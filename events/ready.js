const { ActivityType } = require('discord.js');
const { GuildConfig } = require('../database/db');
const { connectRcon } = require('../utils/rconManager');

module.exports = async (client) => {
    console.log(`[SYSTEM] ${client.user.tag} is online and ready!`);

    // Set Bot Status
    client.user.setActivity('Rust Console', { type: ActivityType.Playing });

    // Auto-Connect RCON for all configured servers
    try {
        const servers = await GuildConfig.findAll();
        for (const server of servers) {
            if (server.rconIp && server.rconPort && server.rconPassword) {
                console.log(`[RCON] Attempting auto-connect for server ${server.guildId}...`);
                connectRcon(server.guildId, client).catch(err => {
                    console.log(`[RCON] Failed to auto-connect: ${err.message}`);
                });
            }
        }
    } catch (error) {
        console.error('[RCON AUTO-CONNECT ERROR]', error);
    }
};