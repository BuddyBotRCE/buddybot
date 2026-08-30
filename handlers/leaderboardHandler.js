const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { GuildConfig, UserEconomy } = require('../database/db');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

    try {
        let category = 'wealth';
        if (customId === 'hub_lb_select') {
            category = selectedValue;
        } else if (customId.startsWith('lb_refresh_')) {
            category = customId.replace('lb_refresh_', '');
        }

        // Fetch fresh config & fresh user economy records from the database
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config ? config.economyCurrency : 'Scrap';
        
        // Force a fresh reload from the database table (no cached models)
        const allPlayers = await UserEconomy.findAll({ 
            where: { guildId: interaction.guild.id },
            raw: true // pulls plain JS objects to prevent stale Sequelize instance caches
        });

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
                const totalWealth = (player.wallet || 0) + (player.bank || 0);
                leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **${totalWealth.toLocaleString()}** ${currency}\n`; 
            });
        } else if (category === 'level') {
            const sortedPlayers = allPlayers.sort((a, b) => { 
                if ((b.level || 1) === (a.level || 1)) return (b.xp || 0) - (a.xp || 0); 
                return (b.level || 1) - (a.level || 1); 
            }).slice(0, 10);
            embedTitle = '⭐ BuddyPass Leaderboard'; 
            embedColor = '#00ff00';
            sortedPlayers.forEach((player, index) => { 
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`; 
                const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked'; 
                leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **Level ${player.level || 1}** (${(player.xp || 0).toLocaleString()} XP)\n`; 
            });
        } else if (category === 'pvp' || category === 'pvpKills') {
            const sortedPlayers = allPlayers.sort((a, b) => {
                const killsA = a.pvpKills || 0;
                const deathsA = a.deaths || 0;
                const killsB = b.pvpKills || 0;
                const deathsB = b.deaths || 0;
                
                const kdRatioA = deathsA === 0 ? killsA : (killsA / deathsA); 
                const kdRatioB = deathsB === 0 ? killsB : (killsB / deathsB);
                
                if (kdRatioB === kdRatioA) return killsB - killsA; 
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
                    { label: 'Wealth (Wallet + Bank)', value: 'wealth', emoji: '💰', default: category === 'wealth' },
                    { label: 'BuddyPass Level & XP', value: 'level', emoji: '⭐', default: category === 'level' },
                    { label: 'PvP K/D Ratio', value: 'pvp', emoji: '⚔️', default: category === 'pvp' }
                ])
        );

        const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lb_refresh_${category}`).setLabel('Refresh Leaderboard').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        );

        // Acknowledge and update the interaction message components cleanly
        if (interaction.isRepliable()) {
            return await interaction.update({ embeds: [embed], components: [selectRow, btnRow] }).catch(async () => {
                // Fallback if interaction update window expired
                await interaction.followUp({ embeds: [embed], components: [selectRow, btnRow], flags: 64 }).catch(() => {});
            });
        }
    } catch (err) {
        console.error('Leaderboard Update Error:', err);
        if (interaction.isRepliable() && !interaction.replied) {
            return interaction.reply({ content: '❌ An error occurred updating the leaderboards.', flags: 64 }).catch(() => {});
        }
    }
};