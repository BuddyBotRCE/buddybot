const { SlashCommandBuilder } = require('discord.js');
const { GuildConfig, UserEconomy } = require('../../database/db');
const { sendRconCommand } = require('../../utils/rconManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('claimvote')
        .setDescription('Claim your voting reward in-game!'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const user = await UserEconomy.findOne({ where: { guildId, userId } });
        if (!user || !user.inGameName) {
            return interaction.reply({ content: '❌ You must link your Rust account first using `/playerpanel`!', flags: 64 });
        }

        const now = new Date();
        if (user.lastVoteTime && (now - new Date(user.lastVoteTime)) < 43200000) { // 12-hour cooldown
            const hoursLeft = Math.ceil((43200000 - (now - new Date(user.lastVoteTime))) / 3600000);
            return interaction.reply({ content: `⏳ You have already claimed your vote reward! Please wait **${hoursLeft} more hours** before claiming again.`, flags: 64 });
        }

        const config = await GuildConfig.findOne({ where: { guildId } });
        const reward = config?.voteRewardAmount || 250;
        const currency = config?.economyCurrency || 'Scrap';

        // Update cooldown
        await user.update({ lastVoteTime: now });

        // Deliver reward via RCON (or Wallet balance)
        try {
            if (currency.toLowerCase() === 'scrap') {
                await sendRconCommand(guildId, `inventory.giveto "${user.inGameName}" scrap ${reward}`);
            } else {
                await user.update({ wallet: user.wallet + reward });
            }
            return interaction.reply({ content: `✅ **Vote Reward Claimed!** Sent **${reward} ${currency}** to **${user.inGameName}** in-game! Thank you for supporting the server.`, flags: 64 });
        } catch (e) {
            return interaction.reply({ content: `❌ RCON Error delivering reward: ${e.message}`, flags: 64 });
        }
    }
};