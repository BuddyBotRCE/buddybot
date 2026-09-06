const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder } = require('discord.js');
const { RecyclerConfig, RecyclerLocation } = require('../database/db');
const { captureAdminPosition } = require('../utils/rconPosTracker'); 
const adminHandler = require('./adminHandler');

async function renderRecyclerPanel(interaction) {
    const guildId = interaction.guild.id;
    const [config] = await RecyclerConfig.findOrCreate({ where: { guildId }, defaults: { cooldownMinutes: 15 } });
    const location = await RecyclerLocation.findOne({ where: { guildId } });

    const roleDisplay = config.requiredRoleId ? `<@&${config.requiredRoleId}>` : '`None (Open to all)`';
    const locDisplay = location ? `✅ **Saved at:** \`X: ${location.posX}, Y: ${location.posY}, Z: ${location.posZ}\`` : '🔴 `Not Set`';

    const embed = new EmbedBuilder()
        .setTitle('♻️ Independent Recycler System')
        .setDescription(
            `Configure a dedicated server Recycler that players can spawn via quick-chat emote.\n\n` +
            `• **Required Role:** ${roleDisplay}\n` +
            `• **Location Status:** ${locDisplay}\n\n` +
            `**How to spawn in-game:** Emote \`I Need Scrap\` or type \`!recycler\``
        )
        .setColor('#27ae60');

    const row1 = new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('recycler_select_role').setPlaceholder('Select required Discord role...').setMinValues(1).setMaxValues(1)
    );
    
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_recycler_capture').setLabel('Capture Location In-Game').setStyle(ButtonStyle.Success).setEmoji('📍'),
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Dashboard').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    const payload = { embeds: [embed], components: [row1, row2], flags: 64 };
    
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        return await interaction.reply(payload);
    }
    return await interaction.update(payload).catch(() => {});
}

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;

        if (interaction.isRoleSelectMenu() && customId === 'recycler_select_role') {
            await RecyclerConfig.upsert({ guildId, requiredRoleId: interaction.values[0] });
            return await renderRecyclerPanel(interaction);
        }

        if (interaction.isButton() && customId === 'btn_recycler_capture') {
            await interaction.reply({ content: '📍 **Fetching your current position via RCON...** (Please wait 3-5 seconds)', flags: 64 });
            // Tells the tracker to save to the 'recycler' type
            return await captureAdminPosition(interaction, 'recycler');
        }

        if (interaction.isButton() && customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
        }

        // Default open
        return await renderRecyclerPanel(interaction);

    } catch (err) {
        console.error('[RECYCLER HANDLER ERROR]', err);
    }
};

module.exports.refreshPanelViaInteraction = async (interaction, message) => {
    if (message) await interaction.editReply({ content: message }).catch(() => {});
    await renderRecyclerPanel(interaction);
};