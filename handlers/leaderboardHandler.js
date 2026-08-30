const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { GuildConfig, UserEconomy } = require('../database/db');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    try {
        let category = 'wealth';
        if (customId === 'hub_lb_select') {
            category = selectedValue;
        } else if (customId.startsWith('lb_refresh_')) {
            category = customId.replace('lb_refresh_', '');
        }

        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config ? config.economyCurrency : 'Scrap';
        const allPlayers = await UserEconomy.findAll({ where: { guildId: interaction.guild.id } });

        let leaderboardText = ''; 
        let embedTitle = ''; 
        let embedColor = '';

        if (category === 'wealth' || category === 'wallet') {
            const sortedPlayers = allPlayers.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank)).slice(0, 10);
            embedTitle = '💰 Wealth Leaderboard'; 
            embedColor = '#FFD700';
            sortedPlayers.forEach((player, index) => { 
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`; 
                const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked'; 
                leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **${player.wallet + player.bank}** ${currency}\n`; 
            });
        } else if (category === 'level') {
            const sortedPlayers = allPlayers.sort((a, b) => { if (b.level === a.level) return b.xp - a.xp; return b.level - a.level; }).slice(0, 10);
            embedTitle = '⭐ BuddyPass Leaderboard'; 
            embedColor = '#00ff00';
            sortedPlayers.forEach((player, index) => { 
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`; 
                const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked'; 
                leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **Level ${player.level || 1}** (${player.xp || 0} XP)\n`; 
            });
        } else if (category === 'pvp' || category === 'pvpKills') {
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
            .setDescription(leaderboardText || 'No player data recorded yet.')
            .setColor(embedColor)
            .setTimestamp();

        const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('hub_lb_select')
                .setPlaceholder('Select Leaderboard Category...')
                .addOptions([
                    { label: 'Wealth (Wallet + Bank)', value: 'wealth', emoji: '💰' },
                    { label: 'BuddyPass Level & XP', value: 'level', emoji: '⭐' },
                    { label: 'PvP K/D Ratio', value: 'pvp', emoji: '⚔️' }
                ])
        );

        const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lb_refresh_${category}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        );

        if (interaction.isRepliable()) {
            if (interaction.deferred || interaction.replied) {
                return await interaction.update({ embeds: [embed], components: [selectRow, btnRow] }).catch(() => {});
            } else {
                return await interaction.reply({ embeds: [embed], components: [selectRow, btnRow], flags: 64 }).catch(() => {});
            }
        }
    } catch (err) {
        console.error('Leaderboard Error:', err);
        if (interaction.isRepliable() && !interaction.replied) {
            return interaction.reply({ content: '❌ An error occurred loading the leaderboards.', flags: 64 }).catch(() => {});
        }
    }
};