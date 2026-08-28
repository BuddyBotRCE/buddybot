const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig } = require('../database/db');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;

        // 1. Admin setup panel trigger
        if (customId === 'admin_menu_select' && interaction.isStringSelectMenu() && interaction.values[0] === 'setup_tickets') {
            const config = await GuildConfig.findOne({ where: { guildId } });
            const catDisplay = config?.ticketCategory ? `<#${config.ticketCategory}>` : '`Not Set`';

            const embed = new EmbedBuilder()
                .setTitle('🎫 Ticket System Manager')
                .setDescription(`Configure support tickets for your players.\n\n• **Support Category:** ${catDisplay}`)
                .setColor('#3498db');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_tk_setcat').setLabel('Set Category').setStyle(ButtonStyle.Primary).setEmoji('📂')
            );

            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }

        // 2. Set category button
        if (interaction.isButton() && customId === 'btn_tk_setcat') {
            const embed = new EmbedBuilder()
                .setTitle('📂 Select Ticket Category')
                .setDescription('Please select the Discord category where new support tickets will be spawned.')
                .setColor('#3498db');

            const row = new ActionRowBuilder().addComponents(
                new class extends require('discord.js').ChannelSelectMenuBuilder {
                    constructor() {
                        super();
                        this.setCustomId('select_tk_category');
                        this.setPlaceholder('Select target category...');
                        this.addChannelTypes(ChannelType.GuildCategory);
                    }
                }()
            );

            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }

        // 3. Save selected category
        if (interaction.isChannelSelectMenu() && customId === 'select_tk_category') {
            const categoryId = interaction.values[0];
            await GuildConfig.upsert({ guildId, ticketCategory: categoryId });
            return interaction.update({ content: `✅ Ticket category successfully set to <#${categoryId}>!`, components: [], embeds: [] });
        }

        // 4. Player create ticket
        if (customId === 'ticket_create') {
            const config = await GuildConfig.findOne({ where: { guildId } });
            if (!config || !config.ticketCategory) {
                return interaction.reply({ content: '❌ **Ticket System Error:** The support ticket system needs to be set up by an admin first!', flags: 64 });
            }

            const guild = interaction.guild;
            const category = guild.channels.cache.get(config.ticketCategory);
            if (!category) {
                return interaction.reply({ content: '❌ **Ticket System Error:** The configured ticket category no longer exists.', flags: 64 });
            }

            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.reply({ content: `❌ You already have an open ticket: ${existingChannel}`, flags: 64 });
            }

            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
                ]
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 Support Ticket — ${interaction.user.tag}`)
                .setDescription('Welcome! Describe your issue below and staff will assist you shortly.')
                .setColor('#2ecc71')
                .setTimestamp();

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tk_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [closeRow] });
            return interaction.reply({ content: `✅ Your ticket has been created! Head over to ${ticketChannel}.`, flags: 64 });
        }

        // 5. Close ticket
        if (customId === 'tk_close') {
            await interaction.reply({ content: '🔒 Closing this ticket in 5 seconds...', flags: 64 });
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }

    } catch (error) {
        console.error('[TICKET ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing your ticket request.', flags: 64 }).catch(() => {});
        }
    }
};