const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { GuildConfig, TicketCategory } = require('../database/db');
const discordTranscripts = require('discord-html-transcripts');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (customId === 'admin_menu_select' && selectedValue === 'setup_tickets') {
        const cats = await TicketCategory.findAll({ where: { guildId: interaction.guild.id } });
        const catList = cats.length ? cats.map(c => `• **${c.name}**`).join('\n') : 'No custom categories added yet.';
        const embed = new EmbedBuilder().setTitle('🎫 Ticket System Manager').setDescription(`Configure support categories, roles, and custom ticket types.\n\n**Custom Categories:**\n${catList}`).setColor('#e67e22');
        const row1 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ticket_action_select').setPlaceholder('Select ticket configuration...').addOptions([{ label: 'Set Ticket Category Parent', value: 'tk_cat', emoji: '📁' }, { label: 'Set Transcript Channel', value: 'tk_trans', emoji: '📜' }, { label: 'Set Admin Role', value: 'tk_admin', emoji: '🛡️' }, { label: 'Set Priority VIP Role', value: 'tk_vip', emoji: '⭐' }, { label: 'Toggle User DM Transcripts', value: 'tk_toggle', emoji: '📩' }]));
        const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_tk_add_cat').setLabel('Add Custom Category').setStyle(ButtonStyle.Success).setEmoji('➕'), new ButtonBuilder().setCustomId('btn_tk_clear_cats').setLabel('Clear Categories').setStyle(ButtonStyle.Danger).setEmoji('🗑️'));
        return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }

    if (customId === 'ticket_action_select') {
        if (selectedValue === 'tk_cat') return interaction.reply({ content: '📁 Select Category:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_ticket_category').setPlaceholder('Select Ticket Category...').addChannelTypes(ChannelType.GuildCategory))], flags: 64 });
        if (selectedValue === 'tk_trans') return interaction.reply({ content: '📜 Select Transcript Channel:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_ticket_transcript').setPlaceholder('Select Transcript Channel...').addChannelTypes(ChannelType.GuildText))], flags: 64 });
        if (selectedValue === 'tk_admin') return interaction.reply({ content: '🛡️ Select Admin Role:', components: [new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_ticket_admin').setPlaceholder('Select Admin Role...'))], flags: 64 });
        if (selectedValue === 'tk_vip') return interaction.reply({ content: '⭐ Select VIP Role:', components: [new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_ticket_vip').setPlaceholder('Select VIP Role...'))], flags: 64 });
        if (selectedValue === 'tk_toggle') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const newState = !(config?.ticketSendUserTranscript ?? true);
            await GuildConfig.upsert({ guildId: interaction.guild.id, ticketSendUserTranscript: newState });
            return interaction.reply({ content: `📩 **User Transcripts:** DMs are now **${newState ? 'ON' : 'OFF'}**.`, flags: 64 });
        }
    }

    if (customId === 'select_ticket_category' && interaction.isChannelSelectMenu()) {
        await GuildConfig.upsert({ guildId: interaction.guild.id, ticketCategoryId: interaction.values[0] });
        return interaction.update({ content: `✅ Ticket Category set!`, components: [] });
    }
    if (customId === 'select_ticket_transcript' && interaction.isChannelSelectMenu()) {
        await GuildConfig.upsert({ guildId: interaction.guild.id, ticketTranscriptChannelId: interaction.values[0] });
        return interaction.update({ content: `✅ Ticket Transcript channel set!`, components: [] });
    }
    if (customId === 'select_ticket_admin' && interaction.isRoleSelectMenu()) {
        await GuildConfig.upsert({ guildId: interaction.guild.id, ticketAdminRoleId: interaction.values[0] });
        return interaction.update({ content: `✅ Ticket Admin Role set!`, components: [] });
    }
    if (customId === 'select_ticket_vip' && interaction.isRoleSelectMenu()) {
        await GuildConfig.upsert({ guildId: interaction.guild.id, ticketVipRoleId: interaction.values[0] });
        return interaction.update({ content: `✅ Ticket Priority VIP Role set!`, components: [] });
    }

    if (customId === 'btn_tk_add_cat') {
        const modal = new ModalBuilder().setCustomId('modal_tk_add_cat').setTitle('Add Ticket Category');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_name').setLabel("Category Name (e.g. VIP Problems)").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_desc').setLabel("Description").setStyle(TextInputStyle.Short).setValue('Support ticket category').setRequired(false)));
        return interaction.showModal(modal);
    }
    if (customId === 'btn_tk_clear_cats') {
        await TicketCategory.destroy({ where: { guildId: interaction.guild.id } });
        return interaction.reply({ content: `🗑️ All custom ticket categories cleared!`, flags: 64 });
    }

    if (customId === 'ticket_create') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        if (!config || !config.ticketCategoryId || !config.ticketAdminRoleId) return interaction.reply({ content: '❌ Tickets are not fully configured by an admin yet.', flags: 64 });
        const customCats = await TicketCategory.findAll({ where: { guildId: interaction.guild.id } });
        const options = customCats.length > 0 ? customCats.map(c => ({ label: c.name, description: c.description, value: c.name })) : [{ label: 'VIP Problems', value: 'VIP Problems' }, { label: 'General Help', value: 'General Help' }, { label: 'Giveaway Claims', value: 'Giveaway Claims' }];
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('ticket_category_select').setPlaceholder('Select a ticket category...').addOptions(options));
        return interaction.reply({ content: '🎫 Please select a category for your support ticket:', components: [row], flags: 64 });
    }

    if (customId === 'ticket_category_select' && interaction.isStringSelectMenu()) {
        const modal = new ModalBuilder().setCustomId(`modal_ticket_reason_${selectedValue}`).setTitle('Ticket Reason');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel("Please describe your issue or request").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId.startsWith('modal_ticket_reason_')) {
        const categoryName = customId.replace('modal_ticket_reason_', '');
        const reason = interaction.fields.getTextInputValue('reason');
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });

        let isPriority = config.ticketVipRoleId && interaction.member.roles.cache.has(config.ticketVipRoleId);
        const channel = await interaction.guild.channels.create({
            name: `${isPriority ? '⭐-priority-' : '🎫-ticket-'}${interaction.user.username}`,
            type: ChannelType.GuildText, parent: config.ticketCategoryId,
            permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }, { id: config.ticketAdminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }]
        });

        const embed = new EmbedBuilder().setTitle(`Support Ticket: ${categoryName}`).setDescription(`**Created by:** <@${interaction.user.id}>\n**Category:** ${categoryName}\n**Reason:**\n> ${reason}`).setColor('#e67e22').setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_claim_${interaction.user.id}`).setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('✋'), new ButtonBuilder().setCustomId('ticket_close').setLabel('Close & Delete').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
        await channel.send({ content: `<@&${config.ticketAdminRoleId}> | <@${interaction.user.id}>`, embeds: [embed], components: [row] });
        return interaction.reply({ content: `✅ Your support ticket has been created: <#${channel.id}>`, flags: 64 });
    }

    if (customId.startsWith('ticket_claim_')) {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        await interaction.channel.permissionOverwrites.edit(config.ticketAdminRoleId, { ViewChannel: false });
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true });
        return interaction.reply({ content: `✋ Claimed by <@${interaction.user.id}>.` });
    }

    if (customId === 'ticket_close') {
        const modal = new ModalBuilder().setCustomId('modal_ticket_close_reason').setTitle('Close Support Ticket');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('close_reason').setLabel("Reason for closing this ticket").setStyle(TextInputStyle.Paragraph).setPlaceholder('e.g., Issue resolved').setRequired(true)));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === 'modal_ticket_close_reason') {
        const closeReason = interaction.fields.getTextInputValue('close_reason');
        await interaction.reply({ content: `🔒 Ticket closing... Reason: *${closeReason}*` });
        try {
            const transcript = await discordTranscripts.createTranscript(interaction.channel, { returnType: 'attachment', filename: `${interaction.channel.name}.html` });
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            if (config?.ticketTranscriptChannelId) {
                const transcriptChan = client.channels.cache.get(config.ticketTranscriptChannelId);
                if (transcriptChan) await transcriptChan.send({ embeds: [new EmbedBuilder().setTitle(`Ticket Closed: ${interaction.channel.name}`).setDescription(`**Closed by:** <@${interaction.user.id}>\n**Reason:** ${closeReason}`).setColor('#e74c3c').setTimestamp()], files: [transcript] });
            }
            if (config?.ticketSendUserTranscript ?? true) {
                const overwrites = interaction.channel.permissionOverwrites.cache;
                let creatorId = null;
                for (const [id, overwrite] of overwrites) { if (id !== interaction.guild.id && id !== config.ticketAdminRoleId) { creatorId = id; break; } }
                if (creatorId) {
                    try {
                        const creatorUser = await client.users.fetch(creatorId);
                        const dmTranscript = await discordTranscripts.createTranscript(interaction.channel, { returnType: 'attachment', filename: `${interaction.channel.name}.html` });
                        await creatorUser.send({ embeds: [new EmbedBuilder().setTitle(`Your support ticket in ${interaction.guild.name} was closed`).setDescription(`**Reason for closing:** ${closeReason}`).setColor('#3498db')], files: [dmTranscript] });
                    } catch (dmErr) {}
                }
            }
        } catch (err) {}
        setTimeout(() => interaction.channel.delete().catch(()=>{}), 3000);
    }
    if (interaction.isModalSubmit() && customId === 'modal_tk_add_cat') {
        await TicketCategory.create({ guildId: interaction.guild.id, name: interaction.fields.getTextInputValue('cat_name'), description: interaction.fields.getTextInputValue('cat_desc') || 'Support ticket category' });
        return interaction.reply({ content: `✅ Custom ticket category added successfully!`, flags: 64 });
    }
};