const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { GuildConfig, ReactionRole } = require('../database/db');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- ADMIN MENU SELECT ENTRY ---
        if (customId === 'admin_menu_select' && selectedValue === 'setup_reactionroles') {
            const activeRoles = await ReactionRole.count({ where: { guildId: interaction.guild.id } });
            
            const embed = new EmbedBuilder()
                .setTitle('🎭 Reaction Roles Setup')
                .setDescription(`Create interactive button-based role panels. Use the native dropdown menus below to configure your panel channels and roles.\n\n• **Active Reaction Roles:** ${activeRoles}`)
                .setColor('#3498db');

            const channelRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_rr_channel')
                    .setPlaceholder('📂 Select Target Channel for RR Panel...')
                    .addChannelTypes(ChannelType.GuildText)
            );

            const roleRow = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('select_rr_role')
                    .setPlaceholder('🏷️ Select Role to Add to Panel...')
            );

            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_rr_deploy').setLabel('Deploy Panel').setStyle(ButtonStyle.Success).setEmoji('📦'),
                new ButtonBuilder().setCustomId('btn_rr_list').setLabel('View Active Roles').setStyle(ButtonStyle.Secondary).setEmoji('📋')
            );

            return interaction.reply({ 
                embeds: [embed], 
                components: [channelRow, roleRow, actionRow], 
                flags: 64 
            });
        }

        // --- HANDLE CHANNEL SELECTION (Temporarily store in memory or config) ---
        if (interaction.isChannelSelectMenu() && customId === 'select_rr_channel') {
            const channelId = interaction.values[0];
            await GuildConfig.upsert({ guildId: interaction.guild.id, rrTempChannelId: channelId });
            return interaction.reply({ content: `✅ Reaction Role target channel temporarily set to <#${channelId}>! Now select a role below.`, flags: 64 });
        }

        // --- HANDLE ROLE SELECTION (Saves to database immediately) ---
        if (interaction.isRoleSelectMenu() && customId === 'select_rr_role') {
            const roleId = interaction.values[0];
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const targetChannelId = config?.rrTempChannelId || interaction.channelId;

            // Save role config to database
            await ReactionRole.create({
                guildId: interaction.guild.id,
                channelId: targetChannelId,
                roleId: roleId,
                buttonLabel: interaction.guild.roles.cache.get(roleId)?.name || 'Get Role',
                buttonStyle: 'Primary'
            });

            return interaction.reply({ content: `✅ Successfully added role <@&${roleId}> to the reaction role queue! Click **Deploy Panel** when you're ready.`, flags: 64 });
        }

        // --- DEPLOY REACTION ROLE PANEL ---
        if (interaction.isButton() && customId === 'btn_rr_deploy') {
            const roles = await ReactionRole.findAll({ where: { guildId: interaction.guild.id } });
            if (roles.length === 0) {
                return interaction.reply({ content: '❌ Please select at least one role using the role dropdown menu first!', flags: 64 });
            }

            const targetChannelId = roles[0].channelId;
            const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
            if (!targetChannel) {
                return interaction.reply({ content: '❌ Target channel not found. Please re-select the channel.', flags: 64 });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎭 Server Roles')
                .setDescription('Click the buttons below to toggle your roles instantly!')
                .setColor('#f1c40f');

            // Build buttons dynamically from database entries
            const buttons = roles.map((rr, index) => 
                new ButtonBuilder()
                    .setCustomId(`rr_toggle_${rr.id}`)
                    .setLabel(rr.buttonLabel)
                    .setStyle(ButtonStyle.Primary)
            );

            // Group buttons into rows of up to 5
            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }

            await targetChannel.send({ embeds: [embed], components: rows });
            return interaction.reply({ content: `✅ Reaction Role panel successfully deployed to <#${targetChannelId}>!`, flags: 64 });
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