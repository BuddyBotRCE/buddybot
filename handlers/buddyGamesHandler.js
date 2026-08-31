const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const adminHandler = require('./adminHandler');
const gunGameHandler = require('./gunGameHandler');
const battleRoyaleHandler = require('./battleRoyaleHandler');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

    if (customId === 'admin_menu_back') {
        if (adminHandler && adminHandler.renderMainPanel) {
            return await adminHandler.renderMainPanel(interaction);
        }
        return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] }).catch(() => {});
    }

    // 1. Triggered from Dropdown 2: Shows the main Buddy Games menu
    if (customId === 'admin_menu_select_2' && selectedValue === 'setup_buddy_games') {
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

        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply({ embeds: [embed], components: [row1, row2] });
        }
        return await interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }

    // 2. Handles selection from the Buddy Games hub dropdown
    if (customId === 'buddy_games_hub_select') {
        if (selectedValue === 'hub_goto_gungame') {
            interaction.values = ['setup_gungame'];
            interaction.customId = 'admin_menu_select';
            return await gunGameHandler(interaction, client);
        }

        if (selectedValue === 'hub_goto_br') {
            interaction.values = ['setup_battleroyale'];
            interaction.customId = 'admin_menu_select';
            return await battleRoyaleHandler(interaction, client);
        }
    }
};