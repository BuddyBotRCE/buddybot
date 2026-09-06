const WebSocket = require('ws');
const { GuildConfig, GameServer, UserEconomy, CustomBind, BindCooldown, ActiveBounty, BountyCooldown, HomeTeleportConfig, HomeTeleportCooldown, HomeTeleportLocation } = require('../database/db');
const { EmbedBuilder } = require('discord.js');
const { processD11Router } = require('./d11ChatHandler'); // Linked to your D11 router
const { handleRconLogMessage, queueAdminPos } = require('./rconPosTracker'); // Our standalone position tracker

const activeConnections = new Map();
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
        const guildGameServer = await GameServer.findOne({ where: { guildId: guildId } });
        if (guildGameServer && guildGameServer.rconIp && guildGameServer.rconPort && guildGameServer.rconPassword) {
            rconIp = guildGameServer.rconIp; rconPort = guildGameServer.rconPort; rconPassword = guildGameServer.rconPassword;
        }
    }

    if (!rconIp || !rconPort || !rconPassword) {
        throw new Error("No game server found or configured with valid RCON credentials for this guild!");
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

        // --- SAFE PARSER PATCH 1: Event Register ---
        registerEventParser({
            on: (event, cb) => {
                if (event === 'message') {
                    ws.on('message', (raw) => {
                        try {
                            const rawStr = raw.toString();
                            let msg = '';
                            try {
                                const sanitized = rawStr.replace(/,\s*}/g, '}');
                                const parsed = JSON.parse(sanitized);
                                msg = parsed.Message || parsed.message || rawStr;
                            } catch (e) {
                                msg = rawStr;
                            }
                            if (msg) cb({ message: msg });
                        } catch (e) {}
                    });
                }
            }
        }, eventEmitterCallback);

                // --- SAFE PARSER PATCH 2: Main WebSocket Listener ---
        ws.on('message', async (data) => {
            try {
                const rawStr = data.toString();
                let msg = '';
                
                try {
                    const sanitized = rawStr.replace(/,\s*}/g, '}');
                    const parsed = JSON.parse(sanitized);
                    msg = parsed.Message || parsed.message || rawStr;
                } catch (e) {
                    msg = rawStr; 
                }

                if (!msg) return;

                // 🛑 ANTI-SPAM: Completely block raw JSON code chunks from GPortal!
                if (msg.includes('"username":') || msg.includes('"userid":') || msg.includes('"stacktrace":') || msg.trim().startsWith('{')) {
                    return;
                }

                // 🛑 Feed the standalone position tracker immediately!
                if (typeof handleRconLogMessage === 'function') {
                    await handleRconLogMessage(guildId, msg);
                }
                
                // ... (the rest of your listener continues normally below this)

                // 🛑 NEW: Ignore GPortal Auto-Save Spam so it doesn't trigger fake chats
                if (msg.includes('[ SAVE ]') || msg.includes('Starting auto save') || msg.includes('Begining save')) {
                    return; 
                }
                
                const msgLower = msg.toLowerCase();
                let rawUsername = '';
                let rawContent = msg;
                let cleanMsg = msg;

                // Safely strip GPortal tags regardless of case
                cleanMsg = cleanMsg.replace(/\[CHAT SERVER\]/i, '').trim();
                cleanMsg = cleanMsg.replace(/\[CHAT LOCAL\]/i, '').trim();

                const isQuickChat = cleanMsg.toLowerCase().includes('d11_quick_chat_');

                if (cleanMsg.includes(':')) {
                    const parts = cleanMsg.split(':');
                    if (parts.length >= 2) {
                        rawUsername = parts[0].trim();
                        rawContent = parts.slice(1).join(':').trim().toLowerCase();
                    }
                } else if (isQuickChat) {
                    rawContent = cleanMsg.trim().toLowerCase();
                    
                    const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
                    for (const player of registeredPlayers) {
                        if (player.inGameName && rawStr.toLowerCase().includes(player.inGameName.toLowerCase())) {
                            rawUsername = player.inGameName;
                            break;
                        }
                    }
                    if (!rawUsername && registeredPlayers.length > 0) {
                        rawUsername = registeredPlayers[0].inGameName;
                    }
                } else {
                    // Ignore non-chat system clutter, but let quick-chats and standard chat through
                    return;
                }

                const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });

                // ==========================================
                // 1. HOME TELEPORT RESPAWN SCANNER INTERCEPTOR
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
                // 3. D11 QUICK-CHAT ROUTER & CUSTOM BINDS
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

// Notice how we removed queueAdminPos and adminPosQueue from the exports below!
module.exports = { connectRcon, sendRconCommand, triggerCustomEvent, activeConnections, fetchServerKits, queueAdminPos };