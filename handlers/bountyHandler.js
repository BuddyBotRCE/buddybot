const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, ActiveBounty } = require('../database/db');
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

    if (customId === 'admin_menu_select' && selectedValue === 'setup_bounties') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const activeBounties = await ActiveBounty.count({ where: { guildId: interaction.guild.id } });
        
        const embed = new EmbedBuilder()
            .setTitle('🎯 Bounties System Manager')
            .setDescription(`Configure automatic killstreak bounties.\n\n• **Kills to Activate:** ${config?.bountyKillsToActivate || 5}\n• **Reward Amount:** ${config?.bountyRewardAmount || 500} ${config?.economyCurrency || 'Scrap'}\n• **Cooldown After Bounty:** ${config?.bountyCooldownMinutes || 60} mins\n\n• **Current Active Bounties:** ${activeBounties}`)
            .setColor('#e74c3c');
            
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_bounty_settings').setLabel('Configure Bounties').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
            new ButtonBuilder().setCustomId('btn_bounty_clear').setLabel('Clear All Active Bounties').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );

        return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }

    if (customId === 'hub_bounties') {
        const bounties = await ActiveBounty.findAll({ where: { guildId: interaction.guild.id } });
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config?.economyCurrency || 'Scrap';

        if (bounties.length === 0) return interaction.reply({ content: '🎯 There are currently no active bounties on the server. Nobody has reached the killstreak threshold yet!', flags: 64 });

        const list = bounties.map(b => `🎯 **${b.inGameName}** — Reward: **${b.reward} ${currency}**`).join('\n');
        const embed = new EmbedBuilder().setTitle('🎯 Active Player Bounties').setDescription(`Hunt down these players to claim their bounty!\n\n${list}`).setColor('#e74c3c').setTimestamp();
        return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (customId === 'btn_bounty_settings') {
        const modal = new ModalBuilder().setCustomId('modal_bounty_config').setTitle('Configure Bounties');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kills').setLabel("Kills to Trigger (e.g. 5)").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reward').setLabel("Reward Amount (e.g. 500)").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cooldown').setLabel("Cooldown in Minutes (e.g. 60)").setStyle(TextInputStyle.Short).setRequired(true))
        );
        return interaction.showModal(modal);
    }

    if (customId === 'btn_bounty_clear') {
        await ActiveBounty.destroy({ where: { guildId: interaction.guild.id } });
        return interaction.reply({ content: '🗑️ All active bounties have been cleared from the database.', flags: 64 });
    }

    if (interaction.isModalSubmit() && customId === 'modal_bounty_config') {
        const kills = parseInt(interaction.fields.getTextInputValue('kills')) || 5;
        const reward = parseInt(interaction.fields.getTextInputValue('reward')) || 500;
        const cooldown = parseInt(interaction.fields.getTextInputValue('cooldown')) || 60;
        await GuildConfig.upsert({ guildId: interaction.guild.id, bountyKillsToActivate: kills, bountyRewardAmount: reward, bountyCooldownMinutes: cooldown });
        return interaction.reply({ content: `✅ Bounty system configured!\n• Activates at: **${kills} Kills**\n• Reward: **${reward} Scrap**\n• Cooldown: **${cooldown} mins**`, flags: 64 });
    }
};