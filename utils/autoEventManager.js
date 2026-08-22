const { GuildConfig } = require('../database/db');
const { sendRconCommand } = require('../utils/rconManager');

function startAutoEventScheduler() {
    setInterval(async () => {
        try {
            const guilds = await GuildConfig.findAll();

            for (const config of guilds) {
                if (!config.autoEventsEnabled) continue;
                const guildId = config.guildId;
                const now = Date.now();

                // --- 1. SUPPLY DROP AUTO-EVENT ---
                if (config.autoSupplyEnabled && config.supplyInterval) {
                    const lastRun = config.lastSupplyRun ? new Date(config.lastSupplyRun).getTime() : 0;
                    const intervalMs = config.supplyInterval * 60 * 1000;

                    if (now - lastRun > intervalMs) {
                        const count = config.supplySpawnCount || 1;
                        let spawnedAny = false;

                        for (let i = 1; i <= count; i++) {
                            const x = config[`supplySlot${i}X`];
                            const y = config[`supplySlot${i}Y`];
                            const z = config[`supplySlot${i}Z`];

                            if (x !== null && y !== null && z !== null) {
                                await sendRconCommand(guildId, `spawn supply_drop ${x},${y},${z}`);
                                spawnedAny = true;
                            }
                        }

                        if (!spawnedAny) {
                            await sendRconCommand(guildId, 'supply.drop');
                        }

                        config.lastSupplyRun = new Date();
                        await config.save();
                    }
                }

                // --- 2. ELITE CRATE AUTO-EVENT ---
                if (config.autoEliteEnabled && config.eliteInterval) {
                    const lastRun = config.lastEliteRun ? new Date(config.lastEliteRun).getTime() : 0;
                    const intervalMs = config.eliteInterval * 60 * 1000;

                    if (now - lastRun > intervalMs) {
                        const count = config.eliteSpawnCount || 1;
                        let spawnedAny = false;

                        for (let i = 1; i <= count; i++) {
                            const x = config[`eliteSlot${i}X`];
                            const y = config[`eliteSlot${i}Y`];
                            const z = config[`eliteSlot${i}Z`];

                            if (x !== null && y !== null && z !== null) {
                                await sendRconCommand(guildId, `spawn codelockedhackablecrate ${x},${y},${z}`);
                                spawnedAny = true;
                            }
                        }

                        if (!spawnedAny) {
                            await sendRconCommand(guildId, 'spawn codelockedhackablecrate');
                        }

                        config.lastEliteRun = new Date();
                        await config.save();
                    }
                }

                // --- 3. TIMED CRATE AUTO-EVENT ---
                if (config.autoTimedEnabled && config.timedInterval) {
                    const lastRun = config.lastTimedRun ? new Date(config.lastTimedRun).getTime() : 0;
                    const intervalMs = config.timedInterval * 60 * 1000;

                    if (now - lastRun > intervalMs) {
                        const count = config.timedSpawnCount || 1;
                        let spawnedAny = false;

                        for (let i = 1; i <= count; i++) {
                            const x = config[`timedSlot${i}X`];
                            const y = config[`timedSlot${i}Y`];
                            const z = config[`timedSlot${i}Z`];

                            if (x !== null && y !== null && z !== null) {
                                await sendRconCommand(guildId, `spawn hackablelockedcrate ${x},${y},${z}`);
                                spawnedAny = true;
                            }
                        }

                        if (!spawnedAny) {
                            await sendRconCommand(guildId, 'spawn hackablelockedcrate');
                        }

                        config.lastTimedRun = new Date();
                        await config.save();
                    }
                }
            }
        } catch (err) {
            console.error('[Auto-Event Scheduler Loop Error]:', err);
        }
    }, 60000);
}

module.exports = { startAutoEventScheduler };