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

    if (hometpConfig.requiredRoleId && !memberObj.roles.cache.has(hometpConfig.requiredRoleId)) {
        await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you lack the required Discord role to use Home Teleport!"`, client);
        return true;
    }

    // ==========================================
    // A. SET HOME TRIGGER (Emote: "Can I have a key")
    // ==========================================
    if (isSetHome) {
        // Just notify and let your working kill/respawn flow happen
        await sendRconCommand(guildId, `say "⚠️ ${matchedPlayer.inGameName}, respawn at your bed and use your tracking tool to anchor!"`, client);
        
        // Directly queue this player in your rconPosTracker to catch their next position output!
        try {
            const { queueHomeTpPos } = require('../utils/rconPosTracker');
            await queueHomeTpPos(guildId, matchedPlayer.userId, matchedPlayer.inGameName, client);
        } catch (err) {
            console.error('[HOME TP ERROR]', err);
        }

        return true;
    }

    // ==========================================
    // B. RETREAT TELEPORT TRIGGER (Emote: "Retreat")
    // ==========================================
    if (isRetreat) {
        const now = new Date();
        const [cd] = await HomeTeleportCooldown.findOrCreate({ 
            where: { guildId, userId: matchedPlayer.userId }, 
            defaults: { expiresAt: now } 
        });
        
        if (new Date(cd.expiresAt) > now) {
            const minsLeft = Math.ceil((new Date(cd.expiresAt) - now) / 60000);
            await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, Home Teleport is on cooldown for another ${minsLeft} minutes!"`, client);
            return true;
        }

        const homeLoc = await HomeTeleportLocation.findOne({ where: { guildId, userId: matchedPlayer.userId } });
        if (!homeLoc) {
            await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you have not set a home yet! Use 'Can I have a key' first."`, client);
            return true;
        }

        const expiryTime = new Date(now.getTime() + hometpConfig.cooldownMinutes * 60000);
        await cd.update({ expiresAt: expiryTime });

        const safeY = parseFloat(homeLoc.posY) + 0.5;

        await sendRconCommand(guildId, `say "🏠 [Teleport] ${matchedPlayer.inGameName} is retreating home..."`, client);
        await sendRconCommand(guildId, `teleportpos (${homeLoc.posX},${safeY},${homeLoc.posZ}) "${matchedPlayer.inGameName}"`, client);
        
        return true;
    }

    return false;
}

module.exports = { processHomeTpChat };