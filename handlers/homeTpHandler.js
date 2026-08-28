const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { HomeTeleportConfig } = require('../database/db');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // 1. Admin Panel Setup View (triggered from Dropdown 2 / Premium Panel)
        if (customId === 'admin_menu_select' && selectedValue === 'setup_hometp') {
            const [config] = await HomeTeleportConfig.findOrCreate({ where: { guildId }, defaults: { cooldownMinutes: 30 } });
            const roleDisplay = config.requiredRoleId ? `<@&${config.requiredRoleId}>` : '`None (Open to all players)`';

            const embed = new EmbedBuilder()
                .setTitle('🏠 Home Teleport Manager')
                .setDescription(`Configure your emote wheel retreat teleport system.\n\n` +
                    `• **Required Role:** ${roleDisplay}\n` +
                    `• **Cooldown:** ${config.cooldownMinutes} minutes\n` +
                    `• **Set Home Emote:** \`Can I have a key\` (Triggers suicide to log respawn bed coords)\n` +
                    `• **Teleport Emote:** \`Retreat\` (Teleports home)`)
                .setColor('#e67e22');

            const row1 = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder().setCustomId('hometp_select_role').setPlaceholder('Select required role...').setMinValues(1).setMaxValues(1)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hometp_btn_settings').setLabel('Set Cooldown Minutes').setStyle(ButtonStyle.Primary).setEmoji('⚙️')
            );

            return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
        }

        // 2. Save Role Selection from Role Select Menu
        if (interaction.isRoleSelectMenu() && customId === 'hometp_select_role') {
            const roleId = interaction.values[0];
            await HomeTeleportConfig.upsert({ guildId, requiredRoleId: roleId });
            return interaction.update({ content: `✅ Home Teleport required role successfully set to <@&${roleId}>!`, components: [], embeds: [] });
        }

        // 3. Open Cooldown Settings Modal
        if (interaction.isButton() && customId === 'hometp_btn_settings') {
            const config = await HomeTeleportConfig.findOne({ where: { guildId } });
            const modal = new ModalBuilder().setCustomId('modal_hometp_settings').setTitle('Home Teleport Cooldown');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('tp_cooldown').setLabel('Cooldown (Minutes)').setStyle(TextInputStyle.Short).setValue(`${config?.cooldownMinutes || 30}`).setRequired(true)
                )
            );
            return interaction.showModal(modal);
        }

        // 4. Save Modal Settings
        if (interaction.isModalSubmit() && customId === 'modal_hometp_settings') {
            const cooldownMinutes = parseInt(interaction.fields.getTextInputValue('tp_cooldown')) || 30;

            await HomeTeleportConfig.upsert({ guildId, cooldownMinutes });
            return interaction.reply({ content: `✅ Home Teleport cooldown updated to **${cooldownMinutes} minutes**!`, flags: 64 });
        }

    } catch (err) {
        console.error('[HOME TP HANDLER ERROR]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing the home teleport settings.', flags: 64 }).catch(() => {});
        }
    }
};