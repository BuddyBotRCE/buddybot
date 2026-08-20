const WebSocket = require('ws');
const { GuildConfig, UserEconomy, CustomBind, BindCooldown } = require('../database/db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

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

                // Ignore standard server error echoes
                if (msgLower.includes('invalid player') || msgLower.includes('unknown command')) return;

                // DEBUG: Log RCON output to terminal
                console.log('[RCON RAW MESSAGE]', msg);

                // 1. POSITION TRACKER FOR `server.printpos` (GPortal RCE)
                if (msg.includes('X:') || msg.includes('pos') || msg.includes('Position') || msgLower.includes('vector') || /(-?\d+\.\d+)/.test(msg)) {
                    for (const [adminName, setupData] of adminPosQueue.entries()) {
                        if (setupData.timeoutTimer) clearTimeout(setupData.timeoutTimer);
                        const channel = client.channels.cache.get(setupData.channelId);

                        if (channel) {
                            let posX = 0.00;
                            let posY = 50.00;
                            let posZ = 0.00;

                            const matches = msg.match(/-?\d+\.\d+/g);
                            if (matches && matches.length >= 3) {
                                posX = parseFloat(matches[0]);
                                posY = parseFloat(matches[1]);
                                posZ = parseFloat(matches[2]);
                            }

                            if (setupData.type === 'cargodock') {
                                await GuildConfig.upsert({ guildId: guildId, cargoDockX: posX, cargoDockY: posY, cargoDockZ: posZ });
                                channel.send({ content: `✅ <@${setupData.adminId}> **Cargo Dock Position Saved!**\nCoordinates: \`X: ${posX.toFixed(2)}, Y: ${posY.toFixed(2)}, Z: ${posZ.toFixed(2)}\`` });
                            } else {
                                const coords = `${posX.toFixed(2)}_${posY.toFixed(2)}_${posZ.toFixed(2)}`;
                                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`btn_finalize_tpl_${setupData.type}_${coords}`).setLabel('📍 Finalize Setup').setStyle(ButtonStyle.Success));
                                channel.send({ content: `<@${setupData.adminId}> 📍 Coordinates grabbed: **${posX.toFixed(2)}, ${posY.toFixed(2)}, ${posZ.toFixed(2)}**\nClick below to finish!`, components: [row] });
                            }
                        }
                        adminPosQueue.delete(adminName);
                        break;
                    }
                }

                // 2. KILLFEED & COMBAT LOG PARSER (Discord & In-Game Broadcast)
                if ((msgLower.includes('killed') || msgLower.includes('murdered') || msgLower.includes('suicide') || msgLower.includes('died') || msgLower.includes('slain')) && !msg.includes('[Killfeed]')) {
                    const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });
                    
                    // Broadcast in-game chat feed
                    await sendRconCommand(guildId, `say "[Killfeed] ${msg}"`);

                    if (currentConfig && currentConfig.killfeedChannelId) {
                        const killfeedChannel = client.channels.cache.get(currentConfig.killfeedChannelId);
                        if (killfeedChannel) {
                            let embedColor = '#e74c3c'; // PvP red
                            let killType = '⚔️ PvP Combat';

                            if (msgLower.includes('scientist') || msgLower.includes('boar') || msgLower.includes('bear') || msgLower.includes('wolf') || msgLower.includes('fall') || msgLower.includes('drown') || msgLower.includes('fire') || msgLower.includes('radiation')) {
                                embedColor = '#3498db'; // PvE blue
                                killType = '🐻 PvE / Environmental';
                            } else if (msgLower.includes('suicide')) {
                                embedColor = '#95a5a6';
                                killType = '💀 Suicide';
                            }

                            // Update K/D database records
                            const players = await UserEconomy.findAll({ where: { guildId: guildId } });
                            for (const p of players) {
                                if (p.inGameName && msg.includes(p.inGameName)) {
                                    if (msgLower.includes('killed') && msg.indexOf(p.inGameName) < msg.indexOf('killed')) {
                                        if (killType.includes('PvP')) {
                                            await p.update({ pvpKills: (p.pvpKills || 0) + 1 });
                                        } else {
                                            await p.update({ pveKills: (p.pveKills || 0) + 1 });
                                        }
                                    } else if (msgLower.includes('killed') || msgLower.includes('murdered')) {
                                        await p.update({ deaths: (p.deaths || 0) + 1 });
                                    }
                                }
                            }

                            const killEmbed = new EmbedBuilder()
                                .setTitle(killType)
                                .setDescription(`\`\`\`fix\n${msg}\`\`\``)
                                .setColor(embedColor)
                                .setTimestamp();

                            killfeedChannel.send({ embeds: [killEmbed] }).catch(() => {});
                        }
                    }
                }

                // 3. CHAT PARSER & CUSTOM BINDS
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
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
            await connectRcon(guildId, global.discordClient); 
            ws = activeConnections.get(guildId);
        } catch (e) {}
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected to RCON. Please go to the RCON Server admin panel and click 'Connect RCON' first.");
    }

    ws.send(JSON.stringify({ Identifier: 1, Message: commandStr, Name: "BuddyBot" }));
    return true;
}

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
                const fallbackX = 0, fallbackY = 50, fallbackZ = 0;
                if (type === 'cargodock') {
                    await GuildConfig.upsert({ guildId: guildId, cargoDockX: fallbackX, cargoDockY: fallbackY, cargoDockZ: fallbackZ });
                    channel.send({ content: `⚠️ <@${adminId}> RCON position timed out. Default position set (X: 0, Y: 50, Z: 0).` });
                } else {
                    const coords = `${fallbackX}_${fallbackY}_${fallbackZ}`;
                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`btn_finalize_tpl_${type}_${coords}`).setLabel('📍 Finalize Setup').setStyle(ButtonStyle.Success));
                    channel.send({ content: `<@${adminId}> ⚠️ RCON coordinate response timed out. Click below to use default center coordinates (0, 50, 0):`, components: [row] });
                }
            }
        }
    }, 5000);

    adminPosQueue.set(adminName, { guildId, adminId, channelId, type, timeoutTimer });

    // Instantly query position via server.printpos for GPortal RCE
    sendRconCommand(guildId, 'server.printpos').catch(() => {});
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