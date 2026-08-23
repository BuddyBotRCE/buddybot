const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { GuildConfig, ReactionRole } = require('../database/db');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- ADMIN MENU SELECT ENTRY ---
        if ((customId === 'admin_menu_select' && selectedValue === 'setup_reactionroles') || customId === 'rr_action_select') {
            const activeRoles = await ReactionRole.count({ where: { guildId: interaction.guild.id } });
            
            const embed = new EmbedBuilder()
                .setTitle('🎭 Reaction Roles Setup')
                .setDescription(`Create interactive button-based role panels with custom emojis and rich text descriptions.\n\n• **Queued / Active Roles:** ${activeRoles}`)
                .setColor('#3498db');

            const channelRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_rr_channel')
                    .setPlaceholder('📂 1. Select Target Channel for RR Panel...')
                    .addChannelTypes(ChannelType.GuildText)
            );

            const roleRow = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('select_rr_role')
                    .setPlaceholder('🏷️ 2. Select Role to Add (Queues with default 🏷️)...')
            );

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_rr_modal_config').setLabel('Customize Text & Emojis').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_rr_deploy').setLabel('Deploy Panel').setStyle(ButtonStyle.Success).setEmoji('📦'),
                new ButtonBuilder().setCustomId('btn_rr_clear').setLabel('Clear Queue').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            return interaction.reply({ 
                embeds: [embed], 
                components: [channelRow, roleRow, actionRow], 
                flags: 64 
            });
        }

        // --- HANDLE CHANNEL SELECTION ---
        if (interaction.isChannelSelectMenu() && customId === 'select_rr_channel') {
            const channelId = interaction.values[0];
            await GuildConfig.upsert({ guildId: interaction.guild.id, rrTempChannelId: channelId });
            return interaction.reply({ content: `✅ Reaction Role target channel set to <#${channelId}>! Now select roles below.`, flags: 64 });
        }

        // --- HANDLE ROLE SELECTION ---
        if (interaction.isRoleSelectMenu() && customId === 'select_rr_role') {
            const roleId = interaction.values[0];
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const targetChannelId = config?.rrTempChannelId || interaction.channelId;
            const roleObj = interaction.guild.roles.cache.get(roleId);

            const existing = await ReactionRole.findOne({ where: { guildId: interaction.guild.id, roleId: roleId } });
            if (existing) {
                return interaction.reply({ content: `⚠️ The role **${roleObj?.name || roleId}** is already in the queue!`, flags: 64 });
            }

            await ReactionRole.create({
                guildId: interaction.guild.id,
                channelId: targetChannelId,
                roleId: roleId,
                buttonLabel: roleObj?.name || 'Get Role',
                buttonStyle: 'Primary',
                messageId: 'PENDING_DEPLOY',
                emoji: '🏷️'
            });

            const totalQueued = await ReactionRole.count({ where: { guildId: interaction.guild.id } });
            return interaction.reply({ content: `✅ Added **${roleObj?.name || 'Role'}** to the queue! *(Total queued: ${totalQueued}). Click **Customize Text & Emojis** to change button icons.*`, flags: 64 });
        }

        // --- OPEN CUSTOMIZATION MODAL (RICH TEXT & EMOJIS) ---
        if (interaction.isButton() && customId === 'btn_rr_modal_config') {
            const roles = await ReactionRole.findAll({ where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            if (roles.length === 0) {
                return interaction.reply({ content: '❌ Please select at least one role from the dropdown first before customizing!', flags: 64 });
            }

            const modal = new ModalBuilder().setCustomId('modal_rr_customize').setTitle('Customize Reaction Panel Text');
            
            // Allow typing detailed descriptions (up to 4000 characters per Discord modal input limit)
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('panel_description')
                        .setLabel("Panel Description / Rules (Rich Text)")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder("Type your detailed rules, info, or description here...")
                        .setRequired(true)
                )
            );

            return interaction.showModal(modal);
        }

        // --- CLEAR QUEUE BUTTON ---
        if (interaction.isButton() && customId === 'btn_rr_clear') {
            await ReactionRole.destroy({ where: { guildId: interaction.guild.id } });
            await GuildConfig.update({ rrTempDescription: null }, { where: { guildId: interaction.guild.id } });
            return interaction.reply({ content: '🗑️ Cleared all queued reaction roles and text for this server.', flags: 64 });
        }

        // --- DEPLOY REACTION ROLE PANEL ---
        if (interaction.isButton() && customId === 'btn_rr_deploy') {
            const roles = await ReactionRole.findAll({ where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            if (roles.length === 0) {
                return interaction.reply({ content: '❌ Please select at least one role using the role dropdown menu first!', flags: 64 });
            }

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const targetChannelId = roles[0].channelId;
            const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
            if (!targetChannel) {
                return interaction.reply({ content: '❌ Target channel not found. Please re-select the channel.', flags: 64 });
            }

            const customDescription = config?.rrTempDescription || 'Click the buttons below to assign or remove roles instantly!';

            const embed = new EmbedBuilder()
                .setTitle('🎭 Server Roles & Verification')
                .setDescription(customDescription)
                .setColor('#f1c40f')
                .setTimestamp();

            // Build buttons dynamically with custom emojis attached
            const buttons = roles.map((rr) => {
                const btn = new ButtonBuilder()
                    .setCustomId(`rr_toggle_${rr.id}`)
                    .setLabel(rr.buttonLabel)
                    .setStyle(ButtonStyle.Primary);
                
                if (rr.emoji) {
                    btn.setEmoji(rr.emoji);
                }
                return btn;
            });

            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }

            const sentMessage = await targetChannel.send({ embeds: [embed], components: rows });

            await ReactionRole.update({ messageId: sentMessage.id }, { where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            await config.update({ rrTempDescription: null });

            return interaction.reply({ content: `✅ Reaction panel successfully deployed to <#${targetChannelId}> with custom text and emojis!`, flags: 64 });
        }

        // --- HANDLE MODAL SUBMISSION FOR RICH TEXT ---
        if (interaction.isModalSubmit() && customId === 'modal_rr_customize') {
            const desc = interaction.fields.getTextInputValue('panel_description');
            await GuildConfig.upsert({ guildId: interaction.guild.id, rrTempDescription: desc });
            return interaction.reply({ content: `✅ Panel description saved successfully! You can now click **Deploy Panel** whenever you're ready.`, flags: 64 });
        }

        // --- USER CLICKS A REACTION ROLE BUTTON ---
        if (interaction.isButton() && customId.startsWith('rr_toggle_')) {
            const rrId = customId.replace('rr_toggle_', '');
            const rrData = await ReactionRole.findByPk(rrId);

            if (!rrData) {
                return interaction.reply({ content: '❌ This reaction role configuration no longer exists.', flags: 64 });
            }

            const role = interaction.guild.roles.cache.get(rrData.roleId);
            if (!role) {
                return interaction.reply({ content: '❌ The assigned role no longer exists on this server.', flags: 64 });
            }

            const member = interaction.member;
            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
                return interaction.reply({ content: `❌ Removed role **${role.name}** from you.`, flags: 64 });
            } else {
                await member.roles.add(role);
                return interaction.reply({ content: `✅ Added role **${role.name}** to you!`, flags: 64 });
            }
        }

    } catch (error) {
        console.error('[REACTION ROLE HANDLER ERROR]', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing reaction roles.', flags: 64 }).catch(() => {});
        }
    }
};