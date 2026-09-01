const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { GameServer } = require('../database/db');
const adminHandler = require('./adminHandler');
const gunGameHandler = require('./gunGameHandler');
const battleRoyaleHandler = require('./battleRoyaleHandler');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';
        const guildId = interaction.guild.id;

        if (customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
            return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] }).catch(() => {});
        }

        const embed = new EmbedBuilder()
            .setTitle('🎮 Buddy Games: Arena Event Suite')
            .setDescription('Manage your Rust Console Edition automated arena minigames below:')
            .setColor('#9b59b6');

        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('buddy_games_hub_select').setPlaceholder('Choose an arena game to configure...')
                .addOptions([
                    { label: '🎯 Gun Game Manager', value: 'hub_goto_gungame', description: 'Configure weapon ladder, presets, and spawns', emoji: '🎯' },
                    { label: '🛡️ Battle Royale Manager', value: 'hub_goto_br', description: 'Configure elite crate drops and fill percentages', emoji: '🛡️' }
                ])
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );

        if (!interaction.deferred && !interaction.replied) {
            return await interaction.update({ embeds: [embed], components: [row1, row2] }).catch(async () => {
                await interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 }).catch(() => {});
            });
        } else {
            return await interaction.editReply({ embeds: [embed], components: [row1, row2] }).catch(() => {});
        }

    } catch (error) {
        console.error('[BUDDY GAMES HANDLER ERROR]', error);
        if (interaction && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `❌ Error loading panel: ${error.message}`, flags: 64 }).catch(() => {});
        }
    }
};