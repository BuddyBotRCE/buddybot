const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder } = require('discord.js');
const { GameServer, GuildConfig } = require('../database/db');
const { sendRconCommand, activeConnections } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');

const liveSessions = new Map();

async function getOnlinePlayerOptions(guildId, serverId, client) {
    try {
        const res = await sendRconCommand(guildId, 'playerlist', client, serverId);
        if (!res) return [];

        let players = [];
        const textResponse = typeof res === 'string' ? res : JSON.stringify(res);

        try {
            const parsed = JSON.parse(textResponse);
            if (Array.isArray(parsed)) {
                players = parsed;
            } else if (parsed.Players) {
                players = parsed.Players;
            } else if (parsed.result) {
                players = typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result;
            }
        } catch (e) {
            // Extracts clean display names using regex from the raw console response
            const nameMatches = textResponse.match(/"(?:displayname|DisplayName|username|Username|name)"\s*:\s*"([^"]+)"/g);
            if (nameMatches) {
                players = nameMatches.map(m => ({ displayname: m.split('"')[3] }));
            }
        }

        // Pull unique player names directly
        const uniqueNames = [...new Set(players.map(p => p.displayname || p.DisplayName || p.username || p.Username || p.name).filter(Boolean))];

        if (uniqueNames.length === 0) {
            return [];
        }

        // Returns clean options where the label and value match the player's name exactly
        return uniqueNames.slice(0, 25).map(name => ({
            label: name,
            value: `player_sel_${name}`,
            emoji: '👤'
        }));
    } catch (err) {
        console.error('[PLAYERLIST PARSE ERROR]', err);
        return [];
    }
}

async function renderLiveToolsPanel(interaction, messageOverride = '') {
    const guildId = interaction.guild.id;
    if (!liveSessions.has(guildId)) {
        liveSessions.set(guildId, { serverId: null, mode: 'dashboard', selectedCategory: null, selectedItem: null, selectedPlayer: null, itemQuantity: 1 });
    }
    const session = liveSessions.get(guildId);
    const servers = await GameServer.findAll({ where: { guildId } }).catch(() => []);

    let targetServerName = '🌐 All Servers (Global)';
    if (session.serverId) {
        const found = servers.find(s => s.id.toString() === session.serverId.toString());
        if (found) targetServerName = found.serverName;
    }

    const embed = new EmbedBuilder()
        .setTitle('⚡ Rust Console Edition — Catalog & RCON Suite')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Admin command center linked to your item catalog & live player dropdowns.\n\n` +
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

    if (session.mode === 'give_item_category') {
        embed.addFields({ name: '🎁 Step 1: Select Item Category', value: 'Choose a catalog category to pick an item from:' });
        const catOptions = Object.keys(RUST_CATEGORIES).slice(0, 25).map(key => ({
            label: RUST_CATEGORIES[key].label.substring(0, 100),
            value: `cat_${key}`,
            emoji: RUST_CATEGORIES[key].emoji || '📦'
        }));
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('live_cat_select').setPlaceholder('Select item category...').addOptions(catOptions)
        ));
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('live_btn_back_dash').setLabel('Back to Dashboard').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    } else if (session.mode === 'give_item_product') {
        const cat = RUST_CATEGORIES[session.selectedCategory];
        embed.addFields({ name: `🎁 Step 2: Select Item from [${cat?.label}]`, value: 'Choose the specific item you want to give:' });
        const itemOptions = cat.items.slice(0, 25).map(item => ({
            label: item.name.substring(0, 100),
            description: `Shortname: ${item.shortname}`,
            value: `item_${item.shortname}`,
            emoji: '🔹'
        }));
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('live_item_select').setPlaceholder('Select item...').addOptions(itemOptions)
        ));
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('live_btn_back_cat').setLabel('Back to Categories').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    } else if (session.mode === 'give_item_player') {
        embed.addFields({ name: `🎁 Step 3: Select Recipient`, value: `Item: \`${session.selectedItem}\` (Qty: \`${session.itemQuantity}\`). Select online player or use manual button below:` });
        
        const playerOptions = await getOnlinePlayerOptions(guildId, session.serverId, interaction.client);
        
        if (playerOptions.length > 0) {
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('live_player_select').setPlaceholder('Select online player from server...').addOptions(playerOptions)
            ));
        } else {
            embed.addFields({ name: '⚠️ No Active Players Detected', value: '*Could not fetch live playerlist automatically. Click the button below to type the exact gamertag manually.*' });
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('live_btn_manual_player').setLabel('Type Gamertag Manually').setStyle(ButtonStyle.Primary).setEmoji('⌨️'),
            new ButtonBuilder().setCustomId('live_btn_back_prod').setLabel('Back to Items').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    } else {
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('live_btn_giveitem_menu').setLabel('Give Catalog Item').setStyle(ButtonStyle.Success).setEmoji('🎁'),
            new ButtonBuilder().setCustomId('live_btn_givekit').setLabel('Give Kit (Manager)').setStyle(ButtonStyle.Success).setEmoji('📦'),
            new ButtonBuilder().setCustomId('live_btn_addvip').setLabel('Add VIP').setStyle(ButtonStyle.Success).setEmoji('⭐'),
            new ButtonBuilder().setCustomId('live_btn_addmod').setLabel('Add Moderator').setStyle(ButtonStyle.Primary).setEmoji('🛡️')
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('live_btn_players').setLabel('Online Players').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
            new ButtonBuilder().setCustomId('live_btn_say').setLabel('Global Broadcast').setStyle(ButtonStyle.Primary).setEmoji('📢'),
            new ButtonBuilder().setCustomId('live_btn_kick').setLabel('Kick Player').setStyle(ButtonStyle.Danger).setEmoji('👢'),
            new ButtonBuilder().setCustomId('live_btn_ban').setLabel('Ban Player').setStyle(ButtonStyle.Danger).setEmoji('🔨')
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('live_btn_save').setLabel('Save World').setStyle(ButtonStyle.Success).setEmoji('💾'),
            new ButtonBuilder().setCustomId('live_btn_weather').setLabel('Weather / Time').setStyle(ButtonStyle.Secondary).setEmoji('⛅'),
            new ButtonBuilder().setCustomId('live_btn_custom').setLabel('Custom RCON').setStyle(ButtonStyle.Secondary).setEmoji('⌨️')
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }

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
        liveSessions.set(guildId, { serverId: null, mode: 'dashboard', selectedCategory: null, selectedItem: null, selectedPlayer: null, itemQuantity: 1 });
    }
    const session = liveSessions.get(guildId);

    try {
        if (selectedValue === 'admin_tools') {
            session.mode = 'dashboard';
            return await renderLiveToolsPanel(interaction);
        }

        if (interaction.isStringSelectMenu() && customId === 'live_server_select') {
            session.serverId = selectedValue === 'live_server_all' ? null : selectedValue.replace('live_server_', '');
            return await renderLiveToolsPanel(interaction, `🌐 **Target Server Switched Successfully!**`);
        }

        if (interaction.isStringSelectMenu()) {
            if (customId === 'live_cat_select') {
                session.selectedCategory = selectedValue.replace('cat_', '');
                session.mode = 'give_item_product';
                return await renderLiveToolsPanel(interaction);
            }
            if (customId === 'live_item_select') {
                session.selectedItem = selectedValue.replace('item_', '');
                const modal = new ModalBuilder().setCustomId('modal_live_item_qty').setTitle('Set Item Quantity');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('qty').setLabel('Quantity to Give').setStyle(TextInputStyle.Short).setValue('1').setRequired(true))
                );
                return await interaction.showModal(modal);
            }
            if (customId === 'live_player_select') {
                const targetPlayer = selectedValue.replace('player_sel_', '');
                session.mode = 'dashboard';
                await sendRconCommand(guildId, `inventory.giveto "${targetPlayer}" "${session.selectedItem}" ${session.itemQuantity || 1}`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `🎁 Successfully gave **${session.itemQuantity}x ${session.selectedItem}** to **${targetPlayer}**!`);
            }
        }

        if (interaction.isButton()) {
            if (customId === 'live_btn_back_dash' || customId === 'live_btn_cancel') {
                session.mode = 'dashboard';
                return await renderLiveToolsPanel(interaction);
            }
            if (customId === 'live_btn_back_cat') {
                session.mode = 'give_item_category';
                return await renderLiveToolsPanel(interaction);
            }
            if (customId === 'live_btn_back_prod') {
                session.mode = 'give_item_product';
                return await renderLiveToolsPanel(interaction);
            }
            if (customId === 'live_btn_giveitem_menu') {
                session.mode = 'give_item_category';
                return await renderLiveToolsPanel(interaction);
            }
            if (customId === 'live_btn_manual_player') {
                const modal = new ModalBuilder().setCustomId('modal_live_manual_player').setTitle('Enter Gamertag Manually');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Exact Gamertag').setStyle(TextInputStyle.Short).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'live_btn_players') {
                const res = await sendRconCommand(guildId, 'playerlist', client, session.serverId);
                return await renderLiveToolsPanel(interaction, `👥 **Online Players List:**\n\`\`\`${res || 'No players online or response empty'}\`\`\``);
            }

            if (customId === 'live_btn_save') {
                await sendRconCommand(guildId, 'server.save', client, session.serverId);
                return await renderLiveToolsPanel(interaction, `💾 **World saved successfully!**`);
            }

            if (customId === 'live_btn_givekit') {
                const modal = new ModalBuilder().setCustomId('modal_live_givekit').setTitle('Kit Manager: Give Kit');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('player').setLabel('Exact Gamertag').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kitname').setLabel('Kit Name').setStyle(TextInputStyle.Short).setRequired(true))
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
            if (customId === 'modal_live_item_qty') {
                session.itemQuantity = parseInt(interaction.fields.getTextInputValue('qty')) || 1;
                session.mode = 'give_item_player';
                return await renderLiveToolsPanel(interaction);
            }

            if (customId === 'modal_live_manual_player') {
                const targetPlayer = interaction.fields.getTextInputValue('player');
                session.mode = 'dashboard';
                await sendRconCommand(guildId, `inventory.giveto "${targetPlayer}" "${session.selectedItem}" ${session.itemQuantity || 1}`, client, session.serverId);
                return await renderLiveToolsPanel(interaction, `🎁 Successfully gave **${session.itemQuantity}x ${session.selectedItem}** to **${targetPlayer}**!`);
            }

            if (customId === 'modal_live_givekit') {
                const player = interaction.fields.getTextInputValue('player');
                const kitName = interaction.fields.getTextInputValue('kitname');
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