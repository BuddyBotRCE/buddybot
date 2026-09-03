const { AutoEvent, AutoEventLocation, GameServer } = require('../database/db');
const { sendRconCommand } = require('./rconManager');

const TYPE_INFO = { 
    hackable: { prefab: 'codelockedhackablecrate' }, 
    supply: { prefab: 'supply_drop' }, 
    elite: { prefab: 'crate_elite' }, 
    node: { prefab: 'stone-ore' },
    cargo: { prefab: 'cargoshipdynamic1' }
};

// Track last execution timestamps in memory: Map<eventId, timestamp>
const lastExecutionMap = new Map();

function startAutoEventLoop(client) {
    console.log('[SYSTEM] Auto-Events background manager loop initialized.');

    // Check every 30 seconds
    setInterval(async () => {
        try {
            const now = Date.now();
            const enabledEvents = await AutoEvent.findAll({ where: { isEnabled: true } });

            for (const ev of enabledEvents) {
                const intervalMs = (ev.interval || 60) * 60 * 1000; // Convert minutes to milliseconds
                const lastRun = lastExecutionMap.get(ev.id) || 0;

                // Check if the time interval has elapsed
                if (now - lastRun >= intervalMs) {
                    lastExecutionMap.set(ev.id, now); // Update last run time immediately

                    const locations = await AutoEventLocation.findAll({ where: { eventId: ev.id } });
                    if (locations.length === 0) continue;

                    const prefabInfo = TYPE_INFO[ev.eventType];
                    if (!prefabInfo) continue;

                    // Find if a specific server is tied or fallback to main
                    const servers = await GameServer.findAll({ where: { guildId: ev.guildId } });
                    const targetServerId = servers.length > 0 ? servers[0].id : null;

                    let firedCount = 0;
                    for (let i = 0; i < (ev.amount || 1); i++) {
                        for (const loc of locations) {
                            try {
                                await sendRconCommand(
                                    ev.guildId, 
                                    `spawn ${prefabInfo.prefab} "${loc.posX},${loc.posY},${loc.posZ}"`, 
                                    client, 
                                    targetServerId
                                );
                                firedCount++;
                            } catch (rconErr) {
                                console.error(`[AUTO EVENT ERROR] Failed to fire event ${ev.name} on guild ${ev.guildId}:`, rconErr.message);
                            }
                        }
                    }

                    console.log(`[AUTO EVENTS] Successfully triggered scheduled event "${ev.name}" (${firedCount} items spawned).`);
                }
            }
        } catch (err) {
            console.error('[AUTO EVENT LOOP ERROR]', err);
        }
    }, 30000); 
}

module.exports = { startAutoEventLoop };