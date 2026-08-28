const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminpanel')
        .setDescription('Opens the Admin Dashboard')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction) {
        const adminEmbed = new EmbedBuilder()
            .setTitle('🛠️ Admin Panel & Dashboard')
            .setDescription('Configure your server modules, automated systems, shops, and community tools using the categories below.')
            .setColor('#2b2d31');

        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('admin_menu_select').setPlaceholder('⚙️ Core Server & Economy Systems...')
                .addOptions([
                    { label: 'RCON & Servers', value: 'setup_multiserver', emoji: '🌐' },
                    { label: 'Live Admin Tools', value: 'admin_tools', emoji: '🧰' },
                    { label: 'Shop & Store Manager', value: 'setup_shop', emoji: '🛒' },
                    { label: 'Economy Manager', value: 'setup_economy', emoji: '💰' },
                    { label: 'Minigames Casino', value: 'setup_minigames', emoji: '🎰' },
                    { label: 'BuddyPass Manager', value: 'setup_buddypass', emoji: '⭐' },
                    { label: 'Clan System Manager', value: 'setup_clans', emoji: '🛡️' },
                    { label: 'Bounties System', value: 'setup_bounties', emoji: '🎯' },
                    { label: 'Custom Zones Builder', value: 'setup_custom_zones', description: 'Create and manage map zones', emoji: '🗺️' },
                    { label: 'Custom Binds', value: 'setup_binds', emoji: '🗣️' },
                    { label: 'Server Wipe Panel', value: 'setup_wipe', emoji: '☢️' }
                ])
        );

        const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('admin_menu_select_2').setPlaceholder('🛡️ Community, Moderation & Utility...')
                .addOptions([
                    { label: 'Auto-Moderation Suite', value: 'setup_automod', emoji: '🛡️' },
                    { label: 'Auto-Events (Premium)', value: 'setup_autoevents', emoji: '🚁' },
                    { label: 'Ticket System', value: 'setup_tickets', emoji: '🎫' },
                    { label: 'Giveaways Manager', value: 'setup_giveaways', emoji: '🎉' },
                    { label: 'Cross-Chat', value: 'setup_crosschat', emoji: '💬' },
                    { label: 'ORP Manager', value: 'setup_orp', emoji: '🛡️' },
                    { label: 'Embeds & Reaction Roles', value: 'setup_embeds_roles', description: 'Announcements, Verifications, & Roles', emoji: '🎨' },
                    // 👇 NEW ADMIN & MOD ROLE CONFIG OPTION 👇
                    { label: 'Admin & Mod Roles', value: 'setup_server_roles', description: 'Set bot administrator & moderator roles', emoji: '👑' },
                    { label: 'AI Integration Setup', value: 'setup_ai', emoji: '🤖' },
                    { label: 'Logging System', value: 'setup_logging', emoji: '📊' },
                    { label: 'Suggestions System', value: 'setup_suggestions', emoji: '💡' },
                    { label: 'Premium Status', value: 'setup_tier', emoji: '🏷️' }
                ])
        );

        await interaction.reply({ embeds: [adminEmbed], components: [row1, row2], flags: 64 });
    }
};