const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { GuildConfig } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminpanel')
        .setDescription('Opens the Admin Dashboard'),
        
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const member = interaction.member;

        const config = await GuildConfig.findOne({ where: { guildId } });
        const isOwner = interaction.guild.ownerId === member.id;
        const isNativeAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
        
        const hasCustomAdminRole = config?.adminRoleId && member.roles.cache.has(config.adminRoleId);
        const hasCustomModRole = config?.modRoleId && member.roles.cache.has(config.modRoleId);

        if (!isOwner && !isNativeAdmin && !hasCustomAdminRole && !hasCustomModRole) {
            return await interaction.reply({ 
                content: '❌ **Access Denied:** You do not have the required Administrator or Moderator role to open the admin panel.', 
                flags: 64 
            });
        }

        const adminEmbed = new EmbedBuilder()
            .setTitle('🛠️ Admin Panel & Dashboard')
            .setDescription('Configure your server modules, automated systems, shops, and community tools using the categories below.\n\n• **Dropdown 1:** Basic Systems & Upgrades\n• **Dropdown 2:** ⭐ Premium & Advanced Modules')
            .setColor('#2b2d31');

        // DROPDOWN 1: BASIC SYSTEMS
        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('admin_menu_select').setPlaceholder('⚙️ Basic Systems & Upgrades...')
                .addOptions([
                    { label: '⭐ Buy / Upgrade to Premium', value: 'setup_tier', description: 'Unlock all advanced modules and features', emoji: '⭐' },
                    { label: 'RCON & Servers', value: 'setup_multiserver', emoji: '🌐' },
                    { label: 'Live Admin Tools', value: 'admin_tools', emoji: '🧰' },
                    { label: 'Shop & Store Manager', value: 'setup_shop', emoji: '🛒' },
                    { label: 'Economy Manager', value: 'setup_economy', emoji: '💰' },
                    { label: 'Minigames Casino', value: 'setup_minigames', emoji: '🎰' },
                    { label: 'Ticket System', value: 'setup_tickets', emoji: '🎫' },
                    { label: 'Cross-Chat', value: 'setup_crosschat', emoji: '💬' },
                    { label: 'Admin & Mod Roles', value: 'setup_server_roles', description: 'Set bot admin/mod roles', emoji: '👑' },
                    { label: 'Logging System', value: 'setup_logging', emoji: '📊' },
                    { label: 'Custom Zones Builder', value: 'setup_custom_zones', description: 'Create and manage map zones', emoji: '🗺️' },
                    { label: 'Server Wipe Panel', value: 'setup_wipe', emoji: '☢️' }
                ])
        );

        // DROPDOWN 2: PREMIUM & ADVANCED SECTION
        const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('admin_menu_select_2').setPlaceholder('⭐ Premium & Advanced Features...')
                .addOptions([
                    { label: 'Auto-Events (Premium)', value: 'setup_autoevents', emoji: '🚁' },
                    { label: 'Auto-Moderation Suite', value: 'setup_automod', emoji: '🛡️' },
                    { label: 'BuddyPass Manager', value: 'setup_buddypass', emoji: '⭐' },
                    { label: 'Clan System Manager', value: 'setup_clans', emoji: '🛡️' },
                    { label: 'Bounties System', value: 'setup_bounties', emoji: '🎯' },
                    { label: 'Custom Binds', value: 'setup_binds', emoji: '🗣️' },
                    { label: 'ORP Manager', value: 'setup_orp', emoji: '🛡️' },
                    { label: 'AI Integration Setup', value: 'setup_ai', emoji: '🤖' },
                    { label: 'Premium Status & License', value: 'setup_tier', emoji: '⭐' },
                    { label: 'Embeds & Reaction Roles', value: 'setup_embeds_roles', description: 'Announcements, Verifications, & Roles', emoji: '🎨' },
                    { label: 'Giveaways Manager', value: 'setup_giveaways', emoji: '🎉' },
                    { label: 'Suggestions System', value: 'setup_suggestions', emoji: '💡' },
                    { label: 'Home Teleport System', value: 'setup_hometp', description: 'Configure emote retreat teleports', emoji: '🏠' },
                ])
        );
S
        await interaction.reply({ embeds: [adminEmbed], components: [row1, row2], flags: 64 });
    }
};