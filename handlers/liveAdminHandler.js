const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder } = require('discord.js');
const { GameServer, GuildConfig } = require('../database/db');
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
        .setTitle('⚡ Rust Console Edition — Live RCON Suite')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Admin command center connected to your item catalog & in-game Kit Manager for **Rust Console Edition**.\n\n` +
            `• **Active Target Server:** \`${targetServerName}\`\n` +
            `• **WebRCON Status:** ${activeConnections.has(guildId) ? '🟢 Connected' : '🟡 Ready / On-Demand'}`
        )
        .setColor('#e67e22')
        .setTimestamp();

    const components = [];

    if (servers.length > 0) {
        const serverOptions = [{ label: '🌐 All Servers (Global Command)', value: 'live_server_all', emoji: '🌐' }];
        servers.forEach(s => {
            serverOptions.push({ label: `🖥️ Server: ${s.serverName}`, value: `live_server_${s.id}`, emoji: '🖥️' });
        });
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('live_server_select').setPlaceholder('Select target server...').addOptions(serverOptions)
        ));
    }

    // Row 1: Catalog & Kit Actions
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('live_btn_giveitem').setLabel('Give Catalog Item').setStyle(ButtonStyle.Success).setEmoji('🎁'),
        new ButtonBuilder().setCustomId('live_btn_givekit').setLabel('Give Kit (Manager)').setStyle(ButtonStyle.Success).setEmoji('📦'),
        new ButtonBuilder().setCustomId('live_btn_addvip').setLabel('Add VIP').setStyle(ButtonStyle.Success).setEmoji('⭐'),
        new ButtonBuilder().setCustomId('live_btn_addmod').setLabel('Add Moderator').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
    ));

    // Row 2: Player Management
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('live_btn_players').setLabel('Online Players').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
        new ButtonBuilder().setCustomId('live_btn_say').setLabel('Global Broadcast').setStyle(ButtonStyle.Primary).setEmoji('📢'),
        new ButtonBuilder().setCustomId('live_btn_kick').setLabel('Kick Player').setStyle(ButtonStyle.Danger).setEmoji('👢'),
        new ButtonBuilder().setCustomId('live_btn_ban').setLabel('Ban Player').setStyle(ButtonStyle.Danger).setEmoji('🔨')
    ));

    // Row 3: Server Controls
    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('live_btn_save').setLabel('Save World').setStyle(ButtonStyle.Success).setEmoji('💾'),
        new ButtonBuilder().setCustomId('live_btn_weather').setLabel('Weather / Time').setStyle(ButtonStyle.Secondary).setEmoji('⛅'),
        new ButtonBuilder().setCustomId('live_btn_custom').setLabel('Custom RCON').setStyle(ButtonStyle.Secondary).setEmoji('⌨️')
    ));

    // Row 4: Back
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
                return await renderLiveToolsPanel(interaction, `💾 **World saved successfully!**`);
            }

            if (customId === 'live_btn_giveitem') {
                const modal = new ModalBuilder().setCustomId('modal_live_giveitem').setTitle('Catalog: Give Item');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Exact Gamertag').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item').setLabel('Catalog Shortname / Item ID').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('Quantity').setStyle(TextInputStyle.Short).setValue('1').setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'live_btn_givekit') {
                const modal = new ModalBuilder().setCustomId('modal_live_givekit').setTitle('Kit Manager: Give Kit');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Exact Gamertag').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kitname').setLabel('Kit Name (from Kit Manager)').setStyle(TextInputStyle.Short).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'live_btn_addvip') {
                const modal = new ModalBuilder().setCustomId('modal_live_addvip').setTitle('Console: Add VIP Group');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Exact Gamertag').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('days').setLabel('Duration (Days)').setStyle(TextInputStyle.Short).setValue('30').setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'live_btn_addmod') {
                const embed = new EmbedBuilder()
                    .setTitle('🛡️ Assign Bot Moderator Role')
                    .setDescription('Select the Discord role you wish to assign as a Bot Moderator using the menu below.')
                    .setColor('#3498db');
                const row = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder().setCustomId('select_live_mod_role').setPlaceholder('Select Moderator Role...').setMinValues(1).setMaxValues(1)
                );
                return await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
            }

            if (customId === 'live_btn_say') {
                const modal = new ModalBuilder().setCustomId('modal_live_say').setTitle('Global Broadcast');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message').setLabel('Message to Broadcast').setStyle(TextInputStyle.Short).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'live_btn_kick') {
                const modal = new ModalBuilder().setCustomId('modal_live_kick').setTitle('Kick Player');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Exact Gamertag').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Short).setValue('Kicked by Admin').setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'live_btn_ban') {
                const modal = new ModalBuilder().setCustomId('modal_live_ban').setTitle('Ban Player');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Exact Gamertag').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Short).setValue('Banned by Admin').setRequired(false))
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
                const modal = new ModalBuilder().setCustomId('modal_live_custom').setTitle('Custom RCON Command');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('command').setLabel('Console RCON Command').setStyle(TextInputStyle.Short).setRequired(true)));
                return await interaction.showModal(modal);
            }
        }

        if (interaction.isRoleSelectMenu() && customId === 'select_live_mod_role') {
            const roleId = interaction.values[0];
            await GuildConfig.upsert({ guildId, modRoleId: roleId });
            return await interaction.update({ content: `✅ Bot **Moderator Role** successfully set to <@&${roleId}>!`, components: [] });
        }

        if (interaction.isModalSubmit()) {
            if (customId === 'modal_live_giveitem') {
                const player = interaction.fields.getTextInputValue('player');
                const item = interaction.fields.getTextInputValue('item');
                const amount = interaction.fields.getTextInputValue('amount') || '1';
                // Pulling from catalog / item database via standard console inventory give command
                await sendRconCommand(guildId, `inventory.giveto "${player}" "${item}" ${amount}`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `🎁 Catalog Item Sent: **${amount}x ${item}** to **${player}**!`);
            }

            if (customId === 'modal_live_givekit') {
                const player = interaction.fields.getTextInputValue('player');
                const kitName = interaction.fields.getTextInputValue('kitname');
                // Pulling directly from in-game kit manager syntax
                await sendRconCommand(guildId, `kit.give "${player}" "${kitName}"`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `📦 Kit Manager Issued: **${kitName}** to **${player}**!`);
            }

            if (customId === 'modal_live_addvip') {
                const player = interaction.fields.getTextInputValue('player');
                const days = interaction.fields.getTextInputValue('days') || '30';
                await sendRconCommand(guildId, `user.group add "${player}" vip`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `⭐ Added **${player}** to VIP group (${days} days)!`);
            }

            if (customId === 'modal_live_say') {
                const val = interaction.fields.getTextInputValue('message');
                await sendRconCommand(guildId, `say "${val}"`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `📢 Broadcasted: \`${val}\``);
            }

            if (customId === 'modal_live_kick') {
                const player = interaction.fields.getTextInputValue('player');
                const reason = interaction.fields.getTextInputValue('reason') || 'Kicked';
                await sendRconCommand(guildId, `kick "${player}" "${reason}"`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `👢 Kicked **${player}**.`);
            }

            if (customId === 'modal_live_ban') {
                const player = interaction.fields.getTextInputValue('player');
                const reason = interaction.fields.getTextInputValue('reason') || 'Banned';
                await sendRconCommand(guildId, `ban "${player}" "${reason}"`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `🔨 Banned **${player}**.`);
            }

            if (customId === 'modal_live_weather') {
                const time = interaction.fields.getTextInputValue('time');
                const rain = interaction.fields.getTextInputValue('rain');
                if (time) await sendRconCommand(guildId, `env.time ${time}`, client, session.serverId);
                if (rain) await sendRconCommand(guildId, `weather.rain ${rain}`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `⛅ **Weather & Time Updated!**`);
            }

            if (customId === 'modal_live_custom') {
                const val = interaction.fields.getTextInputValue('command');
                const output = await sendRconCommand(guildId, val, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `⌨️ **Executed:** \`${val}\`\n\`\`\`${output || 'Executed'}\`\`\``);
            }
        }

        return await renderLiveToolsPanel(interaction);
    } catch (err) {
        console.error('[LIVE ADMIN HANDLER ERROR]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: '❌ An error occurred.', flags: 64 }).catch(() => {});
        }
    }
};

module.exports = liveAdminHandler;