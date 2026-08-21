const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminpanel')
        .setDescription('Opens the Admin Dashboard')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction) {
        const adminEmbed = new EmbedBuilder()
            .setTitle('🛠️ Admin Panel & Dashboard')
            .setDescription('Configure bot modules, shops, custom embeds, and server economies.')
            .setColor('#2b2d31');
        
        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('admin_menu_select').setPlaceholder('Select a module to configure...')
                .addOptions([
                    { label: 'RCON Server', value: 'setup_rcon', emoji: '🌐' },
                    { label: 'Live Admin Tools', value: 'admin_tools', emoji: '🧰' },
                    { label: 'Shop & Store Manager', value: 'setup_shop', emoji: '🛒' },
                    { label: 'Economy Manager', value: 'setup_economy', emoji: '💰' },
                    { label: 'Minigames Casino', value: 'setup_minigames', emoji: '🎰' },
                    { label: 'BuddyPass Manager', value: 'setup_buddypass', emoji: '⭐' },
                    { label: 'Bounties System', value: 'setup_bounties', emoji: '🎯' },
                    { label: 'PVE Custom Zones', value: 'setup_pvezones', emoji: '🏕️' },
                    { label: 'Auto-Events (Premium)', value: 'setup_autoevents', emoji: '🚁' },
                    { label: 'License & Tier Manager', value: 'setup_tier', emoji: '🏷️' },
                    { label: 'Ticket System', value: 'setup_tickets', emoji: '🎫' },
                    { label: 'Custom Binds', value: 'setup_binds', emoji: '🗣️' },
                    { label: 'Cross-Chat', value: 'setup_crosschat', emoji: '💬' },
                    { label: 'ORP Manager', value: 'setup_orp', emoji: '🛡️' },
                    { label: 'AI Integration Setup', value: 'setup_ai', emoji: '🤖' },
                    { label: 'Logging System', value: 'setup_logging', emoji: '📊' },
                    { label: 'Suggestions System', value: 'setup_suggestions', emoji: '💡' }
                ])
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_giveaway_panel').setLabel('Giveaways').setStyle(ButtonStyle.Secondary).setEmoji('🎉'),
            new ButtonBuilder().setCustomId('wipe_panel_open').setLabel('Wipe Panel').setStyle(ButtonStyle.Danger).setEmoji('☢️'),
            new ButtonBuilder().setCustomId('btn_admin_embed_helper').setLabel('Post Custom Embed').setStyle(ButtonStyle.Primary).setEmoji('📢')
        );

        await interaction.reply({ embeds: [adminEmbed], components: [row1, row2], flags: 64 });
    }
};