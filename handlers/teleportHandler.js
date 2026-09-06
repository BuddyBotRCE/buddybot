const { CustomBind, UserEconomy, GuildConfig } = require('../database/db');

async function processTeleportAction(guildId, rawUsername, rawContent, msgLower, client, sendRconCommand) {
    const serverBinds = await CustomBind.findAll({ 
        where: { guildId: guildId, actionType: 'teleport' } 
    });
    
    console.log(`========================================`);
    console.log(`[TELEPORT DIAGNOSTIC] Incoming rawUsername: "${rawUsername}"`);
    console.log(`[TELEPORT DIAGNOSTIC] Incoming rawContent: "${rawContent}"`);
    console.log(`[TELEPORT DIAGNOSTIC] Incoming msgLower: "${msgLower}"`);
    console.log(`[TELEPORT DIAGNOSTIC] Found ${serverBinds.length} teleport binds in DB.`);
    
    if (serverBinds.length === 0) return false;

    const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
    const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });

    for (const bind of serverBinds) {
        if (!bind.targetValue || !bind.command) continue;
        const phrase = bind.targetValue.toLowerCase().trim();
        const content = rawContent.toLowerCase().trim();
        
        console.log(`[TELEPORT DIAGNOSTIC] Comparing Database Phrase: "${phrase}" against Incoming Content: "${content}"`);

        // Strict match or phrase containment check suitable for RCE log streams
        if (content === phrase || content.includes(phrase) || msgLower.includes(phrase)) {
            console.log(`[SUCCESS!] MATCH FOUND for Teleport Bind: "${bind.name}"! Executing...`);
            
            let matchedPlayer = null;
            
            // 1. Try exact username match first
            for (const player of registeredPlayers) {
                if (player.inGameName && rawUsername.toLowerCase() === player.inGameName.toLowerCase()) {
                    matchedPlayer = player;
                    break;
                }
            }

            // 2. Fallback: Search inside message text if rawUsername didn't line up perfectly
            if (!matchedPlayer) {
                for (const player of registeredPlayers) {
                    if (player.inGameName && msgLower.includes(player.inGameName.toLowerCase())) {
                        matchedPlayer = player;
                        break;
                    }
                }
            }

            if (matchedPlayer) {
                const currency = currentConfig?.economyCurrency || 'Scrap';
                
                // Check if player has enough balance for the teleport cost
                if (bind.cost > 0 && matchedPlayer.wallet < bind.cost) {
                    console.log(`[TELEPORT DENIED] Player ${matchedPlayer.inGameName} lacks funds (${matchedPlayer.wallet}/${bind.cost} ${currency})`);
                    await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you need ${bind.cost} ${currency} to use this teleport!"`, client);
                    return true;
                }
                
                // Deduct cost from economy wallet
                if (bind.cost > 0) {
                    await matchedPlayer.update({ wallet: matchedPlayer.wallet - bind.cost });
                    console.log(`[TELEPORT ECONOMY] Deducted ${bind.cost} ${currency} from ${matchedPlayer.inGameName}`);
                }

                // Replace placeholder and execute RCON command string
                const finalCommandString = bind.command.replace(/{player}/gi, matchedPlayer.inGameName);
                console.log(`[TELEPORT EXECUTED] Running RCON: ${finalCommandString}`);

                for (const cmd of finalCommandString.split('\n')) {
                    if (cmd.trim() !== '') {
                        await sendRconCommand(guildId, cmd.trim(), client);
                    }
                }
                return true;
            } else {
                console.log(`[TELEPORT ERROR] Phrase matched for bind "${bind.name}", but no registered UserEconomy record found for player "${rawUsername}"!`);
            }
        }
    }
    console.log(`========================================`);
    return false;
}

module.exports = { processTeleportAction };