const { GuildConfig } = require('../database/db');
const { sendRconCommand } = require('./rconManager');

function initAutoEventLoop(client) {
    // Check every 1 minute
    setInterval(async () => {
        try {
            const configs = await GuildConfig.findAll({ where: { autoEventsEnabled: true, isPremiumServer: true } });
            
            for (const config of configs) {
                const guildId = config.guildId;
                const now = Date.now();

                // You can track last spawn timestamps in memory or database. 
                // For simplicity, here is how the interval triggers your custom cargo spawn:
                if (config.cargoDockX !== null && config.cargoDockY !== null && config.cargoDockZ !== null) {
                    // Cargo interval check (e.g., every cargoInterval minutes)
                    // (To fully automate, you can compare `config.updatedAt` or store `lastCargoSpawn` timestamp in GuildConfig)
                }
            }
        } catch (err) {
            console.error('[AUTO EVENT ERROR]', err);
        }
    }, 60000);
}

module.exports = { initAutoEventLoop };