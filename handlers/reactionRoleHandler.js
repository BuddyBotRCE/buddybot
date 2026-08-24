const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { ReactionRole } = require('../database/db');

// In-memory session manager for setup panels (Bypasses all DB schema limitations)
const rrSetupSessions = new Map();

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        
        let selectedValue = '';
        if (interaction.isStringSelectMenu()) {
            selectedValue = interaction.values[0] || '';
        } else if (interaction.isChannelSelectMenu()) {
            selectedValue = interaction.values[0] || interaction.channels.first()?.id || '';
        } else if (interaction.isRoleSelectMenu()) {
            selectedValue = interaction.values[0] || interaction.roles.first()?.id || '';
        }

        console.log(`[RR DEBUG] CustomID: ${customId} | SelectedValue: ${selectedValue}`);

        // Ensure session exists
        if (!rrSetupSessions.has(guildId)) {
            rrSetupSessions.set(guildId, { channelId: null, description: null });
        }
        const session = rrSetupSessions.get(guildId);

        // Helper to render the setup panel
        const renderSetupPanel = async (inter, messageOverride = '') => {
            const activeRoles = await ReactionRole.count({ where: { guildId: inter.guild.id, messageId: 'PENDING_DEPLOY' } });
            
            const targetChannelId = session.channelId;
            const targetChText = targetChannelId ? `<#${targetChannelId}>` : '❌ Not Selected Yet';
            const customText = session.description;
            const customTextStatus = customText ? `✅ Loaded (${customText.length} chars)` : '❌ Using Default Text';

            const embed = new EmbedBuilder()
                .setTitle('🎭 Reaction & Verification Roles Setup')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Configure your interactive verification or role panel below.\n\n• **Target Channel:** ${targetChText}\n• **Queued Roles:** ${activeRoles}\n• **Custom Description:** ${customTextStatus}`)
                .setColor('#3498db');

            const channelRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_rr_channel')
                    .setPlaceholder(targetChannelId ? `📂 Target Channel Selected` : '📂 1. Select Target Channel for Panel...')
                    .addChannelTypes(ChannelType.GuildText)
            );

            const roleRow = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('select_rr_role')
                    .setPlaceholder('🏷️ 2. Select Role to Add to Panel...')
            );

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_rr_modal_config').setLabel('Customize Panel Text').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_rr_deploy').setLabel('Deploy Panel').setStyle(ButtonStyle.Success).setEmoji('📦'),
                new ButtonBuilder().setCustomId('btn_rr_clear').setLabel('Clear Queue').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            const payload = { embeds: [embed], components: [channelRow, roleRow, actionRow], flags: 64 };

            if (inter.isRepliable() && !inter.replied && !inter.deferred) {
                return await inter.reply(payload);
            } else {
                return await inter.update(payload).catch(() => inter.followUp(payload));
            }
        };

        // --- ENTRY OR REFRESH ---
        if ((customId === 'admin_menu_select' && selectedValue === 'setup_reactionroles') || customId === 'rr_action_select' || customId === 'btn_rr_refresh') {
            return await renderSetupPanel(interaction);
        }

        // --- HANDLE CHANNEL SELECTION ---
        if (interaction.isChannelSelectMenu() && customId === 'select_rr_channel') {
            if (!selectedValue) {
                return await interaction.reply({ content: '❌ Could not determine selected channel. Please try again.', flags: 64 });
            }
            
            // Save to live memory session
            session.channelId = selectedValue;
            rrSetupSessions.set(guildId, session);

            console.log(`[RR CHANNEL SAVED] Channel ID: ${selectedValue}`);
            return await renderSetupPanel(interaction, `✅ Target channel successfully set to <#${selectedValue}>!`);
        }

        // --- HANDLE ROLE SELECTION & PROMPT FOR EMOJI ---
        if (interaction.isRoleSelectMenu() && customId === 'select_rr_role') {
            if (!selectedValue) {
                return await interaction.reply({ content: '❌ Could not determine selected role. Please try again.', flags: 64 });
            }
            const roleObj = interaction.guild.roles.cache.get(selectedValue);

            const existing = await ReactionRole.findOne({ where: { guildId, roleId: selectedValue, messageId: 'PENDING_DEPLOY' } });
            if (existing) {
                return await interaction.reply({ content: `⚠️ The role **${roleObj?.name || selectedValue}** is already in the queue!`, flags: 64 });
            }

            const emojiMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`select_rr_emoji_${selectedValue}`)
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

            await ReactionRole.create({
                guildId,
                channelId: session.channelId || interaction.channelId, // Backup channel ID
                roleId: roleId,
                buttonLabel: roleObj?.name || 'Verify / Get Role',
                buttonStyle: 'Primary',
                messageId: 'PENDING_DEPLOY',
                emoji: selectedEmoji
            });

            return await renderSetupPanel(interaction, `✅ Added role **${roleObj?.name || 'Role'}** with emoji ${selectedEmoji}!`);
        }

        // --- OPEN CUSTOMIZATION MODAL (RICH TEXT) ---
        if (interaction.isButton() && customId === 'btn_rr_modal_config') {
            const modal = new ModalBuilder().setCustomId('modal_rr_customize').setTitle('Customize Reaction Panel Text');
            const textInput = new TextInputBuilder()
                .setCustomId('panel_description')
                .setLabel("Panel Description / Verification Rules")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Type or paste your detailed text, rules, or welcome message here...")
                .setRequired(true);

            if (session.description) {
                textInput.setValue(session.description.substring(0, 4000));
            }

            modal.addComponents(new ActionRowBuilder().addComponents(textInput));
            return await interaction.showModal(modal);
        }

        // --- HANDLE MODAL SUBMISSION FOR RICH TEXT ---
        if (interaction.isModalSubmit() && customId === 'modal_rr_customize') {
            const desc = interaction.fields.getTextInputValue('panel_description');
            
            // Save directly to memory session
            session.description = desc;
            rrSetupSessions.set(guildId, session);

            console.log(`[RR TEXT SAVED MODAL] Length: ${desc.length} chars`);
            return await interaction.reply({ content: `✅ Panel text saved successfully (${desc.length} characters)! Now click **Deploy Panel** in your setup menu.`, flags: 64 });
        }

        // --- CLEAR QUEUE BUTTON ---
        if (interaction.isButton() && customId === 'btn_rr_clear') {
            await ReactionRole.destroy({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
            rrSetupSessions.set(guildId, { channelId: null, description: null }); // Clear memory cache
            return await renderSetupPanel(interaction, '🗑️ Cleared queue and temporary configuration.');
        }

        // --- DEPLOY REACTION ROLE PANEL ---
        if (interaction.isButton() && customId === 'btn_rr_deploy') {
            const roles = await ReactionRole.findAll({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
            if (roles.length === 0) {
                return await interaction.reply({ content: '❌ Please select at least one role using the role dropdown menu first!', flags: 64 });
            }

            const targetChannelId = session.channelId;
            console.log(`[RR DEPLOY DEBUG] Resolved Target Channel ID: ${targetChannelId}`);

            if (!targetChannelId) {
                return await interaction.reply({ content: '❌ Please select a target channel using the channel dropdown menu (Step 1) before deploying!', flags: 64 });
            }

            let targetChannel = interaction.guild.channels.cache.get(targetChannelId);
            if (!targetChannel) {
                try {
                    targetChannel = await interaction.guild.channels.fetch(targetChannelId);
                } catch {
                    targetChannel = null;
                }
            }

            if (!targetChannel || typeof targetChannel.send !== 'function') {
                return await interaction.reply({ content: `❌ Could not find or access target channel ID: \`${targetChannelId}\`. Please re-select it from the channel dropdown.`, flags: 64 });
            }

            const customDescription = session.description || 'Click the button below to verify and get your role instantly!';
            console.log(`[RR DEPLOY DEBUG] Final Text Length: ${customDescription.length}`);

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

            // Lock in deployment in the database
            await ReactionRole.update({ messageId: sentMessage.id }, { where: { guildId, messageId: 'PENDING_DEPLOY' } });
            
            // Wipe memory cache to prevent crossover on future deployments
            rrSetupSessions.set(guildId, { channelId: null, description: null });

            return await interaction.reply({ content: `✅ Verification & Reaction panel successfully deployed to <#${targetChannel.id}> with your custom text!`, flags: 64 });
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