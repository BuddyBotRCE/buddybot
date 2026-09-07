const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { AutoMessage, GameServer } = require('../database/db');

const COLOR_OPTIONS = [
    { label: '🟢 Emerald Green (#2ecc71)', value: '#2ecc71', description: 'Fresh, vibrant success tone' },
    { label: '🔵 Dodger Blue (#3498db)', value: '#3498db', description: 'Standard professional blue' },
    { label: '🟡 Amber Gold (#f1c40f)', value: '#f1c40f', description: 'Warm warning or notice tone' },
    { label: '🔴 Crimson Red (#e74c3c)', value: '#e74c3c', description: 'Bold alert or danger tone' },
    { label: '🟣 Amethyst Purple (#9b59b6)', value: '#9b59b6', description: 'Sleek premium accent' },
    { label: '🩷 Hot Pink (#ff69b4)', value: '#ff69b4', description: 'Bright energetic pink' },
    { label: '🟠 Neon Orange (#ff4500)', value: '#ff4500', description: 'High-visibility vibrant orange' },
    { label: '🔵 Cyan / Aqua (#00ffff)', value: '#00ffff', description: 'Electric bright cyan' },
    { label: '🍋 Lime Green (#00ff00)', value: '#00ff00', description: 'Luminous neon green' },
    { label: '🩅 Electric Indigo (#4b0082)', value: '#4b0082', description: 'Deep mystical purple-blue' },
    { label: '🤍 Pure White (#ffffff)', value: '#ffffff', description: 'Clean crisp neutral' },
    { label: '🖤 Midnight Dark (#111111)', value: '#111111', description: 'Stealth black tone' },
    { label: '🤎 Chocolate Brown (#8b4513)', value: '#8b4513', description: 'Earthy rust tone' },
    { label: '🪙 Luxury Gold (#ffd700)', value: '#ffd700', description: 'Metallic store gold' },
    { label: '🩵 Turquoise Blue (#40e0d0)', value: '#40e0d0', description: 'Refreshing aqua blue' },
    { label: '🪸 Coral Pink (#ff7f50)', value: '#ff7f50', description: 'Warm sunset coral' },
    { label: '🌿 Forest Green (#228b22)', value: '#228b22', description: 'Deep natural green' },
    { label: '🌊 Deep Navy Blue (#000080)', value: '#000080', description: 'Dark ocean navy' },
    { label: '🍇 Grape Purple (#6f2da8)', value: '#6f2da8', description: 'Rich dark violet' },
    { label: '⚡ Electric Yellow (#ffff00)', value: '#ffff00', description: 'High-contrast bright yellow' },
    { label: '🏮 Rust Orange (#b7410e)', value: '#b7410e', description: 'Classic Rust game orange' },
    { label: '❄️ Ice Blue (#add8e6)', value: '#add8e6', description: 'Cool light pastel blue' },
    { label: '🌸 Pastel Pink (#ffb6c1)', value: '#ffb6c1', description: 'Soft muted pink' },
    { label: '🫒 Olive Drab (#556b2f)', value: '#556b2f', description: 'Tactical military olive' },
    { label: '🩻 Slate Grey (#708090)', value: '#708090', description: 'Neutral modern slate' }
];

async function renderAutoMessagePanel(interaction, messageOverride = '') {
    const guildId = interaction.guild.id;
    const messages = await AutoMessage.findAll({ where: { guildId } });
    const servers = await GameServer.findAll({ where: { guildId } });

    let msgList = messages.length > 0
        ? messages.map((m, i) => {
            const serverTarget = m.serverId ? servers.find(s => s.id.toString() === m.serverId)?.serverName || 'Specific Server' : '🌐 All Servers';
            return `**${i + 1}.** ${m.isEnabled ? '🟢 ACTIVE' : '🔴 PAUSED'} | Interval: \`${m.intervalMinutes}m\` | Target: \`${serverTarget}\`\n` +
                   `> **Prefix:** \`${m.prefix}\` | **Color:** \`${m.color}\`\n` +
                   `> \`${m.message}\``;
        }).join('\n\n')
        : '*No auto-messages configured yet. Click "Add Message" below!*';

    const embed = new EmbedBuilder()
        .setTitle('📢 Automated Server Messages Manager')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Configure periodic broadcast messages that automatically display in Rust server chats with custom intervals, target servers, prefixes, and color themes.\n\n` +
            `**Active Broadcasts (${messages.length}):**\n${msgList}`
        )
        .setColor('#3498db');

    const components = [];

    if (messages.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('automsg_manage_select')
            .setPlaceholder('⚙️ Select a message to edit, toggle, or delete...')
            .addOptions(messages.slice(0, 25).map(m => ({
                label: `[${m.intervalMinutes}m] ${m.prefix} ${m.message.substring(0, 30)}...`.substring(0, 100),
                value: m.id.toString(),
                description: `Status: ${m.isEnabled ? 'Active' : 'Paused'}`,
                emoji: m.isEnabled ? '🟢' : '🔴'
            })));
        components.push(new ActionRowBuilder().addComponents(selectMenu));
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

async function renderEditMessagePanel(interaction, msgId) {
    const msgObj = await AutoMessage.findByPk(msgId);
    if (!msgObj) return renderAutoMessagePanel(interaction, '❌ Message not found.');

    const servers = await GameServer.findAll({ where: { guildId: interaction.guild.id } });
    const targetName = msgObj.serverId ? servers.find(s => s.id.toString() === msgObj.serverId)?.serverName || 'Specific Server' : '🌐 All Servers';

    const embed = new EmbedBuilder()
        .setTitle(`✏️ Editing Auto-Message #${msgObj.id}`)
        .setDescription(
            `• **Status:** ${msgObj.isEnabled ? '🟢 Active' : '🔴 Paused'}\n` +
            `• **Interval:** \`${msgObj.intervalMinutes} minutes\`\n` +
            `• **Target Server:** \`${targetName}\`\n` +
            `• **Prefix:** \`${msgObj.prefix}\`\n` +
            `• **Color Theme Preview:** \`⬛⬛⬛ ${msgObj.color} ⬛⬛⬛\`\n\n` +
            `**Message Content:**\n> \`${msgObj.message}\``
        )
        .setColor(msgObj.color || '#3498db');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`automsg_toggle_${msgObj.id}`).setLabel(msgObj.isEnabled ? 'Pause Message' : 'Enable Message').setStyle(msgObj.isEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(msgObj.isEnabled ? '⏸️' : '▶️'),
        new ButtonBuilder().setCustomId(`automsg_edit_text_${msgObj.id}`).setLabel('Edit Content & Prefix').setStyle(ButtonStyle.Primary).setEmoji('📝'),
        new ButtonBuilder().setCustomId(`automsg_edit_time_${msgObj.id}`).setLabel('Set Interval').setStyle(ButtonStyle.Secondary).setEmoji('⏱️'),
        new ButtonBuilder().setCustomId(`automsg_edit_color_${msgObj.id}`).setLabel('Color Theme').setStyle(ButtonStyle.Secondary).setEmoji('🎨')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`automsg_edit_server_${msgObj.id}`).setLabel('Target Server').setStyle(ButtonStyle.Secondary).setEmoji('🌐'),
        new ButtonBuilder().setCustomId(`automsg_delete_${msgObj.id}`).setLabel('Delete Message').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
        new ButtonBuilder().setCustomId('automsg_back_main').setLabel('Back to List').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    return interaction.update({ embeds: [embed], components: [row1, row2], flags: 64 });
}

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        const selectedVal = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        if (interaction.isButton() && customId === 'automsg_btn_add') {
            const modal = new ModalBuilder().setCustomId('modal_automsg_add').setTitle('Create Auto-Message');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_prefix').setLabel('Prefix Tag (e.g. [SERVER], [EVENT])').setStyle(TextInputStyle.Short).setValue('[ANNOUNCEMENT]').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_text').setLabel('Message Text').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_mins').setLabel('Interval in Minutes (e.g. 30)').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_automsg_add') {
            const prefix = interaction.fields.getTextInputValue('msg_prefix').trim();
            const message = interaction.fields.getTextInputValue('msg_text').trim();
            const intervalMinutes = parseInt(interaction.fields.getTextInputValue('msg_mins')) || 30;

            await AutoMessage.create({ guildId, prefix, message, intervalMinutes });
            return await renderAutoMessagePanel(interaction, `✅ Successfully created new auto-message!`);
        }

        if (interaction.isStringSelectMenu() && customId === 'automsg_manage_select') {
            return await renderEditMessagePanel(interaction, selectedVal);
        }

        if (interaction.isButton() && customId === 'automsg_back_main') {
            return await renderAutoMessagePanel(interaction);
        }

        if (customId.startsWith('automsg_toggle_')) {
            const msgId = customId.replace('automsg_toggle_', '');
            const msgObj = await AutoMessage.findByPk(msgId);
            if (msgObj) {
                await msgObj.update({ isEnabled: !msgObj.isEnabled });
                return await renderEditMessagePanel(interaction, msgId);
            }
        }

        if (customId.startsWith('automsg_delete_')) {
            const msgId = customId.replace('automsg_delete_', '');
            await AutoMessage.destroy({ where: { id: msgId, guildId } });
            return await renderAutoMessagePanel(interaction, `🗑️ Successfully deleted auto-message.`);
        }

        if (customId.startsWith('automsg_edit_text_')) {
            const msgId = customId.replace('automsg_edit_text_', '');
            const msgObj = await AutoMessage.findByPk(msgId);
            const modal = new ModalBuilder().setCustomId(`modal_automsg_text_${msgId}`).setTitle('Edit Message Text & Prefix');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_prefix').setLabel('Prefix Tag').setStyle(TextInputStyle.Short).setValue(msgObj.prefix).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_text').setLabel('Message Content').setStyle(TextInputStyle.Paragraph).setValue(msgObj.message).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId.startsWith('modal_automsg_text_')) {
            const msgId = customId.replace('modal_automsg_text_', '');
            const prefix = interaction.fields.getTextInputValue('msg_prefix').trim();
            const message = interaction.fields.getTextInputValue('msg_text').trim();
            await AutoMessage.update({ prefix, message }, { where: { id: msgId } });
            return await renderEditMessagePanel(interaction, msgId);
        }

        if (customId.startsWith('automsg_edit_time_')) {
            const msgId = customId.replace('automsg_edit_time_', '');
            const msgObj = await AutoMessage.findByPk(msgId);
            const modal = new ModalBuilder().setCustomId(`modal_automsg_time_${msgId}`).setTitle('Edit Interval Time');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_mins').setLabel('Interval in Minutes').setStyle(TextInputStyle.Short).setValue(msgObj.intervalMinutes.toString()).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId.startsWith('modal_automsg_time_')) {
            const msgId = customId.replace('modal_automsg_time_', '');
            const intervalMinutes = parseInt(interaction.fields.getTextInputValue('msg_mins')) || 30;
            await AutoMessage.update({ intervalMinutes }, { where: { id: msgId } });
            return await renderEditMessagePanel(interaction, msgId);
        }

        if (customId.startsWith('automsg_edit_color_')) {
            const msgId = customId.replace('automsg_edit_color_', '');
            const embed = new EmbedBuilder().setTitle('🎨 Choose Color Theme').setDescription('Select from 25 expanded color theme presets for this announcement style.').setColor('#3498db');
            const menu = new StringSelectMenuBuilder().setCustomId(`automsg_color_select_${msgId}`).setPlaceholder('Select color theme...').addOptions(COLOR_OPTIONS);
            return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`automsg_back_edit_${msgId}`).setLabel('Back').setStyle(ButtonStyle.Secondary))] });
        }

        if (interaction.isStringSelectMenu() && customId.startsWith('automsg_color_select_')) {
            const msgId = customId.replace('automsg_color_select_', '');
            const color = selectedVal;
            await AutoMessage.update({ color }, { where: { id: msgId } });
            return await renderEditMessagePanel(interaction, msgId);
        }

        if (customId.startsWith('automsg_edit_server_')) {
            const msgId = customId.replace('automsg_edit_server_', '');
            const servers = await GameServer.findAll({ where: { guildId } });
            
            let serverOptions = [{ label: '🌐 All Servers (Global Broadcast)', value: 'target_server_all', emoji: '🌐' }];
            if (servers.length > 0) {
                servers.forEach(s => {
                    serverOptions.push({ label: `🖥️ Server: ${s.serverName}`, value: `target_server_${s.id}`, emoji: '🖥️' });
                });
            }

            const embed = new EmbedBuilder().setTitle('🌐 Target Server').setDescription('Choose whether this message broadcasts to all connected servers or a single specific server.').setColor('#3498db');
            const menu = new StringSelectMenuBuilder().setCustomId(`automsg_server_select_${msgId}`).setPlaceholder('Select target server...').addOptions(serverOptions);
            return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`automsg_back_edit_${msgId}`).setLabel('Back').setStyle(ButtonStyle.Secondary))] });
        }

        if (interaction.isStringSelectMenu() && customId.startsWith('automsg_server_select_')) {
            const msgId = customId.replace('automsg_server_select_', '');
            const serverId = selectedVal === 'target_server_all' ? null : selectedVal.replace('target_server_', '');
            await AutoMessage.update({ serverId }, { where: { id: msgId } });
            return await renderEditMessagePanel(interaction, msgId);
        }

        if (customId.startsWith('automsg_back_edit_')) {
            const msgId = customId.replace('automsg_back_edit_', '');
            return await renderEditMessagePanel(interaction, msgId);
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