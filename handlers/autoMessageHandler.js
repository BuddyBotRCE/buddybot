const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { AutoMessage } = require('../database/db');

async function renderAutoMessagePanel(interaction, messageOverride = '') {
    const guildId = interaction.guild.id;
    const messages = await AutoMessage.findAll({ where: { guildId } });

    let msgList = messages.length > 0
        ? messages.map((m, i) => `**${i + 1}.** [Every ${m.intervalMinutes}m] ${m.isEnabled ? '🟢' : '🔴'}\n> \`${m.message}\``).join('\n\n')
        : '*No auto-messages configured yet. Click "Add Message" below!*';

    const embed = new EmbedBuilder()
        .setTitle('📢 Automated Server Messages Manager')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Configure periodic broadcast messages that automatically display in the Rust server chat.\n\n` +
            `**Active Messages:**\n${msgList}`
        )
        .setColor('#3498db');

    const components = [];

    if (messages.length > 0) {
        const delMenu = new StringSelectMenuBuilder()
            .setCustomId('automsg_del_select')
            .setPlaceholder('🗑️ Select a message to delete...')
            .addOptions(messages.slice(0, 25).map(m => ({
                label: `Every ${m.intervalMinutes}m: ${m.message.substring(0, 40)}...`,
                value: m.id.toString()
            })));
        components.push(new ActionRowBuilder().addComponents(delMenu));
    }

    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('automsg_btn_add').setLabel('Add Message').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Dashboard').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    ));

    const payload = { embeds: [embed], components, flags: 64 };
    
    if (interaction.isMessageComponent()) {
        if (interaction.replied || interaction.deferred) return await interaction.editReply(payload);
        else return await interaction.update(payload);
    } else {
        return await interaction.reply(payload);
    }
}

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        const selectedVal = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        if (interaction.isButton() && customId === 'automsg_btn_add') {
            const modal = new ModalBuilder().setCustomId('modal_automsg_add').setTitle('Create Auto-Message');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_text').setLabel('Message Text (Supports RCON quotes)').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_mins').setLabel('Interval in Minutes (e.g. 30)').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_automsg_add') {
            const message = interaction.fields.getTextInputValue('msg_text').trim();
            const intervalMinutes = parseInt(interaction.fields.getTextInputValue('msg_mins')) || 30;

            await AutoMessage.create({ guildId, message, intervalMinutes });
            return await renderAutoMessagePanel(interaction, `✅ Successfully created new auto-message (Interval: ${intervalMinutes}m)!`);
        }

        if (interaction.isStringSelectMenu() && customId === 'automsg_del_select') {
            await AutoMessage.destroy({ where: { id: selectedVal, guildId } });
            return await renderAutoMessagePanel(interaction, `🗑️ Successfully deleted the auto-message.`);
        }

        if (interaction.isButton() && customId === 'admin_menu_back') {
            const adminHandler = require('./adminHandler');
            if (adminHandler && adminHandler.renderMainPanel) return await adminHandler.renderMainPanel(interaction);
        }

        return await renderAutoMessagePanel(interaction);
    } catch (err) {
        console.error('[AUTO MESSAGE HANDLER ERROR]', err);
    }
};

module.exports.refreshPanelViaInteraction = async (interaction, message) => {
    if (message) await interaction.editReply({ content: message }).catch(() => {});
    await renderAutoMessagePanel(interaction);
};