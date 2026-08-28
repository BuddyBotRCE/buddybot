const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GuildConfig, UserEconomy, BuddyPassChallenge } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playerpanel')
        .setDescription('Opens the Player Hub & Store Dashboard'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        
        const config = await GuildConfig.findOne({ where: { guildId } });
        const currency = config?.economyCurrency || 'Scrap';

        const [user] = await UserEconomy.findOrCreate({
            where: { guildId, userId },
            defaults: { wallet: 0, bank: 0, level: 1, xp: 0 }
        });

        const currentLevel = user.level || 1;
        const currentXp = user.xp || 0;
        const requiredXp = currentLevel * 100;

        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${interaction.guild.name} — Player Hub`)
            .setDescription(`Welcome to the community hub! Manage your Rust account, access banking, check your progression, play casino minigames, view leaderboards, manage your Clan, browse the store, or open a support token.`)
            .addFields(
                { name: '⭐ BuddyPass Status', value: `• **Level:** ${currentLevel}\n• **XP:** ${currentXp} / ${requiredXp}`, inline: true },
                { name: '💰 Balances', value: `• **Wallet:** ${user.wallet || 0} ${currency}\n• **Bank:** ${user.bank || 0} ${currency}`, inline: true }
            )
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
            new ButtonBuilder().setCustomId('hub_buddypass_view').setLabel('BuddyPass').setStyle(ButtonStyle.Primary).setEmoji('⭐')
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hub_leaderboards').setLabel('Leaderboards').setStyle(ButtonStyle.Primary).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('hub_vote_info').setLabel('Vote & Claim').setStyle(ButtonStyle.Success).setEmoji('🗳️'),
            new ButtonBuilder().setCustomId('ticket_create').setLabel('Open Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🎫')
        );

        const suggestionButtonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_player_open_suggestion')
                .setLabel('Make a Suggestion')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💡')
        );

        return interaction.reply({ embeds: [embed], components: [row1, row2, row3, suggestionButtonRow], flags: 64 });
    }
};