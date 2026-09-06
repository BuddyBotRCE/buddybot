const { RecyclerConfig, UserEconomy } = require('../database/db');

// Map to prevent spam: Now keyed by userId so it is a per-player cooldown!
const userRecyclerCooldown = new Map(); 

async function processRecyclerChat(guildId, rawUsername, client, sendRconCommand) {
    const config = await RecyclerConfig.findOne({ where: { guildId } }) || { cooldownMinutes: 15 };
    
    // Find player first so we know who is triggering it
    const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
    let matchedPlayer = null;
    for (const player of registeredPlayers) {
        if (player.inGameName && (rawUsername.toLowerCase() === player.inGameName.toLowerCase())) {
            matchedPlayer = player;
            break;
        }
    }
    
    if (!matchedPlayer) return false;

    // Check Per-User Cooldown
    const now = Date.now();
    const lastUsed = userRecyclerCooldown.get(matchedPlayer.userId) || 0;
    const cdMs = (config.cooldownMinutes || 15) * 60000;

    if (now - lastUsed < cdMs) {
        const minsLeft = Math.ceil((cdMs - (now - lastUsed)) / 60000);
        await sendRconCommand(guildId, `say "⚠️ ${matchedPlayer.inGameName}, your Recycler drop is on cooldown for ${minsLeft} more minutes!"`, client);
        return true;
    }

    const guildObj = client.guilds.cache.get(guildId);
    const memberObj = await guildObj?.members.fetch(matchedPlayer.userId).catch(() => null);

    if (config.requiredRoleId && memberObj && !memberObj.roles.cache.has(config.requiredRoleId)) {
        await sendRconCommand(guildId, `say "⚠️ ${matchedPlayer.inGameName}, you lack the required Discord role to spawn a Recycler!"`, client);
        return true;
    }

    // Lock the cooldown for this specific user
    userRecyclerCooldown.set(matchedPlayer.userId, now);

    // Queue the player in the standalone tracker to intercept their coordinates instantly
    try {
        const { queueRecyclerPos } = require('../utils/rconPosTracker');
        await queueRecyclerPos(guildId, matchedPlayer.userId, matchedPlayer.inGameName, client);
    } catch (err) {
        console.error('[RECYCLER POS QUEUE ERROR]', err);
    }
    
    return true;
}

module.exports = { processRecyclerChat };