// ============================================================================
// STANDALONE RCON POSITION TRACKER FOR RUST CONSOLE EDITION
// ============================================================================
const { UserEconomy, CustomBind, HomeTeleportLocation, PrisonCell, JailedPlayer } = require('../database/db');

const adminPosQueue = new Map();
const homeTpPosQueue = new Map();
const recyclerPosQueue = new Map();

async function queueHomeTpPos(guildId, userId, inGameName, client, serverId = null) {
    if (homeTpPosQueue.has(userId)) clearTimeout(homeTpPosQueue.get(userId).timeoutTimer);
    const timeoutTimer = setTimeout(() => { if (homeTpPosQueue.has(userId)) homeTpPosQueue.delete(userId); }, 15000);
    homeTpPosQueue.set(userId, { guildId, userId, inGameName, timeoutTimer, serverId, client });
    try {
        const { sendRconCommand } = require('./rconManager');
        await sendRconCommand(guildId, `printpos "${inGameName}"`, client, serverId);
    } catch (err) {
        homeTpPosQueue.delete(userId);
    }
}

async function queueRecyclerPos(guildId, userId, inGameName, client, serverId = null) {
    if (recyclerPosQueue.has(userId)) clearTimeout(recyclerPosQueue.get(userId).timeoutTimer);
    const timeoutTimer = setTimeout(() => { if (recyclerPosQueue.has(userId)) recyclerPosQueue.delete(userId); }, 15000);
    recyclerPosQueue.set(userId, { guildId, userId, inGameName, timeoutTimer, serverId, client });
    try {
        const { sendRconCommand } = require('./rconManager');
        await sendRconCommand(guildId, `printpos "${inGameName}"`, client, serverId);
    } catch (err) {
        recyclerPosQueue.delete(userId);
    }
}

async function captureAdminPosition(interaction, type = 'custom_bind', targetId = null, serverId = null) {
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
        const { sendRconCommand } = require('./rconManager');
        await sendRconCommand(guildId, `printpos "${inGameName}"`, client, serverId);
    } catch (err) {
        adminPosQueue.delete(adminId);
    }
}

async function handleRconLogMessage(guildId, msg) {
    
    // === 1. HOME TELEPORT INTERCEPT ===
    if (homeTpPosQueue.size > 0) {
        for (const [userId, tpData] of homeTpPosQueue.entries()) {
            if (tpData.guildId !== guildId) continue;
            let posX, posY, posZ;
            let foundPos = false;
            const nakedCoordMatch = msg.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
            if (nakedCoordMatch) {
                posX = parseFloat(nakedCoordMatch[1]).toFixed(2);
                posY = parseFloat(nakedCoordMatch[2]).toFixed(2);
                posZ = parseFloat(nakedCoordMatch[3]).toFixed(2);
                foundPos = true;
            }
            if (foundPos) {
                if (tpData.timeoutTimer) clearTimeout(tpData.timeoutTimer);
                homeTpPosQueue.delete(userId);
                const { sendRconCommand } = require('./rconManager');
                await HomeTeleportLocation.upsert({ guildId, userId, posX, posY, posZ });
                await sendRconCommand(guildId, `say "✅ ${tpData.inGameName}, your Home location has been successfully anchored!"`, tpData.client, tpData.serverId);
                return true;
            }
        }
    }

    // === 2. DYNAMIC RECYCLER INTERCEPT ===
    if (recyclerPosQueue.size > 0) {
        for (const [userId, recData] of recyclerPosQueue.entries()) {
            if (recData.guildId !== guildId) continue;
            let posX, posY, posZ;
            let foundPos = false;
            const nakedCoordMatch = msg.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
            if (nakedCoordMatch) {
                posX = parseFloat(nakedCoordMatch[1]).toFixed(2);
                posY = parseFloat(nakedCoordMatch[2]).toFixed(2);
                posZ = parseFloat(nakedCoordMatch[3]).toFixed(2);
                foundPos = true;
            }
            if (foundPos) {
                if (recData.timeoutTimer) clearTimeout(recData.timeoutTimer);
                recyclerPosQueue.delete(userId);
                const safeY = (parseFloat(posY) - 0.5).toFixed(2);
                const { sendRconCommand } = require('./rconManager');
                await sendRconCommand(guildId, `spawn recycler_static (${posX},${safeY},${posZ})`, recData.client, recData.serverId);
                await sendRconCommand(guildId, `say "♻️ ${recData.inGameName} has dynamically deployed a Recycler!"`, recData.client, recData.serverId);
                return true;
            }
        }
    }

    // === 3. DEATH & RESPAWN ENFORCER (PRISON TRAP) ===
    const deathMatch = msg.match(/(['"]?)([^'"]+)\1 (was killed by|died)/i);
    if (deathMatch) {
        const deadPlayerName = deathMatch[2].trim();
        const jailedRecord = await JailedPlayer.findOne({ where: { guildId, inGameName: deadPlayerName } });
        if (jailedRecord) {
            const cell = await PrisonCell.findOne({ where: { guildId, cellNumber: jailedRecord.cellNumber } });
            if (cell) {
                setTimeout(async () => {
                    const { sendRconCommand } = require('./rconManager');
                    await sendRconCommand(guildId, `teleportpos (${cell.posX},${cell.posY},${cell.posZ}) "${deadPlayerName}"`, null);
                    await sendRconCommand(guildId, `say "🔒 ${deadPlayerName} tried to escape death, but was dragged right back into Cell #${jailedRecord.cellNumber}!"`, null);
                }, 3000); // 3-second delay to let respawn finish before pulling back
            }
        }
    }

    // === 4. ADMIN POSITION INTERCEPT ===
    if (adminPosQueue.size === 0) return false;

    for (const [adminId, setupData] of adminPosQueue.entries()) {
        if (setupData.guildId !== guildId) continue;
        let posX, posY, posZ;
        let foundPos = false;
        const nakedCoordMatch = msg.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        if (nakedCoordMatch) {
            posX = parseFloat(nakedCoordMatch[1]).toFixed(2);
            posY = parseFloat(nakedCoordMatch[2]).toFixed(2);
            posZ = parseFloat(nakedCoordMatch[3]).toFixed(2);
            foundPos = true;
        }

        if (foundPos) {
            if (setupData.timeoutTimer) clearTimeout(setupData.timeoutTimer);

            if (setupData.type === 'prison_cell') {
                try {
                    const cellNum = parseInt(setupData.targetId);
                    await PrisonCell.upsert({ guildId: setupData.interaction.guild.id, cellNumber: cellNum, posX, posY: parseFloat(posY)-0.5, posZ });
                    const prisonHandler = require('../handlers/prisonHandler');
                    if (prisonHandler && prisonHandler.refreshPanelViaInteraction) {
                        await prisonHandler.refreshPanelViaInteraction(setupData.interaction, `✅ **Cell #${cellNum} Position Saved!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\``);
                    }
                } catch (error) { console.error('[PRISON CELL SAVE ERROR]', error); }
            } else if (setupData.type === 'custom_bind') {
                try {
                    const bind = await CustomBind.findByPk(setupData.targetId);
                    if (bind) {
                        let command = bind.actionType === 'teleport' ? `teleportpos (${posX},${parseFloat(posY)-0.5},${posZ}) "{player}"` : `spawn recycler_static (${posX},${parseFloat(posY)-0.5},${posZ})`; 
                        await bind.update({ command });
                    }
                    const bindHandler = require('../handlers/bindHandler');
                    if (bindHandler && bindHandler.refreshPanelViaInteraction) {
                        await bindHandler.refreshPanelViaInteraction(setupData.interaction, `✅ **Position Captured!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\``, setupData.targetId);
                    }
                } catch (error) { console.error('[CUSTOM BIND POS SAVE ERROR]', error); }
            }

            adminPosQueue.delete(adminId);
            return true; 
        }
    }
    return false;
}
// === AUTOMATED PRISON EXPIRATION, RF DOOR TRIGGER & REMINDER LOOP ===
setInterval(async () => {
    try {
        const allJailed = await JailedPlayer.findAll();
        if (!allJailed || allJailed.length === 0) return;

        const now = new Date();
        const { sendRconCommand, activeConnections } = require('./rconManager');
        const { PrisonCell, PrisonLog } = require('../database/db');

        for (const prisoner of allJailed) {
            // Check expiration for temporary sentences
            if (prisoner.isTemp && prisoner.expiresAt && new Date(prisoner.expiresAt) <= now) {
                const guildId = prisoner.guildId;
                const cellObj = await PrisonCell.findOne({ where: { guildId, cellNumber: prisoner.cellNumber } });

                if (cellObj && cellObj.rfFrequency) {
                    // 📻 AUTOMATICALLY TRIGGER RF DOOR OPENER VIA RCON
                    for (const gId of activeConnections.keys()) {
                        if (gId === guildId) {
                            await sendRconCommand(guildId, `rf.trigger ${cellObj.rfFrequency}`, null);
                        }
                    }
                }

                // Announce release and log inspection audit
                for (const gId of activeConnections.keys()) {
                    if (gId === guildId) {
                        await sendRconCommand(guildId, `say "🔓 ${prisoner.inGameName} has served their time! Cell #${prisoner.cellNumber} door unlocked."`, null);
                    }
                }

                await PrisonLog.create({
                    guildId,
                    inGameName: prisoner.inGameName,
                    cellNumber: prisoner.cellNumber,
                    action: 'TIME_EXPIRED',
                    reason: 'Completed sentence duration',
                    wardenDiscordId: 'BOT_AUTOMATION'
                });

                await JailedPlayer.destroy({ where: { id: prisoner.id } });
                continue;
            }

            // Calculate remaining time for temp sentences or display lifer status
            let timeMsg = 'Permanent Lifer';
            if (prisoner.isTemp && prisoner.expiresAt) {
                const minsLeft = Math.ceil((new Date(prisoner.expiresAt) - now) / 60000);
                timeMsg = `${minsLeft}m remaining`;
            }

            // 2-Minute Recurring In-Game Reminder
            for (const guildId of activeConnections.keys()) {
                if (guildId === prisoner.guildId) {
                    await sendRconCommand(guildId, `say "🔒 [PRISON] Inmate: ${prisoner.inGameName} | Reason: ${prisoner.reason} | Sentence: ${timeMsg}"`, null);
                }
            }
        }
    } catch (e) {
        console.error('[PRISON INTERVAL ERROR]', e);
    }
}, 120000); // 120,000 ms = exactly 2 minutes

module.exports = {
    captureAdminPosition,
    queueAdminPos: captureAdminPosition, 
    handleRconLogMessage,
    queueHomeTpPos,
    queueRecyclerPos
};