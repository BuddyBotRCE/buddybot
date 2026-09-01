// ============================================================================
// STANDALONE RCON POSITION TRACKER FOR RUST CONSOLE EDITION
// ============================================================================
const { sendRconCommand } = require('./rconManager');

const pendingPosRequests = new Map();

/**
 * Request coordinates from an in-game admin via RCON
 * @param {import('discord.js').Interaction} interaction 
 * @param {string} targetModule - e.g., 'custom_zone', 'br_spawn', 'br_crate', 'gg_spawn'
 * @param {any} targetId - Database ID or identifier
 * @param {Function} onSaveCallback - Function to call with (guildId, x, y, z, targetId)
 * @param {Function} onRefreshCallback - Function to call to refresh the UI
 */
async function captureAdminPosition(interaction, targetModule, targetId, onSaveCallback, onRefreshCallback) {
    const guildId = interaction.guild.id;
    
    // Store request context
    pendingPosRequests.set(guildId, {
        targetModule,
        targetId,
        interaction,
        onSaveCallback,
        onRefreshCallback,
        timestamp: Date.now()
    });

    try {
        // Send printpos command to Rust Console server
        await sendRconCommand(guildId, 'printpos', interaction.client);
    } catch (err) {
        console.error('[RCON POS TRACKER ERROR] Failed to send printpos:', err);
        pendingPosRequests.delete(guildId);
        if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({ content: '❌ Failed to communicate with Rust Console RCON server.', flags: 64 }).catch(() => {});
        }
    }
}

/**
 * Handle incoming RCON console logs to intercept player coordinates
 * @param {string} guildId 
 * @param {string} logMessage 
 */
async function handleRconLogMessage(guildId, logMessage) {
    if (!pendingPosRequests.has(guildId)) return;

    // Rust Console printpos output format check (e.g. "Position: (X, Y, Z)" or similar coordinate logs)
    const coordMatch = logMessage.match(/(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)/);
    if (!coordMatch) return;

    const request = pendingPosRequests.get(guildId);
    pendingPosRequests.delete(guildId);

    const x = parseFloat(coordMatch[1]);
    const y = parseFloat(coordMatch[3]);
    const z = parseFloat(coordMatch[5]);

    try {
        if (request.onSaveCallback) {
            await request.onSaveCallback(guildId, x, y, z, request.targetId);
        }
        if (request.onRefreshCallback) {
            await request.onRefreshCallback(request.interaction, `✅ Position successfully captured! (\`X: ${x}, Y: ${y}, Z: ${z}\`)`, request.targetId);
        }
    } catch (err) {
        console.error('[RCON POS TRACKER SAVE ERROR]', err);
    }
}

module.exports = {
    captureAdminPosition,
    handleRconLogMessage
};