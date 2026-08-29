const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig } = require('../database/db');
const adminHandler = require('./adminHandler');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (customId === 'admin_menu_back') {
        if (adminHandler && adminHandler.renderMainPanel) {
            return await adminHandler.renderMainPanel(interaction);
        }
        return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
    }

    if (customId === 'admin_menu_select' && selectedValue === 'setup_skipnight') {
        return await renderSkipNightPanel(interaction);
    }

    if (interaction.isButton()) {
        if (customId === 'btn_toggle_skipnight') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const newState = !(config?.skipNightEnabled || false);
            await GuildConfig.upsert({ guildId: interaction.guild.id, skipNightEnabled: newState });
            return await renderSkipNightPanel(interaction, `✅ Skip night feature turned **${newState ? 'ON 🟢' : 'OFF 🔴'}**!`);
        }

        if (customId === 'btn_set_skipnight_percentage') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_skipnight_percentage').setTitle('Set Vote Percentage');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('percentage_val')
                        .setLabel('Required % of Players (e.g., 40, 50)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(`${config?.skipNightPercentage || 50}`)
                        .setRequired(true)
                )
            );
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && customId === 'modal_skipnight_percentage') {
        const val = parseInt(interaction.fields.getTextInputValue('percentage_val'));
        if (isNaN(val) || val < 1 || val > 100) {
            return interaction.reply({ content: '❌ Please enter a valid percentage between 1 and 100.', flags: 64 });
        }
        await GuildConfig.upsert({ guildId: interaction.guild.id, skipNightPercentage: val });
        return await renderSkipNightPanel(interaction, `✅ Vote threshold successfully set to **${val}%**!`);
    }
};

async function renderSkipNightPanel(interaction, messageText = '') {
    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
    const isEnabled = config?.skipNightEnabled || false;
    const percentage = config?.skipNightPercentage || 50;

    const embed = new EmbedBuilder()
        .setTitle('🌙 Skip Night Configuration')
        .setDescription(
            (messageText ? `**${messageText}**\n\n` : '') +
            'Configure the in-game quick-chat vote system allowing players to skip the dark nighttime cycle.\n\n' +
            `• **Status:** ${isEnabled ? '🟢 ACTIVE' : '🔴 DISABLED'}\n` +
            `• **Required Vote Threshold:** \`${percentage}%\` of active players\n` +
            `• **Trigger Emote Phrase:** \`Wait Here\` (In-game Quick Chat)`
        )
        .setColor('#e67e22');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_toggle_skipnight')
            .setLabel(isEnabled ? 'Disable Skip Night' : 'Enable Skip Night')
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(isEnabled ? '🔴' : '🟢'),
        new ButtonBuilder()
            .setCustomId('btn_set_skipnight_percentage')
            .setLabel('Set Vote Percentage')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('admin_menu_back')
            .setLabel('Back to Admin Panel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔙')
    );

    const payload = { embeds: [embed], components: [row1, row2], flags: 64 };
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply(payload);
    } else if (interaction.isButton() || interaction.isModalSubmit()) {
        return await interaction.update(payload);
    } else {
        return await interaction.reply(payload);
    }
}