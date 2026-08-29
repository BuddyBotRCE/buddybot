const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, AttachmentBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const { GuildConfig } = require('../database/db');
const adminHandler = require('./adminHandler');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;

        if (customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
            return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
        }

        // ==========================================
        // 1. ADMIN SETUP PANEL
        // ==========================================
        if (customId === 'admin_menu_select' && interaction.isStringSelectMenu() && interaction.values[0] === 'setup_tickets') {
            const config = await GuildConfig.findOrCreate({ where: { guildId } });
            const cfg = config[0];
            
            const catDisplay = cfg.ticketCategoryId ? `<#${cfg.ticketCategoryId}>` : '`Not Set`';
            const logDisplay = cfg.ticketTranscriptChannelId ? `<#${cfg.ticketTranscriptChannelId}>` : '`Not Set`';
            const roleDisplay = cfg.ticketAdminRoleId ? `<@&${cfg.ticketAdminRoleId}>` : '`Not Set`';

            const embed = new EmbedBuilder()
                .setTitle('🎫 Ticket System Manager')
                .setDescription(`Configure support tickets for your players.\n\n**Current Setup:**\n📂 **Category:** ${catDisplay}\n📄 **Transcripts:** ${logDisplay}\n👮 **Support Role:** ${roleDisplay}`)
                .setColor('#3498db');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_tk_setcat').setLabel('Set Category').setStyle(ButtonStyle.Primary).setEmoji('📂'),
                new ButtonBuilder().setCustomId('btn_tk_setlog').setLabel('Set Transcript Log').setStyle(ButtonStyle.Primary).setEmoji('📄'),
                new ButtonBuilder().setCustomId('btn_tk_setrole').setLabel('Set Support Role').setStyle(ButtonStyle.Primary).setEmoji('👮')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
            );

            return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
        }

        // --- SETUP BUTTONS (Now using modern Dropdown Select Menus!) ---
        if (interaction.isButton()) {
            if (customId === 'btn_tk_setcat') {
                const embed = new EmbedBuilder().setTitle('📂 Select Ticket Category').setDescription('Please select the Discord category where new support tickets will be spawned.').setColor('#3498db');
                const menu = new ChannelSelectMenuBuilder().setCustomId('tk_sel_cat').setPlaceholder('Select target category...').addChannelTypes(ChannelType.GuildCategory);
                return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
            }

            if (customId === 'btn_tk_setlog') {
                const embed = new EmbedBuilder().setTitle('📄 Select Transcript Log').setDescription('Please select the text channel where closed ticket transcripts will be sent.').setColor('#3498db');
                const menu = new ChannelSelectMenuBuilder().setCustomId('tk_sel_log').setPlaceholder('Select transcript channel...').addChannelTypes(ChannelType.GuildText);
                return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
            }

            if (customId === 'btn_tk_setrole') {
                const embed = new EmbedBuilder().setTitle('👮 Select Support Role').setDescription('Please select the role that will be pinged and given access to new tickets.').setColor('#3498db');
                const menu = new RoleSelectMenuBuilder().setCustomId('tk_sel_role').setPlaceholder('Select support staff role...');
                return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
            }
        }

        // --- SETUP DROPDOWN SAVERS ---
        if (interaction.isChannelSelectMenu()) {
            if (customId === 'tk_sel_cat') {
                await GuildConfig.update({ ticketCategoryId: interaction.values[0] }, { where: { guildId } });
                return interaction.update({ content: `✅ Ticket category successfully set to <#${interaction.values[0]}>!`, embeds: [], components: [] });
            }
            if (customId === 'tk_sel_log') {
                await GuildConfig.update({ ticketTranscriptChannelId: interaction.values[0] }, { where: { guildId } });
                return interaction.update({ content: `✅ Transcripts will now be sent to <#${interaction.values[0]}>!`, embeds: [], components: [] });
            }
        }

        if (interaction.isRoleSelectMenu() && customId === 'tk_sel_role') {
            await GuildConfig.update({ ticketAdminRoleId: interaction.values[0] }, { where: { guildId } });
            return interaction.update({ content: `✅ Support role set! <@&${interaction.values[0]}> will now have access to tickets.`, embeds: [], components: [] });
        }

        // ==========================================
        // 2. PLAYER CREATE TICKET
        // ==========================================
        if (customId === 'ticket_create') {
            const config = await GuildConfig.findOne({ where: { guildId } });
            if (!config || !config.ticketCategoryId) {
                return interaction.reply({ content: '❌ **Ticket System Error:** The support ticket system needs to be set up by an admin first!', flags: 64 });
            }

            const guild = interaction.guild;
            const category = guild.channels.cache.get(config.ticketCategoryId);
            if (!category) {
                return interaction.reply({ content: '❌ **Ticket System Error:** The configured ticket category no longer exists.', flags: 64 });
            }

            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.reply({ content: `❌ You already have an open ticket: ${existingChannel}`, flags: 64 });
            }

            let perms = [
                { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
            ];

            if (config.ticketAdminRoleId) {
                perms.push({ id: config.ticketAdminRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] });
            }

            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: category.id,
                topic: interaction.user.id, 
                permissionOverwrites: perms
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 Support Ticket — ${interaction.user.tag}`)
                .setDescription(`Welcome <@${interaction.user.id}>!\n\nPlease describe your issue or question in as much detail as possible. A staff member will be with you shortly.`)
                .setColor('#2ecc71')
                .setTimestamp();

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tk_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('✋'),
                new ButtonBuilder().setCustomId('tk_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            const pingMsg = config.ticketAdminRoleId ? `<@${interaction.user.id}> | <@&${config.ticketAdminRoleId}>` : `<@${interaction.user.id}>`;
            
            await ticketChannel.send({ content: pingMsg, embeds: [ticketEmbed], components: [actionRow] });
            return interaction.reply({ content: `✅ Your ticket has been created! Head over to ${ticketChannel}.`, flags: 64 });
        }

        // ==========================================
        // 3. CLAIM TICKET
        // ==========================================
        if (customId === 'tk_claim') {
            const config = await GuildConfig.findOne({ where: { guildId } });
            
            const isStaff = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || (config?.ticketAdminRoleId && interaction.member.roles.cache.has(config.ticketAdminRoleId));
            
            if (!isStaff) {
                return interaction.reply({ content: '❌ You do not have permission to claim tickets.', flags: 64 });
            }

            const oldEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .setColor('#f1c40f')
                .addFields({ name: '✋ Claimed By', value: `<@${interaction.user.id}> is now handling this ticket.` });

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tk_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            return interaction.update({ embeds: [newEmbed], components: [actionRow] });
        }

        // ==========================================
        // 4. CLOSE TICKET CONFIRMATION
        // ==========================================
        if (customId === 'tk_close') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tk_confirm_close').setLabel('Yes, Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('✅'),
                new ButtonBuilder().setCustomId('tk_cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('❌')
            );
            return interaction.reply({ content: '⚠️ **Are you sure you want to close this ticket?** This will generate a transcript and delete the channel.', components: [row] });
        }

        if (customId === 'tk_cancel_close') {
            return interaction.message.delete().catch(() => {});
        }

        // ==========================================
        // 5. PROCESS CLOSE & TRANSCRIPT
        // ==========================================
        if (customId === 'tk_confirm_close') {
            await interaction.update({ content: '🔒 **Ticket locked.** Generating transcript and closing in 5 seconds...', components: [] });
            
            const config = await GuildConfig.findOne({ where: { guildId } });
            const ticketCreatorId = interaction.channel.topic; 
            
            // 1. Lock the channel so the player can't send more messages while we process
            if (ticketCreatorId) {
                await interaction.channel.permissionOverwrites.edit(ticketCreatorId, { SendMessages: false }).catch(()=>{});
            }

            // 2. Build the Transcript
            let messages = await interaction.channel.messages.fetch({ limit: 100 });
            messages = Array.from(messages.values()).reverse(); 

            const logContent = messages.map(m => {
                const time = new Date(m.createdTimestamp).toLocaleString();
                const attachmentTxt = m.attachments.size > 0 ? ` [Attached ${m.attachments.size} file(s)]` : '';
                const embedTxt = m.embeds.length > 0 ? ` [Embedded Content]` : '';
                return `[${time}] ${m.author.tag}: ${m.content}${attachmentTxt}${embedTxt}`;
            }).join('\n\n');

            const buffer = Buffer.from(`TICKET TRANSCRIPT: ${interaction.channel.name}\nGenerated on: ${new Date().toLocaleString()}\n-------------------------------------------------\n\n${logContent}`, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `${interaction.channel.name}-transcript.txt` });

            // 3. Send to Server Log Channel
            if (config?.ticketTranscriptChannelId) {
                const logChannel = interaction.guild.channels.cache.get(config.ticketTranscriptChannelId);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📄 Ticket Transcript')
                        .addFields(
                            { name: 'Ticket', value: `\`${interaction.channel.name}\``, inline: true },
                            { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true }
                        )
                        .setColor('#95a5a6');
                    await logChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(()=>{});
                }
            }

            // 4. DM to the Player
            if (ticketCreatorId) {
                try {
                    const user = await client.users.fetch(ticketCreatorId);
                    await user.send({ 
                        content: `📦 **Ticket Closed!**\nThank you for reaching out. Here is a copy of your chat transcript for your ticket (\`${interaction.channel.name}\`).`, 
                        files: [attachment] 
                    });
                } catch (e) {
                    console.log(`[TICKETS] Could not DM transcript to ${ticketCreatorId} (DMs might be off).`);
                }
            }

            // 5. Delete Channel
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