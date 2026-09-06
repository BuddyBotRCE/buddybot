const { CustomBind, UserEconomy, GuildConfig } = require('../database/db');

async function processTeleportAction(guildId, rawUsername, rawContent, msgLower, client, sendRconCommand) {
    const serverBinds = await CustomBind.findAll({ 
        where: { guildId: guildId, actionType: 'teleport' } 
    });
    
    console.log(`========================================`);
    console.log(`[TELEPORT DIAGNOSTIC] rawUsername: "${rawUsername}" | rawContent: "${rawContent}" | msgLower: "${msgLower}"`);
    console.log(`[TELEPORT DIAGNOSTIC] Found ${serverBinds.length} teleport binds in DB.`);
    
    if (serverBinds.length === 0) return false;

    const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
    const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });

    for (const bind of serverBinds) {
        if (!bind.targetValue || !bind.command) continue;
        const phrase = bind.targetValue.toLowerCase().trim();
        const content = rawContent.toLowerCase().trim();
        
        console.log(`[TELEPORT CHECK] Comparing Phrase: "${phrase}" against Content: "${content}"`);

        // Flexible match for RCE quick-chats and command strings
        if (content === phrase || content.includes(phrase) || msgLower.includes(phrase)) {
            console.log(`[SUCCESS!] MATCH FOUND for Teleport Bind: "${bind.name}"!`);
            
            let matchedPlayer = null;
            
            // 1. Exact username match
            if (rawUsername) {
                for (const player of registeredPlayers) {
                    if (player.inGameName && rawUsername.toLowerCase() === player.inGameName.toLowerCase()) {
                        matchedPlayer = player;
                        break;
                    }
                }
            }

            // 2. Fallback search inside the message text
            if (!matchedPlayer) {
                for (const player of registeredPlayers) {
                    if (player.inGameName && (msgLower.includes(player.inGameName.toLowerCase()) || rawContent.includes(player.inGameName.toLowerCase()))) {
                        matchedPlayer = player;
                        break;
                    }
                }
            }

            // 3. Ultimate fallback for single-player testing if only 1 registered player exists
            if (!matchedPlayer && registeredPlayers.length === 1) {
                matchedPlayer = registeredPlayers[0];
            }

            if (matchedPlayer) {
                const currency = currentConfig?.economyCurrency || 'Scrap';
                
                if (bind.cost > 0 && matchedPlayer.wallet < bind.cost) {
                    console.log(`[TELEPORT DENIED] ${matchedPlayer.inGameName} lacks funds (${matchedPlayer.wallet}/${bind.cost})`);
                    await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you need ${bind.cost} ${currency} to use this teleport!"`, client);
                    return true;
                }
                
                if (bind.cost > 0) {
                    await matchedPlayer.update({ wallet: matchedPlayer.wallet - bind.cost });
                    console.log(`[TELEPORT ECONOMY] Deducted ${bind.cost} ${currency} from ${matchedPlayer.inGameName}`);
                }

                const finalCommandString = bind.command.replace(/{player}/gi, matchedPlayer.inGameName);
                console.log(`[TELEPORT EXECUTED] Running RCON: ${finalCommandString}`);

                for (const cmd of finalCommandString.split('\n')) {
                    if (cmd.trim() !== '') {
                        await sendRconCommand(guildId, cmd.trim(), client);
                    }
                }
                return true;
            } else {
                console.log(`[TELEPORT ERROR] Phrase matched for bind "${bind.name}", but could not map to any registered player!`);
            }
        }
    }
    console.log(`========================================`);
    return false;
}

module.exports = { processTeleportAction };