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
        await sendRconCommand(guildId, `say "⚠️ ${matchedPlayer.inGameName}, killing you to capture your bed spawn..."`, client);
        await sendRconCommand(guildId, `killplayer "${matchedPlayer.inGameName}"`, client);
        
        if (homeTpPosQueue.has(matchedPlayer.userId)) {
            clearTimeout(homeTpPosQueue.get(matchedPlayer.userId).timeoutTimer);
        }
        
        // 🛑 BULLETPROOF TIMED CAPTURE:
        // Instead of guessing when you spawn from chat lines, we wait 3.5 seconds 
        // (giving you time to click respawn on your bag), then automatically request your coords!
        const captureTimer = setTimeout(async () => {
            try {
                console.log(`[HOME TP] Auto-fetching bed coordinates for ${matchedPlayer.inGameName}...`);
                // Register into the manager's queue temporarily so it catches the incoming printpos response
                homeTpPosQueue.set(matchedPlayer.userId, {
                    userId: matchedPlayer.userId,
                    inGameName: matchedPlayer.inGameName,
                    state: 'waiting_for_pos',
                    timeoutTimer: setTimeout(() => homeTpPosQueue.delete(matchedPlayer.userId), 5000)
                });
                
                await sendRconCommand(guildId, `printpos "${matchedPlayer.inGameName}"`, client);
            } catch (err) {
                console.error('[HOME TP ERROR] Failed to auto-fetch bed position:', err);
            }
        }, 3500); 

        homeTpPosQueue.set(matchedPlayer.userId, { 
            userId: matchedPlayer.userId, 
            inGameName: matchedPlayer.inGameName, 
            state: 'waiting_for_spawn',
            serverId: null,
            timeoutTimer: captureTimer 
        });
        
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