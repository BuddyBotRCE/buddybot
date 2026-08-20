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

                // 1. COORDINATE TRACKER (Fixed Name Matching & Button IDs)
                if (msg.trim().startsWith('[') && msg.includes('SteamID') && msg.includes('Position')) {
                    const players = JSON.parse(msg);
                    for (const p of players) {
                        
                        // FIX 1: Loose matching for names (ignores caps and clan tags)
                        let matchedAdminName = null;
                        for (const queuedName of adminPosQueue.keys()) {
                            if (p.DisplayName.toLowerCase().includes(queuedName.toLowerCase())) {
                                matchedAdminName = queuedName;
                                break;
                            }
                        }

                        if (matchedAdminName) {
                            const setupData = adminPosQueue.get(matchedAdminName);
                            const channel = client.channels.cache.get(setupData.channelId);
                            if (channel && p.Position) {
                                
                                if (setupData.type === 'cargodock') {
                                    await GuildConfig.upsert({ guildId: guildId, cargoDockX: p.Position.x, cargoDockY: p.Position.y, cargoDockZ: p.Position.z });
                                    channel.send({ content: `✅ <@${setupData.adminId}> **Cargo Dock Position Saved!**\nCoordinates: \`X: ${p.Position.x.toFixed(2)}, Y: ${p.Position.y.toFixed(2)}, Z: ${p.Position.z.toFixed(2)}\`` });
                                } else {
                                    const coords = `${p.Position.x.toFixed(2)}_${p.Position.y.toFixed(2)}_${p.Position.z.toFixed(2)}`;
                                    // FIX 2: Added "tpl_" to the button ID so it connects perfectly to interactionCreate.js
                                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`btn_finalize_tpl_${setupData.type}_${coords}`).setLabel('📍 Finalize Setup').setStyle(ButtonStyle.Success));
                                    channel.send({ content: `<@${setupData.adminId}> 📍 Coordinates grabbed: **${p.Position.x.toFixed(2)}, ${p.Position.y.toFixed(2)}, ${p.Position.z.toFixed(2)}**\nClick below to finish!`, components: [row] });
                                }
                            }
                            adminPosQueue.delete(matchedAdminName);
                        }

                        // Loose match for TP home setting
                        let matchedHomeName = null;
                        for (const queuedName of homeSetQueue.keys()) {
                            if (p.DisplayName.toLowerCase().includes(queuedName.toLowerCase())) {
                                matchedHomeName = queuedName;
                                break;
                            }
                        }
                        
                        if (matchedHomeName) {
                            const gid = homeSetQueue.get(matchedHomeName);
                            const userProfile = await UserEconomy.findOne({ where: { guildId: gid, inGameName: matchedHomeName } });
                            if (userProfile && p.Position) {
                                await userProfile.update({ homeX: p.Position.x, homeY: p.Position.y, homeZ: p.Position.z });
                                sendRconCommand(gid, `say "[BuddyBot] ${p.DisplayName}, Base Location saved!"`);
                            }
                            homeSetQueue.delete(matchedHomeName);
                        }
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

                        // A. CROSS-CHAT
                        if (currentConfig && currentConfig.crossChatChannelId) {
                            const crossChatChannel = client.channels.cache.get(currentConfig.crossChatChannelId);
                            if (crossChatChannel && !playerName.includes('[Discord]')) {
                                crossChatChannel.send(`💬 **[In-Game] ${playerName}**: ${chatText}`);
                            }
                        }

                        // B. PREMIUM TP BASE
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

                        // C. CUSTOM BINDS
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
    const ws = activeConnections.get(guildId);
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error("Not connected to RCON.");
    ws.send(JSON.stringify({ Identifier: 1, Message: commandStr, Name: "BuddyBot" }));
    return true;
}

// 3. AUTO-EVENTS CUSTOM SPAWNER 
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

module.exports = { connectRcon, sendRconCommand, triggerCustomEvent, activeConnections, adminPosQueue };