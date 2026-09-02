const { GuildConfig, UserEconomy } = require('../database/db');

async function processSkipNightChat(guildId, rawUsername, client, sendRconCommand) {
    const config = await GuildConfig.findOne({ where: { guildId } });
    if (!config || !config.skipNightEnabled) return false;

    const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
    let matchedPlayer = null;

    for (const player of registeredPlayers) {
        if (player.inGameName && player.inGameName.toLowerCase() === rawUsername.toLowerCase()) {
            matchedPlayer = player;
            break;
        }
    }

    if (!matchedPlayer) return false;

    // Trigger skip night voting or command via RCON
    await sendRconCommand(guildId, `say "[SkipNight] ${matchedPlayer.inGameName} voted to skip the night!"`, client);
    // Add your native Rust Console skip time command or vote accumulator here if applicable
    
    return true;
}

module.exports = { processSkipNightChat };