const WebSocket = require('ws');
const { GuildConfig, UserEconomy, CustomBind, BindCooldown, ActiveBounty, BountyCooldown } = require('../database/db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const bindHandler = require('../handlers/bindHandler');

const activeConnections = new Map();
const adminPosQueue = new Map(); 

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

        ws.on('message', async (data) => {
            try {
                const parsed = JSON.parse(data);
                if (!parsed || !parsed.Message) return;
                const msg = parsed.Message;
                const msgLower = msg.toLowerCase();

                console.log('[RCON RAW MESSAGE]', msg);

                const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });
                const guild = client.guilds.cache.get(guildId);

                // ==========================================
                // LIVE GAME FEEDS & ADMIN AUDIT LOGS
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

                // 1. ROBUST ADMIN POSITION QUEUE INTERCEPTOR
                if (adminPosQueue.size > 0) {
                    // Check if message contains numbers or player details
                    const matches = msg.match(/-?\d+\.\d+/g);
                    if (matches && matches.length >= 3) {
                        for (const [adminName, setupData] of adminPosQueue.entries()) {
                            // If message references the admin or contains valid coordinate vectors
                            if (msg.includes(adminName) || matches.length >= 3) {
                                if (setupData.timeoutTimer) clearTimeout(setupData.timeoutTimer);
                                const channel = client.channels.cache.get(setupData.channelId);

                                let posX = parseFloat(matches[0]);
                                let posY = parseFloat(matches[1]);
                                let posZ = parseFloat(matches[2]);

                                if (channel) {
                                    // Inside rconManager.js position listener:
if (setupData.type === 'zone' || setupData.type === 'custom_bind') {
    await bindHandler.autoSavePosition(guildId, posX.toFixed(2), posY.toFixed(2), posZ.toFixed(2));
    channel.send({ content: `✅ <@${setupData.adminId}> **Position Captured Successfully!**\nCoordinates: \`X: ${posX.toFixed(2)}, Y: ${posY.toFixed(2)}, Z: ${posZ.toFixed(2)}\`\n*Return to your Discord panel to continue.*` }).catch(()=>{});
}
 else {
                                        const coords = `${posX.toFixed(2)}_${posY.toFixed(2)}_${posZ.toFixed(2)}`;
                                        const row = new ActionRowBuilder().addComponents(
                                            new ButtonBuilder().setCustomId(`btn_finalize_tpl_${setupData.type}_${coords}`).setLabel('📍 Finalize Setup').setStyle(ButtonStyle.Success),
                                            new ButtonBuilder().setCustomId('btn_dismiss_coord').setLabel('❌ Dismiss').setStyle(ButtonStyle.Secondary)
                                        );
                                        channel.send({ content: `<@${setupData.adminId}> 📍 Coordinates grabbed: **${posX.toFixed(2)}, ${posY.toFixed(2)}, ${posZ.toFixed(2)}**`, components: [row] });
                                    }
                                }
                                adminPosQueue.delete(adminName);
                                break;
                            }
                        }
                    }
                }

                // 2. KILLFEED & BOUNTIES
                if ((msgLower.includes('killed') || msgLower.includes('murdered') || msgLower.includes('suicide') || msgLower.includes('died') || msgLower.includes('slain')) && !msg.includes('[Killfeed]')) {
                    await sendRconCommand(guildId, `say "[Killfeed] ${msg}"`);
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

                    if (currentConfig && currentConfig.killfeedChannelId) {
                        const killfeedChannel = client.channels.cache.get(currentConfig.killfeedChannelId);
                        if (killfeedChannel) {
                            killfeedChannel.send({ embeds: [new EmbedBuilder().setTitle(killType).setDescription(`\`\`\`fix\n${msg}\`\`\``).setColor(embedColor).setTimestamp()] }).catch(() => {});
                        }
                    }

                    if (killerDb && victimDb && killerDb.userId !== victimDb.userId) {
                        await processBountyLogic(guildId, killerDb, victimDb, client, currentConfig);
                    }
                }

                // 3. CHAT PARSER & CUSTOM BINDS EXECUTION
                if (msgLower.includes('[chat]')) {
                    const chatMatch = msg.match(/\[CHAT\] (.*?): (.*)/i);
                    if (chatMatch) {
                        const playerName = chatMatch[1].replace(/\[.*?\]/g, '').trim(); 
                        const chatText = chatMatch[2].toLowerCase();

                        if (currentConfig && currentConfig.crossChatChannelId) {
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
                                if (cmd.trim() !== '') await sendRconCommand(guildId, cmd.trim());
                            }
                        }
                    }
                }
            } catch (e) {}
        });
    });
}

async function sendRconCommand(guildId, commandStr) {
    let ws = activeConnections.get(guildId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
            await connectRcon(guildId, global.discordClient); 
            ws = activeConnections.get(guildId);
        } catch (e) {}
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected to RCON.");
    }
    ws.send(JSON.stringify({ Identifier: 1, Message: commandStr, Name: "BuddyBot" }));
    return true;
}
     // Inside ws.on('message', ...) position listener:
if (adminPosQueue.size > 0) {
    // Matches any floating point numbers or vector patterns (e.g., (100.5, 50.0, -200.1) or 100.5 50.0 -200.1)
    const matches = msg.match(/-?\d+\.\d+/g);
    if (matches && matches.length >= 3) {
        for (const [adminName, setupData] of adminPosQueue.entries()) {
            if (setupData.timeoutTimer) clearTimeout(setupData.timeoutTimer);
            const channel = client.channels.cache.get(setupData.channelId);

            let posX = parseFloat(matches[0]);
            let posY = parseFloat(matches[1]);
            let posZ = parseFloat(matches[2]);

            if (channel) {
                await bindHandler.autoSavePosition(guildId, posX.toFixed(2), posY.toFixed(2), posZ.toFixed(2));
                channel.send({ content: `✅ <@${setupData.adminId}> **Position Captured!**\nCoordinates: \`X: ${posX.toFixed(2)}, Y: ${posY.toFixed(2)}, Z: ${posZ.toFixed(2)}\`\n*Return to your Discord panel to finish.*` }).catch(()=>{});
            }
            adminPosQueue.delete(adminName);
            break;
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