const { HomeTeleportConfig, HomeTeleportCooldown, HomeTeleportLocation, UserEconomy } = require('../database/db');

async function processHomeTpChat(guildId, rawUsername, isSetHome, isRetreat, client, homeTpPosQueue, sendRconCommand) {
    const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
    let matchedPlayer = null;

    for (const player of registeredPlayers) {
        if (player.inGameName && (rawUsername.toLowerCase() === player.inGameName.toLowerCase())) {
            matchedPlayer = player;
            break;
        }
    }

    if (!matchedPlayer || !client) return false;

    const guildObj = client.guilds.cache.get(guildId);
    const memberObj = await guildObj?.members.fetch(matchedPlayer.userId).catch(() => null);
    if (!memberObj) return false;

    const hometpConfig = await HomeTeleportConfig.findOne({ where: { guildId } });
    if (!hometpConfig) return false;

    // Check Role Requirement
    if (hometpConfig.requiredRoleId && !memberObj.roles.cache.has(hometpConfig.requiredRoleId)) {
        await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you lack the required Discord role to use Home Teleport!"`, client);
        return true;
    }

    // A. SET HOME TRIGGER (Emote: Can I have a key)
    if (isSetHome) {
        // We do NOT send printpos here. We just kill them and wait for them to spawn on their bag.
        // The rconManager will automatically catch their "spawned at" log when they wake up!
        await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, home set command received! Respawn at your bag to anchor coordinates."`, client);
        
        if (homeTpPosQueue.has(matchedPlayer.userId)) clearTimeout(homeTpPosQueue.get(matchedPlayer.userId).timeoutTimer);
        const timeoutTimer = setTimeout(() => homeTpPosQueue.delete(matchedPlayer.userId), 30000); // Gives them 30 seconds to respawn
        homeTpPosQueue.set(matchedPlayer.userId, { userId: matchedPlayer.userId, inGameName: matchedPlayer.inGameName, timeoutTimer });
        
        return true;
    }

    // B. RETREAT TELEPORT TRIGGER (Emote: Retreat)
    if (isRetreat) {
        const now = new Date();
        const [cd] = await HomeTeleportCooldown.findOrCreate({ where: { guildId, userId: matchedPlayer.userId }, defaults: { expiresAt: now } });
        
        if (new Date(cd.expiresAt) > now) {
            const minsLeft = Math.ceil((new Date(cd.expiresAt) - now) / 60000);
            await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, Home Teleport is on cooldown for another ${minsLeft} minutes!"`, client);
            return true;
        }

        const homeLoc = await HomeTeleportLocation.findOne({ where: { guildId, userId: matchedPlayer.userId } });
        if (!homeLoc) {
            await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you have not set a home yet! Use the 'Can I have a key' quick-chat first."`, client);
            return true;
        }

        const expiryTime = new Date(now.getTime() + hometpConfig.cooldownMinutes * 60000);
        await cd.update({ expiresAt: expiryTime });

        // Added the global. prefix for Rust Console Edition reliability
        await sendRconCommand(guildId, `global.teleportpos "${matchedPlayer.inGameName}" ${homeLoc.posX} ${homeLoc.posY} ${homeLoc.posZ}`, client);
        await sendRconCommand(guildId, `say "[Teleport] ${matchedPlayer.inGameName} successfully retreated home!"`, client);
        return true;
    }

    return false;
}

module.exports = { processHomeTpChat };