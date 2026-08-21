const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminpanel')
        .setDescription('Opens the Admin Dashboard')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction) {
        const adminEmbed = new EmbedBuilder()
            .setTitle('🛠️ Admin Panel & Dashboard')
            .setDescription('Configure bot modules, automated moderation, reaction roles, and community tools.')
            .setColor('#2b2d31');
        
        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('admin_menu_select').setPlaceholder('Select a module to configure...')
                .addOptions([
                    { label: 'RCON Server', value: 'setup_rcon', emoji: '🌐' },
                    { label: 'Multi-Server RCON Manager', value: 'setup_multiserver', emoji: '🖥️' },
                    { label: 'Live Admin Tools', value: 'admin_tools', emoji: '🧰' },
                    { label: 'Shop & Store Manager', value: 'setup_shop', emoji: '🛒' },
                    { label: 'Economy Manager', value: 'setup_economy', emoji: '💰' },
                    { label: 'Minigames Casino', value: 'setup_minigames', emoji: '🎰' },
                    { label: 'BuddyPass Manager', value: 'setup_buddypass', emoji: '⭐' },
                    { label: 'Clan System Manager', value: 'setup_clans', emoji: '🛡️' },
                    { label: 'Bounties System', value: 'setup_bounties', emoji: '🎯' },
                    { label: 'Reaction Roles & Verify', value: 'setup_reaction_roles', emoji: '🔘' },
                    { label: 'Auto-Moderation Suite', value: 'setup_automod', emoji: '🛡️' },
                    { label: 'PVE Custom Zones', value: 'setup_pvezones', emoji: '🏕️' },
                    { label: 'Auto-Events (Premium)', value: 'setup_autoevents', emoji: '🚁' },
                    { label: 'License & Tier Manager', value: 'setup_tier', emoji: '🏷️' },
                    { label: 'Ticket System', value: 'setup_tickets', emoji: '🎫' },
                    { label: 'Giveaways Manager', value: 'setup_giveaways', emoji: '🎉' },
                    { label: 'Custom Binds', value: 'setup_binds', emoji: '🗣️' },
                    { label: 'Cross-Chat', value: 'setup_crosschat', emoji: '💬' },
                    { label: 'ORP Manager', value: 'setup_orp', emoji: '🛡️' },
                    { label: 'Server Wipe Panel', value: 'setup_wipe', emoji: '☢️' },
                    { label: 'Post Custom Embed', value: 'setup_embed', emoji: '📢' },
                    { label: 'AI Integration Setup', value: 'setup_ai', emoji: '🤖' },
                    { label: 'Logging System', value: 'setup_logging', emoji: '📊' },
                    { label: 'Suggestions System', value: 'setup_suggestions', emoji: '💡' }
                ])
        );

        await interaction.reply({ embeds: [adminEmbed], components: [row1], flags: 64 });
    }
};