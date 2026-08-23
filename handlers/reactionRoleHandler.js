const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { GuildConfig, ReactionRole } = require('../database/db');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';
        console.log(`[RR HANDLER DEBUG] CustomID: ${customId} | Selected: ${selectedValue}`);

        // --- ADMIN MENU SELECT ENTRY ---
        if ((customId === 'admin_menu_select' && selectedValue === 'setup_reactionroles') || customId === 'rr_action_select') {
            const activeRoles = await ReactionRole.count({ where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            
            const embed = new EmbedBuilder()
                .setTitle('🎭 Reaction Roles Setup')
                .setDescription(`Create interactive button-based role panels with custom presets and rich text descriptions.\n\n• **Queued Roles:** ${activeRoles}`)
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
                    .setPlaceholder('🏷️ 2. Select Role to Add...')
            );

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_rr_modal_config').setLabel('Customize Panel Text').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
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

        // --- HANDLE ROLE SELECTION & PROMPT FOR PRESET EMOJI ---
        if (interaction.isRoleSelectMenu() && customId === 'select_rr_role') {
            const roleId = interaction.values[0];
            const roleObj = interaction.guild.roles.cache.get(roleId);

            const existing = await ReactionRole.findOne({ where: { guildId: interaction.guild.id, roleId: roleId, messageId: 'PENDING_DEPLOY' } });
            if (existing) {
                return interaction.reply({ content: `⚠️ The role **${roleObj?.name || roleId}** is already in the queue!`, flags: 64 });
            }

            const emojiMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`select_rr_emoji_${roleId}`)
                    .setPlaceholder('✨ Select a Preset Emoji for this Role...')
                    .addOptions([
                        { label: 'Fire / PvP', value: '🔥', description: 'Flame emoji', emoji: '🔥' },
                        { label: 'Shield / Defense', value: '🛡️', description: 'Shield emoji', emoji: '🛡️' },
                        { label: 'Swords / Combat', value: '⚔️', description: 'Swords emoji', emoji: '⚔️' },
                        { label: 'Star / VIP', value: '⭐', description: 'Star emoji', emoji: '⭐' },
                        { label: 'Gaming Controller', value: '🎮', description: 'Controller emoji', emoji: '🎮' },
                        { label: 'Robot / Automation', value: '🤖', description: 'Robot emoji', emoji: '🤖' },
                        { label: 'Diamond / Premium', value: '💎', description: 'Gem emoji', emoji: '💎' },
                        { label: 'Rocket / Launch', value: '🚀', description: 'Rocket emoji', emoji: '🚀' },
                        { label: 'Crown / Leader', value: '👑', description: 'Crown emoji', emoji: '👑' },
                        { label: 'Target / Notification', value: '🎯', description: 'Target emoji', emoji: '🎯' }
                    ])
            );

            const embed = new EmbedBuilder()
                .setTitle(`🎨 Choose Emoji for: ${roleObj?.name || 'Role'}`)
                .setDescription('Select an imported preset emoji from the dropdown menu below to assign it to this role button.')
                .setColor('#2ecc71');

            return interaction.reply({ embeds: [embed], components: [emojiMenu], flags: 64 });
        }

        // --- HANDLE PRESET EMOJI SELECTION FROM DROPDOWN ---
        if (interaction.isStringSelectMenu() && customId.startsWith('select_rr_emoji_')) {
            const roleId = customId.replace('select_rr_emoji_', '');
            const selectedEmoji = interaction.values[0];
            const roleObj = interaction.guild.roles.cache.get(roleId);

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const targetChannelId = config?.rrTempChannelId || interaction.channelId;

            await ReactionRole.create({
                guildId: interaction.guild.id,
                channelId: targetChannelId,
                roleId: roleId,
                buttonLabel: roleObj?.name || 'Get Role',
                buttonStyle: 'Primary',
                messageId: 'PENDING_DEPLOY',
                emoji: selectedEmoji
            });

            const totalQueued = await ReactionRole.count({ where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            return interaction.update({ 
                content: `✅ Successfully added role **${roleObj?.name || 'Role'}** with preset emoji ${selectedEmoji} to the queue! *(Total queued: ${totalQueued})*.`, 
                embeds: [], 
                components: [] 
            });
        }

        // --- OPEN CUSTOMIZATION MODAL (RICH TEXT) ---
        if (interaction.isButton() && customId === 'btn_rr_modal_config') {
            const modal = new ModalBuilder().setCustomId('modal_rr_customize').setTitle('Customize Reaction Panel Text');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('panel_description')
                        .setLabel("Panel Description (Up to 4,000 chars)")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder("Type your detailed rules, info, or description here...")
                        .setRequired(true)
                )
            );
            return interaction.showModal(modal);
        }

        // --- HANDLE MODAL SUBMISSION FOR RICH TEXT ---
        if (interaction.isModalSubmit() && customId === 'modal_rr_customize') {
            const desc = interaction.fields.getTextInputValue('panel_description');
            await GuildConfig.upsert({ guildId: interaction.guild.id, rrTempDescription: desc });
            return interaction.reply({ content: `✅ Panel description saved successfully!`, flags: 64 });
        }

        // --- CLEAR QUEUE BUTTON ---
        if (interaction.isButton() && customId === 'btn_rr_clear') {
            await ReactionRole.destroy({ where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            await GuildConfig.update({ rrTempDescription: null, rrTempChannelId: null }, { where: { guildId: interaction.guild.id } });
            return interaction.reply({ content: '🗑️ Cleared all queued reaction roles for this server.', flags: 64 });
        }

        // --- DEPLOY REACTION ROLE PANEL ---
        if (interaction.isButton() && customId === 'btn_rr_deploy') {
            const roles = await ReactionRole.findAll({ where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            if (roles.length === 0) {
                return interaction.reply({ content: '❌ Please select at least one role using the role dropdown menu first!', flags: 64 });
            }

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const targetChannelId = config?.rrTempChannelId || roles[0].channelId;
            
            let targetChannel = interaction.guild.channels.cache.get(targetChannelId);
            if (!targetChannel) {
                try {
                    targetChannel = await interaction.guild.channels.fetch(targetChannelId);
                } catch {
                    return interaction.reply({ content: '❌ Target channel not found or inaccessible. Please re-select the channel from the dropdown.', flags: 64 });
                }
            }

            const customDescription = config?.rrTempDescription || 'Click the buttons below to assign or remove roles instantly!';

            const embed = new EmbedBuilder()
                .setTitle('🎭 Server Roles & Verification')
                .setDescription(customDescription)
                .setColor('#f1c40f')
                .setTimestamp();

            const buttons = roles.map((rr) => {
                const labelText = rr.buttonLabel || interaction.guild.roles.cache.get(rr.roleId)?.name || 'Get Role';
                const btn = new ButtonBuilder()
                    .setCustomId(`rr_toggle_${rr.id}`)
                    .setLabel(labelText.substring(0, 80))
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
            await config.update({ rrTempDescription: null, rrTempChannelId: null });

            return interaction.reply({ content: `✅ Reaction panel successfully deployed to <#${targetChannelId}>!`, flags: 64 });
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