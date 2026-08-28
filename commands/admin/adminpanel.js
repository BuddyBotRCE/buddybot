const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminpanel')
        .setDescription('Opens the Admin Dashboard')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction) {
        const adminEmbed = new EmbedBuilder()
            .setTitle('🛠️ Admin Panel & Dashboard')
            .setDescription('Configure your server modules, automated systems, shops, and community tools using the categories below.\n\n• **Dropdown 1:** Basic Systems & Premium Upgrades\n• **Dropdown 2:** ⭐ Premium & Advanced Modules')
            .setColor('#2b2d31');

        // DROPDOWN 1: BASIC SYSTEMS & UPGRADE BUTTON
        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('admin_menu_select').setPlaceholder('⚙️ Basic Systems & Upgrades...')
                .addOptions([
                    // 👇 ADDED BUY PREMIUM OPTION TO BASIC PANEL 👇
                    { label: '⭐ Buy / Upgrade to Premium', value: 'setup_tier', description: 'Unlock all advanced modules and features', emoji: '⭐' },
                    { label: 'RCON & Servers', value: 'setup_multiserver', emoji: '🌐' },
                    { label: 'Live Admin Tools', value: 'admin_tools', emoji: '🧰' },
                    { label: 'Shop & Store Manager', value: 'setup_shop', emoji: '🛒' },
                    { label: 'Economy Manager', value: 'setup_economy', emoji: '💰' },
                    { label: 'Minigames Casino', value: 'setup_minigames', emoji: '🎰' },
                    { label: 'Ticket System', value: 'setup_tickets', emoji: '🎫' },
                    { label: 'Giveaways Manager', value: 'setup_giveaways', emoji: '🎉' },
                    { label: 'Cross-Chat', value: 'setup_crosschat', emoji: '💬' },
                    { label: 'Embeds & Reaction Roles', value: 'setup_embeds_roles', description: 'Announcements, Verifications, & Roles', emoji: '🎨' },
                    { label: 'Admin & Mod Roles', value: 'setup_server_roles', description: 'Set bot admin/mod roles', emoji: '👑' },
                    { label: 'Suggestions System', value: 'setup_suggestions', emoji: '💡' },
                    { label: 'Logging System', value: 'setup_logging', emoji: '📊' }
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
                    { label: 'Custom Zones Builder', value: 'setup_custom_zones', description: 'Create and manage map zones', emoji: '🗺️' },
                    { label: 'Custom Binds', value: 'setup_binds', emoji: '🗣️' },
                    { label: 'ORP Manager', value: 'setup_orp', emoji: '🛡️' },
                    { label: 'AI Integration Setup', value: 'setup_ai', emoji: '🤖' },
                    { label: 'Server Wipe Panel', value: 'setup_wipe', emoji: '☢️' },
                    { label: 'Premium Status & License', value: 'setup_tier', emoji: '⭐' }
                ])
        );

        await interaction.reply({ embeds: [adminEmbed], components: [row1, row2], flags: 64 });
    }
};