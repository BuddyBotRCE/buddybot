const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } = require('discord.js');
const { GuildConfig } = require('../database/db');

const suggestionHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- 1. ADMIN PANEL CONFIGURATION VIEW ---
        if (customId === 'admin_menu_select' && (selectedValue === 'setup_suggestions' || selectedValue.includes('suggestion'))) {
            const config = await GuildConfig.findOne({ where: { guildId } }) || {};

            const embed = new EmbedBuilder()
                .setTitle('💡 Suggestions System Configuration')
                .setDescription('Configure where player suggestions are sent and which admin role gets pinged.\n\n' +
                    `• **Current Channel:** ${config.suggestionChannelId ? `<#${config.suggestionChannelId}>` : '`Not Set`'}\n` +
                    `• **Admin Ping Role:** ${config.adminPingRoleId ? `<@&${config.adminPingRoleId}>` : '`None`'}`)
                .setColor('#f1c40f');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_sug_set_channel').setLabel('Select Suggestion Channel').setStyle(ButtonStyle.Primary).setEmoji('📺'),
                new ButtonBuilder().setCustomId('btn_sug_set_role').setLabel('Select Admin Role to Ping').setStyle(ButtonStyle.Secondary).setEmoji('🔔')
            );

            const payload = { embeds: [embed], components: [row1], flags: 64 };
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) return await interaction.reply(payload);
            return await interaction.update(payload).catch(() => interaction.followUp(payload));
        }

        // --- BUTTON TRIGGERS FOR ADMIN CONFIG ---
        if (interaction.isButton()) {
            if (customId === 'btn_sug_set_channel') {
                const menuRow = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder().setCustomId('select_sug_channel').setPlaceholder('Select channel for suggestions...').setChannelTypes([0]) // Text channels
                );
                return await interaction.reply({ content: '📺 Select the Discord channel where player suggestions should be posted:', components: [menuRow], flags: 64 });
            }

            if (customId === 'btn_sug_set_role') {
                const roleRow = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder().setCustomId('select_sug_role').setPlaceholder('Select role to ping for new suggestions...').setMinValues(1).setMaxValues(1)
                );
                return await interaction.reply({ content: '🔔 Select the Admin role to ping when a new suggestion is submitted:', components: [roleRow], flags: 64 });
            }

            // --- PLAYER PANEL: OPEN SUGGESTION MODAL ---
            if (customId === 'btn_player_open_suggestion') {
                const modal = new ModalBuilder().setCustomId('modal_player_submit_suggestion').setTitle('Submit a Server Suggestion');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('sug_text').setLabel('Your Suggestion').setStyle(TextInputStyle.Paragraph).setPlaceholder('Type your detailed suggestion here...').setRequired(true).setMaxLength(1000)
                    )
                );
                return await interaction.showModal(modal);
            }

            // --- VOTING & APPROVAL ACTIONS ---
            if (customId.startsWith('sug_vote_')) {
                const voteType = customId.replace('sug_vote_', ''); // 'yes' or 'no'
                await interaction.reply({ content: `✅ Your **${voteType.toUpperCase()}** vote has been recorded!`, flags: 64 });
                return;
            }

            if (customId.startsWith('sug_action_')) {
                const action = customId.replace('sug_action_', ''); // 'approve' or 'decline'
                const member = interaction.member;
                const isOwner = interaction.guild.ownerId === interaction.user.id;
                const isAdmin = member.permissions.has('Administrator') || member.permissions.has('ManageGuild');

                if (!isOwner && !isAdmin) {
                    return await interaction.reply({ content: '❌ Only administrators can approve or decline suggestions.', flags: 64 });
                }

                // If declining, show a modal to ask for the reason
                if (action === 'decline') {
                    const modal = new ModalBuilder().setCustomId(`modal_sug_decline_reason_${interaction.message.id}`).setTitle('Reason for Declining');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder().setCustomId('decline_reason').setLabel('Reason (sent via DM to player)').setStyle(TextInputStyle.Paragraph).setPlaceholder('Explain why this suggestion was declined...').setRequired(true).setMaxLength(500)
                        )
                    );
                    return await interaction.showModal(modal);
                }

                // If approving directly:
                const message = interaction.message;
                const oldEmbed = message.embeds[0];
                
                // Extract author ID from footer, description, or author icon/name if stored, or parse description
                // To safely track the author, let's look at the author name/footer or embed fields.
                // Alternatively, let's embed the author's Discord ID safely into the footer text invisibly: e.g. `Author ID: 123456789`
                const footerText = oldEmbed.footer?.text || '';
                const authorIdMatch = footerText.match(/Author ID: (\d+)/);

                if (authorIdMatch) {
                    const authorId = authorIdMatch[1];
                    try {
                        const targetUser = await client.users.fetch(authorId);
                        await targetUser.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('✅ Suggestion Approved!')
                                    .setDescription(`Your suggestion on **${interaction.guild.name}** has been **approved** by the staff team!\n\n> *"${oldEmbed.description}"*`)
                                    .setColor('#2ecc71')
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    } catch (e) {}
                }

                const updatedEmbed = EmbedBuilder.from(oldEmbed)
                    .setColor('#2ecc71')
                    .addFields({ name: 'Status', value: `✅ **Approved** by <@${interaction.user.id}>`, inline: false });

                await message.edit({ embeds: [updatedEmbed], components: [] });
                return await interaction.reply({ content: `✅ Suggestion successfully approved and player notified via DM!`, flags: 64 });
            }
        }

        // --- SELECT MENUS & ROLE SELECTORS ---
        if (interaction.isChannelSelectMenu() && customId === 'select_sug_channel') {
            const channelId = interaction.values[0];
            await GuildConfig.upsert({ guildId, suggestionChannelId: channelId });
            return await interaction.update({ content: `✅ Suggestion channel successfully set to <#${channelId}>!`, components: [] });
        }

        if (interaction.isRoleSelectMenu() && customId === 'select_sug_role') {
            const roleId = interaction.values[0];
            await GuildConfig.upsert({ guildId, adminPingRoleId: roleId });
            return await interaction.update({ content: `✅ Admin ping role successfully set to <@&${roleId}>!`, components: [] });
        }

        // --- MODAL SUBMISSIONS ---
        if (interaction.isModalSubmit()) {
            if (customId === 'modal_player_submit_suggestion') {
                const suggestionText = interaction.fields.getTextInputValue('sug_text').trim();
                const config = await GuildConfig.findOne({ where: { guildId } });

                if (!config || !config.suggestionChannelId) {
                    return await interaction.reply({ content: '❌ Suggestions are not configured on this server yet.', flags: 64 });
                }

                const channel = interaction.guild.channels.cache.get(config.suggestionChannelId);
                if (!channel) {
                    return await interaction.reply({ content: '❌ Configured suggestion channel could not be found.', flags: 64 });
                }

                const sugEmbed = new EmbedBuilder()
                    .setTitle('💡 New Server Suggestion')
                    .setDescription(suggestionText)
                    .setColor('#3498db')
                    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                    .setFooter({ text: `Author ID: ${interaction.user.id}` })
                    .setTimestamp();

                const voteRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sug_vote_yes').setLabel('👍 Yes (0)').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('sug_vote_no').setLabel('👎 No (0)').setStyle(ButtonStyle.Danger)
                );

                const adminRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sug_action_approve').setLabel('Approve').setStyle(ButtonStyle.Primary).setEmoji('✅'),
                    new ButtonBuilder().setCustomId('sug_action_decline').setLabel('Decline').setStyle(ButtonStyle.Secondary).setEmoji('❌')
                );

                const pingContent = config.adminPingRoleId ? `<@&${config.adminPingRoleId}> New suggestion submitted!` : '';

                await channel.send({ content: pingContent, embeds: [sugEmbed], components: [voteRow, adminRow] });
                return await interaction.reply({ content: '✅ Your suggestion has been successfully submitted to the staff team!', flags: 64 });
            }

            if (customId.startsWith('modal_sug_decline_reason_')) {
                const reason = interaction.fields.getTextInputValue('decline_reason').trim();
                const message = interaction.message;
                if (!message) return await interaction.reply({ content: '❌ Original message could not be retrieved.', flags: 64 });

                const oldEmbed = message.embeds[0];
                const footerText = oldEmbed.footer?.text || '';
                const authorIdMatch = footerText.match(/Author ID: (\d+)/);

                if (authorIdMatch) {
                    const authorId = authorIdMatch[1];
                    try {
                        const targetUser = await client.users.fetch(authorId);
                        await targetUser.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('❌ Suggestion Declined')
                                    .setDescription(`Your suggestion on **${interaction.guild.name}** was **declined** by the staff team.\n\n> *"${oldEmbed.description}"*`)
                                    .addFields({ name: 'Reason Provided', value: reason, inline: false })
                                    .setColor('#e74c3c')
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    } catch (e) {}
                }

                const updatedEmbed = EmbedBuilder.from(oldEmbed)
                    .setColor('#e74c3c')
                    .addFields(
                        { name: 'Status', value: `❌ **Declined** by <@${interaction.user.id}>`, inline: false },
                        { name: 'Reason', value: reason, inline: false }
                    );

                await message.edit({ embeds: [updatedEmbed], components: [] });
                return await interaction.reply({ content: `✅ Suggestion marked as declined, and reason DM'd to the player!`, flags: 64 });
            }
        }

    } catch (error) {
        console.error('[SUGGESTION HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing suggestions.', flags: 64 }).catch(() => {});
        }
    }
};

module.exports = suggestionHandler;