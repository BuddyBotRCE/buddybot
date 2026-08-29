const { GuildConfig, UserEconomy, CustomBind } = require('../database/db');

async function processCustomBindChat(guildId, rawUsername, rawContent, msgLower, client, sendRconCommand) {
    const currentConfig = await GuildConfig.findOne({ where: { guildId } });
    const registeredPlayers = await UserEconomy.findAll({ where: { guildId } });

    const serverBinds = await CustomBind.findAll({ where: { guildId } });
    if (serverBinds.length === 0) return false;

    for (const bind of serverBinds) {
        if (!bind.targetValue) continue;
        const phrase = bind.targetValue.toLowerCase();

        if (rawContent.includes(phrase) || msgLower.includes(phrase)) {
            let matchedPlayer = null;
            for (const player of registeredPlayers) {
                if (player.inGameName && (rawUsername.toLowerCase() === player.inGameName.toLowerCase() || msgLower.includes(player.inGameName.toLowerCase()))) {
                    matchedPlayer = player;
                    break;
                }
            }
            if (matchedPlayer) {
                // Check Economics
                if (bind.cost > 0 && matchedPlayer.wallet < bind.cost) {
                    await sendRconCommand(guildId, `say "${matchedPlayer.inGameName}, you need ${bind.cost} ${currentConfig?.economyCurrency || 'Scrap'} to use this!"`, client);
                    return true;
                }
                if (bind.cost > 0) await matchedPlayer.update({ wallet: matchedPlayer.wallet - bind.cost });

                // Execute Bind Command
                const finalCommandString = bind.command.replace(/{player}/gi, matchedPlayer.inGameName);
                for (const cmd of finalCommandString.split('\n')) {
                    if (cmd.trim() !== '') await sendRconCommand(guildId, cmd.trim(), client);
                }
                return true;
            }
        }
    }
    return false;
}

module.exports = { processCustomBindChat };