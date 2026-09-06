const { RecyclerConfig, RecyclerLocation, UserEconomy } = require('../database/db');

// Map to prevent multiple players spamming spawns simultaneously
const globalRecyclerCooldown = new Map(); 

async function processRecyclerChat(guildId, rawUsername, client, sendRconCommand) {
    const config = await RecyclerConfig.findOne({ where: { guildId } }) || { cooldownMinutes: 15 };
    
    // Check Global Server Cooldown (Default 15m)
    const now = Date.now();
    const lastUsed = globalRecyclerCooldown.get(guildId) || 0;
    const cdMs = (config.cooldownMinutes || 15) * 60000;

    if (now - lastUsed < cdMs) {
        const minsLeft = Math.ceil((cdMs - (now - lastUsed)) / 60000);
        await sendRconCommand(guildId, `say "⚠️ Recycler spawn is on cooldown for ${minsLeft} more minutes!"`, client);
        return true;
    }

    const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
    let matchedPlayer = null;
    for (const player of registeredPlayers) {
        if (player.inGameName && (rawUsername.toLowerCase() === player.inGameName.toLowerCase())) {
            matchedPlayer = player;
            break;
        }
    }
    
    if (!matchedPlayer) return false;

    const guildObj = client.guilds.cache.get(guildId);
    const memberObj = await guildObj?.members.fetch(matchedPlayer.userId).catch(() => null);

    if (config.requiredRoleId && memberObj && !memberObj.roles.cache.has(config.requiredRoleId)) {
        await sendRconCommand(guildId, `say "⚠️ ${matchedPlayer.inGameName}, you lack the required Discord role to use the Recycler!"`, client);
        return true;
    }

    const loc = await RecyclerLocation.findOne({ where: { guildId } });
    if (!loc) {
        await sendRconCommand(guildId, `say "⚠️ The admin has not set a Recycler location yet!"`, client);
        return true;
    }

    // Lock the cooldown
    globalRecyclerCooldown.set(guildId, now);

    // Spawn the recycler slightly embedded in the foundation to mimic normal generation
    const safeY = parseFloat(loc.posY) - 0.5;
    await sendRconCommand(guildId, `spawn recycler_static (${loc.posX},${safeY},${loc.posZ})`, client);
    await sendRconCommand(guildId, `say "♻️ ${matchedPlayer.inGameName} has deployed the public Recycler!"`, client);
    
    return true;
}

module.exports = { processRecyclerChat };