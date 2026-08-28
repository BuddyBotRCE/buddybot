const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { GuildConfig, CustomEmbed, ReactionRole } = require('../database/db');

const embedSessions = new Map();
const rrSetupSessions = new Map();

const RUST_TEMPLATES = {
    wipe: {
        templateName: '🪓 Wipe Announcement', title: '🪓 WIPE ANNOUNCEMENT — FRESH MAP!', description: 'The server has successfully wiped!\n\n• **Map Seed:** [Insert Seed]\n• **Map Size:** [Insert Size]\n• **Blueprints:** [Force / Kept]\n\nConnect via F1 console: `connect server.ip:port`', color: '#e74c3c', thumbnailUrl: '', imageUrl: '', footerText: 'Good luck out there, survivors!'
    },
    rules: {
        templateName: '📜 Server Rules', title: '📜 RUST CONSOLE COMMUNITY RULES', description: 'Please follow these rules to keep the server fun and fair for everyone:\n\n1️⃣ No racism, hate speech, or excessive toxicity in chat.\n2️⃣ Max team limits must be strictly respected.\n3️⃣ No exploiting bugs, glitches, or under-map building.\n4️⃣ Be respectful to admins and community members.', color: '#f1c40f', thumbnailUrl: '', imageUrl: '', footerText: 'Breaking rules will result in a permanent ban.'
    },
    store: {
        templateName: '🛒 Store & VIP', title: '🛒 SUPPORT THE SERVER & VIP', description: 'Want to support the community and grab cool perks? Check out our official store for VIP kits, skins, and economy packages!\n\nType `/playerpanel` in-game or visit our store link to browse available packages.', color: '#2ecc71', thumbnailUrl: '', imageUrl: '', footerText: 'All proceeds go directly back into server hosting.'
    },
    vote: {
        templateName: '🗳️ Vote & Earn Rewards', title: '🗳️ VOTE FOR FREE SCRAP', description: 'Help our community grow by voting for the server daily! Every vote grants free scrap directly to your in-game wallet.\n\nClick the link or use the vote menu in your player panel to claim.', color: '#9b59b6', thumbnailUrl: '', imageUrl: '', footerText: 'Thank you for supporting our server!'
    }
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
        // 🎭 REACTION ROLES & VERIFICATION PANELS LOGIC
        // ====================================================================
        if (customId.startsWith('rr_') || customId.startsWith('select_rr_') || customId.startsWith('btn_rr_') || customId.startsWith('modal_rr_') || (customId === 'unified_embed_select' && (selectedValue === 'create_reaction_panel' || selectedValue === 'create_verification_panel'))) {
            
            if (!rrSetupSessions.has(guildId)) rrSetupSessions.set(guildId, { channelId: null, description: null, panelMode: 'toggle' });
            const rrSession = rrSetupSessions.get(guildId);

            const renderSetupPanel = async (inter, messageOverride = '') => {
                const activeRoles = await ReactionRole.count({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
                const targetChannelId = rrSession.channelId;
                const targetChText = targetChannelId ? `<#${targetChannelId}>` : '❌ Not Selected Yet';
                const customText = rrSession.description;
                const customTextStatus = customText ? `✅ Loaded (${customText.length} chars)` : '❌ Using Default Text';
                
                const isVerify = rrSession.panelMode === 'verify';
                const modeText = isVerify ? '✅ **Verification (Add Only)**' : '🔄 **Reaction Roles (Toggle)**';

                const embed = new EmbedBuilder()
                    .setTitle(isVerify ? '🔐 Verification Panel Setup' : '🎭 Reaction Roles Setup')
                    .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Configure your interactive panel below.\n\n• **Target Channel:** ${targetChText}\n• **Panel Mode:** ${modeText}\n• **Queued Roles:** ${activeRoles}\n• **Custom Description:** ${customTextStatus}`)
                    .setColor(isVerify ? '#2ecc71' : '#3498db');

                const channelRow = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_rr_channel').setPlaceholder(targetChannelId ? `📂 Target Channel Selected` : '📂 1. Select Target Channel for Panel...').addChannelTypes(ChannelType.GuildText));
                const roleRow = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_rr_role').setPlaceholder('🏷️ 2. Select Role to Add to Panel...'));
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_rr_modal_config').setLabel('Customize Text').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                    new ButtonBuilder().setCustomId('btn_rr_deploy').setLabel('Deploy Panel').setStyle(ButtonStyle.Success).setEmoji('📦'),
                    new ButtonBuilder().setCustomId('btn_rr_clear').setLabel('Clear Queue').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );

                const payload = { embeds: [embed], components: [channelRow, roleRow, actionRow], flags: 64 };
                if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
                return await inter.update(payload).catch(() => inter.followUp(payload));
            };

            if (customId === 'unified_embed_select') {
                rrSession.panelMode = selectedValue === 'create_verification_panel' ? 'verify' : 'toggle';
                rrSession.channelId = null; rrSession.description = null;
                rrSetupSessions.set(guildId, rrSession);
                return await renderSetupPanel(interaction);
            }

            if (interaction.isChannelSelectMenu() && customId === 'select_rr_channel') {
                rrSession.channelId = selectedValue;
                rrSetupSessions.set(guildId, rrSession);
                return await renderSetupPanel(interaction, `✅ Target channel successfully set to <#${selectedValue}>!`);
            }

            if (interaction.isRoleSelectMenu() && customId === 'select_rr_role') {
                const roleObj = interaction.guild.roles.cache.get(selectedValue);
                const existing = await ReactionRole.findOne({ where: { guildId, roleId: selectedValue, messageId: 'PENDING_DEPLOY' } });
                if (existing) return await interaction.reply({ content: `⚠️ The role **${roleObj?.name || selectedValue}** is already in the queue!`, flags: 64 });

                const emojiMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId(`select_rr_emoji_${selectedValue}`).setPlaceholder('✨ Select a Preset Emoji for this Role Button...').addOptions([
                        { label: 'Verify / Checkmark', value: '✅', description: 'Verification checkmark', emoji: '✅' }, { label: 'Fire / PvP', value: '🔥', description: 'Flame emoji', emoji: '🔥' }, { label: 'Shield / Defense', value: '🛡️', description: 'Shield emoji', emoji: '🛡️' }, { label: 'Swords / Combat', value: '⚔️', description: 'Swords emoji', emoji: '⚔️' }, { label: 'Star / VIP', value: '⭐', description: 'Star emoji', emoji: '⭐' }, { label: 'Gaming Controller', value: '🎮', description: 'Controller emoji', emoji: '🎮' }, { label: 'Robot / Automation', value: '🤖', description: 'Robot emoji', emoji: '🤖' }, { label: 'Diamond / Premium', value: '💎', description: 'Gem emoji', emoji: '💎' }, { label: 'Rocket / Launch', value: '🚀', description: 'Rocket emoji', emoji: '🚀' }, { label: 'Crown / Leader', value: '👑', description: 'Crown emoji', emoji: '👑' }
                    ])
                );
                return await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🎨 Choose Emoji for: ${roleObj?.name || 'Role'}`).setDescription('Select an emoji from the dropdown menu below to assign it to this button.').setColor('#2ecc71')], components: [emojiMenu], flags: 64 });
            }

            if (interaction.isStringSelectMenu() && customId.startsWith('select_rr_emoji_')) {
                const roleId = customId.replace('select_rr_emoji_', '');
                const roleObj = interaction.guild.roles.cache.get(roleId);
                const isVerify = rrSession.panelMode === 'verify';
                await ReactionRole.create({ guildId, channelId: rrSession.channelId || interaction.channelId, roleId: roleId, buttonLabel: isVerify ? 'Verify' : (roleObj?.name || 'Get Role'), buttonStyle: isVerify ? 'Success' : 'Primary', messageId: 'PENDING_DEPLOY', emoji: selectedValue || '✅' });
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
                return await interaction.reply({ content: `✅ Panel text saved successfully!`, flags: 64 });
            }

            if (interaction.isButton() && customId === 'btn_rr_clear') {
                await ReactionRole.destroy({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
                rrSetupSessions.set(guildId, { channelId: null, description: null, panelMode: rrSession.panelMode });
                return await renderSetupPanel(interaction, '🗑️ Cleared queue and temporary configuration.');
            }

            if (interaction.isButton() && customId === 'btn_rr_deploy') {
                const roles = await ReactionRole.findAll({ where: { guildId, messageId: 'PENDING_DEPLOY' } });
                if (roles.length === 0) return await interaction.reply({ content: '❌ Please select at least one role using the role dropdown menu first!', flags: 64 });
                if (!rrSession.channelId) return await interaction.reply({ content: '❌ Please select a target channel using the channel dropdown menu (Step 1) before deploying!', flags: 64 });

                let targetChannel = interaction.guild.channels.cache.get(rrSession.channelId);
                if (!targetChannel) targetChannel = await interaction.guild.channels.fetch(rrSession.channelId).catch(()=>null);
                if (!targetChannel) return await interaction.reply({ content: `❌ Could not access target channel.`, flags: 64 });

                const isVerify = rrSession.panelMode === 'verify';
                const embed = new EmbedBuilder().setTitle(isVerify ? '🔐 Server Verification' : '🎭 Server Roles').setDescription(rrSession.description || (isVerify ? 'Click the button below to verify and unlock access to the server!' : 'Click the buttons below to assign or remove roles instantly!')).setColor(isVerify ? '#2ecc71' : '#3498db').setTimestamp();

                const buttons = roles.map((rr) => {
                    const btn = new ButtonBuilder().setCustomId(`rr_toggle_${rr.id}`).setLabel((rr.buttonLabel || interaction.guild.roles.cache.get(rr.roleId)?.name || 'Role').substring(0, 80)).setStyle(rr.buttonStyle === 'Success' ? ButtonStyle.Success : ButtonStyle.Primary);
                    if (rr.emoji) btn.setEmoji(rr.emoji);
                    return btn;
                });

                const rows = [];
                for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));

                const sentMessage = await targetChannel.send({ embeds: [embed], components: rows });
                await ReactionRole.update({ messageId: sentMessage.id }, { where: { guildId, messageId: 'PENDING_DEPLOY' } });
                rrSetupSessions.delete(guildId); 
                return await interaction.reply({ content: `✅ Panel successfully deployed to <#${targetChannel.id}>!`, flags: 64 });
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
            return; // End RR Execution
        }

        // ====================================================================
        // 📢 CUSTOM EMBEDS & ANNOUNCEMENTS LOGIC
        // ====================================================================
        if (customId.startsWith('emb_') || customId.startsWith('select_emb_') || customId.startsWith('btn_emb_') || customId.startsWith('modal_emb_') || (customId === 'unified_embed_select' && selectedValue === 'setup_postembed')) {
            
            if (!embedSessions.has(guildId)) {
                embedSessions.set(guildId, { title: '📢 Server Announcement', description: 'Type your announcement details here using the builder controls below.', color: '#3498db', thumbnailUrl: '', imageUrl: '', footerText: '' });
            }
            const embSession = embedSessions.get(guildId);

            const renderBuilder = async (inter, messageOverride = '') => {
                const previewEmbed = new EmbedBuilder().setTitle(embSession.title).setDescription(embSession.description).setColor(embSession.color).setTimestamp();
                if (embSession.thumbnailUrl) previewEmbed.setThumbnail(embSession.thumbnailUrl);
                if (embSession.imageUrl) previewEmbed.setImage(embSession.imageUrl);
                if (embSession.footerText) previewEmbed.setFooter({ text: embSession.footerText });

                const configEmbed = new EmbedBuilder().setTitle('🎨 Post Embed Builder').setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Design your custom announcement with banners, thumbnails, and custom text, then publish it live.`).setColor('#f39c12');

                const templateRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_emb_template').setPlaceholder('⚡ Load Pre-Made Rust Template...').addOptions([{ label: '🪓 Wipe Announcement', value: 'wipe', description: 'Fresh map & connection details' }, { label: '📜 Server Rules', value: 'rules', description: 'Community guidelines & limits' }, { label: '🛒 Store & VIP', value: 'store', description: 'Donations and VIP packages' }, { label: '🗳️ Vote & Rewards', value: 'vote', description: 'Voting links and scrap rewards' }]));
                const row1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_emb_title').setLabel('Title').setStyle(ButtonStyle.Primary).setEmoji('✏️'), new ButtonBuilder().setCustomId('btn_emb_desc').setLabel('Description').setStyle(ButtonStyle.Primary).setEmoji('📝'), new ButtonBuilder().setCustomId('btn_emb_color').setLabel('Color').setStyle(ButtonStyle.Secondary).setEmoji('🎨'), new ButtonBuilder().setCustomId('btn_emb_thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'), new ButtonBuilder().setCustomId('btn_emb_image').setLabel('Banner Image').setStyle(ButtonStyle.Secondary).setEmoji('🌟'));
                const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_emb_footer').setLabel('Footer Text').setStyle(ButtonStyle.Secondary).setEmoji('📌'), new ButtonBuilder().setCustomId('btn_emb_publish').setLabel('Select Channel & Post').setStyle(ButtonStyle.Success).setEmoji('🚀'));

                const payload = { embeds: [configEmbed, previewEmbed], components: [templateRow, row1, row2], flags: 64 };
                if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
                return await inter.update(payload).catch(() => inter.followUp(payload));
            };

            if (customId === 'unified_embed_select') return await renderBuilder(interaction);

            if (interaction.isStringSelectMenu() && customId === 'select_emb_template') {
                const template = RUST_TEMPLATES[selectedValue];
                if (template) {
                    embSession.title = template.title; embSession.description = template.description; embSession.color = template.color; embSession.thumbnailUrl = template.thumbnailUrl; embSession.imageUrl = template.imageUrl; embSession.footerText = template.footerText;
                    embedSessions.set(guildId, embSession);
                    return await renderBuilder(interaction, `⚡ Loaded template: **${template.templateName}**!`);
                }
            }

            if (interaction.isButton()) {
                if (customId === 'btn_emb_title') { const modal = new ModalBuilder().setCustomId('modal_emb_title').setTitle('Set Embed Title'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Title Text').setStyle(TextInputStyle.Short).setValue(embSession.title).setRequired(true))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_desc') { const modal = new ModalBuilder().setCustomId('modal_emb_desc').setTitle('Set Embed Description'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Description').setStyle(TextInputStyle.Paragraph).setValue(embSession.description).setRequired(true))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_color') { const modal = new ModalBuilder().setCustomId('modal_emb_color').setTitle('Set Embed Color'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Hex Code (e.g. #e74c3c)').setStyle(TextInputStyle.Short).setValue(embSession.color).setRequired(true))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_thumb') { const modal = new ModalBuilder().setCustomId('modal_emb_thumb').setTitle('Set Thumbnail URL'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Corner Thumbnail Image URL').setStyle(TextInputStyle.Short).setValue(embSession.thumbnailUrl || '').setRequired(false))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_image') { const modal = new ModalBuilder().setCustomId('modal_emb_image').setTitle('Set Banner Image URL'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Large Banner Image URL').setStyle(TextInputStyle.Short).setValue(embSession.imageUrl || '').setRequired(false))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_footer') { const modal = new ModalBuilder().setCustomId('modal_emb_footer').setTitle('Set Footer Text'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(embSession.footerText || '').setRequired(false))); return await interaction.showModal(modal); }
                if (customId === 'btn_emb_publish') return await interaction.reply({ content: '📢 Select the Discord channel where you want to post this embed:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_emb_target_channel').setPlaceholder('Select channel to post announcement...').setChannelTypes([0]))], flags: 64 });
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
                return await interaction.update({ content: `✅ Announcement successfully posted to <#${channelId}>!`, components: [] });
            }

            if (interaction.isModalSubmit()) {
                const val = interaction.fields.getTextInputValue('val');
                if (customId === 'modal_emb_title') embSession.title = val;
                if (customId === 'modal_emb_desc') embSession.description = val;
                if (customId === 'modal_emb_color') embSession.color = val;
                if (customId === 'modal_emb_thumb') embSession.thumbnailUrl = val;
                if (customId === 'modal_emb_image') embSession.imageUrl = val;
                if (customId === 'modal_emb_footer') embSession.footerText = val;

                embedSessions.set(guildId, embSession);
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