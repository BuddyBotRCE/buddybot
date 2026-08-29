const { GuildConfig, UserEconomy } = require('../database/db');

// Temporarily stores active votes: guildId -> { voters: Set, timer, targetVotes }
const activeVotes = new Map(); 

async function processSkipNightChat(guildId, rawUsername, client, sendRconCommand) {
    const config = await GuildConfig.findOne({ where: { guildId } });
    
    // If Skip Night is disabled in the Admin Panel, ignore the command
    if (!config || !config.skipNightEnabled) return false;

    const registeredPlayers = await UserEconomy.findAll({ where: { guildId } });
    let matchedPlayer = null;
    
    // Find the player in the database so we know who is voting
    for (const player of registeredPlayers) {
        if (player.inGameName && rawUsername.toLowerCase() === player.inGameName.toLowerCase()) {
            matchedPlayer = player;
            break;
        }
    }

    if (!matchedPlayer) return false; // Must be a registered player to vote

    if (!activeVotes.has(guildId)) {
        // Start a new vote!
        // Note: For now, we assume an average of 10 players online to do the math. 
        // If your config is set to 50%, it will require 5 votes.
        const assumedPlayersOnline = 10; 
        let targetVotes = Math.ceil((config.skipNightPercentage / 100) * assumedPlayersOnline);
        if (targetVotes < 1) targetVotes = 1;

        const timer = setTimeout(async () => {
            activeVotes.delete(guildId);
            await sendRconCommand(guildId, `say "🌙 Skip Night Vote FAILED. Not enough votes."`, client);
        }, 5 * 60 * 1000); // 5 minutes to vote before it expires

        activeVotes.set(guildId, {
            voters: new Set([matchedPlayer.userId]),
            timer,
            targetVotes
        });

        await sendRconCommand(guildId, `say "🌙 ${matchedPlayer.inGameName} started a Skip Night vote! Use 'Wait Here' in quick-chat to vote! (1/${targetVotes})"`, client);
    } else {
        const voteData = activeVotes.get(guildId);
        
        // Prevent the same person from voting twice
        if (voteData.voters.has(matchedPlayer.userId)) {
            return true; 
        }

        voteData.voters.add(matchedPlayer.userId);
        const currentVotes = voteData.voters.size;

        if (currentVotes >= voteData.targetVotes) {
            clearTimeout(voteData.timer);
            activeVotes.delete(guildId);
            await sendRconCommand(guildId, `say "🌅 Vote PASSED! Skipping to morning..."`, client);
            await sendRconCommand(guildId, `env.time 8`, client); // Changes server time to 8:00 AM
        } else {
            await sendRconCommand(guildId, `say "🌙 Skip Night Vote: ${currentVotes}/${voteData.targetVotes} received."`, client);
        }
    }

    return true; // We handled the command, so return true to stop the router
}

module.exports = { processSkipNightChat };