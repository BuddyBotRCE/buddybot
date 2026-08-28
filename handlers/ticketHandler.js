const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig } = require('../database/db');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;

        // ====================================================================
        // 1. ADMIN SETUP PANEL ROUTER
        // ====================================================================
        if (customId === 'admin_menu_select' && interaction.isStringSelectMenu() && interaction.values[0] === 'setup_tickets') {
            const config = await GuildConfig.findOne({ where: { guildId } });
            const catDisplay = config?.ticketCategoryId ? `<#${config.ticketCategoryId}>` : '`Not Set`';

            const embed = new EmbedBuilder()
                .setTitle('🎫 Ticket System Manager')
                .setDescription(`Configure your support ticket system.\n\n• **Support Category:** ${catDisplay}`)
                .setColor('#3498db');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_tk_setcat').setLabel('Set Ticket Category').setStyle(ButtonStyle.Primary).setEmoji('📂')
            );

            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }

        // ====================================================================
        // 2. ADMIN CATEGORY SELECT BUTTON & HANDLERS
        // ====================================================================
        if (interaction.isButton() && customId === 'btn_tk_setcat') {
            const embed = new EmbedBuilder()
                .setTitle('📂 Select Ticket Category')
                .setDescription('Please select the Discord category where new support tickets should be created.')
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

        // Catch the custom category select menu response
        if (interaction.isChannelSelectMenu() && customId === 'select_tk_category') {
            const categoryId = interaction.values[0];
            // Save to BOTH common column names to prevent future mismatch errors
            await GuildConfig.upsert({ 
                guildId, 
                ticketCategoryId: categoryId,
                ticketCategory: categoryId 
            });

            return interaction.update({ 
                content: `✅ Support ticket category successfully set to <#${categoryId}>!`, 
                components: [], 
                embeds: [] 
            });
        }

        // ====================================================================
        // 3. PLAYER PANEL / BUTTON: CREATE TICKET
        // ====================================================================
        if (customId === 'ticket_create' || customId === 'hub_ticket_create' || customId === 'btn_player_create_ticket') {
            const config = await GuildConfig.findOne({ where: { guildId } });
            
            // Check both properties to ensure it passes even if one was blank
            const categoryId = config?.ticketCategoryId || config?.ticketCategory;

            if (!categoryId) {
                return interaction.reply({ 
                    content: '❌ **Ticket System Error:** The support ticket category has not been configured by an administrator yet!', 
                    flags: 64 
                });
            }

            const guild = interaction.guild;
            const category = guild.channels.cache.get(categoryId);

            if (!category) {
                return interaction.reply({ 
                    content: '❌ **Ticket System Error:** The configured ticket category no longer exists on this server. Please ask an admin to re-configure it.', 
                    flags: 64 
                });
            }

            // Check if user already has an active ticket channel
            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.reply({ 
                    content: `❌ You already have an open ticket: ${existingChannel}`, 
                    flags: 64 
                });
            }

            // Create private ticket channel
            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                    }
                ]
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 Support Ticket — ${interaction.user.tag}`)
                .setDescription('Welcome! Describe your issue or question below. Support staff will be with you shortly.')
                .setColor('#2ecc71')
                .setTimestamp();

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tk_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed], components: [closeRow] });

            return interaction.reply({ 
                content: `✅ Your ticket has been created successfully! Head over to ${ticketChannel}.`, 
                flags: 64 
            });
        }

        // ====================================================================
        // 4. CLOSE TICKET BUTTON
        // ====================================================================
        if (customId === 'tk_close') {
            await interaction.reply({ content: '🔒 Closing this ticket in 5 seconds...', flags: 64 });
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }

    } catch (error) {
        console.error('[TICKET HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing your ticket request.', flags: 64 }).catch(() => {});
        }
    }
};