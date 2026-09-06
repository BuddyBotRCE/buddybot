// ============================================================================
// STANDALONE RCON POSITION TRACKER FOR RUST CONSOLE EDITION
// ============================================================================
const { UserEconomy, CustomBind, HomeTeleportLocation } = require('../database/db');

// Queues for admins and home teleports
const adminPosQueue = new Map();
const homeTpPosQueue = new Map();

async function queueHomeTpPos(guildId, userId, inGameName, client, serverId = null) {
    if (homeTpPosQueue.has(userId)) clearTimeout(homeTpPosQueue.get(userId).timeoutTimer);

    const timeoutTimer = setTimeout(() => {
        if (homeTpPosQueue.has(userId)) {
            homeTpPosQueue.delete(userId);
        }
    }, 15000);

    homeTpPosQueue.set(userId, { guildId, userId, inGameName, timeoutTimer, serverId, client });

    try {
        const { sendRconCommand } = require('./rconManager');
        await sendRconCommand(guildId, `printpos "${inGameName}"`, client, serverId);
    } catch (err) {
        homeTpPosQueue.delete(userId);
        console.error('[RCON POS TRACKER HOME TP ERROR]', err);
    }
}

/**
 * Request coordinates from an in-game admin via RCON
 */
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
        // LAZY LOAD to avoid circular dependency
        const { sendRconCommand } = require('./rconManager');
        
        // RCE command: printpos "Gamertag"
        await sendRconCommand(guildId, `printpos "${inGameName}"`, client, serverId);
    } catch (err) {
        adminPosQueue.delete(adminId);
        console.error('[RCON POS TRACKER ERROR]', err);
    }
}

/**
 * Handle incoming RCON console logs to intercept player coordinates
 */
async function handleRconLogMessage(guildId, msg) {
    // 1. === HOME TELEPORT INTERCEPT ===
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

    // 2. === ADMIN POSITION INTERCEPT ===
    if (adminPosQueue.size === 0) return false;

    const msgLower = msg.toLowerCase();

    for (const [adminId, setupData] of adminPosQueue.entries()) {
        if (setupData.guildId !== guildId) continue;

        let posX, posY, posZ;
        let foundPos = false;

        // Flexible Regex to match RCE coordinate patterns
        const nakedCoordMatch = msg.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
        if (nakedCoordMatch) {
            posX = parseFloat(nakedCoordMatch[1]).toFixed(2);
            posY = parseFloat(nakedCoordMatch[2]).toFixed(2);
            posZ = parseFloat(nakedCoordMatch[3]).toFixed(2);
            foundPos = true;
        }

        if (foundPos) {
            if (setupData.timeoutTimer) clearTimeout(setupData.timeoutTimer);
            console.log(`[RCON POS TRACKER] Captured Coordinates for ${setupData.inGameName}: X:${posX}, Y:${posY}, Z:${posZ}`);

            // === A. CUSTOM BINDS ===
            if (setupData.type === 'custom_bind') {
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
            // === B. AUTO EVENTS ===
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
                } catch (error) { console.error('[AUTO EVENT RCON SAVE ERROR]', error); }
            }
            // === C. CUSTOM ZONES ===
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
                } catch (error) { console.error('[CUSTOM ZONE RCON SAVE ERROR]', error); }
            }
            // === D. RECYCLER LOCATION ===
            else if (setupData.type === 'recycler') {
                try {
                    const { RecyclerLocation } = require('../database/db');
                    await RecyclerLocation.upsert({ guildId: setupData.guildId, posX, posY, posZ });
                    const recyclerHandler = require('../handlers/recyclerHandler');
                    if (recyclerHandler && recyclerHandler.refreshPanelViaInteraction) {
                        await recyclerHandler.refreshPanelViaInteraction(
                            setupData.interaction,
                            `✅ **Recycler Position Saved!**\nCoordinates: \`X: ${posX}, Y: ${posY}, Z: ${posZ}\``
                        );
                    }
                } catch (error) { console.error('[RECYCLER RCON SAVE ERROR]', error); }
            }

            adminPosQueue.delete(adminId);
            return true; 
        }
    }
    return false;
}

// Exporting with queueHomeTpPos included
module.exports = {
    captureAdminPosition,
    queueAdminPos: captureAdminPosition, 
    handleRconLogMessage,
    queueHomeTpPos
};