const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { UserEconomy, GuildConfig } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Check the Top 10 server leaderboards!')
        .addStringOption(option => 
            option.setName('category')
                .setDescription('Which leaderboard do you want to view?')
                .setRequired(true)
                .addChoices(
                    { name: '💰 Top 10 Richest Players', value: 'wealth' },
                    { name: '⭐ Top 10 Highest Levels', value: 'level' }
                )
        ),
        
    async execute(interaction) {
        const category = interaction.options.getString('category');
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config ? config.economyCurrency : 'Scrap';

        // Fetch every player in the server who has an economy profile
        const allPlayers = await UserEconomy.findAll({ where: { guildId: interaction.guild.id } });

        if (allPlayers.length === 0) {
            return interaction.reply({ content: '❌ No one is on the leaderboard yet! Players need to use `/daily` or chat first.', flags: MessageFlags.Ephemeral });
        }

        let leaderboardText = '';
        let embedTitle = '';
        let embedColor = '';

        if (category === 'wealth') {
            // Sort by total wealth (Wallet + Bank combined), Highest to Lowest
            const sortedPlayers = allPlayers.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank)).slice(0, 10);
            
            embedTitle = '💰 Wealth Leaderboard';
            embedColor = '#FFD700';

            sortedPlayers.forEach((player, index) => {
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                const totalWealth = player.wallet + player.bank;
                leaderboardText += `${rank} <@${player.userId}> - **${totalWealth}** ${currency}\n`;
            });
        } 
        else if (category === 'level') {
            // Sort by Level first. If tied, sort by XP. Highest to Lowest.
            const sortedPlayers = allPlayers.sort((a, b) => {
                if (b.level === a.level) return b.xp - a.xp;
                return b.level - a.level;
            }).slice(0, 10);
            
            embedTitle = '⭐ BuddyPass Leaderboard';
            embedColor = '#00ff00';

            sortedPlayers.forEach((player, index) => {
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                leaderboardText += `${rank} <@${player.userId}> - **Level ${player.level}** (${player.xp} XP)\n`;
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(embedTitle)
            .setDescription(leaderboardText)
            .setColor(embedColor)
            .setFooter({ text: 'Compete in-game and in chat to climb the ranks!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};