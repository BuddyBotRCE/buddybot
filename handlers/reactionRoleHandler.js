const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { GuildConfig, ReactionRole } = require('../database/db');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        
        let selectedValue = '';
        if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
            selectedValue = interaction.values?.[0] 
                || interaction.channels?.first()?.id 
                || interaction.roles?.first()?.id 
                || '';
        }

        console.log(`[RR HANDLER DEBUG] CustomID: ${customId} | Selected: ${selectedValue}`);

        // --- ADMIN MENU SELECT ENTRY ---
        if ((customId === 'admin_menu_select' && selectedValue === 'setup_reactionroles') || customId === 'rr_action_select') {
            const activeRoles = await ReactionRole.count({ where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const hasCustomText = config?.getDataValue('rrTempDescription') ? '✅ Loaded (Ready)' : '❌ Using Default';
            const targetCh = config?.getDataValue('rrTempChannelId') ? `<#${config.getDataValue('rrTempChannelId')}>` : '❌ Not Set';
            
            const embed = new EmbedBuilder()
                .setTitle('🎭 Reaction & Verification Roles Setup')
                .setDescription(`Create interactive button panels with custom emojis, rich text descriptions, and permanent storage.\n\n• **Target Channel:** ${targetCh}\n• **Queued Roles:** ${activeRoles}\n• **Custom Text Status:** ${hasCustomText}`)
                .setColor('#3498db');

            const channelRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_rr_channel')
                    .setPlaceholder('📂 1. Select Target Channel for Panel...')
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

            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                return await interaction.reply({ embeds: [embed], components: [channelRow, roleRow, actionRow], flags: 64 });
            } else {
                return await interaction.update({ embeds: [embed], components: [channelRow, roleRow, actionRow] });
            }
        }

        // --- HANDLE CHANNEL SELECTION ---
        if (interaction.isChannelSelectMenu() && customId === 'select_rr_channel') {
            const channelId = selectedValue || interaction.channels?.first()?.id;
            if (!channelId) {
                return await interaction.reply({ content: '❌ Could not determine selected channel. Please try again.', flags: 64 });
            }
            await GuildConfig.upsert({ guildId: interaction.guild.id, rrTempChannelId: channelId });
            console.log(`[RR CHANNEL SAVED] Guild: ${interaction.guild.id} | Channel: ${channelId}`);
            return await interaction.reply({ content: `✅ Target channel successfully set to <#${channelId}>! Now select roles below.`, flags: 64 });
        }

        // --- HANDLE ROLE SELECTION & PROMPT FOR PRESET EMOJI ---
        if (interaction.isRoleSelectMenu() && customId === 'select_rr_role') {
            const roleId = selectedValue || interaction.roles?.first()?.id;
            if (!roleId) {
                return await interaction.reply({ content: '❌ Could not determine selected role. Please try again.', flags: 64 });
            }
            const roleObj = interaction.guild.roles.cache.get(roleId);

            const existing = await ReactionRole.findOne({ where: { guildId: interaction.guild.id, roleId: roleId, messageId: 'PENDING_DEPLOY' } });
            if (existing) {
                return await interaction.reply({ content: `⚠️ The role **${roleObj?.name || roleId}** is already in the queue!`, flags: 64 });
            }

            const emojiMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`select_rr_emoji_${roleId}`)
                    .setPlaceholder('✨ Select a Preset Emoji for this Role Button...')
                    .addOptions([
                        { label: 'Verify / Checkmark', value: '✅', description: 'Verification checkmark', emoji: '✅' },
                        { label: 'Fire / PvP', value: '🔥', description: 'Flame emoji', emoji: '🔥' },
                        { label: 'Shield / Defense', value: '🛡️', description: 'Shield emoji', emoji: '🛡️' },
                        { label: 'Swords / Combat', value: '⚔️', description: 'Swords emoji', emoji: '⚔️' },
                        { label: 'Star / VIP', value: '⭐', description: 'Star emoji', emoji: '⭐' },
                        { label: 'Gaming Controller', value: '🎮', description: 'Controller emoji', emoji: '🎮' },
                        { label: 'Robot / Automation', value: '🤖', description: 'Robot emoji', emoji: '🤖' },
                        { label: 'Diamond / Premium', value: '💎', description: 'Gem emoji', emoji: '💎' },
                        { label: 'Rocket / Launch', value: '🚀', description: 'Rocket emoji', emoji: '🚀' },
                        { label: 'Crown / Leader', value: '👑', description: 'Crown emoji', emoji: '👑' }
                    ])
            );

            const embed = new EmbedBuilder()
                .setTitle(`🎨 Choose Emoji for: ${roleObj?.name || 'Role'}`)
                .setDescription('Select an emoji from the dropdown menu below to assign it to this verification/role button.')
                .setColor('#2ecc71');

            return await interaction.reply({ embeds: [embed], components: [emojiMenu], flags: 64 });
        }

        // --- HANDLE PRESET EMOJI SELECTION FROM DROPDOWN ---
        if (interaction.isStringSelectMenu() && customId.startsWith('select_rr_emoji_')) {
            const roleId = customId.replace('select_rr_emoji_', '');
            const selectedEmoji = selectedValue || '✅';
            const roleObj = interaction.guild.roles.cache.get(roleId);

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const targetChannelId = config?.getDataValue('rrTempChannelId') || interaction.channelId;

            await ReactionRole.create({
                guildId: interaction.guild.id,
                channelId: targetChannelId,
                roleId: roleId,
                buttonLabel: roleObj?.name || 'Verify / Get Role',
                buttonStyle: 'Primary',
                messageId: 'PENDING_DEPLOY',
                emoji: selectedEmoji
            });

            const totalQueued = await ReactionRole.count({ where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            return await interaction.reply({ 
                content: `✅ Successfully added **${roleObj?.name || 'Role'}** with emoji ${selectedEmoji} to the queue! *(Total queued: ${totalQueued})*.`, 
                flags: 64 
            });
        }

        // --- OPEN CUSTOMIZATION MODAL (RICH TEXT) ---
        if (interaction.isButton() && customId === 'btn_rr_modal_config') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            
            const modal = new ModalBuilder().setCustomId('modal_rr_customize').setTitle('Customize Reaction Panel Text');
            const textInput = new TextInputBuilder()
                .setCustomId('panel_description')
                .setLabel("Panel Description / Verification Rules")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Type or paste your detailed text, rules, or welcome message here...")
                .setRequired(true);

            const existingDesc = config?.getDataValue('rrTempDescription');
            if (existingDesc) {
                textInput.setValue(existingDesc.substring(0, 4000));
            }

            modal.addComponents(new ActionRowBuilder().addComponents(textInput));
            return await interaction.showModal(modal);
        }

        // --- HANDLE MODAL SUBMISSION FOR RICH TEXT ---
        if (interaction.isModalSubmit() && customId === 'modal_rr_customize') {
            const desc = interaction.fields.getTextInputValue('panel_description');
            
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            config.set('rrTempDescription', desc);
            await config.save();

            console.log(`[RR TEXT SAVED] Guild: ${interaction.guild.id} | Length: ${desc.length} chars`);
            return await interaction.reply({ content: `✅ Panel text successfully saved (${desc.length} characters)! Click **Deploy Panel** whenever you are ready.`, flags: 64 });
        }

        // --- CLEAR QUEUE BUTTON ---
        if (interaction.isButton() && customId === 'btn_rr_clear') {
            await ReactionRole.destroy({ where: { guildId: interaction.guild.id } });
            await GuildConfig.update({ rrTempDescription: null, rrTempChannelId: null }, { where: { guildId: interaction.guild.id } });
            return await interaction.reply({ content: '🗑️ Cleared all queued roles and temporary config for this server.', flags: 64 });
        }

        // --- DEPLOY REACTION ROLE PANEL ---
        if (interaction.isButton() && customId === 'btn_rr_deploy') {
            const roles = await ReactionRole.findAll({ where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } });
            if (roles.length === 0) {
                return await interaction.reply({ content: '❌ Please select at least one role using the role dropdown menu first!', flags: 64 });
            }

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            
            // Explicitly check config channel, falling back to the first role's channel, then current channel
            const targetChannelId = config?.getDataValue('rrTempChannelId') || roles[0].getDataValue('channelId') || interaction.channelId;
            console.log(`[RR DEPLOY TARGET] Resolved Channel ID: ${targetChannelId}`);
            
            let targetChannel = interaction.guild.channels.cache.get(targetChannelId);
            if (!targetChannel || typeof targetChannel.send !== 'function') {
                try {
                    targetChannel = await interaction.guild.channels.fetch(targetChannelId);
                } catch {
                    targetChannel = null;
                }
            }

            if (!targetChannel || typeof targetChannel.send !== 'function') {
                targetChannel = interaction.channel;
            }

            // Retrieve custom description safely from GuildConfig
            const customDescription = config?.getDataValue('rrTempDescription') || 'Click the button below to verify and get your role instantly!';
            console.log(`[RR DEPLOY TEXT] Description Length: ${customDescription.length}`);

            const embed = new EmbedBuilder()
                .setTitle('🔐 Server Verification & Roles')
                .setDescription(customDescription)
                .setColor('#2ecc71')
                .setTimestamp();

            const buttons = roles.map((rr) => {
                const labelText = rr.buttonLabel || interaction.guild.roles.cache.get(rr.roleId)?.name || 'Verify';
                const btn = new ButtonBuilder()
                    .setCustomId(`rr_toggle_${rr.id}`)
                    .setLabel(labelText.substring(0, 80))
                    .setStyle(ButtonStyle.Success);
                
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

            // Stamp message ID onto active records
            await ReactionRole.update({ 
                messageId: sentMessage.id
            }, { 
                where: { guildId: interaction.guild.id, messageId: 'PENDING_DEPLOY' } 
            });

            // Clear temporary cache
            await config.update({ rrTempDescription: null, rrTempChannelId: null });

            return await interaction.reply({ content: `✅ Verification & Reaction panel successfully deployed to <#${targetChannel.id}> with your custom description!`, flags: 64 });
        }

        // --- USER CLICKS A REACTION / VERIFICATION ROLE BUTTON ---
        if (interaction.isButton() && customId.startsWith('rr_toggle_')) {
            const rrId = customId.replace('rr_toggle_', '');
            const rrData = await ReactionRole.findByPk(rrId);

            if (!rrData) {
                return await interaction.reply({ content: '❌ This role configuration no longer exists.', flags: 64 });
            }

            const role = interaction.guild.roles.cache.get(rrData.roleId);
            if (!role) {
                return await interaction.reply({ content: '❌ The assigned role no longer exists on this server.', flags: 64 });
            }

            const member = interaction.member;
            if (member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
                return await interaction.reply({ content: `❌ Verification removed: Role **${role.name}** has been taken away.`, flags: 64 });
            } else {
                await member.roles.add(role);
                return await interaction.reply({ content: `✅ Verified! You have successfully been assigned the **${role.name}** role.`, flags: 64 });
            }
        }

    } catch (error) {
        console.error('[REACTION ROLE HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing reaction roles.', flags: 64 }).catch(() => {});
        }
    }
};