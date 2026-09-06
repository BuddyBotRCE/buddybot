// ============================================================================
// STANDALONE RCON POSITION TRACKER FOR RUST CONSOLE EDITION
// ============================================================================
const { UserEconomy, CustomBind } = require('../database/db');

// Replaces the queue that used to be in rconManager
const adminPosQueue = new Map();

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

            // === 1. CUSTOM BINDS ===
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
            // === 2. AUTO EVENTS ===
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
            // === 3. CUSTOM ZONES ===
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

            adminPosQueue.delete(adminId);
            return true; 
        }
    }
    return false;
}

// Exporting as both names so your UI files don't break if they use queueAdminPos
module.exports = {
    captureAdminPosition,
    queueAdminPos: captureAdminPosition, 
    handleRconLogMessage
};