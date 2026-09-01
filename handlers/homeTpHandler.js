const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { HomeTeleportConfig, GameServer } = require('../database/db');
const adminHandler = require('./adminHandler');

const homeTpSessions = new Map();

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        if (!homeTpSessions.has(guildId)) homeTpSessions.set(guildId, { serverId: null });
        const session = homeTpSessions.get(guildId);

        async function renderHomeTpPanel(messageOverride = '') {
            const [config] = await HomeTeleportConfig.findOrCreate({ where: { guildId }, defaults: { cooldownMinutes: 30 } });
            const roleDisplay = config.requiredRoleId ? `<@&${config.requiredRoleId}>` : '`None (Open to all players)`';
            const servers = await GameServer.findAll({ where: { guildId } });

            let serverDisplay = '`Default / Main Server`';
            if (session.serverId) {
                const targetServer = servers.find(s => s.id == session.serverId);
                if (targetServer) serverDisplay = `**${targetServer.serverName}**`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🏠 Home Teleport Manager')
                .setDescription(
                    (messageOverride ? `**${messageOverride}**\n\n` : '') +
                    `Configure your emote wheel retreat teleport system.\n\n` +
                    `• **Target Server:** ${serverDisplay}\n` +
                    `• **Required Role:** ${roleDisplay}\n` +
                    `• **Cooldown:** ${config.cooldownMinutes} minutes\n` +
                    `• **Set Home Emote:** \`Can I have a key\` (Triggers suicide to log respawn bed coords)\n` +
                    `• **Teleport Emote:** \`Retreat\` (Teleports home)`
                )
                .setColor('#e67e22');

            let components = [];

            if (servers.length > 0) {
                const serverOptions = [{ label: 'Default / Main Server', value: 'hometp_server_default', emoji: '🌐' }, ...servers.map(s => ({ label: s.serverName, value: `hometp_server_${s.id}`, emoji: '🖥️' }))];
                components.push(new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('hometp_menu_server_select').setPlaceholder('🖥️ Select target server...').addOptions(serverOptions)
                ));
            }

            const row1 = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('hometp_select_role').setPlaceholder('Select required role...').setMinValues(1).setMaxValues(1)
            );
            
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hometp_btn_settings').setLabel('Set Cooldown Minutes').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
                new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
            );

            components.push(row1, row2);

            return { embeds: [embed], components };
        }

        if (customId === 'admin_menu_select' && selectedValue === 'setup_hometp') {
            const panelData = await renderHomeTpPanel();
            return interaction.reply({ ...panelData, flags: 64 });
        }

        if (interaction.isStringSelectMenu() && customId === 'hometp_menu_server_select') {
            session.serverId = selectedValue === 'hometp_server_default' ? null : selectedValue.replace('hometp_server_', '');
            const panelData = await renderHomeTpPanel('🖥️ Target server updated!');
            return interaction.update(panelData);
        }

        if (interaction.isRoleSelectMenu() && customId === 'hometp_select_role') {
            const roleId = interaction.values[0];
            await HomeTeleportConfig.upsert({ guildId, requiredRoleId: roleId });
            
            const panelData = await renderHomeTpPanel(`✅ Required role successfully updated to <@&${roleId}>!`);
            return interaction.update(panelData);
        }

        if (interaction.isButton() && customId === 'hometp_btn_settings') {
            const config = await HomeTeleportConfig.findOne({ where: { guildId } });
            const modal = new ModalBuilder().setCustomId('modal_hometp_settings').setTitle('Home Teleport Cooldown');
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('tp_cooldown').setLabel('Cooldown (Minutes)').setStyle(TextInputStyle.Short).setValue(`${config?.cooldownMinutes || 30}`).setRequired(true)
                )
            );
            
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_hometp_settings') {
            const cooldownMinutes = parseInt(interaction.fields.getTextInputValue('tp_cooldown')) || 30;
            await HomeTeleportConfig.upsert({ guildId, cooldownMinutes });

            const panelData = await renderHomeTpPanel(`✅ Home Teleport cooldown updated to **${cooldownMinutes} minutes**!`);
            return interaction.update(panelData);
        }

        if (interaction.isButton() && customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
            return interaction.update({ content: '🔙 Returned to main dashboard.', components: [], embeds: [] });
        }

    } catch (err) {
        console.error('[HOME TP HANDLER ERROR]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing the home teleport settings.', flags: 64 }).catch(() => {});
        }
    }
};