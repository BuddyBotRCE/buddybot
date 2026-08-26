const WebSocket = require('ws');
const { GuildConfig, UserEconomy, CustomBind, BindCooldown, ActiveBounty, BountyCooldown } = require('../database/db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const activeConnections = new Map();
const adminPosQueue = new Map(); 

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
                // 1. ADVANCED POSITION INTERCEPTOR
                // ==========================================
                if (adminPosQueue.size > 0) {
                    for (const [adminId, setupData] of adminPosQueue.entries()) {
                        
                        let posX, posY, posZ;
                        let foundPos = false;

                        const nakedCoordMatch = msg.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
                        if (nakedCoordMatch) {
                            posX = parseFloat(nakedCoordMatch[1]).toFixed(2);
                            posY = parseFloat(nakedCoordMatch[2]).toFixed(2);
                            posZ = parseFloat(nakedCoordMatch[3]).toFixed(2);
                            foundPos = true;
                        }

                        if (!foundPos && msgLower.includes(setupData.inGameName.toLowerCase()) && msgLower.includes('teleport')) {
                            const matches = msg.match(/-?\d+(\.\d+)?/g);
                            if (matches && matches.length >= 3) {
                                const len = matches.length;
                                posX = parseFloat(matches[len-3]).toFixed(2);
                                posY = parseFloat(matches[len-2]).toFixed(2);
                                posZ = parseFloat(matches[len-1]).toFixed(2);
                                foundPos = true;
                            }
                        }

                        if (foundPos) {
                            if (setupData.timeoutTimer) clearTimeout(setupData.timeoutTimer);

                            if (setupData.type === 'auto_event') {
                                const aeHandler = require('../handlers/autoEventsHandler');
                                if (aeHandler && aeHandler.autoSaveLocation) {
                                    await aeHandler.autoSaveLocation(guildId, posX, posY, posZ, setupData.targetId);
                                    if (setupData.interaction) {
                                        await aeHandler.refreshPanelViaInteraction(
                                            setupData.interaction, 
                                            `✅ **Position Captured Automatically!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\``
                                        );
                                    }
                                }
                            } 
                            else if (setupData.type === 'custom_zone') {
                                const czHandler = require('../handlers/customZoneHandler');
                                if (czHandler && czHandler.autoSaveLocation) {
                                    await czHandler.autoSaveLocation(guildId, posX, posY, posZ, setupData.targetId);
                                    if (setupData.interaction) {
                                        await czHandler.refreshPanelViaInteraction(
                                            setupData.interaction, 
                                            `✅ **Zone Center Captured Automatically!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\``,
                                            setupData.targetId
                                        );
                                    }
                                }
                            } 
                            else if (setupData.type === 'custom_bind') {
                                try {
                                    console.log(`[DEBUG-BINDS] Saving Coords to Bind ID ${setupData.targetId}: X:${posX}, Y:${posY}, Z:${posZ}`);
                                    const bind = await CustomBind.findByPk(setupData.targetId);
                                    
                                    if (bind) {
                                        let command = '';
                                        if (bind.actionType === 'teleport') {
                                            // 👈 Corrected back to RCE standard 'teleportpos'
                                            command = `teleportpos "{player}" ${posX} ${posY} ${posZ}`;
                                        } else if (bind.actionType === 'recycler') {
                                            command = `spawn recycler_static ${posX} ${posY} ${posZ}`;
                                        }
                                        await bind.update({ command });
                                        console.log(`[DEBUG-BINDS] Successfully updated DB Command: ${command}`);
                                    } else {
                                        console.error(`[DEBUG-BINDS] Could not find Bind ID ${setupData.targetId} in DB!`);
                                    }

                                    const bindHandler = require('../handlers/bindHandler');
                                    if (bindHandler && bindHandler.refreshPanelViaInteraction) {
                                        await bindHandler.refreshPanelViaInteraction(
                                            setupData.interaction, 
                                            `✅ **Position Captured Automatically!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\``,
                                            setupData.targetId
                                        );
                                    }
                                } catch (error) {
                                    console.error("[DEBUG-BINDS] Error saving bind position:", error);
                                }
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
                // 4. CHAT PARSER & CUSTOM BINDS EXECUTION (BULLETPROOF RCE)
                // ==========================================
                // Looks for any log with a colon that isn't a killfeed or system message
                if (msg.includes(':') && !msgLower.includes('[killfeed]') && !msgLower.includes('rcon')) {
                    const parts = msg.split(':');
                    const leftSide = parts[0]; 
                    const chatText = parts.slice(1).join(':').toLowerCase().trim();

                    // Handle Cross-Chat if it's explicitly global chat
                    if (msgLower.includes('[chat]') && currentConfig && currentConfig.crossChatChannelId && client) {
                        const crossChatChannel = client.channels.cache.get(currentConfig.crossChatChannelId);
                        const chatMatch = msg.match(/\[(.*?)\]\s*(.*?)\s*:\s*(.*)/i);
                        if (chatMatch && crossChatChannel && !chatMatch[2].includes('[Discord]')) {
                            const pName = chatMatch[2].replace(/\[.*?\]/g, '').trim(); 
                            crossChatChannel.send(`💬 **[In-Game] ${pName}**: ${chatText}`);
                        }
                    }

                    // Check if chat matches a Bind
                    const serverBinds = await CustomBind.findAll({ where: { guildId: guildId } });
                    const activeBind = serverBinds.find(b => 
                        (b.targetValue && chatText.includes(b.targetValue.toLowerCase())) || 
                        (b.name && chatText.includes(b.name.toLowerCase()))
                    );
                    
                    if (activeBind) {
                        // Bind matches! Now, did a registered player say it?
                        const playersList = await UserEconomy.findAll({ where: { guildId: guildId } });
                        let matchedPlayer = null;
                        
                        for (const p of playersList) {
                            // Check if the left side of the colon contains their in-game name
                            if (p.inGameName && leftSide.toLowerCase().includes(p.inGameName.toLowerCase())) {
                                matchedPlayer = p;
                                break;
                            }
                        }

                        if (matchedPlayer) {
                            console.log(`[DEBUG-BINDS] Matched Wheel Emote: "${chatText}" to Bind ID ${activeBind.id} for ${matchedPlayer.inGameName}`);
                            
                            if (activeBind.cost > 0 && matchedPlayer.wallet < activeBind.cost) {
                                await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you need ${activeBind.cost} ${currentConfig?.economyCurrency || 'Scrap'} to use this!"`, client);
                                return;
                            }
                            
                            if (activeBind.cost > 0) {
                                await matchedPlayer.update({ wallet: matchedPlayer.wallet - activeBind.cost });
                            }

                            const finalCommandString = activeBind.command.replace(/{player}/gi, matchedPlayer.inGameName);
                            const commands = finalCommandString.split('\n');
                            for (const cmd of commands) {
                                if (cmd.trim() !== '') {
                                    console.log(`[DEBUG-BINDS] Executing Command: ${cmd.trim()}`);
                                    await sendRconCommand(guildId, cmd.trim(), client);
                                }
                            }
                        }
                    }
                }
            } catch (e) {}
        });
    });
}

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

async function queueAdminPos(interaction, type = 'custom_bind', targetId = null) {
    const guildId = interaction.guild.id;
    const adminId = interaction.user.id;
    const client = interaction.client;

    const userProfile = await UserEconomy.findOne({ where: { userId: adminId } });

    if (!userProfile || !userProfile.inGameName) {
        const handler = type === 'custom_zone' ? require('../handlers/customZoneHandler') : require('../handlers/bindHandler');
        if (handler && handler.refreshPanelViaInteraction) {
            await handler.refreshPanelViaInteraction(interaction, `❌ **Missing In-Game Name!**\nPlease use the \`/playerpanel\` to link your in-game name first!`, targetId);
        }
        return;
    }

    const inGameName = userProfile.inGameName;

    if (adminPosQueue.has(adminId)) {
        clearTimeout(adminPosQueue.get(adminId).timeoutTimer);
    }

    const timeoutTimer = setTimeout(async () => {
        if (adminPosQueue.has(adminId)) {
            const data = adminPosQueue.get(adminId);
            adminPosQueue.delete(adminId);
            if (data.interaction) {
                const handler = data.type === 'custom_zone' ? require('../handlers/customZoneHandler') : require('../handlers/bindHandler');
                if (handler && handler.refreshPanelViaInteraction) {
                    await handler.refreshPanelViaInteraction(data.interaction, `⚠️ **Auto-Scan Failed.**\nPlease ensure your server is online, and that you are actively spawned into the game as \`${inGameName}\`.`, data.targetId);
                }
            }
        }
    }, 8000);

    adminPosQueue.set(adminId, { guildId, adminId, type, timeoutTimer, inGameName, targetId, interaction });
    
    try {
        await sendRconCommand(guildId, `printpos "${inGameName}"`, client);
    } catch (err) {
        const handler = type === 'custom_zone' ? require('../handlers/customZoneHandler') : require('../handlers/bindHandler');
        if (handler && handler.refreshPanelViaInteraction) {
            await handler.refreshPanelViaInteraction(interaction, `❌ **Failed to connect to RCON.**`, targetId);
        }
        if (adminPosQueue.has(adminId)) {
            clearTimeout(adminPosQueue.get(adminId).timeoutTimer);
            adminPosQueue.delete(adminId);
        }
    }
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