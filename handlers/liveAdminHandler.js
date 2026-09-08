const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GameServer } = require('../database/db');
const { sendRconCommand, activeConnections } = require('../utils/rconManager');

const liveSessions = new Map();

async function renderLiveToolsPanel(interaction, messageOverride = '') {
    const guildId = interaction.guild.id;
    if (!liveSessions.has(guildId)) {
        liveSessions.set(guildId, { serverId: null, mode: 'dashboard' });
    }
    const session = liveSessions.get(guildId);
    const servers = await GameServer.findAll({ where: { guildId } }).catch(() => []);

    let targetServerName = '🌐 All Servers (Global)';
    if (session.serverId) {
        const found = servers.find(s => s.id.toString() === session.serverId.toString());
        if (found) targetServerName = found.serverName;
    }

    const embed = new EmbedBuilder()
        .setTitle('⚡ Live Server Admin Tools')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Execute real-time RCON commands, manage players, broadcast messages, and control your Rust servers live from Discord.\n\n` +
            `• **Active Target Server:** \`${targetServerName}\`\n` +
            `• **WebRCON Status:** ${activeConnections.has(guildId) ? '🟢 Connected' : '🟡 Ready / On-Demand'}`
        )
        .setColor('#e67e22')
        .setTimestamp();

    const components = [];

    // Server Selector Dropdown if multiple servers exist
    if (servers.length > 0) {
        const serverOptions = [{ label: '🌐 All Servers (Global Command)', value: 'live_server_all', emoji: '🌐' }];
        servers.forEach(s => {
            serverOptions.push({ label: `🖥️ Server: ${s.serverName}`, value: `live_server_${s.id}`, emoji: '🖥️' });
        });
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('live_server_select').setPlaceholder('Select target server for live tools...').addOptions(serverOptions)
        ));
    }

    // Action Buttons Row 1
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('live_btn_say').setLabel('Global Chat Say').setStyle(ButtonStyle.Primary).setEmoji('📢'),
        new ButtonBuilder().setCustomId('live_btn_kick').setLabel('Kick Player').setStyle(ButtonStyle.Danger).setEmoji('👢'),
        new ButtonBuilder().setCustomId('live_btn_ban').setLabel('Ban Player').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
        new ButtonBuilder().setCustomId('live_btn_save').setLabel('Save World Data').setStyle(ButtonStyle.Success).setEmoji('💾')
    );

    // Action Buttons Row 2
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('live_btn_pop').setLabel('Server Population').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
        new ButtonBuilder().setCustomId('live_btn_custom').setLabel('Custom RCON Command').setStyle(ButtonStyle.Primary).setEmoji('⌨️'),
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    components.push(row1, row2);

    const payload = { embeds: [embed], components, flags: 64 };

    if (interaction.isMessageComponent() && !interaction.replied && !interaction.deferred) {
        return await interaction.update(payload).catch(async () => await interaction.editReply(payload));
    } else if (interaction.isMessageComponent()) {
        return await interaction.editReply(payload);
    } else {
        return await interaction.reply(payload);
    }
}

const liveAdminHandler = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';
    const guildId = interaction.guild.id;

    if (!liveSessions.has(guildId)) {
        liveSessions.set(guildId, { serverId: null, mode: 'dashboard' });
    }
    const session = liveSessions.get(guildId);

    try {
        if (selectedValue === 'admin_tools') {
            return await renderLiveToolsPanel(interaction);
        }

        if (interaction.isStringSelectMenu() && customId === 'live_server_select') {
            session.serverId = selectedValue === 'live_server_all' ? null : selectedValue.replace('live_server_', '');
            return await renderLiveToolsPanel(interaction, `🌐 **Target Server Switched Successfully!**`);
        }

        if (interaction.isButton()) {
            if (customId === 'live_btn_pop') {
                const res = await sendRconCommand(guildId, 'server.population', client, session.serverId);
                return await renderLiveToolsPanel(interaction, `📊 **Server Population Report:**\n\`\`\`${res || 'No response data'}\`\`\``);
            }

            if (customId === 'live_btn_save') {
                await sendRconCommand(guildId, 'server.save', client, session.serverId);
                return await renderLiveToolsPanel(interaction, `💾 **World saved successfully across target server(s)!**`);
            }

            if (customId === 'live_btn_say') {
                const modal = new ModalBuilder().setCustomId('modal_live_say').setTitle('Broadcast Chat Message');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message').setLabel('Message to Broadcast').setStyle(TextInputStyle.Short).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'live_btn_kick') {
                const modal = new ModalBuilder().setCustomId('modal_live_kick').setTitle('Kick Player');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Player Name or SteamID64').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Short).setValue('Kicked by Admin').setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'live_btn_ban') {
                const modal = new ModalBuilder().setCustomId('modal_live_ban').setTitle('Ban Player');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Player Name or SteamID64').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Ban Reason').setStyle(TextInputStyle.Short).setValue('Banned by Admin').setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'live_btn_custom') {
                const modal = new ModalBuilder().setCustomId('modal_live_custom').setTitle('Execute Custom RCON');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('command').setLabel('RCON Command (e.g. status)').setStyle(TextInputStyle.Short).setRequired(true)));
                return await interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit()) {
            const val = interaction.fields.getTextInputValue('message') || interaction.fields.getTextInputValue('command') || interaction.fields.getTextInputValue('player');

            if (customId === 'modal_live_say') {
                await sendRconCommand(guildId, `say "${val}"`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `📢 Broadcasted message to server: \`${val}\``);
            }

            if (customId === 'modal_live_kick') {
                const player = interaction.fields.getTextInputValue('player');
                const reason = interaction.fields.getTextInputValue('reason') || 'Kicked';
                await sendRconCommand(guildId, `kick "${player}" "${reason}"`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `👢 Kicked player **${player}**.`);
            }

            if (customId === 'modal_live_ban') {
                const player = interaction.fields.getTextInputValue('player');
                const reason = interaction.fields.getTextInputValue('reason') || 'Banned';
                await sendRconCommand(guildId, `ban "${player}" "${reason}"`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `🔨 Banned player **${player}**.`);
            }

            if (customId === 'modal_live_custom') {
                const output = await sendRconCommand(guildId, val, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `⌨️ **Executed:** \`${val}\`\n\`\`\`${output || 'Command executed (No response text)'}\`\`\``);
            }
        }

        return await renderLiveToolsPanel(interaction);
    } catch (err) {
        console.error('[LIVE ADMIN HANDLER ERROR]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: '❌ An error occurred executing the live tool action.', flags: 64 }).catch(() => {});
        }
    }
};

module.exports = liveAdminHandler;