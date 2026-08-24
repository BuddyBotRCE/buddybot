const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { ReactionRole } = require('../database/db');

// In-memory session manager for setup panels (Bypasses all DB limitations)
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

        // --- STEP 1: SHOW THE DROPDOWN MENU WHEN CLICKED FROM ADMIN PANEL ---
        if (customId === 'admin_menu_select' && selectedValue === 'setup_reactionroles') {
            // Clear any old sessions
            rrSetupSessions.delete(guildId);

            const embed = new EmbedBuilder()
                .setTitle('🎭 Reaction Roles & Verification')
                .setDescription('Select an option from the dropdown menu below to begin creating your interactive panel:')
                .setColor('#3498db');

            const selectMenuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('rr_action_select')
                    .setPlaceholder('⚙️ Choose Role Panel Type to Create...')
                    .addOptions([
                        {
                            label: 'Create Reaction Roles Panel',
                            value: 'create_reaction_roles',
                            description: 'Buttons that allow users to freely toggle (add & remove) roles.',
                            emoji: '🔄'
                        },
                        {
                            label: 'Create Verification Panel',
                            value: 'create_verification_panel',
                            description: 'One-time verification button to assign a member role.',
                            emoji: '✅'
                        }
                    ])
            );

            const payload = { embeds: [embed], components: [selectMenuRow], flags: 64 };
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                return await interaction.reply(payload);
            } else {
                return await interaction.update(payload).catch(() => interaction.followUp(payload));
            }
        }

        // --- STEP 2: USER SELECTS PANEL TYPE FROM DROPDOWN -> OPEN SETUP PANEL ---
        if (interaction.isStringSelectMenu() && customId === 'rr_action_select') {
            const isVerify = selectedValue === 'create_verification_panel';
            
            rrSetupSessions.set(guildId, { 
                channelId: null, 
                description: null, 
                panelMode: isVerify ? 'verify' : 'toggle' 
            });

            return await renderSetupPanel(interaction, `✅ Selected Mode: **${isVerify ? 'Verification (Add Only)' : 'Reaction Roles (Toggle)'}**`);
        }

        // Ensure session exists for all subsequent interactions
        if (!rrSetupSessions.has(guildId)) {
            rrSetupSessions.set(guildId, { channelId: null, description: null, panelMode: 'toggle' });
        }
        const session = rrSetupSessions.get(guildId);

        // Helper to render the actual setup panel
        async function renderSetupPanel(inter, messageOverride = '') {
            const activeRoles = await ReactionRole.count({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
            
            const targetChannelId = session.channelId;
            const targetChText = targetChannelId ? `<#${targetChannelId}>` : '❌ Not Selected Yet';
            const customText = session.description;
            const customTextStatus = customText ? `✅ Loaded (${customText.length} chars)` : '❌ Using Default Text';
            
            const isVerify = session.panelMode === 'verify';
            const titleText = isVerify ? '🔐 Verification Panel Setup' : '🎭 Reaction Roles Setup';
            const modeText = isVerify ? 'Verification (Add Only)' : 'Reaction Roles (Toggle)';

            const embed = new EmbedBuilder()
                .setTitle(titleText)
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Configure your interactive panel below.\n\n• **Panel Mode:** \`${modeText}\`\n• **Target Channel:** ${targetChText}\n• **Queued Roles:** ${activeRoles}\n• **Custom Description:** ${customTextStatus}`)
                .setColor(isVerify ? '#2ecc71' : '#3498db');

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
        }

        // Catch refresh requests just in case
        if (customId === 'btn_rr_refresh') {
            return await renderSetupPanel(interaction);
        }

        // --- HANDLE CHANNEL SELECTION ---
        if (interaction.isChannelSelectMenu() && customId === 'select_rr_channel') {
            if (!selectedValue) return await interaction.reply({ content: '❌ Could not determine selected channel.', flags: 64 });
            
            session.channelId = selectedValue;
            rrSetupSessions.set(guildId, session);
            return await renderSetupPanel(interaction, `✅ Target channel successfully set to <#${selectedValue}>!`);
        }

        // --- HANDLE ROLE SELECTION & PROMPT FOR EMOJI ---
        if (interaction.isRoleSelectMenu() && customId === 'select_rr_role') {
            if (!selectedValue) return await interaction.reply({ content: '❌ Could not determine selected role.', flags: 64 });
            
            const roleObj = interaction.guild.roles.cache.get(selectedValue);
            const existing = await ReactionRole.findOne({ where: { guildId, roleId: selectedValue, messageId: 'PENDING_DEPLOY' } });
            if (existing) {
                return await interaction.reply({ content: `⚠️ The role **${roleObj?.name || selectedValue}** is already in the queue!`, flags: 64 });
            }

            const emojiMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`select_rr_emoji_${selectedValue}`)
                    .setPlaceholder('✨ Select a Preset Emoji for this Button...')
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
                .setDescription('Select an emoji from the dropdown menu below to assign it to this button.')
                .setColor('#2ecc71');

            return await interaction.reply({ embeds: [embed], components: [emojiMenu], flags: 64 });
        }

        // --- HANDLE PRESET EMOJI SELECTION FROM DROPDOWN ---
        if (interaction.isStringSelectMenu() && customId.startsWith('select_rr_emoji_')) {
            const roleId = customId.replace('select_rr_emoji_', '');
            const selectedEmoji = selectedValue || '✅';
            const roleObj = interaction.guild.roles.cache.get(roleId);

            const isVerify = session.panelMode === 'verify';
            const finalStyle = isVerify ? 'Success' : 'Primary';
            const finalLabel = isVerify ? 'Verify' : (roleObj?.name || 'Get Role');

            await ReactionRole.create({
                guildId,
                channelId: session.channelId || interaction.channelId,
                roleId: roleId,
                buttonLabel: finalLabel,
                buttonStyle: finalStyle,
                messageId: 'PENDING_DEPLOY',
                emoji: selectedEmoji
            });

            return await renderSetupPanel(interaction, `✅ Added role **${roleObj?.name || 'Role'}** with emoji ${selectedEmoji}!`);
        }

        // --- OPEN CUSTOMIZATION MODAL (RICH TEXT) ---
        if (interaction.isButton() && customId === 'btn_rr_modal_config') {
            const modal = new ModalBuilder().setCustomId('modal_rr_customize').setTitle('Customize Panel Text');
            const textInput = new TextInputBuilder()
                .setCustomId('panel_description')
                .setLabel("Panel Description / Verification Rules")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Type your detailed rules or welcome message here...")
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
            session.description = desc;
            rrSetupSessions.set(guildId, session);
            return await interaction.reply({ content: `✅ Panel text saved successfully (${desc.length} characters)! Now click **Deploy Panel** in your setup menu.`, flags: 64 });
        }

        // --- CLEAR QUEUE BUTTON ---
        if (interaction.isButton() && customId === 'btn_rr_clear') {
            await ReactionRole.destroy({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
            rrSetupSessions.set(guildId, { channelId: null, description: null, panelMode: session.panelMode });
            return await renderSetupPanel(interaction, '🗑️ Cleared queue and temporary configuration.');
        }

        // --- DEPLOY REACTION ROLE PANEL ---
        if (interaction.isButton() && customId === 'btn_rr_deploy') {
            const roles = await ReactionRole.findAll({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
            if (roles.length === 0) {
                return await interaction.reply({ content: '❌ Please select at least one role using the role dropdown menu first!', flags: 64 });
            }

            const targetChannelId = session.channelId;
            if (!targetChannelId) {
                return await interaction.reply({ content: '❌ Please select a target channel using the channel dropdown menu (Step 1) before deploying!', flags: 64 });
            }

            let targetChannel = interaction.guild.channels.cache.get(targetChannelId);
            if (!targetChannel) {
                try {
                    targetChannel = await interaction.guild.channels.fetch(targetChannelId);
                } catch {
                    return await interaction.reply({ content: `❌ Could not access target channel. Please re-select it.`, flags: 64 });
                }
            }

            const isVerify = session.panelMode === 'verify';
            const customDescription = session.description || (isVerify 
                ? 'Click the button below to verify and unlock access to the server!' 
                : 'Click the buttons below to assign or remove roles instantly!');

            const embed = new EmbedBuilder()
                .setTitle(isVerify ? '🔐 Server Verification' : '🎭 Server Roles')
                .setDescription(customDescription)
                .setColor(isVerify ? '#2ecc71' : '#3498db')
                .setTimestamp();

            const buttons = roles.map((rr) => {
                const labelText = rr.buttonLabel || interaction.guild.roles.cache.get(rr.roleId)?.name || 'Role';
                const btn = new ButtonBuilder()
                    .setCustomId(`rr_toggle_${rr.id}`)
                    .setLabel(labelText.substring(0, 80))
                    .setStyle(rr.buttonStyle === 'Success' ? ButtonStyle.Success : ButtonStyle.Primary);
                
                if (rr.emoji) btn.setEmoji(rr.emoji);
                return btn;
            });

            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }

            const sentMessage = await targetChannel.send({ embeds: [embed], components: rows });

            await ReactionRole.update({ messageId: sentMessage.id }, { where: { guildId, messageId: 'PENDING_DEPLOY' } });
            rrSetupSessions.delete(guildId); // Clear session entirely so the next one starts fresh

            return await interaction.reply({ content: `✅ Panel successfully deployed to <#${targetChannel.id}>!`, flags: 64 });
        }

        // --- USER CLICKS A REACTION / VERIFICATION ROLE BUTTON ---
        if (interaction.isButton() && customId.startsWith('rr_toggle_')) {
            const rrId = customId.replace('rr_toggle_', '');
            const rrData = await ReactionRole.findByPk(rrId);

            if (!rrData) return await interaction.reply({ content: '❌ This role configuration no longer exists.', flags: 64 });

            const role = interaction.guild.roles.cache.get(rrData.roleId);
            if (!role) return await interaction.reply({ content: '❌ The assigned role no longer exists on this server.', flags: 64 });

            const member = interaction.member;
            
            // Verification Mode: Green button / Add only
            if (rrData.buttonStyle === 'Success') {
                if (member.roles.cache.has(role.id)) {
                    return await interaction.reply({ content: `✅ You are already verified!`, flags: 64 });
                } else {
                    await member.roles.add(role);
                    return await interaction.reply({ content: `✅ Verified! You have been assigned the **${role.name}** role.`, flags: 64 });
                }
            } 
            // Reaction Role Mode: Blue button / Toggleable
            else {
                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                    return await interaction.reply({ content: `❌ Removed role **${role.name}** from you.`, flags: 64 });
                } else {
                    await member.roles.add(role);
                    return await interaction.reply({ content: `✅ Added role **${role.name}** to you!`, flags: 64 });
                }
            }
        }

    } catch (error) {
        console.error('[REACTION ROLE HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing reaction roles.', flags: 64 }).catch(() => {});
        }
    }
};