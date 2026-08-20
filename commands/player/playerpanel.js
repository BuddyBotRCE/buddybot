const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { UserEconomy } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playerpanel')
        .setDescription('Opens your Player Dashboard & Hub'),
        
    async execute(interaction) {
        // Fetch the user to see if they are already linked
        const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
        const linkStatus = user && user.inGameName ? `✅ Linked as: **${user.inGameName}**` : '❌ Not Linked';

        const embed = new EmbedBuilder()
            .setTitle('🎮 Player Hub')
            .setDescription(`Manage your account, claim daily rewards, browse the store, or play minigames.\n\n**Account Status:** ${linkStatus}`)
            .setColor('#2ecc71');

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hub_balance').setLabel('My Balance').setStyle(ButtonStyle.Primary).setEmoji('💰'),
            new ButtonBuilder().setCustomId('hub_daily').setLabel('Claim Daily').setStyle(ButtonStyle.Success).setEmoji('🎁'),
            new ButtonBuilder().setCustomId('hub_shop_menu').setLabel('Server Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛒'),
            new ButtonBuilder().setCustomId('hub_casino').setLabel('Casino').setStyle(ButtonStyle.Danger).setEmoji('🎰')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hub_link_account').setLabel('Link Rust Account').setStyle(ButtonStyle.Success).setEmoji('🔗'),
            new ButtonBuilder().setCustomId('ticket_create').setLabel('Open Support Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🎫'),
            // Make sure to replace YOUR_CLIENT_ID in the URL below if you want the bot invite link to work!
            new ButtonBuilder()
                .setLabel('Add Bot to Server')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot+applications.commands')
                .setEmoji('🤖')
        );

        await interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }
};