const WebSocket = require('ws');
const { GuildConfig, GameServer, UserEconomy, CustomBind, BindCooldown, ActiveBounty, BountyCooldown, HomeTeleportConfig, HomeTeleportCooldown, HomeTeleportLocation } = require('../database/db');
const { EmbedBuilder } = require('discord.js');
const { processD11Router } = require('./d11ChatHandler'); // Linked to your D11 router

const activeConnections = new Map();
const adminPosQueue = new Map(); 
const homeTpPosQueue = new Map(); 

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

async function connectRcon(guildId, client, targetServerId = null) {
    let rconIp, rconPort, rconPassword;

    if (targetServerId) {
        const specificServer = await GameServer.findByPk(targetServerId);
        if (specificServer && specificServer.rconIp && specificServer.rconPort && specificServer.rconPassword) {
            rconIp = specificServer.rconIp; rconPort = specificServer.rconPort; rconPassword = specificServer.rconPassword;
        }
    }

    if (!rconIp || !rconPort || !rconPassword) {
        const firstGameServer = await GameServer.findOne({ where: { guildId: guildId } });
        if (firstGameServer && firstGameServer.rconIp && firstGameServer.rconPort && firstGameServer.rconPassword) {
            rconIp = firstGameServer.rconIp; rconPort = firstGameServer.rconPort; rconPassword = firstGameServer.rconPassword;
        }
    }

    if (!rconIp || !rconPort || !rconPassword) {
        const config = await GuildConfig.findOne({ where: { guildId: guildId } });
        if (config && config.rconIp && config.rconPort && config.rconPassword) {
            rconIp = config.rconIp; rconPort = config.rconPort; rconPassword = config.rconPassword;
        }
    }

    if (!rconIp || !rconPort || !rconPassword) {
        throw new Error("Missing RCON credentials for this server!");
    }
    
    if (activeConnections.has(guildId)) {
        const existingWs = activeConnections.get(guildId);
        if (existingWs.readyState === WebSocket.OPEN) return "Already connected!";
        else activeConnections.delete(guildId);
    }

    return new Promise((resolve, reject) => {
        const rconUrl = `ws://${rconIp}:${rconPort}/${encodeURIComponent(rconPassword)}`;
        const ws = new WebSocket(rconUrl);
        
        const timeout = setTimeout(() => { 
            try { ws.close(); } catch(e){}
            reject(new Error(`RCON Connection timed out to ${rconIp}:${rconPort}.`)); 
        }, 10000);

        ws.on('open', () => {
            clearTimeout(timeout);
            activeConnections.set(guildId, ws);
            resolve("Connection established successfully!");
        });

        ws.on('close', () => activeConnections.delete(guildId));

        ws.on('error', (err) => {
            clearTimeout(timeout);
            activeConnections.delete(guildId);
            reject(new Error(`RCON Socket Error: Unable to reach ${rconIp}:${rconPort}`));
        });

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
                if (!parsed) return;
                
                const msg = parsed.Message || '';
                const msgLower = msg.toLowerCase();

                let rawUsername = '';
                let rawContent = msg;

                // Flexible chat parser supporting standard chat tags or raw broadcasted D11 lines
                if (msg.includes(':')) {
                    const parts = msg.split(':');
                    if (parts.length >= 2) {
                        rawUsername = parts[0].replace(/\[.*?\]/g, '').trim();
                        rawContent = parts.slice(1).join(':').trim().toLowerCase();
                    }
                } else if (msg.includes('d11_quick_chat_')) {
                    rawContent = msg.trim().toLowerCase();
                }

                const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });

                // ==========================================
                // 1. POSITION INTERCEPTOR (ADMIN / SETUP TOOLS)
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

                        if (!foundPos && (rawUsername.toLowerCase() === setupData.inGameName.toLowerCase() || msgLower.includes(setupData.inGameName.toLowerCase())) && msgLower.includes('teleport')) {
                            const matches = msg.match(/-?\d+(\.\d+)?/g);
                            if (matches && matches.length >= 3) {
                                const len = matches.length;
                                posX = parseFloat(matches[len-3]).toFixed(2); posY = parseFloat(matches[len-2]).toFixed(2); posZ = parseFloat(matches[len-1]).toFixed(2);
                                foundPos = true;
                            }
                        }

                        if (foundPos) {
                            if (setupData.timeoutTimer) clearTimeout(setupData.timeoutTimer);

                            if (setupData.type === 'custom_bind') {
                                try {
                                    const bind = await CustomBind.findByPk(setupData.targetId);
                                    if (bind) {
                                       let command = bind.actionType === 'teleport' ? `teleportpos ${posX} ${posY} ${posZ} "${setupData.inGameName}"` : `spawn recycler_static (${posX},${posY},${posZ})`; 
                                        await bind.update({ command });
                                    }
                                    const bindHandler = require('../handlers/bindHandler');
                                    if (bindHandler && bindHandler.refreshPanelViaInteraction) {
                                        await bindHandler.refreshPanelViaInteraction(setupData.interaction, `✅ **Position Captured!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\``, setupData.targetId);
                                    }
                                } catch (error) {}
                            } 
                            else if (setupData.type === 'auto_event') {
                                try {
                                    const autoEventsHandler = require('../handlers/autoEventsHandler');
                                    if (autoEventsHandler && autoEventsHandler.autoSaveLocation) {
                                        await autoEventsHandler.autoSaveLocation(setupData.interaction.guild.id, posX, posY, posZ, setupData.targetId);
                                    }
                                    if (autoEventsHandler && autoEventsHandler.refreshPanelViaInteraction) {
                                        await autoEventsHandler.refreshPanelViaInteraction(
                                            setupData.interaction,
                                            `✅ **Spawn Position Added!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\``,
                                            setupData.targetId
                                        );
                                    }
                                } catch (error) {
                                    console.error('[AUTO EVENT RCON SAVE ERROR]', error);
                                }
                            }
                            else if (setupData.type === 'custom_zone') {
                                try {
                                    const customZoneHandler = require('../handlers/customZoneHandler');
                                    if (customZoneHandler && customZoneHandler.autoSaveLocation) {
                                        await customZoneHandler.autoSaveLocation(setupData.interaction.guild.id, posX, posY, posZ, setupData.targetId);
                                    }
                                    if (customZoneHandler && customZoneHandler.refreshPanelViaInteraction) {
                                        await customZoneHandler.refreshPanelViaInteraction(
                                            setupData.interaction,
                                            `✅ **Zone Center Position Saved!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\``,
                                            setupData.targetId
                                        );
                                    }
                                } catch (error) {
                                    console.error('[CUSTOM ZONE RCON SAVE ERROR]', error);
                                }
                            }

                            adminPosQueue.delete(adminId);
                            break;
                        }
                    }
                }

                // ==========================================
                // 1.1 HOME TELEPORT RESPAWN SCANNER INTERCEPTOR
                // ==========================================
                if (homeTpPosQueue.size > 0) {
                    for (const [userId, tpData] of homeTpPosQueue.entries()) {
                        if ((rawUsername.toLowerCase() === tpData.inGameName.toLowerCase() || msgLower.includes(tpData.inGameName.toLowerCase())) && (msgLower.includes('spawn') || msgLower.includes('teleport') || msgLower.includes('respawn') || msgLower.includes('printpos'))) {
                            const nakedCoordMatch = msg.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
                            if (nakedCoordMatch) {
                                const posX = parseFloat(nakedCoordMatch[1]).toFixed(2);
                                const posY = parseFloat(nakedCoordMatch[2]).toFixed(2);
                                const posZ = parseFloat(nakedCoordMatch[3]).toFixed(2);

                                await HomeTeleportLocation.upsert({ guildId, userId, posX, posY, posZ });
                                if (tpData.timeoutTimer) clearTimeout(tpData.timeoutTimer);
                                homeTpPosQueue.delete(userId);
                                await sendRconCommand(guildId, `say "${tpData.inGameName}, your Home location has been successfully anchored!"`, client, tpData.serverId || null);
                                break;
                            }
                        }
                    }
                }

                // ==========================================
                // 2. KILLFEED, BOUNTIES & KILL REWARDS
                // ==========================================
                if ((msgLower.includes('killed') || msgLower.includes('murdered') || msgLower.includes('suicide') || msgLower.includes('died') || msgLower.includes('slain')) && !msg.includes('[Killfeed]')) {
                    await sendRconCommand(guildId, `say "[Killfeed] ${msg}"`, client);
                    
                    let killerDb = null; 
                    let victimDb = null;
                    const currency = currentConfig?.economyCurrency || 'Scrap';
                    const playersList = await UserEconomy.findAll({ where: { guildId: guildId } });

                    if (msgLower.includes('scientist') && (msgLower.includes('killed') || msgLower.includes('murdered'))) {
                        for (const p of playersList) {
                            if (p.inGameName && msg.indexOf(p.inGameName) < msg.indexOf('killed') && msg.indexOf(p.inGameName) !== -1) {
                                killerDb = p;
                                break;
                            }
                        }
                        if (killerDb) {
                            const reward = currentConfig?.scientistKillReward ?? 10;
                            await killerDb.update({ wallet: (killerDb.wallet || 0) + reward });
                            await sendRconCommand(guildId, `say "${killerDb.inGameName} earned +${reward} ${currency} for killing a Scientist!"`, client);
                        }
                    } else {
                        for (const p of playersList) {
                            if (p.inGameName && msg.includes(p.inGameName)) {
                                if (msgLower.includes('killed') && msg.indexOf(p.inGameName) < msg.indexOf('killed')) {
                                    await p.update({ pvpKills: (p.pvpKills || 0) + 1 }); 
                                    killerDb = p; 
                                } else if (msgLower.includes('killed') || msgLower.includes('murdered')) {
                                    await p.update({ deaths: (p.deaths || 0) + 1, currentKillstreak: 0 }); 
                                    victimDb = p; 
                                }
                            }
                        }

                        if (killerDb && victimDb && killerDb.userId !== victimDb.userId) {
                            const reward = currentConfig?.playerKillReward ?? 50;
                            await killerDb.update({ wallet: (killerDb.wallet || 0) + reward });
                            await sendRconCommand(guildId, `say "${killerDb.inGameName} earned +${reward} ${currency} for eliminating ${victimDb.inGameName}!"`, client);
                            await processBountyLogic(guildId, killerDb, victimDb, client, currentConfig);
                        }
                    }
                }

                // ==========================================
                // 4. D11 QUICK-CHAT ROUTER & CUSTOM BINDS
                // ==========================================
                const handled = await processD11Router(guildId, rawUsername, rawContent, msgLower, client, homeTpPosQueue, sendRconCommand);
                if (handled) return;

            } catch (e) {}
        });
    });
}

async function sendRconCommand(guildId, commandStr, client = null, serverId = null) {
    let ws = activeConnections.get(guildId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        try { await connectRcon(guildId, client || global.discordClient, serverId); ws = activeConnections.get(guildId); } catch (e) { throw e; }
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error("Not connected to RCON.");
    ws.send(JSON.stringify({ Identifier: 1, Message: commandStr, Name: "BuddyBot" }));
    return true;
}

async function queueAdminPos(interaction, type = 'custom_bind', targetId = null, serverId = null) {
    const guildId = interaction.guild.id;
    const adminId = interaction.user.id;
    const client = interaction.client;

    const userProfile = await UserEconomy.findOne({ where: { userId: adminId } });
    if (!userProfile || !userProfile.inGameName) {
        return interaction.editReply({ content: `❌ **Missing In-Game Name!** Link your gamertag via \`/playerpanel\` first!` }).catch(()=>{});
    }

    const inGameName = userProfile.inGameName;
    if (adminPosQueue.has(adminId)) clearTimeout(adminPosQueue.get(adminId).timeoutTimer);

    const timeoutTimer = setTimeout(async () => {
        if (adminPosQueue.has(adminId)) {
            adminPosQueue.delete(adminId);
            await interaction.editReply({ content: `⚠️ **Auto-Scan Failed.** Make sure you are online as \`${inGameName}\` and try again.` }).catch(()=>{});
        }
    }, 8000);

    adminPosQueue.set(adminId, { guildId, adminId, type, timeoutTimer, inGameName, targetId, interaction, serverId });
    
    try {
        await sendRconCommand(guildId, `printpos "${inGameName}"`, client, serverId);
    } catch (err) {
        adminPosQueue.delete(adminId);
    }
}

async function triggerCustomEvent(guildId, eventType, data = {}) {
    if (eventType === 'supply_drop') return await sendRconCommand(guildId, 'supply.drop');
    if (eventType === 'elite_crate') return await sendRconCommand(guildId, 'spawn codelockedhackablecrate');
    if (eventType === 'timed_crate') return await sendRconCommand(guildId, 'spawn hackablelockedcrate');
    return await sendRconCommand(guildId, 'cargoships.spawncargoship');
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
                if (gameChannel) gameChannel.send({ embeds: [new EmbedBuilder().setTitle('🎯 BOUNTY PLACED!').setDescription(`**${killerDb.inGameName}** has a **${killerDb.currentKillstreak} killstreak**! Bounty: **${config.bountyRewardAmount || 500} ${currency}**`).setColor('#e74c3c')] }).catch(()=>{});
            }
        }
    }
}

async function fetchServerKits(guildId) {
    return new Promise(async (resolve, reject) => {
        const ws = activeConnections.get(guildId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            try { await connectRcon(guildId, global.discordClient); } catch (e) { return reject(new Error("Not connected to RCON.")); }
        }
        
        let foundKits = [];
        const tempListener = (data) => {
            try {
                const parsed = JSON.parse(data);
                if (!parsed || !parsed.Message) return;
                const msg = parsed.Message;
                if (msg.includes("Kit") || msg.includes("kits") || msg.includes("[")) {
                    for (const line of msg.split('\n')) {
                        const clean = line.trim();
                        if (clean && !clean.toLowerCase().includes('list')) foundKits.push(clean);
                    }
                }
            } catch (e) {}
        };

        const activeWs = activeConnections.get(guildId);
        activeWs.on('message', tempListener);
        activeWs.send(JSON.stringify({ Identifier: 999, Message: "kit.list", Name: "AdminWizard" }));

        setTimeout(() => {
            activeWs.off('message', tempListener);
            resolve(foundKits.length > 0 ? foundKits : ["starter", "vip", "builder"]); 
        }, 1500);
    });
}

module.exports = { connectRcon, sendRconCommand, triggerCustomEvent, activeConnections, adminPosQueue, queueAdminPos, fetchServerKits };