const WebSocket = require('ws');
const { GuildConfig, UserEconomy, CustomBind, BindCooldown, ActiveBounty, BountyCooldown } = require('../database/db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const bindHandler = require('../handlers/bindHandler');

const activeConnections = new Map();
const adminPosQueue = new Map(); 

// --- EMBEDDED RUST EVENT PARSER ---
function registerEventParser(rconMock, emit) {
    rconMock.on('message', (msg) => {
        if (!msg || !msg.message) return;
        const line = msg.message.toLowerCase();

        if (line.includes("cargo ship") && line.includes("docked")) emit("cargoDocked", { raw: msg.message, timestamp: Date.now() });
        if (line.includes("supply_drop") || line.includes("supply drop")) emit("supplyDrop", { raw: msg.message, timestamp: Date.now() });
        if (line.includes("locked crate") && line.includes("hack started")) emit("lockedCrateHackStart", { raw: msg.message, timestamp: Date.now() });
        if (line.includes("locked crate") && line.includes("hack completed")) emit("lockedCrateHackFinish", { raw: msg.message, timestamp: Date.now() });
        if (line.includes("spawned") && line.includes("crate_elite")) emit("eliteCrate", { raw: msg.message, timestamp: Date.now() });
    });
}

async function connectRcon(guildId, client) {
    const config = await GuildConfig.findOne({ where: { guildId: guildId } });
    if (!config || !config.rconIp || !config.rconPort || !config.rconPassword) throw new Error("Missing RCON credentials!");
    if (activeConnections.has(guildId)) return "Already connected!";

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://${config.rconIp}:${config.rconPort}/${encodeURIComponent(config.rconPassword)}`);
        const timeout = setTimeout(() => { ws.close(); reject(new Error("Connection timed out.")); }, 10000);

        ws.on('open', () => {
            clearTimeout(timeout);
            activeConnections.set(guildId, ws);
            resolve("Connection established!");
        });
        ws.on('close', () => activeConnections.delete(guildId));
        ws.on('error', () => { clearTimeout(timeout); activeConnections.delete(guildId); });

        const eventEmitterCallback = async (eventName, data) => {
            try {
                const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });
                if (!client) return;
                const guild = client.guilds.cache.get(guildId);
                if (!currentConfig || !currentConfig.logGameChannelId || !guild) return;

                const channel = guild.channels.cache.get(currentConfig.logGameChannelId);
                if (!channel) return;

                if (eventName === "cargoDocked") await channel.send("🚢 **Cargo Ship has docked!**").catch(() => {});
                if (eventName === "supplyDrop") await channel.send("📦 **Supply Drop detected!**").catch(() => {});
                if (eventName === "lockedCrateHackStart") await channel.send("🔓 **Locked Crate hack has started!**").catch(() => {});
                if (eventName === "lockedCrateHackFinish") await channel.send("✅ **Locked Crate hack completed!**").catch(() => {});
                if (eventName === "eliteCrate") await channel.send("💎 **Elite Crate spawned!**").catch(() => {});
            } catch (err) {}
        };

        registerEventParser({
            on: (event, cb) => {
                if (event === 'message') {
                    ws.on('message', (raw) => {
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed && parsed.Message) cb({ message: parsed.Message });
                        } catch (e) {}
                    });
                }
            }
        }, eventEmitterCallback);

        ws.on('message', async (data) => {
            try {
                const parsed = JSON.parse(data);
                if (!parsed || !parsed.Message) return;
                const msg = parsed.Message;
                const msgLower = msg.toLowerCase();

                const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });
                const guild = client ? client.guilds.cache.get(guildId) : null;

                // ==========================================
                // 1. RUST CONSOLE POSITION INTERCEPTOR
                // ==========================================
                if (adminPosQueue.size > 0) {
                    for (const [adminId, setupData] of adminPosQueue.entries()) {
                        
                        // Check for numbers matching coordinate formats
                        const matches = msg.match(/-?\d+\.\d+/g);
                        
                        // We found 3 coordinates!
                        if (matches && matches.length >= 3) {
                            if (setupData.timeoutTimer) clearTimeout(setupData.timeoutTimer);
                            const channel = client ? client.channels.cache.get(setupData.channelId) : null;

                            let posX = parseFloat(matches[0]).toFixed(2);
                            let posY = parseFloat(matches[1]).toFixed(2);
                            let posZ = parseFloat(matches[2]).toFixed(2);

                            if (setupData.type === 'auto_event') {
                                const aeHandler = require('../handlers/autoEventsHandler');
                                if (aeHandler && aeHandler.autoSaveLocation) {
                                    await aeHandler.autoSaveLocation(guildId, posX, posY, posZ);
                                }
                            } else {
                                await bindHandler.autoSavePosition(guildId, posX, posY, posZ);
                            }

                            if (channel) {
                                channel.send({ content: `✅ <@${setupData.adminId}> **Position Captured Successfully!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\`\n*Return to your Discord panel to test or save.*` }).catch(()=>{});
                            }
                            adminPosQueue.delete(adminId);
                            break;
                        }
                    }
                }

                // ==========================================
                // 2. LIVE GAME FEEDS & AUDIT LOGS
                // ==========================================
                if (currentConfig && guild) {
                    if (/(giving |spawned |teleport|kick |ban |inventory\.giveto)/i.test(msg)) {
                        if (currentConfig.logAdminChannelId) {
                            const chan = guild.channels.cache.get(currentConfig.logAdminChannelId);
                            if (chan) chan.send({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(`🛠️ **Admin / System Action:**\n\`\`\`${msg}\`\`\``).setTimestamp()] }).catch(()=>{});
                        }
                    }
                    if (/(Cargo Ship|Patrol Helicopter|Airdrop|Bradley APC|Locked Crate)/i.test(msg)) {
                        if (currentConfig.logGameChannelId) {
                            const chan = guild.channels.cache.get(currentConfig.logGameChannelId);
                            if (chan) chan.send({ embeds: [new EmbedBuilder().setColor('#9b59b6').setDescription(`🌍 **World Event:**\n\`\`\`${msg}\`\`\``).setTimestamp()] }).catch(()=>{});
                        }
                    }
                }

                // ==========================================
                // 3. KILLFEED & BOUNTIES
                // ==========================================
                if ((msgLower.includes('killed') || msgLower.includes('murdered') || msgLower.includes('suicide') || msgLower.includes('died') || msgLower.includes('slain')) && !msg.includes('[Killfeed]')) {
                    await sendRconCommand(guildId, `say "[Killfeed] ${msg}"`, client);
                    let embedColor = '#e74c3c';
                    let killType = '⚔️ PvP Combat';

                    if (msgLower.includes('scientist') || msgLower.includes('boar') || msgLower.includes('bear') || msgLower.includes('wolf') || msgLower.includes('fall') || msgLower.includes('drown') || msgLower.includes('fire') || msgLower.includes('radiation')) {
                        embedColor = '#3498db';
                        killType = '🐻 PvE / Environmental';
                    } else if (msgLower.includes('suicide')) {
                        embedColor = '#95a5a6';
                        killType = '💀 Suicide';
                    }

                    let killerDb = null;
                    let victimDb = null;
                    const playersList = await UserEconomy.findAll({ where: { guildId: guildId } });

                    for (const p of playersList) {
                        if (p.inGameName && msg.includes(p.inGameName)) {
                            if (msgLower.includes('killed') && msg.indexOf(p.inGameName) < msg.indexOf('killed')) {
                                if (killType.includes('PvP')) {
                                    await p.update({ pvpKills: (p.pvpKills || 0) + 1 });
                                    killerDb = p; 
                                } else {
                                    await p.update({ pveKills: (p.pveKills || 0) + 1 });
                                }
                            } else if (msgLower.includes('killed') || msgLower.includes('murdered')) {
                                await p.update({ deaths: (p.deaths || 0) + 1, currentKillstreak: 0 });
                                victimDb = p; 
                            }
                        }
                    }

                    if (currentConfig && currentConfig.killfeedChannelId && client) {
                        const killfeedChannel = client.channels.cache.get(currentConfig.killfeedChannelId);
                        if (killfeedChannel) {
                            killfeedChannel.send({ embeds: [new EmbedBuilder().setTitle(killType).setDescription(`\`\`\`fix\n${msg}\`\`\``).setColor(embedColor).setTimestamp()] }).catch(() => {});
                        }
                    }

                    if (killerDb && victimDb && killerDb.userId !== victimDb.userId) {
                        await processBountyLogic(guildId, killerDb, victimDb, client, currentConfig);
                    }
                }

                // ==========================================
                // 4. CHAT PARSER & CUSTOM BINDS
                // ==========================================
                if (msgLower.includes('[chat]')) {
                    const chatMatch = msg.match(/\[CHAT\] (.*?): (.*)/i);
                    if (chatMatch) {
                        const playerName = chatMatch[1].replace(/\[.*?\]/g, '').trim(); 
                        const chatText = chatMatch[2].toLowerCase();

                        if (currentConfig && currentConfig.crossChatChannelId && client) {
                            const crossChatChannel = client.channels.cache.get(currentConfig.crossChatChannelId);
                            if (crossChatChannel && !playerName.includes('[Discord]')) {
                                crossChatChannel.send(`💬 **[In-Game] ${playerName}**: ${chatText}`);
                            }
                        }

                        const serverBinds = await CustomBind.findAll({ where: { guildId: guildId } });
                        const activeBind = serverBinds.find(b => b.emote.toLowerCase() === chatText || b.name.toLowerCase() === chatText || b.targetValue?.toLowerCase() === chatText);
                        
                        if (activeBind) {
                            const userProfile = await UserEconomy.findOne({ where: { guildId: guildId, inGameName: playerName } });
                            if (activeBind.cost > 0 && (!userProfile || userProfile.wallet < activeBind.cost)) return;
                            if (activeBind.cost > 0) await userProfile.update({ wallet: userProfile.wallet - activeBind.cost });

                            const finalCommandString = activeBind.command.replace(/{player}/gi, `"${playerName}"`);
                            const commands = finalCommandString.split('\n');
                            for (const cmd of commands) {
                                if (cmd.trim() !== '') await sendRconCommand(guildId, cmd.trim(), client);
                            }
                        }
                    }
                }
            } catch (e) {}
        });
    });
}

// Updated to guarantee client is passed so it can reconnect safely
async function sendRconCommand(guildId, commandStr, client = null) {
    let ws = activeConnections.get(guildId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
            await connectRcon(guildId, client || global.discordClient); 
            ws = activeConnections.get(guildId);
        } catch (e) {
            console.error("[RCON CONNECTION FAILED]", e.message);
        }
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected to RCON.");
    }
    ws.send(JSON.stringify({ Identifier: 1, Message: commandStr, Name: "BuddyBot" }));
    return true;
}

// === UPDATED QUEUE ADMIN POS ===
async function queueAdminPos(interaction, type = 'custom_bind') {
    const guildId = interaction.guild.id;
    const adminId = interaction.user.id;
    const channelId = interaction.channelId;
    const client = interaction.client;

    if (adminPosQueue.has(adminId)) {
        const old = adminPosQueue.get(adminId);
        if (old.timeoutTimer) clearTimeout(old.timeoutTimer);
    }

    // Give the admin 20 FULL SECONDS to type the command in-game
    const timeoutTimer = setTimeout(async () => {
        if (adminPosQueue.has(adminId)) {
            adminPosQueue.delete(adminId);
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                channel.send({ content: `<@${adminId}> ⚠️ **Position capture timed out!** You must type \`printpos\` in your in-game console before the 20-second timer runs out.` }).catch(()=>{});
            }
        }
    }, 20000);

    adminPosQueue.set(adminId, { guildId, adminId, channelId, type, timeoutTimer });
}

async function triggerCustomEvent(guildId, eventType, data = {}) {
    if (eventType === 'supply_drop') return await sendRconCommand(guildId, 'supply.drop');
    if (eventType === 'elite_crate') return await sendRconCommand(guildId, 'spawn codelockedhackablecrate');
    if (eventType === 'timed_crate') return await sendRconCommand(guildId, 'spawn hackablelockedcrate');
    if (eventType === 'docked_cargo') {
        const config = await GuildConfig.findOne({ where: { guildId } });
        if (config && config.cargoDockX !== null && config.cargoDockY !== null && config.cargoDockZ !== null) {
            const coords = `${config.cargoDockX},${config.cargoDockY},${config.cargoDockZ}`;
            return await sendRconCommand(guildId, `spawn cargoshipdynamic1 ${coords}`);
        }
        return await sendRconCommand(guildId, 'cargoships.spawncargoship');
    }
    throw new Error('Unknown custom event type.');
}

async function processBountyLogic(guildId, killerDb, victimDb, client, config) {
    const currency = config.economyCurrency || 'Scrap';
    const guild = client.guilds.cache.get(guildId);
    const gameChannel = config.logGameChannelId ? guild?.channels.cache.get(config.logGameChannelId) : null;

    await killerDb.update({ currentKillstreak: (killerDb.currentKillstreak || 0) + 1 });

    if (killerDb.currentKillstreak >= (config.bountyKillsToActivate || 5)) {
        const cd = await BountyCooldown.findOne({ where: { guildId, userId: killerDb.userId } });
        const now = new Date();
        
        if (!cd || cd.expiresAt < now) {
            const existingBounty = await ActiveBounty.findOne({ where: { guildId, userId: killerDb.userId } });
            
            if (!existingBounty) {
                await ActiveBounty.create({ guildId, userId: killerDb.userId, inGameName: killerDb.inGameName, reward: config.bountyRewardAmount || 500 });
                const cdTime = new Date(now.getTime() + (config.bountyCooldownMinutes || 60) * 60000);
                await BountyCooldown.upsert({ guildId, userId: killerDb.userId, expiresAt: cdTime });

                if (gameChannel) {
                    gameChannel.send({ embeds: [new EmbedBuilder().setTitle('🎯 BOUNTY PLACED!').setDescription(`**${killerDb.inGameName}** is unstoppable on a **${killerDb.currentKillstreak} killstreak**!\n\nA bounty of **${config.bountyRewardAmount || 500} ${currency}** has been placed on their head!`).setColor('#e74c3c')] }).catch(()=>{});
                }
            }
        }
    }

    const activeBounty = await ActiveBounty.findOne({ where: { guildId, userId: victimDb.userId } });
    if (activeBounty) {
        await killerDb.update({ wallet: killerDb.wallet + activeBounty.reward });
        if (gameChannel) {
            gameChannel.send({ embeds: [new EmbedBuilder().setTitle('🎯 BOUNTY CLAIMED!').setDescription(`**${killerDb.inGameName}** has killed **${victimDb.inGameName}** and claimed the bounty of **${activeBounty.reward} ${currency}**!`).setColor('#2ecc71')] }).catch(()=>{});
        }
        await activeBounty.destroy();
    }
}

module.exports = { connectRcon, sendRconCommand, triggerCustomEvent, activeConnections, adminPosQueue, queueAdminPos };