const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { GuildConfig, UserEconomy } = require('../../database/db');
const { sendRconCommand } = require('../../utils/rconManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Vote for the server and claim in-game rewards!'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = await GuildConfig.findOne({ where: { guildId } });
        const voteUrl = config?.voteUrl || 'https://rust-servers.net';
        const reward = config?.voteRewardAmount || 250;
        const currency = config?.economyCurrency || 'Scrap';

        const embed = new EmbedBuilder()
            .setTitle(`🗳️ Support Our GPortal Server — ${interaction.guild.name}`)
            .setDescription(`Vote for our server on community lists to help us grow and earn free in-game currency!\n\n🔗 **Vote Link:** [Click Here to Vote](${voteUrl})\n\n🎁 **Reward:** **${reward} ${currency}**\n*After voting, type \`/claimvote\` to get your items delivered straight to your inventory!*`)
            .setColor('#e67e22')
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};