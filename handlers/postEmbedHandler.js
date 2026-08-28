const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { GuildConfig, CustomEmbed, ReactionRole } = require('../database/db');

const embedSessions = new Map();
const rrSetupSessions = new Map();

const RUST_TEMPLATES = {
    wipe: { templateName: '🪓 Wipe Announcement', title: '🪓 WIPE ANNOUNCEMENT — FRESH MAP!', description: 'The server has successfully wiped!\n\n• **Map Seed:** [Insert Seed]\n• **Map Size:** [Insert Size]\n• **Blueprints:** [Force / Kept]\n\nConnect via F1 console: `connect server.ip:port`', color: '#e74c3c', thumbnailUrl: '', imageUrl: '', footerText: 'Good luck out there, survivors!' },
    rules: { templateName: '📜 Server Rules', title: '📜 RUST CONSOLE COMMUNITY RULES', description: 'Please follow these rules to keep the server fun and fair for everyone:\n\n1️⃣ No racism, hate speech, or excessive toxicity in chat.\n2️⃣ Max team limits must be strictly respected.\n3️⃣ No exploiting bugs, glitches, or under-map building.\n4️⃣ Be respectful to admins and community members.', color: '#f1c40f', thumbnailUrl: '', imageUrl: '', footerText: 'Breaking rules will result in a permanent ban.' },
    store: { templateName: '🛒 Store & VIP', title: '🛒 SUPPORT THE SERVER & VIP', description: 'Want to support the community and grab cool perks? Check out our official store for VIP kits, skins, and economy packages!\n\nType `/playerpanel` in-game or visit our store link to browse available packages.', color: '#2ecc71', thumbnailUrl: '', imageUrl: '', footerText: 'All proceeds go directly back into server hosting.' },
    vote: { templateName: '🗳️ Vote & Earn Rewards', title: '🗳️ VOTE FOR FREE SCRAP', description: 'Help our community grow by voting for the server daily! Every vote grants free scrap directly to your in-game wallet.\n\nClick the link or use the vote menu in your player panel to claim.', color: '#9b59b6', thumbnailUrl: '', imageUrl: '', footerText: 'Thank you for supporting our server!' }
};

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        let selectedValue = '';
        
        if (interaction.isStringSelectMenu()) selectedValue = interaction.values[0] || '';
        else if (interaction.isChannelSelectMenu()) selectedValue = interaction.values[0] || interaction.channels.first()?.id || '';
        else if (interaction.isRoleSelectMenu()) selectedValue = interaction.values[0] || interaction.roles.first()?.id || '';

        // ====================================================================
        // 🚦 INITIAL ROUTING FOR NEW UNIFIED MENU OPTIONS
        // ====================================================================
        if (customId === 'unified_embed_select') {
            if (selectedValue === 'setup_postembed') {
                embedSessions.set(guildId, { title: '📢 Server Announcement', description: 'Type your announcement details here.', color: '#3498db', thumbnailUrl: '', imageUrl: '', footerText: '', editMode: false });
            }
            if (selectedValue === 'edit_postembed') {
                const modal = new ModalBuilder().setCustomId('modal_edit_embed_prompt').setTitle('Edit Existing Embed');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message_id').setLabel('Message ID or Link').setStyle(TextInputStyle.Short).setRequired(true)));
                return await interaction.showModal(modal);
            }
            if (selectedValue === 'attach_reaction_panel') {
                const modal = new ModalBuilder().setCustomId('modal_attach_rr_prompt').setTitle('Attach Roles to Message');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message_id').setLabel('Message ID or Link').setStyle(TextInputStyle.Short).setRequired(true)));
                return await interaction.showModal(modal);
            }
            if (selectedValue === 'create_reaction_panel' || selectedValue === 'create_verification_panel') {
                const isVerify = selectedValue === 'create_verification_panel';
                rrSetupSessions.set(guildId, { channelId: null, description: null, panelMode: isVerify ? 'verify' : 'toggle' });
            }
        }

        // ====================================================================
        // 📥 MODAL CATCHERS FOR TARGET IDs (EDITING / ATTACHING)
        // ====================================================================
        if (interaction.isModalSubmit() && (customId === 'modal_edit_embed_prompt' || customId === 'modal_attach_rr_prompt')) {
            const input = interaction.fields.getTextInputValue('message_id').trim();
            let msg = null;
            let targetChannelId = null;

            try {
                if (input.includes('discord.com/channels/')) {
                    const parts = input.split('/');
                    targetChannelId = parts[parts.length - 2];
                    const mId = parts[parts.length - 1];
                    const channel = await interaction.guild.channels.fetch(targetChannelId).catch(()=>null);
                    if (channel) msg = await channel.messages.fetch(mId).catch(()=>null);
                } else {
                    msg = await interaction.channel.messages.fetch(input).catch(()=>null);
                    targetChannelId = interaction.channelId;
                    if (!msg) {
                        const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
                        for (const [id, channel] of channels) {
                            msg = await channel.messages.fetch(input).catch(()=>null);
                            if (msg) { targetChannelId = id; break; }
                        }
                    }
                }

                if (!msg) return interaction.reply({ content: '❌ Could not find that message. Try pasting the full Message Link instead.', flags: 64 });

                if (customId === 'modal_edit_embed_prompt') {
                    if (!msg.embeds.length) return interaction.reply({ content: '❌ That message has no embeds to edit.', flags: 64 });
                    
                    const oldEmbed = msg.embeds[0];
                    const embSession = embedSessions.get(guildId) || {};
                    embSession.title = oldEmbed.title || '';
                    embSession.description = oldEmbed.description || '';
                    embSession.color = oldEmbed.hexColor || '#3498db';
                    embSession.thumbnailUrl = oldEmbed.thumbnail?.url || '';
                    embSession.imageUrl = oldEmbed.image?.url || '';
                    embSession.footerText = oldEmbed.footer?.text || '';
                    embSession.editMode = true;
                    embSession.targetChannelId = targetChannelId;
                    embSession.targetMessageId = msg.id;
                    embedSessions.set(guildId, embSession);
                } 
                else if (customId === 'modal_attach_rr_prompt') {
                    const rrSession = rrSetupSessions.get(guildId) || { channelId: null, description: null, panelMode: 'toggle' };
                    rrSession.panelMode = 'attach';
                    rrSession.channelId = targetChannelId;
                    rrSession.targetMessageId = msg.id;
                    rrSetupSessions.set(guildId, rrSession);
                }
                await interaction.deferUpdate().catch(()=>{}); 
            } catch (e) {
                return interaction.reply({ content: '❌ An error occurred trying to fetch that message.', flags: 64 });
            }
        }

        // ====================================================================
        // 🎭 REACTION ROLES & VERIFICATION PANELS LOGIC
        // ====================================================================
        if (customId.startsWith('rr_') || customId.startsWith('select_rr_') || customId.startsWith('btn_rr_') || customId.startsWith('modal_rr_') || (customId === 'unified_embed_select' && (selectedValue === 'create_reaction_panel' || selectedValue === 'create_verification_panel')) || customId === 'modal_attach_rr_prompt') {
            
            if (!rrSetupSessions.has(guildId)) rrSetupSessions.set(guildId, { channelId: null, description: null, panelMode: 'toggle' });
            const rrSession = rrSetupSessions.get(guildId);

            const renderSetupPanel = async (inter, messageOverride = '') => {
                const activeRoles = await ReactionRole.count({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
                const targetChannelId = rrSession.channelId;
                const targetChText = targetChannelId ? `<#${targetChannelId}>` : '❌ Not Selected Yet';
                const customText = rrSession.description;
                const customTextStatus = customText ? `✅ Loaded (${customText.length} chars)` : '❌ Using Default Text';
                const isVerify = rrSession.panelMode === 'verify';
                const isAttach = rrSession.panelMode === 'attach';
                
                let modeText = '🔄 **Reaction Roles (Toggle)**';
                if (isVerify) modeText = '✅ **Verification (Add Only)**';
                if (isAttach) modeText = '📎 **Attaching to Existing Message**';

                const embed = new EmbedBuilder()
                    .setTitle(isVerify ? '🔐 Verification Setup' : (isAttach ? '📎 Attach Roles Setup' : '🎭 Reaction Roles Setup'))
                    .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Configure your interactive panel below.\n\n• **Target Channel:** ${targetChText}\n• **Panel Mode:** ${modeText}\n• **Queued Roles:** ${activeRoles}\n• **Custom Description:** ${isAttach ? '*Ignored (Using existing message)*' : customTextStatus}`)
                    .setColor(isVerify ? '#2ecc71' : (isAttach ? '#f1c40f' : '#3498db'));

                const components = [];
                if (!isAttach) components.push(new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_rr_channel').setPlaceholder(targetChannelId ? `📂 Target Channel Selected` : '📂 1. Select Target Channel for Panel...').addChannelTypes(ChannelType.GuildText)));
                
                components.push(new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_rr_role').setPlaceholder('🏷️ 2. Select Role to Add to Panel...')));
                
                const actionRow = new ActionRowBuilder();
                if (!isAttach) actionRow.addComponents(new ButtonBuilder().setCustomId('btn_rr_modal_config').setLabel('Customize Text').setStyle(ButtonStyle.Primary).setEmoji('✏️'));
                actionRow.addComponents(new ButtonBuilder().setCustomId('btn_rr_deploy').setLabel(isAttach ? 'Attach to Message' : 'Deploy Panel').setStyle(ButtonStyle.Success).setEmoji(isAttach ? '📎' : '📦'), new ButtonBuilder().setCustomId('btn_rr_clear').setLabel('Clear Queue').setStyle(ButtonStyle.Danger).setEmoji('🗑️'));
                components.push(actionRow);

                const payload = { embeds: [embed], components, flags: 64 };
                if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
                return await inter.editReply(payload).catch(() => inter.followUp(payload));
            };

            if (customId === 'unified_embed_select' || customId === 'modal_attach_rr_prompt') return await renderSetupPanel(interaction);

            if (interaction.isChannelSelectMenu() && customId === 'select_rr_channel') {
                rrSession.channelId = selectedValue; rrSetupSessions.set(guildId, rrSession);
                return await renderSetupPanel(interaction, `✅ Target channel successfully set to <#${selectedValue}>!`);
            }

            if (interaction.isRoleSelectMenu() && customId === 'select_rr_role') {
                const roleObj = interaction.guild.roles.cache.get(selectedValue);
                const existing = await ReactionRole.findOne({ where: { guildId, roleId: selectedValue, messageId: 'PENDING_DEPLOY' } });
                if (existing) return await renderSetupPanel(interaction, `⚠️ The role **${roleObj?.name || selectedValue}** is already in the queue!`);

                const emojiMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId(`select_rr_emoji_${selectedValue}`).setPlaceholder('✨ Select a Preset Emoji for this Role Button...').addOptions([
                        { label: 'Verify / Checkmark', value: '✅', emoji: '✅' }, { label: 'Fire / PvP', value: '🔥', emoji: '🔥' }, { label: 'Shield / Defense', value: '🛡️', emoji: '🛡️' }, { label: 'Swords / Combat', value: '⚔️', emoji: '⚔️' }, { label: 'Star / VIP', value: '⭐', emoji: '⭐' }, { label: 'Gaming Controller', value: '🎮', emoji: '🎮' }, { label: 'Robot', value: '🤖', emoji: '🤖' }, { label: 'Diamond', value: '💎', emoji: '💎' }, { label: 'Rocket', value: '🚀', emoji: '🚀' }, { label: 'Crown', value: '👑', emoji: '👑' }
                    ])
                );
                return await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🎨 Choose Emoji for: ${roleObj?.name || 'Role'}`).setDescription('Select an emoji from the dropdown menu below to assign it to this button.').setColor('#2ecc71')], components: [emojiMenu], flags: 64 });
            }

            if (interaction.isStringSelectMenu() && customId.startsWith('select_rr_emoji_')) {
                const roleId = customId.replace('select_rr_emoji_', '');
                const roleObj = interaction.guild.roles.cache.get(roleId);
                const isVerify = rrSession.panelMode === 'verify';
                await ReactionRole.create({ guildId, channelId: rrSession.channelId || interaction.channelId, roleId: roleId, buttonLabel: isVerify ? 'Verify' : (roleObj?.name || 'Get Role'), buttonStyle: isVerify ? 'Success' : 'Primary', messageId: 'PENDING_DEPLOY', emoji: selectedValue || '✅' });
                
                await interaction.deferUpdate();
                await interaction.deleteReply(); 
                return await renderSetupPanel(interaction, `✅ Added role **${roleObj?.name || 'Role'}**!`);
            }

            if (interaction.isButton() && customId === 'btn_rr_modal_config') {
                const modal = new ModalBuilder().setCustomId('modal_rr_customize').setTitle('Customize Panel Text');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('panel_description').setLabel("Panel Description / Verification Rules").setStyle(TextInputStyle.Paragraph).setPlaceholder("Type your detailed rules or welcome message here...").setValue(rrSession.description ? rrSession.description.substring(0, 4000) : '').setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (interaction.isModalSubmit() && customId === 'modal_rr_customize') {
                rrSession.description = interaction.fields.getTextInputValue('panel_description');
                rrSetupSessions.set(guildId, rrSession);
                await interaction.deferUpdate();
                return await renderSetupPanel(interaction, `✅ Panel text saved successfully!`);
            }

            if (interaction.isButton() && customId === 'btn_rr_clear') {
                await ReactionRole.destroy({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
                rrSetupSessions.set(guildId, { channelId: null, description: null, panelMode: rrSession.panelMode });
                return await renderSetupPanel(interaction, '🗑️ Cleared queue and temporary configuration.');
            }

            if (interaction.isButton() && customId === 'btn_rr_deploy') {
                const roles = await ReactionRole.findAll({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
                if (roles.length === 0) return await renderSetupPanel(interaction, '❌ Please select at least one role using the role dropdown menu first!');
                if (!rrSession.channelId) return await renderSetupPanel(interaction, '❌ Please set the Target Message ID or Target Channel first!');

                let targetChannel = interaction.guild.channels.cache.get(rrSession.channelId);
                if (!targetChannel) targetChannel = await interaction.guild.channels.fetch(rrSession.channelId).catch(()=>null);
                if (!targetChannel) return await renderSetupPanel(interaction, `❌ Could not access target channel.`);

                const buttons = roles.map((rr) => {
                    const btn = new ButtonBuilder().setCustomId(`rr_toggle_${rr.id}`).setLabel((rr.buttonLabel || interaction.guild.roles.cache.get(rr.roleId)?.name || 'Role').substring(0, 80)).setStyle(rr.buttonStyle === 'Success' ? ButtonStyle.Success : ButtonStyle.Primary);
                    if (rr.emoji) btn.setEmoji(rr.emoji);
                    return btn;
                });

                const rows = [];
                for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));

                if (rrSession.panelMode === 'attach') {
                    const msg = await targetChannel.messages.fetch(rrSession.targetMessageId).catch(()=>null);
                    if (!msg) return await renderSetupPanel(interaction, '❌ Target message no longer exists in that channel!');
                    
                    await msg.edit({ components: rows });
                    await ReactionRole.update({ messageId: msg.id }, { where: { guildId, messageId: 'PENDING_DEPLOY' } });
                    rrSetupSessions.delete(guildId);
                    return await interaction.update({ content: `✅ Roles successfully attached to the message!`, embeds: [], components: [] });
                } else {
                    const isVerify = rrSession.panelMode === 'verify';
                    const embed = new EmbedBuilder().setTitle(isVerify ? '🔐 Server Verification' : '🎭 Server Roles').setDescription(rrSession.description || (isVerify ? 'Click the button below to verify and unlock access to the server!' : 'Click the buttons below to assign or remove roles instantly!')).setColor(isVerify ? '#2ecc71' : '#3498db').setTimestamp();

                    const sentMessage = await targetChannel.send({ embeds: [embed], components: rows });
                    await ReactionRole.update({ messageId: sentMessage.id }, { where: { guildId, messageId: 'PENDING_DEPLOY' } });
                    rrSetupSessions.delete(guildId); 
                    return await interaction.update({ content: `✅ Panel successfully deployed to <#${targetChannel.id}>!`, embeds: [], components: [] });
                }
            }

            if (interaction.isButton() && customId.startsWith('rr_toggle_')) {
                const rrData = await ReactionRole.findByPk(customId.replace('rr_toggle_', ''));
                if (!rrData) return await interaction.reply({ content: '❌ This role configuration no longer exists.', flags: 64 });
                const role = interaction.guild.roles.cache.get(rrData.roleId);
                if (!role) return await interaction.reply({ content: '❌ The assigned role no longer exists on this server.', flags: 64 });

                const member = interaction.member;
                if (rrData.buttonStyle === 'Success') {
                    if (member.roles.cache.has(role.id)) return await interaction.reply({ content: `✅ You are already verified!`, flags: 64 });
                    await member.roles.add(role);
                    return await interaction.reply({ content: `✅ Verified! You have been assigned the **${role.name}** role.`, flags: 64 });
                } else {
                    if (member.roles.cache.has(role.id)) { await member.roles.remove(role); return await interaction.reply({ content: `❌ Removed role **${role.name}** from you.`, flags: 64 }); }
                    else { await member.roles.add(role); return await interaction.reply({ content: `✅ Added role **${role.name}** to you!`, flags: 64 }); }
                }
            }
            return;
        }

        // ====================================================================
        // 📢 CUSTOM EMBEDS & ANNOUNCEMENTS LOGIC
        // ====================================================================
        if (customId.startsWith('emb_') || customId.startsWith('select_emb_') || customId.startsWith('btn_emb_') || customId.startsWith('modal_emb_') || (customId === 'unified_embed_select' && selectedValue === 'setup_postembed') || customId === 'modal_edit_embed_prompt') {
            
            if (!embedSessions.has(guildId)) {
                embedSessions.set(guildId, { title: '📢 Server Announcement', description: 'Type your announcement details here.', color: '#3498db', thumbnailUrl: '', imageUrl: '', footerText: '', editMode: false });
            }
            const embSession = embedSessions.get(guildId);

            const renderBuilder = async (inter, messageOverride = '') => {
                const previewEmbed = new EmbedBuilder().setTitle(embSession.title).setDescription(embSession.description).setColor(embSession.color).setTimestamp();
                if (embSession.thumbnailUrl) previewEmbed.setThumbnail(embSession.thumbnailUrl);
                if (embSession.imageUrl) previewEmbed.setImage(embSession.imageUrl);
                if (embSession.footerText) previewEmbed.setFooter({ text: embSession.footerText });

                const configEmbed = new EmbedBuilder().setTitle(embSession.editMode ? '✏️ Editing Existing Embed' : '🎨 Post Embed Builder').setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}${embSession.editMode ? 'Modify the fields below and click Save Edits to push changes to the live message.' : 'Design your custom announcement with banners, thumbnails, and custom text, then publish it live.'}`).setColor(embSession.editMode ? '#e67e22' : '#f39c12');

                const components = [];
                if (!embSession.editMode) {
                    components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_emb_template').setPlaceholder('⚡ Load Pre-Made Rust Template...').addOptions([{ label: '🪓 Wipe Announcement', value: 'wipe' }, { label: '📜 Server Rules', value: 'rules' }, { label: '🛒 Store & VIP', value: 'store' }, { label: '🗳️ Vote & Rewards', value: 'vote' }])));
                }
                
                // 👇 NEW DROPDOWN COLOR PICKER REPLACING THE BUTTON 👇
                components.push(new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('select_emb_color').setPlaceholder('🎨 Select Embed Color...')
                    .addOptions([
                        { label: 'Red (Hostile / Alert)', value: '#e74c3c', emoji: '🔴' },
                        { label: 'Green (Safe / Success)', value: '#2ecc71', emoji: '🟢' },
                        { label: 'Blue (Neutral / Info)', value: '#3498db', emoji: '🔵' },
                        { label: 'Yellow (Warning)', value: '#f1c40f', emoji: '🟡' },
                        { label: 'Orange (Event)', value: '#e67e22', emoji: '🟠' },
                        { label: 'Purple (Premium)', value: '#9b59b6', emoji: '🟣' },
                        { label: 'Black / Dark (Sleek)', value: '#2b2d31', emoji: '⚫' },
                        { label: 'White (Clean)', value: '#ffffff', emoji: '⚪' }
                    ])
                ));

                components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_emb_title').setLabel('Title').setStyle(ButtonStyle.Primary).setEmoji('✏️'), new ButtonBuilder().setCustomId('btn_emb_desc').setLabel('Description').setStyle(ButtonStyle.Primary).setEmoji('📝'), new ButtonBuilder().setCustomId('btn_emb_thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'), new ButtonBuilder().setCustomId('btn_emb_image').setLabel('Banner Image').setStyle(ButtonStyle.Secondary).setEmoji('🌟'), new ButtonBuilder().setCustomId('btn_emb_footer').setLabel('Footer Text').setStyle(ButtonStyle.Secondary).setEmoji('📌')));
                
                const pubBtn = embSession.editMode 
                    ? new ButtonBuilder().setCustomId('btn_emb_publish_edit').setLabel('Save Edits to Message').setStyle(ButtonStyle.Success).setEmoji('💾')
                    : new ButtonBuilder().setCustomId('btn_emb_publish').setLabel('Select Channel & Post').setStyle(ButtonStyle.Success).setEmoji('🚀');

                components.push(new ActionRowBuilder().addComponents(pubBtn));

                const payload = { embeds: [configEmbed, previewEmbed], components, flags: 64 };
                if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
                return await inter.editReply(payload).catch(() => inter.followUp(payload));
            };

            if (customId === 'unified_embed_select' || customId === 'modal_edit_embed_prompt') return await renderBuilder(interaction);

            if (interaction.isStringSelectMenu() && customId === 'select_emb_template') {
                const template = RUST_TEMPLATES[selectedValue];
                if (template) {
                    embSession.title = template.title; embSession.description = template.description; embSession.color = template.color; embSession.thumbnailUrl = template.thumbnailUrl; embSession.imageUrl = template.imageUrl; embSession.footerText = template.footerText;
                    embedSessions.set(guildId, embSession);
                    await interaction.deferUpdate();
                    return await renderBuilder(interaction, `⚡ Loaded template: **${template.templateName}**!`);
                }
            }

            // 👇 HANDLES THE NEW COLOR DROPDOWN 👇
            if (interaction.isStringSelectMenu() && customId === 'select_emb_color') {
                embSession.color = selectedValue;
                embedSessions.set(guildId, embSession);
                await interaction.deferUpdate();
                return await renderBuilder(interaction, `🎨 Embed color updated!`);
            }

            if (interaction.isButton()) {
                if (customId === 'btn_emb_title') { const modal = new ModalBuilder().setCustomId('modal_emb_title').setTitle('Set Embed Title'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Title Text').setStyle(TextInputStyle.Short).setValue(embSession.title).setRequired(true))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_desc') { const modal = new ModalBuilder().setCustomId('modal_emb_desc').setTitle('Set Embed Description'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(embSession.description).setRequired(true))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_thumb') { const modal = new ModalBuilder().setCustomId('modal_emb_thumb').setTitle('Set Thumbnail URL'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Corner Thumbnail Image URL').setStyle(TextInputStyle.Short).setValue(embSession.thumbnailUrl || '').setRequired(false))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_image') { const modal = new ModalBuilder().setCustomId('modal_emb_image').setTitle('Set Banner Image URL'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Large Banner Image URL').setStyle(TextInputStyle.Short).setValue(embSession.imageUrl || '').setRequired(false))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_footer') { const modal = new ModalBuilder().setCustomId('modal_emb_footer').setTitle('Set Footer Text'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(embSession.footerText || '').setRequired(false))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_publish') return await interaction.reply({ content: '📢 Select the Discord channel where you want to post this embed:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_emb_target_channel').setPlaceholder('Select channel to post announcement...').setChannelTypes([0]))], flags: 64 });
                
                if (customId === 'btn_emb_publish_edit') {
                    const channel = interaction.guild.channels.cache.get(embSession.targetChannelId);
                    const msg = await channel.messages.fetch(embSession.targetMessageId).catch(()=>null);
                    if (!msg) return interaction.reply({ content: '❌ Message not found on the server anymore!', flags: 64 });
                    
                    const finalEmbed = new EmbedBuilder().setTitle(embSession.title).setDescription(embSession.description).setColor(embSession.color).setTimestamp();
                    if (embSession.thumbnailUrl) finalEmbed.setThumbnail(embSession.thumbnailUrl);
                    if (embSession.imageUrl) finalEmbed.setImage(embSession.imageUrl);
                    if (embSession.footerText) finalEmbed.setFooter({ text: embSession.footerText });
                    
                    await msg.edit({ embeds: [finalEmbed] });
                    embSession.editMode = false;
                    embedSessions.delete(guildId);
                    return interaction.update({ content: `✅ Successfully edited the embed on the server!`, embeds: [], components: [] });
                }
            }

            if (interaction.isChannelSelectMenu() && customId === 'select_emb_target_channel') {
                const channelId = interaction.values[0];
                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) return await interaction.reply({ content: '❌ Target channel not found.', flags: 64 });

                const finalEmbed = new EmbedBuilder().setTitle(embSession.title).setDescription(embSession.description).setColor(embSession.color).setTimestamp();
                if (embSession.thumbnailUrl) finalEmbed.setThumbnail(embSession.thumbnailUrl);
                if (embSession.imageUrl) finalEmbed.setImage(embSession.imageUrl);
                if (embSession.footerText) finalEmbed.setFooter({ text: embSession.footerText });

                await channel.send({ embeds: [finalEmbed] });
                embedSessions.delete(guildId);
                return await interaction.update({ content: `✅ Announcement successfully posted to <#${channelId}>!`, components: [], embeds: [] });
            }

            if (interaction.isModalSubmit()) {
                const val = interaction.fields.getTextInputValue('val');
                if (customId === 'modal_emb_title') embSession.title = val;
                if (customId === 'modal_emb_desc') embSession.description = val;
                if (customId === 'modal_emb_thumb') embSession.thumbnailUrl = val;
                if (customId === 'modal_emb_image') embSession.imageUrl = val;
                if (customId === 'modal_emb_footer') embSession.footerText = val;

                embedSessions.set(guildId, embSession);
                await interaction.deferUpdate();
                return await renderBuilder(interaction, '✅ Embed preview updated!');
            }
        }
    } catch (error) {
        console.error('[INTERACTIVE PANEL HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing the panel.', flags: 64 }).catch(() => {});
        }
    }
};