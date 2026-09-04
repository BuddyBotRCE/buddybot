const { ActivityType } = require('discord.js');
const { GuildConfig } = require('../database/db');
const { connectRcon } = require('../utils/rconManager');

module.exports = async (client) => {
    console.log(`[SYSTEM] ${client.user.tag} is online and ready!`);

    // Set Bot Status
    client.user.setActivity('Rust Console', { type: ActivityType.Playing });

    
};