const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { UserEconomy, GuildConfig } = require('../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View server leaderboards for wealth, levels, and PvP K/D.')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Leaderboard category')
                .setRequired(true)
                .addChoices(
                    { name: '💰 Wealth', value: 'wealth' },
                    { name: '⭐ Level (BuddyPass)', value: 'level' },
                    { name: '⚔️ PvP K/D', value: 'pvp' }
                )
        ),

    async execute(interaction) {
        const category = interaction.options.getString('category');
        const guildId = interaction.guild.id;
        const config = await GuildConfig.findOne({ where: { guildId } });
        const currency = config ? config.economyCurrency : 'Scrap';

        const allPlayers = await UserEconomy.findAll({ where: { guildId } });
        let leaderboardText = '';
        let embedTitle = '';
        let embedColor = '';

        if (category === 'wealth') {
            const sortedPlayers = allPlayers.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank)).slice(0, 10);
            embedTitle = '💰 Wealth Leaderboard';
            embedColor = '#FFD700';

            sortedPlayers.forEach((player, index) => {
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                const totalWealth = player.wallet + player.bank;
                const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked';
                leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **${totalWealth}** ${currency}\n`;
            });
        } else if (category === 'level') {
            const sortedPlayers = allPlayers.sort((a, b) => {
                if (b.level === a.level) return b.xp - a.xp;
                return b.level - a.level;
            }).slice(0, 10);
            
            embedTitle = '⭐ BuddyPass Leaderboard';
            embedColor = '#00ff00';

            sortedPlayers.forEach((player, index) => {
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked';
                leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **Level ${player.level || 1}** (${player.xp || 0} XP)\n`;
            });
        } else if (category === 'pvp') {
            const sortedPlayers = allPlayers.sort((a, b) => {
                const kdRatioA = a.deaths === 0 ? a.pvpKills : (a.pvpKills / a.deaths);
                const kdRatioB = b.deaths === 0 ? b.pvpKills : (b.pvpKills / b.deaths);
                if (kdRatioB === kdRatioA) return b.pvpKills - a.pvpKills;
                return kdRatioB - kdRatioA;
            }).slice(0, 10);

            embedTitle = '⚔️ PvP K/D Leaderboard';
            embedColor = '#e74c3c';

            sortedPlayers.forEach((player, index) => {
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked';
                const kills = player.pvpKills || 0;
                const deaths = player.deaths || 0;
                const kd = deaths === 0 ? kills.toFixed(2) : (kills / deaths).toFixed(2);
                leaderboardText += `${rank} ${ign} (<@${player.userId}>) — **K: ${kills} | D: ${deaths} | KD: ${kd}**\n`;
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(embedTitle)
            .setDescription(leaderboardText || 'No data recorded yet.')
            .setColor(embedColor)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lb_refresh_${category}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        );

        return interaction.reply({ embeds: [embed], components: [row] });
    }
};