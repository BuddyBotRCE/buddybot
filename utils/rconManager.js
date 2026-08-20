const WebSocket = require('ws');
const { GuildConfig, UserEconomy, CustomBind, BindCooldown } = require('../database/db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const activeConnections = new Map();
const homeSetQueue = new Map();
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

             // 1. CONSOLE-OPTIMIZED POSITION TRACKER (No SteamID required)
                if (msg.includes('DisplayName') || msg.includes('name') || msg.includes('pos') || msg.includes('Position') || msg.trim().startsWith('[')) {
                    try {
                        const players = JSON.parse(msg);
                        if (!Array.isArray(players)) return;

                        for (const p of players) {
                            // Catch console display names (Xbox gamertags, PSN names, or in-game names)
                            const name = p.DisplayName || p.name || p.Username || '';
                            
                            let matchedAdminName = null;
                            for (const queuedName of adminPosQueue.keys()) {
                                if (name.toLowerCase().includes(queuedName.toLowerCase())) {
                                    matchedAdminName = queuedName;
                                    break;
                                }
                            }

                            if (matchedAdminName) {
                                const setupData = adminPosQueue.get(matchedAdminName);
                                if (setupData.timeoutTimer) clearTimeout(setupData.timeoutTimer);

                                const channel = client.channels.cache.get(setupData.channelId);
                                
                                // Catch position keys sent by console RCON
                                const pos = p.Position || p.pos || p.position;

                                if (channel && pos) {
                                    const posX = pos.x ?? pos[0] ?? 0;
                                    const posY = pos.y ?? pos[1] ?? 0;
                                    const posZ = pos.z ?? pos[2] ?? 0;

                                    if (setupData.type === 'cargodock') {
                                        await GuildConfig.upsert({ guildId: guildId, cargoDockX: posX, cargoDockY: posY, cargoDockZ: posZ });
                                        channel.send({ content: `✅ <@${setupData.adminId}> **Cargo Dock Position Saved!**\nCoordinates: \`X: ${posX.toFixed(2)}, Y: ${posY.toFixed(2)}, Z: ${posZ.toFixed(2)}\`` });
                                    } else {
                                        const coords = `${posX.toFixed(2)}_${posY.toFixed(2)}_${posZ.toFixed(2)}`;
                                        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`btn_finalize_tpl_${setupData.type}_${coords}`).setLabel('📍 Finalize Setup').setStyle(ButtonStyle.Success));
                                        channel.send({ content: `<@${setupData.adminId}> 📍 Coordinates grabbed: **${posX.toFixed(2)}, ${posY.toFixed(2)}, ${posZ.toFixed(2)}**\nClick below to finish!`, components: [row] });
                                    }
                                }
                                adminPosQueue.delete(matchedAdminName);
                            }

                            let matchedHomeName = null;
                            for (const queuedName of homeSetQueue.keys()) {
                                if (name.toLowerCase().includes(queuedName.toLowerCase())) {
                                    matchedHomeName = queuedName;
                                    break;
                                }
                            }

                            if (matchedHomeName) {
                                const gid = homeSetQueue.get(matchedHomeName);
                                const userProfile = await UserEconomy.findOne({ where: { guildId: gid, inGameName: matchedHomeName } });
                                if (userProfile && p.Position) {
                                    const homePos = p.Position;
                                    await userProfile.update({ homeX: homePos.x ?? homePos[0], homeY: homePos.y ?? homePos[1], homeZ: homePos.z ?? homePos[2] });
                                    await sendRconCommand(gid, `say "[BuddyBot] ${name}, Base Location saved!"`);
                                }
                                homeSetQueue.delete(matchedHomeName);
                            }
                        }
                    } catch (err) {
                        // Safe ignore for non-playerlist RCON messages
                    }
                    return; 
                }

                // 2. CHAT PARSER
                if (msgLower.includes('[chat]')) {
                    const chatMatch = msg.match(/\[CHAT\] (.*?): (.*)/i);
                    if (chatMatch) {
                        const playerName = chatMatch[1].replace(/\[.*?\]/g, '').trim(); 
                        const chatText = chatMatch[2].toLowerCase();
                        const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });

                        if (currentConfig && currentConfig.crossChatChannelId) {
                            const crossChatChannel = client.channels.cache.get(currentConfig.crossChatChannelId);
                            if (crossChatChannel && !playerName.includes('[Discord]')) {
                                crossChatChannel.send(`💬 **[In-Game] ${playerName}**: ${chatText}`);
                            }
                        }

                        if (currentConfig && currentConfig.isPremiumServer) {
                            if (chatText.includes('can i have a key')) {
                                homeSetQueue.set(playerName, guildId);
                                await sendRconCommand(guildId, 'playerlist'); 
                            }
                            if (chatText.includes('retreat')) {
                                const userProfile = await UserEconomy.findOne({ where: { guildId: guildId, inGameName: playerName } });
                                if (userProfile && userProfile.homeX !== null) {
                                    await sendRconCommand(guildId, `teleportpos "${playerName}" ${userProfile.homeX},${userProfile.homeY},${userProfile.homeZ}`);
                                    sendRconCommand(guildId, `say "[BuddyBot] Teleporting ${playerName} to Base!"`);
                                }
                            }
                        }

                        const serverBinds = await CustomBind.findAll({ where: { guildId: guildId } });
                        const activeBind = serverBinds.find(b => b.emote.toLowerCase() === chatText);
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
    
    // If not connected, force an instant connection and wait for it
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
            await connectRcon(guildId, global.discordClient); 
            ws = activeConnections.get(guildId);
        } catch (e) {
            // If connection fails entirely
        }
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected to RCON. Please go to the RCON Server admin panel and click 'Connect RCON' first.");
    }

    ws.send(JSON.stringify({ Identifier: 1, Message: commandStr, Name: "BuddyBot" }));
    return true;
}
// Helper to hook into admin position queues with a 5-second anti-hang timeout safety net
function queueAdminPos(adminName, guildId, adminId, channelId, type, client) {
    if (adminPosQueue.has(adminName)) {
        const old = adminPosQueue.get(adminName);
        if (old.timeoutTimer) clearTimeout(old.timeoutTimer);
    }

    const timeoutTimer = setTimeout(async () => {
        if (adminPosQueue.has(adminName)) {
            adminPosQueue.delete(adminName);
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                // Fallback coordinates if server doesn't respond with a vector array
                const fallbackX = 0, fallbackY = 50, fallbackZ = 0;
                if (type === 'cargodock') {
                    await GuildConfig.upsert({ guildId: guildId, cargoDockX: fallbackX, cargoDockY: fallbackY, cargoDockZ: fallbackZ });
                    channel.send({ content: `⚠️ <@${adminId}> RCON position timed out. Default Cargo Dock position set (X: 0, Y: 50, Z: 0).` });
                } else {
                    const coords = `${fallbackX}_${fallbackY}_${fallbackZ}`;
                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`btn_finalize_tpl_${type}_${coords}`).setLabel('📍 Finalize Setup').setStyle(ButtonStyle.Success));
                    channel.send({ content: `<@${adminId}> ⚠️ RCON coordinate response timed out. Click below to use default center coordinates (0, 50, 0):`, components: [row] });
                }
            }
        }
    }, 5000); // 5-second safety timer

    adminPosQueue.set(adminName, { guildId, adminId, channelId, type, timeoutTimer });
}

async function triggerCustomEvent(guildId, eventType, data = {}) {
    if (eventType === 'supply_drop') return await sendRconCommand(guildId, 'supply.drop');
    if (eventType === 'elite_crate') return await sendRconCommand(guildId, 'spawn codelockedhackablecrate');
    if (eventType === 'timed_crate') return await sendRconCommand(guildId, 'spawn hackablelockedcrate');
    if (eventType === 'docked_cargo') {
        const config = await GuildConfig.findOne({ where: { guildId } });
        if (config && config.cargoDockX !== null && config.cargoDockY !== null && config.cargoDockZ !== null) {
            return await sendRconCommand(guildId, `spawn cargoship ${config.cargoDockX} ${config.cargoDockY} ${config.cargoDockZ}`);
        }
        return await sendRconCommand(guildId, 'event_cargoship');
    }
    throw new Error('Unknown custom event type.');
}

module.exports = { connectRcon, sendRconCommand, triggerCustomEvent, activeConnections, adminPosQueue, queueAdminPos };