const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder } = require('discord.js');
const { GuildConfig } = require('../database/db');

const loggingHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- 1. ADMIN CONFIGURATION VIEW ---
        if (customId === 'admin_menu_select' && (selectedValue === 'setup_logging' || selectedValue.includes('log'))) {
            const config = await GuildConfig.findOne({ where: { guildId } }) || {};

            const channelLabel = (channelId) => channelId ? '<#' + channelId + '>' : '`Not Set`';
            const embed = new EmbedBuilder()
                .setTitle('📝 Server Logging & Audit System')
                .setDescription(
                    'Configure where different server logs and audit trails are sent.\n\n' +
                    '**🌐 In-Game / RCON Logs:**\n' +
                    '• **Admin Action Channel:** ' + channelLabel(config.logAdminChannelId) + '\n' +
                    '• **World Events & Joins:** ' + channelLabel(config.logGameChannelId) + '\n' +
                    '• **Killfeed Channel:** ' + channelLabel(config.killfeedChannelId) + '\n' +
                    '• **Cross-Chat Channel:** ' + channelLabel(config.crossChatChannelId) + '\n\n' +
                    '**💬 Discord Community Logs:**\n' +
                    '• **Member Joins/Leaves/Bans:** ' + channelLabel(config.logMemberChannelId) + '\n' +
                    '• **Message Edits/Deletes:** ' + channelLabel(config.logMessageChannelId) + '\n' +
                    '• **Voice Channel Activity:** ' + channelLabel(config.logVoiceChannelId)
                )
                .setColor('#9b59b6');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_log_set_admin').setLabel('Admin Logs').setStyle(ButtonStyle.Primary).setEmoji('🛠️'),
                new ButtonBuilder().setCustomId('btn_log_set_game').setLabel('World Events').setStyle(ButtonStyle.Primary).setEmoji('🌍'),
                new ButtonBuilder().setCustomId('btn_log_set_kill').setLabel('Killfeed').setStyle(ButtonStyle.Secondary).setEmoji('⚔️'),
                new ButtonBuilder().setCustomId('btn_log_set_chat').setLabel('Cross-Chat').setStyle(ButtonStyle.Secondary).setEmoji('💬')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_log_set_member').setLabel('Joins / Bans').setStyle(ButtonStyle.Success).setEmoji('👤'),
                new ButtonBuilder().setCustomId('btn_log_set_message').setLabel('Messages').setStyle(ButtonStyle.Success).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_log_set_voice').setLabel('Voice Chat').setStyle(ButtonStyle.Success).setEmoji('🔊')
            );

            const payload = { embeds: [embed], components: [row1, row2], flags: 64 };
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) return await interaction.reply(payload);
            return await interaction.update(payload).catch(() => interaction.followUp(payload));
        }

        // --- BUTTON TRIGGERS FOR CHANNEL SELECTION ---
        if (interaction.isButton()) {
            let logType = '';
            if (customId === 'btn_log_set_admin') logType = 'admin';
            if (customId === 'btn_log_set_game') logType = 'game';
            if (customId === 'btn_log_set_kill') logType = 'kill';
            if (customId === 'btn_log_set_chat') logType = 'chat';
            if (customId === 'btn_log_set_member') logType = 'member';
            if (customId === 'btn_log_set_message') logType = 'message';
            if (customId === 'btn_log_set_voice') logType = 'voice';

            if (logType) {
                const menuRow = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId(`select_log_chan_${logType}`)
                        .setPlaceholder(`Select channel for ${logType} logs...`)
                        .setChannelTypes([0]) // Text channels
                );
                await interaction.reply({
                    content: '📺 Select the Discord channel for **' + logType.toUpperCase() + '** logs:',
                    components: [menuRow],
                    flags: 64
                });
                return;
            }
        }

        // --- CHANNEL SELECT MENU SUBMISSIONS ---
        if (interaction.isChannelSelectMenu() && customId.startsWith('select_log_chan_')) {
            const logType = customId.replace('select_log_chan_', '');
            const channelId = interaction.values[0];

            let updateField = {};
            if (logType === 'admin') updateField = { logAdminChannelId: channelId };
            if (logType === 'game') updateField = { logGameChannelId: channelId };
            if (logType === 'kill') updateField = { killfeedChannelId: channelId };
            if (logType === 'chat') updateField = { crossChatChannelId: channelId };
            if (logType === 'member') updateField = { logMemberChannelId: channelId };
            if (logType === 'message') updateField = { logMessageChannelId: channelId };
            if (logType === 'voice') updateField = { logVoiceChannelId: channelId };

            await GuildConfig.upsert({ guildId, ...updateField });
            return await interaction.update({
                content: '✅ Successfully set **' + logType.toUpperCase() + '** log channel to <#' + channelId + '>!',
                components: []
            });
        }

    } catch (error) {
        console.error('[LOGGING HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred configuring logging.', flags: 64 }).catch(() => {});
        }
    }
};

module.exports = loggingHandler;