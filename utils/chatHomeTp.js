const { HomeTeleportConfig, HomeTeleportCooldown, HomeTeleportLocation, UserEconomy } = require('../database/db');

async function processHomeTpChat(guildId, rawUsername, isSetHome, isRetreat, client, homeTpPosQueue, sendRconCommand) {
    const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
    let matchedPlayer = null;

    // Resolve the player's database profile based on their gamertag
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

    // Check Discord Role Requirement
    if (hometpConfig.requiredRoleId && !memberObj.roles.cache.has(hometpConfig.requiredRoleId)) {
        await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you lack the required Discord role to use Home Teleport!"`, client);
        return true;
    }

    // ==========================================
    // A. SET HOME TRIGGER (Emote: "Can I have a key")
    // ==========================================
    if (isSetHome) {
        // 1. Warn the player
        await sendRconCommand(guildId, `say "⚠️ ${matchedPlayer.inGameName}, killing you to capture your bed spawn..."`, client);
        
        // 2. Execute the Kill command (killplayer is the correct RCON admin command)
        await sendRconCommand(guildId, `killplayer "${matchedPlayer.inGameName}"`, client);
        
        // FALLBACK: If 'killplayer' doesn't work on your specific RCE branch, uncomment the line below. 
        // It teleports the player 2000 meters into the sky so they fall to their death instantly.
        // await sendRconCommand(guildId, `teleportpos (0,2000,0) "${matchedPlayer.inGameName}"`, client);
        
        // 3. Clear any existing timer
        if (homeTpPosQueue.has(matchedPlayer.userId)) {
            clearTimeout(homeTpPosQueue.get(matchedPlayer.userId).timeoutTimer);
        }
        
        // 4. Give them 2 full minutes to bypass bag timers and respawn
        const timeoutTimer = setTimeout(() => {
            if (homeTpPosQueue.has(matchedPlayer.userId)) {
                homeTpPosQueue.delete(matchedPlayer.userId);
                sendRconCommand(guildId, `say "⚠️ ${matchedPlayer.inGameName}, Home anchoring timed out. Try again!"`, client).catch(()=>{});
            }
        }, 120000); 

        // 5. Register them in the queue so rconManager catches their spawn
        homeTpPosQueue.set(matchedPlayer.userId, { 
            userId: matchedPlayer.userId, 
            inGameName: matchedPlayer.inGameName, 
            state: 'waiting_for_spawn', // 🛑 NEW: Tell the scanner to wait for your respawn
            serverId: null,
            timeoutTimer 
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
        
        // Cooldown Check
        if (new Date(cd.expiresAt) > now) {
            const minsLeft = Math.ceil((new Date(cd.expiresAt) - now) / 60000);
            await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, Home Teleport is on cooldown for another ${minsLeft} minutes!"`, client);
            return true;
        }

        // Validate they have actually saved a location
        const homeLoc = await HomeTeleportLocation.findOne({ where: { guildId, userId: matchedPlayer.userId } });
        if (!homeLoc) {
            await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you have not set a home yet! Use 'Can I have a key' first."`, client);
            return true;
        }

        // Apply new cooldown
        const expiryTime = new Date(now.getTime() + hometpConfig.cooldownMinutes * 60000);
        await cd.update({ expiresAt: expiryTime });

        // Bump the Y axis (+0.5) to ensure they drop ON the foundation, not inside it
        const safeY = parseFloat(homeLoc.posY) + 0.5;

        await sendRconCommand(guildId, `say "🏠 [Teleport] ${matchedPlayer.inGameName} is retreating home..."`, client);
        await sendRconCommand(guildId, `teleportpos (${homeLoc.posX},${safeY},${homeLoc.posZ}) "${matchedPlayer.inGameName}"`, client);
        
        return true;
    }

    return false;
}

module.exports = { processHomeTpChat };