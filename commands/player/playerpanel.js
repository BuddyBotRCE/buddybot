const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GuildConfig } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playerpanel')
        .setDescription('Opens the Player Hub & Store Dashboard'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = await GuildConfig.findOne({ where: { guildId } });
        const currency = config?.economyCurrency || 'Scrap';

        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${interaction.guild.name} — Player Hub`)
            .setDescription(`Welcome to the community hub! Manage your Rust account, access banking, play casino minigames, view leaderboards, manage your Clan, browse the store, or open a support ticket.`)
            .setColor('#3498db')
            .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hub_link_account').setLabel('Link Account').setStyle(ButtonStyle.Primary).setEmoji('🔗'),
            new ButtonBuilder().setCustomId('hub_shop_menu').setLabel('Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛒'),
            new ButtonBuilder().setCustomId('hub_clans').setLabel('Clans').setStyle(ButtonStyle.Success).setEmoji('🛡️')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hub_economy_menu').setLabel('Economy & Bank').setStyle(ButtonStyle.Success).setEmoji('🏦'),
            new ButtonBuilder().setCustomId('hub_casino').setLabel('Casino').setStyle(ButtonStyle.Danger).setEmoji('🎰'),
            new ButtonBuilder().setCustomId('hub_bounties').setLabel('Bounties').setStyle(ButtonStyle.Danger).setEmoji('🎯')
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hub_leaderboards').setLabel('Leaderboards').setStyle(ButtonStyle.Primary).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('hub_vote_info').setLabel('Vote & Claim').setStyle(ButtonStyle.Success).setEmoji('🗳️'),
            new ButtonBuilder().setCustomId('ticket_create').setLabel('Open Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🎫')
        );

        return interaction.reply({ embeds: [embed], components: [row1, row2, row3], flags: 64 });
    }
};