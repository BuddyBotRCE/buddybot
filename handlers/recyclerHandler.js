const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { RecyclerConfig } = require('../database/db');

async function renderRecyclerPanel(interaction) {
    try {
        const guildId = interaction.guild.id;
        
        const [config] = await RecyclerConfig.findOrCreate({ where: { guildId }, defaults: { cooldownMinutes: 15 } }).catch(err => [{ requiredRoleId: null, cooldownMinutes: 15 }]);

        const roleDisplay = config.requiredRoleId ? `<@&${config.requiredRoleId}>` : '`None (Open to all)`';

        const embed = new EmbedBuilder()
            .setTitle('♻️ Dynamic Recycler System')
            .setDescription(
                `Configure the dynamic Recycler deployment system.\n\n` +
                `• **Required Role:** ${roleDisplay}\n` +
                `• **Cooldown Timer:** \`${config.cooldownMinutes} minutes\` per player\n\n` +
                `**How it works in-game:** \nWhen a player uses the \`Repair This\` emote (or types \`!recycler\`), the bot will instantly grab their coordinates and spawn a recycler right at their feet!`
            )
            .setColor('#27ae60');

        const row1 = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder().setCustomId('recycler_select_role').setPlaceholder('Select required Discord role...').setMinValues(1).setMaxValues(1)
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_recycler_cd').setLabel('Set Cooldown').setStyle(ButtonStyle.Primary).setEmoji('⏳'),
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Dashboard').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );

        const payload = { embeds: [embed], components: [row1, row2], flags: 64 };
        
        if (interaction.isMessageComponent()) {
            if (interaction.replied || interaction.deferred) return await interaction.editReply(payload);
            else return await interaction.update(payload);
        } else {
            return await interaction.reply(payload);
        }
    } catch (err) {
        console.error('[RECYCLER UI RENDER ERROR]', err);
    }
}

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;

        if (interaction.isRoleSelectMenu() && customId === 'recycler_select_role') {
            await RecyclerConfig.upsert({ guildId, requiredRoleId: interaction.values[0] });
            return await renderRecyclerPanel(interaction);
        }

        if (interaction.isButton() && customId === 'btn_recycler_cd') {
            const config = await RecyclerConfig.findOne({ where: { guildId } });
            const currentCd = config ? config.cooldownMinutes : 15;

            const modal = new ModalBuilder().setCustomId('modal_recycler_cd').setTitle('Configure Recycler Cooldown');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('cd_mins').setLabel("Cooldown in Minutes (0 for none)").setStyle(TextInputStyle.Short).setValue(currentCd.toString()).setRequired(true)
                )
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && customId === 'modal_recycler_cd') {
            const mins = parseInt(interaction.fields.getTextInputValue('cd_mins')) || 0;
            await RecyclerConfig.upsert({ guildId, cooldownMinutes: mins });
            return await renderRecyclerPanel(interaction);
        }

        if (interaction.isButton() && customId === 'admin_menu_back') {
            const adminHandler = require('./adminHandler');
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
        }

        return await renderRecyclerPanel(interaction);

    } catch (err) {
        console.error('[RECYCLER HANDLER ERROR]', err);
    }
};

module.exports.refreshPanelViaInteraction = async (interaction, message) => {
    if (message) await interaction.editReply({ content: message }).catch(() => {});
    await renderRecyclerPanel(interaction);
};