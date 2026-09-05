const { CustomBind, UserEconomy, GuildConfig } = require('../database/db');

async function processTeleportAction(guildId, rawUsername, rawContent, msgLower, client, sendRconCommand) {
    const serverBinds = await CustomBind.findAll({ 
        where: { guildId: guildId, actionType: 'teleport' } 
    });
    
    if (serverBinds.length === 0) return false;

    const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
    const currentConfig = await GuildConfig.findOne({ where: { guildId: guildId } });

    for (const bind of serverBinds) {
        if (!bind.targetValue || !bind.command) continue;
        const phrase = bind.targetValue.toLowerCase().trim();
        const content = rawContent.toLowerCase().trim();
        
        if (content.includes(phrase) || phrase.includes(content) || msgLower.includes(phrase)) {
            let matchedPlayer = null;
            
            for (const player of registeredPlayers) {
                if (player.inGameName && (rawUsername.toLowerCase() === player.inGameName.toLowerCase() || msgLower.includes(player.inGameName.toLowerCase()))) {
                    matchedPlayer = player;
                    break;
                }
            }

            if (!matchedPlayer && registeredPlayers.length > 0) {
                matchedPlayer = registeredPlayers[0]; 
            }

            if (matchedPlayer) {
                const currency = currentConfig?.economyCurrency || 'Scrap';
                if (bind.cost > 0 && matchedPlayer.wallet < bind.cost) {
                    await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you need ${bind.cost} ${currency} to use this teleport!"`, client);
                    return true;
                }
                if (bind.cost > 0) await matchedPlayer.update({ wallet: matchedPlayer.wallet - bind.cost });

                const finalCommandString = bind.command.replace(/{player}/gi, matchedPlayer.inGameName);
                console.log(`[TELEPORT EXECUTED] Running RCON: ${finalCommandString}`);

                for (const cmd of finalCommandString.split('\n')) {
                    if (cmd.trim() !== '') await sendRconCommand(guildId, cmd.trim(), client);
                }
                return true;
            }
        }
    }
    return false;
}

module.exports = { processTeleportAction };