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
        .setTitle('⚡ Live Server Admin Tools & RCON Suite')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Complete real-time server command center. Execute live RCON instructions, manage online players, trigger weather/time states, and monitor server health instantly.\n\n` +
            `• **Active Target Server:** \`${targetServerName}\`\n` +
            `• **WebRCON Status:** ${activeConnections.has(guildId) ? '🟢 Connected' : '🟡 Ready / On-Demand'}`
        )
        .setColor('#e67e22')
        .setTimestamp();

    const components = [];

    // Server Selector Dropdown
    if (servers.length > 0) {
        const serverOptions = [{ label: '🌐 All Servers (Global Command)', value: 'live_server_all', emoji: '🌐' }];
        servers.forEach(s => {
            serverOptions.push({ label: `🖥️ Server: ${s.serverName}`, value: `live_server_${s.id}`, emoji: '🖥️' });
        });
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('live_server_select').setPlaceholder('Select target server for live tools...').addOptions(serverOptions)
        ));
    }

    // Row 1: Player & Broadcast Actions
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('live_btn_players').setLabel('Online Players').setStyle(ButtonStyle.Primary).setEmoji('👥'),
        new ButtonBuilder().setCustomId('live_btn_say').setLabel('Global Broadcast').setStyle(ButtonStyle.Primary).setEmoji('📢'),
        new ButtonBuilder().setCustomId('live_btn_kick').setLabel('Kick Player').setStyle(ButtonStyle.Danger).setEmoji('👢'),
        new ButtonBuilder().setCustomId('live_btn_ban').setLabel('Ban Player').setStyle(ButtonStyle.Danger).setEmoji('🔨')
    ));

    // Row 2: World & Server Controls
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('live_btn_save').setLabel('Save World').setStyle(ButtonStyle.Success).setEmoji('💾'),
        new ButtonBuilder().setCustomId('live_btn_weather').setLabel('Weather / Time').setStyle(ButtonStyle.Secondary).setEmoji('⛅'),
        new ButtonBuilder().setCustomId('live_btn_custom').setLabel('Custom RCON').setStyle(ButtonStyle.Secondary).setEmoji('⌨️')
    ));

    // Row 3: Navigation Back
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    ));

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
            if (customId === 'live_btn_players') {
                const res = await sendRconCommand(guildId, 'playerlist', client, session.serverId);
                return await renderLiveToolsPanel(interaction, `👥 **Online Players List:**\n\`\`\`${res || 'No players online or response empty'}\`\`\``);
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

            if (customId === 'live_btn_weather') {
                const modal = new ModalBuilder().setCustomId('modal_live_weather').setTitle('Weather & Time Control');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('time').setLabel('Set Time (0-24)').setStyle(TextInputStyle.Short).setValue('12').setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rain').setLabel('Rain Intensity (0 to 1)').setStyle(TextInputStyle.Short).setValue('0').setRequired(false))
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
            if (customId === 'modal_live_say') {
                const val = interaction.fields.getTextInputValue('message');
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

            if (customId === 'modal_live_weather') {
                const time = interaction.fields.getTextInputValue('time');
                const rain = interaction.fields.getTextInputValue('rain');
                if (time) await sendRconCommand(guildId, `env.time ${time}`, client, session.serverId);
                if (rain) await sendRconCommand(guildId, `weather.rain ${rain}`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `⛅ **Weather & Time Updated!** (Time: \`${time}\`, Rain: \`${rain}\`)`);
            }

            if (customId === 'modal_live_custom') {
                const val = interaction.fields.getTextInputValue('command');
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