const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { GuildConfig, GameServer, UserEconomy } = require('../database/db');
const { connectRcon, sendRconCommand } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');
const postEmbedHandler = require('./postEmbedHandler');
const wipeHandler = require('./wipeHandler'); 
const WebSocket = require('ws');
const { activeConnections } = require('../utils/rconManager');

const giveKitSessions = new Map();

// Upgraded High-Yield RCE Native Kit List Scraper
async function fetchRceLiveKits(guildId) {
    return new Promise((resolve) => {
        const ws = activeConnections.get(guildId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return resolve(['Test1']);
        }

        let kitsFound = [];
        const listener = (data) => {
            try {
                const parsed = JSON.parse(data);
                if (!parsed || !parsed.Message) return;
                const msg = parsed.Message;
                
                // Deep tokenization to capture all custom kit strings across the entire output block
                const rawTokens = msg.split(/["'\r\n\s,\/\[\]{}]+/);
                for (let token of rawTokens) {
                    let cleanName = token.replace(/[*#\-]/g, '').trim();
                    const lower = cleanName.toLowerCase();
                    
                    const ignoreList = [
                        'list', 'available', 'kits', 'command', 'servervar', 'kit', 
                        'givetoplayer', 'true', 'false', 'null', 'adminwizard', 
                        'players', 'player', 'server', 'oxide', 'plugin', 'version',
                        'success', 'error', 'info', 'id', 'name', 'items', 'item',
                        'webrcon', 'connected', 'disconnected'
                    ];
                    
                    if (cleanName && 
                        cleanName.length >= 2 && 
                        cleanName.length < 35 && 
                        !ignoreList.includes(lower)) {
                        
                        if (!kitsFound.includes(cleanName)) {
                            kitsFound.push(cleanName);
                        }
                    }
                }
            } catch (e) {}
        };

        ws.on('message', listener);
        ws.send(JSON.stringify({ Identifier: 9999, Message: "kit list", Name: "AdminWizard" }));

        // Extended timeout to 3 seconds to ensure the server streams the entire database array, including the last created kit
        setTimeout(() => {
            ws.off('message', listener);
            if (kitsFound.length === 0) kitsFound = ['Test1'];
            resolve(kitsFound);
        }, 3000);
    });
}

async function renderGiveKitPanel(interaction, session, messageOverride = '') {
    const targetUser = session.targetUserId ? await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: session.targetUserId } }) : null;
    const ignDisplay = targetUser?.inGameName ? `**${targetUser.inGameName}** (<@${session.targetUserId}>)` : '`Not Selected`';
    const kitDisplay = session.kitName ? `**${session.kitName}**` : '`Not Selected`';

    const embed = new EmbedBuilder()
        .setTitle('📦 Live Admin: Give Kit Wizard')
        .setDescription(messageOverride ? `**${messageOverride}**\n\nConfigure your selections below and click Send.` : 'Configure your selections below and click Send.')
        .setColor('#3498db')
        .addFields(
            { name: '👤 Target Player', value: ignDisplay, inline: true },
            { name: '📦 Selected Kit', value: kitDisplay, inline: true }
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ak_panel_player').setLabel('Select Player').setStyle(ButtonStyle.Primary).setEmoji('👤'),
        new ButtonBuilder().setCustomId('ak_panel_kit').setLabel('Select Kit').setStyle(ButtonStyle.Secondary).setEmoji('📦')
    );

    const isReady = session.targetUserId && session.kitName;
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ak_panel_send').setLabel('🚀 Send Kit to Player').setStyle(ButtonStyle.Success).setDisabled(!isReady),
        new ButtonBuilder().setCustomId('ak_panel_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    const payload = { embeds: [embed], components: [row1, row2], flags: 64 };
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        return await interaction.reply(payload);
    } else {
        return await interaction.update(payload).catch(() => interaction.editReply(payload));
    }
}

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';
    const userId = interaction.user.id;

    if (
        selectedValue === 'setup_wipe' || 
        customId.startsWith('btn_wipe_') || 
        customId === 'select_wipe_custom' || 
        customId.startsWith('modal_wipe_')
    ) {
        return await wipeHandler(interaction, client);
    }

    if (customId === 'admin_menu_select') {
        await interaction.channel.messages.fetch({ limit: 10 }).then(messages => {
            const prompts = messages.filter(m => m.content.includes('Grabbing coordinates') || m.content.includes('Stand at your desired'));
            for (const [_, msg] of prompts) { msg.delete().catch(() => {}); }
        });

        if (selectedValue === 'setup_logging') {
            const embed = new EmbedBuilder().setTitle('📊 Server Logging Manager').setDescription('Route different types of logs to specific channels.').setColor('#3498db');
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('log_action_select').setPlaceholder('Select a log channel to configure...').addOptions([{ label: 'Set Admin Logs Channel', value: 'log_admin', emoji: '🛡️' }, { label: 'Set Game Feeds Channel', value: 'log_game', emoji: '🎮' }, { label: 'Set Discord Logs Channel', value: 'log_discord', emoji: '💬' }]));
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }

        if (selectedValue === 'setup_postembed') {
            return await postEmbedHandler(interaction, client);
        }
        
        if (selectedValue === 'setup_multiserver') {
            const servers = await GameServer.findAll({ where: { guildId: interaction.guild.id } });
            const serverList = servers.length ? servers.map(s => `• **${s.serverName}** (\`${s.rconIp}:${s.rconPort}\`)`).join('\n') : 'No game servers configured yet.';
            const embed = new EmbedBuilder().setTitle('🌐 RCON Connect & Server Manager').setDescription(`**Configured Servers:**\n${serverList}`).setColor('#3498db');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_multiserver_add').setLabel('Add Game Server').setStyle(ButtonStyle.Success).setEmoji('➕'), new ButtonBuilder().setCustomId('rcon_quick_connect').setLabel('Connect RCON').setStyle(ButtonStyle.Primary).setEmoji('🔌'));
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }
        
        if (selectedValue === 'setup_embed') {
            const modal = new ModalBuilder().setCustomId('modal_admin_embed').setTitle('Create Custom Embed');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id').setLabel("Target Channel ID").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel("Embed Title").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel("Description (supports \\n)").setStyle(TextInputStyle.Paragraph).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel("Hex Color (e.g. #3498db)").setStyle(TextInputStyle.Short).setValue('#2b2d31').setRequired(false)));
            return interaction.showModal(modal);
        }
        
        if (selectedValue === 'setup_ai') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const isEnabled = config?.aiEnabled !== false;
            
            let premadeCount = 0;
            try { premadeCount = JSON.parse(config?.aiPremadeResponses || '[]').length; } catch(e){}

            const embed = new EmbedBuilder()
                .setTitle('🤖 AI Integration & Premade Responses')
                .setDescription(`Configure your server AI assistant, toggle state, and custom canned answers.\n\n` +
                    `• **Status:** ${isEnabled ? '🟢 ACTIVE (Enabled)' : '🔴 DISABLED'}\n` +
                    `• **Provider:** \`${config?.aiProvider || 'openai'}\`\n` +
                    `• **Model:** \`${config?.aiModel || 'gpt-4o-mini'}\`\n` +
                    `• **API Key:** ${config?.aiApiKey ? '🟢 Configured' : '🔴 Not Set'}\n` +
                    `• **Premade Answers:** \`${premadeCount} configured\``)
                .setColor('#9b59b6');

            const row1 = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_ai_provider')
                    .setPlaceholder('Choose AI Platform / Provider...')
                    .addOptions([
                        { label: 'OpenAI', value: 'openai', emoji: '🟢' },
                        { label: 'Anthropic (Claude)', value: 'anthropic', emoji: '🟠' },
                        { label: 'Google Gemini', value: 'gemini', emoji: '🔵' },
                        { label: 'DeepSeek', value: 'deepseek', emoji: '🟣' },
                        { label: 'Groq', value: 'groq', emoji: '⚡' },
                        { label: 'OpenRouter', value: 'openrouter', emoji: '🌐' },
                        { label: 'Custom / Ollama', value: 'custom', emoji: '💻' }
                    ])
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ai_toggle').setLabel(isEnabled ? 'Disable AI' : 'Enable AI').setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(isEnabled ? '🔴' : '🟢'),
                new ButtonBuilder().setCustomId('btn_ai_set_key').setLabel('API Key & Model').setStyle(ButtonStyle.Primary).setEmoji('🔑'),
                new ButtonBuilder().setCustomId('btn_ai_premade').setLabel('Premade Responses').setStyle(ButtonStyle.Secondary).setEmoji('📝')
            );

            return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
        }
        
        if (selectedValue === 'setup_rcon') {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_rcon_setup').setLabel('Set Credentials').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('rcon_quick_connect').setLabel('Connect RCON').setStyle(ButtonStyle.Success));
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🌐 RCON Setup').setColor('#3498db')], components: [row], flags: 64 });
        }
        
        if (selectedValue === 'admin_tools') {
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_admin_item').setLabel('Give Any Item').setStyle(ButtonStyle.Success).setEmoji('🎁'),
                new ButtonBuilder().setCustomId('btn_admin_kit').setLabel('Give Kit').setStyle(ButtonStyle.Success).setEmoji('📦'),
                new ButtonBuilder().setCustomId('btn_admin_vip').setLabel('Add VIP').setStyle(ButtonStyle.Primary).setEmoji('⭐'),
                new ButtonBuilder().setCustomId('btn_admin_mod').setLabel('Add Moderator').setStyle(ButtonStyle.Secondary).setEmoji('🛡️')
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_admin_say').setLabel('Server Say').setStyle(ButtonStyle.Primary).setEmoji('📢'),
                new ButtonBuilder().setCustomId('btn_admin_rcon').setLabel('Custom RCON Cmd').setStyle(ButtonStyle.Danger).setEmoji('⚡')
            );
            return interaction.reply({ content: '🧰 **Live Admin Tools:** Choose an administrative action below:', components: [row1, row2], flags: 64 });
        }
        
        if (selectedValue === 'setup_crosschat') {
            const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_crosschat_channel').setPlaceholder('Select channel...').addChannelTypes(ChannelType.GuildText));
            return interaction.reply({ content: '💬 Select a text channel:', components: [row], flags: 64 });
        }
    }

    if (interaction.isChannelSelectMenu()) {
        if (customId === 'select_crosschat_channel') { await GuildConfig.upsert({ guildId: interaction.guild.id, crossChatChannelId: interaction.values[0] }); return interaction.update({ content: `✅ Cross-Chat linked!`, components: [] }); }
        if (customId === 'select_killfeed_channel') { await GuildConfig.upsert({ guildId: interaction.guild.id, killfeedChannelId: interaction.values[0] }); return interaction.update({ content: `✅ Killfeed channel successfully linked!`, components: [] }); }
        if (customId === 'select_log_admin_channel') { await GuildConfig.upsert({ guildId: interaction.guild.id, logAdminChannelId: interaction.values[0] }); return interaction.update({ content: `✅ Admin Logs channel linked!`, components: [] }); }
        if (customId === 'select_log_game_channel') { await GuildConfig.upsert({ guildId: interaction.guild.id, logGameChannelId: interaction.values[0] }); return interaction.update({ content: `✅ Game Feeds channel linked!`, components: [] }); }
        if (customId === 'select_log_discord_channel') { await GuildConfig.upsert({ guildId: interaction.guild.id, logDiscordChannelId: interaction.values[0] }); return interaction.update({ content: `✅ Discord Logs channel linked!`, components: [] }); }
    }

    if (interaction.isStringSelectMenu()) {
        if (customId === 'ak_panel_kit_select') {
            if (!giveKitSessions.has(userId)) giveKitSessions.set(userId, { targetUserId: null, kitName: null });
            const session = giveKitSessions.get(userId);
            session.kitName = selectedValue;
            return await renderGiveKitPanel(interaction, session, `📦 Selected kit: **${selectedValue}**`);
        }

        if (customId === 'admin_say_color_select') {
            const selectedColor = selectedValue.replace('#', '');
            const modal = new ModalBuilder().setCustomId(`modal_admin_say_${selectedColor}`).setTitle('Server Broadcast Message');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('say_msg').setLabel("Type your message").setStyle(TextInputStyle.Paragraph).setRequired(true)));
            return interaction.showModal(modal);
        }

        if (customId === 'log_action_select') {
            if (selectedValue === 'log_admin') return interaction.reply({ content: '🛡️ Select channel for **Admin Logs**:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_log_admin_channel').setPlaceholder('Select Admin Logs Channel...').addChannelTypes(ChannelType.GuildText))], flags: 64 });
            if (selectedValue === 'log_game') return interaction.reply({ content: '🎮 Select channel for **Game Feeds**:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_log_game_channel').setPlaceholder('Select Game Feeds Channel...').addChannelTypes(ChannelType.GuildText))], flags: 64 });
            if (selectedValue === 'log_discord') return interaction.reply({ content: '💬 Select channel for **Discord Logs**:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_log_discord_channel').setPlaceholder('Select Discord Logs Channel...').addChannelTypes(ChannelType.GuildText))], flags: 64 });
        }
        
        if (customId === 'select_link_server_target') {
            const serverId = selectedValue.replace('link_server_', '');
            const server = await GameServer.findByPk(serverId);
            const modal = new ModalBuilder().setCustomId(`modal_link_account_${serverId}`).setTitle(`Link Account (${server ? server.serverName : 'Server'})`);
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel("Your exact in-game Rust name").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'hub_lb_select') {
            const category = selectedValue;
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config ? config.economyCurrency : 'Scrap';
            const allPlayers = await UserEconomy.findAll({ where: { guildId: interaction.guild.id } });
            let leaderboardText = ''; let embedTitle = ''; let embedColor = '';

            if (category === 'wealth') {
                const sortedPlayers = allPlayers.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank)).slice(0, 10);
                embedTitle = '💰 Wealth Leaderboard'; embedColor = '#FFD700';
                sortedPlayers.forEach((player, index) => { const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`; const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked'; leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **${player.wallet + player.bank}** ${currency}\n`; });
            } else if (category === 'level') {
                const sortedPlayers = allPlayers.sort((a, b) => { if (b.level === a.level) return b.xp - a.xp; return b.level - a.level; }).slice(0, 10);
                embedTitle = '⭐ BuddyPass Leaderboard'; embedColor = '#00ff00';
                sortedPlayers.forEach((player, index) => { const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`; const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked'; leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **Level ${player.level || 1}** (${player.xp || 0} XP)\n`; });
            } else if (category === 'pvp') {
                const sortedPlayers = allPlayers.sort((a, b) => {
                    const kdRatioA = a.deaths === 0 ? a.pvpKills : (a.pvpKills / a.deaths); const kdRatioB = a.deaths === 0 ? b.pvpKills : (b.pvpKills / b.deaths);
                    if (kdRatioB === kdRatioA) return b.pvpKills - a.pvpKills; return kdRatioB - kdRatioA;
                }).slice(0, 10);
                embedTitle = '⚔️ PvP K/D Leaderboard'; embedColor = '#e74c3c';
                sortedPlayers.forEach((player, index) => {
                    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`; const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked';
                    const kills = player.pvpKills || 0; const deaths = player.deaths || 0; const kd = deaths === 0 ? kills.toFixed(2) : (kills / deaths).toFixed(2);
                    leaderboardText += `${rank} ${ign} (<@${player.userId}>) — **K: ${kills} | D: ${deaths} | KD: ${kd}**\n`;
                });
            }
            const embed = new EmbedBuilder().setTitle(embedTitle).setDescription(leaderboardText || 'No data recorded yet.').setColor(embedColor).setTimestamp();
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`lb_refresh_${category}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'));
            return interaction.update({ content: null, embeds: [embed], components: [row] });
        }
        if (customId === 'admin_item_category_select') {
            const parts = selectedValue.replace('admin_item_cat_', '').split('_');
            const targetUserId = parts[0]; const catKey = parts.slice(1).join('_');
            const categoryData = RUST_CATEGORIES[catKey];
            if (!categoryData || !categoryData.items || categoryData.items.length === 0) return interaction.reply({ content: `❌ Invalid item category.`, flags: 64 });
            const itemOptions = categoryData.items.slice(0, 25).map(item => ({ label: item.name, description: `Shortname: ${item.shortname}`, value: `admin_give_final_${targetUserId}_${item.shortname}` }));
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('admin_item_final_select').setPlaceholder(`Step 3: Choose item from ${categoryData.label}...`).addOptions(itemOptions));
            return interaction.update({ content: `🎁 **Admin Item Wizard:** Choose the exact item from **${categoryData.label}**:`, components: [row] });
        }
        if (customId === 'admin_item_final_select') {
            const cleanVal = selectedValue.replace('admin_give_final_', '');
            const firstUnderscore = cleanVal.indexOf('_');
            const targetUserId = cleanVal.substring(0, firstUnderscore);
            const shortname = cleanVal.substring(firstUnderscore + 1);
            const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: targetUserId } });
            const modal = new ModalBuilder().setCustomId(`modal_admin_give_item_exec_${targetUserId}_${shortname}`).setTitle(`Give ${shortname} to ${targetUser ? targetUser.inGameName.substring(0, 20) : 'Player'}`);
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Enter Amount to Send").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'select_ai_provider') {
            let defaultUrl = 'https://api.openai.com/v1'; 
            let defaultModel = 'gpt-4o-mini';

            if (selectedValue === 'anthropic') { defaultUrl = 'https://api.anthropic.com/v1'; defaultModel = 'claude-3-7-sonnet'; }
            else if (selectedValue === 'gemini') { defaultUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/'; defaultModel = 'gemini-2.5-flash'; }
            else if (selectedValue === 'deepseek') { defaultUrl = 'https://api.deepseek.com/v1'; defaultModel = 'deepseek-chat'; }
            else if (selectedValue === 'groq') { defaultUrl = 'https://api.groq.com/openai/v1'; defaultModel = 'llama-3.3-70b-versatile'; }
            else if (selectedValue === 'openrouter') { defaultUrl = 'https://openrouter.ai/api/v1'; defaultModel = 'anthropic/claude-3.7-sonnet'; }
            else if (selectedValue === 'custom') { defaultUrl = 'http://localhost:11434/v1'; defaultModel = 'llama3'; }

            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            await config.update({ aiProvider: selectedValue, aiBaseUrl: defaultUrl, aiModel: defaultModel });

            const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ai_set_key').setLabel('Enter API Key & Model').setStyle(ButtonStyle.Primary).setEmoji('🔑'));
            return interaction.update({ content: `✅ AI Platform set to **${selectedValue.toUpperCase()}** (Default model: \`${defaultModel}\`)!\nNow click **Enter API Key & Model** to save your credentials.`, embeds: [], components: [row2] });
        }
    }

    if (interaction.isUserSelectMenu()) {
        if (customId === 'ak_panel_player_select') {
            if (!giveKitSessions.has(userId)) giveKitSessions.set(userId, { targetUserId: null, kitName: null });
            const session = giveKitSessions.get(userId);
            session.targetUserId = interaction.values[0];
            return await renderGiveKitPanel(interaction, session, '✅ Target player selected!');
        }

        if (customId === 'admin_item_select_player') {
            const targetUserId = interaction.values[0];
            const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: targetUserId } });
            if (!targetUser || !targetUser.inGameName) return interaction.reply({ content: `❌ This user has not linked their Rust account yet!`, flags: 64 });
            const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => ({ label: RUST_CATEGORIES[catKey].label, value: `admin_item_cat_${targetUserId}_${catKey}`, emoji: RUST_CATEGORIES[catKey].emoji }));
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('admin_item_category_select').setPlaceholder('Step 2: Select item category...').addOptions(catOptions));
            return interaction.update({ content: `🎁 **Admin Item Wizard:** Target player set to **${targetUser.inGameName}**. Now select an item category:`, components: [row] });
        }
        if (customId === 'select_give_item_target') {
            const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.values[0] } });
            if (!targetUser || !targetUser.inGameName) return interaction.reply({ content: `❌ User hasn't linked their Rust account!`, flags: 64 });
            const modal = new ModalBuilder().setCustomId(`modal_give_item_${targetUser.inGameName}`).setTitle(`Give Item to ${targetUser.inGameName.substring(0, 20)}`);
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_name').setLabel("Item Shortname (e.g. rifle.ak)").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_amount').setLabel("Amount").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
    }

    if (interaction.isButton()) {
        if (customId === 'btn_admin_kit') {
            giveKitSessions.set(userId, { targetUserId: null, kitName: null });
            return await renderGiveKitPanel(interaction, giveKitSessions.get(userId));
        }

        if (customId === 'ak_panel_player') {
            const row = new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder().setCustomId('ak_panel_player_select').setPlaceholder('Select the player to receive the kit...')
            );
            return interaction.update({ content: '👤 **Select Target Player:**', components: [row], embeds: [] });
        }

        if (customId === 'ak_panel_kit') {
            await interaction.deferUpdate();
            let liveKits = await fetchRceLiveKits(interaction.guild.id);

            const kitOptions = liveKits.slice(0, 25).map(k => ({
                label: k.substring(0, 100),
                value: k,
                emoji: '📦'
            }));

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ak_panel_kit_select')
                    .setPlaceholder('Select a kit from your RCE server...')
                    .addOptions(kitOptions)
            );
            return interaction.editReply({ content: '📦 **Select Kit from RCE Server:**', components: [row], embeds: [] });
        }

        if (customId === 'ak_panel_send') {
            const session = giveKitSessions.get(userId);
            if (!session || !session.targetUserId || !session.kitName) {
                return interaction.reply({ content: '❌ Please select both a player and a kit first.', flags: 64 });
            }

            const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: session.targetUserId } });
            if (!targetUser || !targetUser.inGameName) {
                return interaction.reply({ content: '❌ Target user has not linked their in-game Rust name!', flags: 64 });
            }

            try {
                await sendRconCommand(interaction.guild.id, `kit givetoplayer "${session.kitName}" "${targetUser.inGameName}"`);
                
                giveKitSessions.delete(userId);
                return interaction.update({ content: `✅ Successfully gave kit **${session.kitName}** to **${targetUser.inGameName}** (<@${session.targetUserId}>)!`, components: [], embeds: [] });
            } catch (e) {
                return interaction.reply({ content: `❌ RCON Error: \`${e.message}\``, flags: 64 });
            }
        }

        if (customId === 'ak_panel_cancel') {
            giveKitSessions.delete(userId);
            return interaction.update({ content: '❌ Give kit action cancelled.', components: [], embeds: [] });
        }

        if (customId === 'btn_admin_vip') {
            const modal = new ModalBuilder().setCustomId('modal_admin_vip_exec').setTitle('Grant VIP Status');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel("Exact In-Game Name / SteamID").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'btn_admin_mod') {
            const modal = new ModalBuilder().setCustomId('modal_admin_mod_exec').setTitle('Grant Server Moderator');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel("Exact In-Game Name / SteamID").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'btn_rcon_setup') {
            const modal = new ModalBuilder().setCustomId('modal_setup_rcon').setTitle('Configure RCON Credentials');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_ip').setLabel("Server IP").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_port').setLabel("Port").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_pass').setLabel("Password").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'btn_multiserver_add') {
            const modal = new ModalBuilder().setCustomId('modal_multiserver_add').setTitle('Add Game Server');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server_name').setLabel("Server Name (e.g. Main 2X)").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_ip').setLabel("RCON IP Address").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_port').setLabel("RCON Port").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_pass').setLabel("RCON Password").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'btn_automod_toggle') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const newState = !(config?.autoModEnabled || false);
            await GuildConfig.upsert({ guildId: interaction.guild.id, autoModEnabled: newState });
            return interaction.reply({ content: `✅ Auto-Moderation has been turned **${newState ? 'ON 🟢' : 'OFF 🔴'}**!`, flags: 64 });
        }
        if (customId === 'btn_automod_settings') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_automod_config').setTitle('Configure Auto-Mod Parameters');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('action').setLabel("Punishment ('warn', 'timeout', 'ban')").setStyle(TextInputStyle.Short).setValue(config?.autoModAction || 'timeout').setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('caps').setLabel("Max Caps % Allowed (e.g. 70)").setStyle(TextInputStyle.Short).setValue(`${config?.autoModCapsLimit || 70}`).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'btn_admin_item') {
            const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('admin_item_select_player').setPlaceholder('Step 1: Select the player to give items to...'));
            return interaction.reply({ content: '🎁 **Admin Item Wizard:** Choose the target player below:', components: [row], flags: 64 });
        }
        if (customId === 'btn_admin_rcon') {
            const modal = new ModalBuilder().setCustomId('modal_admin_rcon').setTitle('Send RCON');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_command').setLabel("Command").setStyle(TextInputStyle.Paragraph).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'rcon_quick_connect') {
            await interaction.reply({ content: '⏳ Connecting...', flags: 64 });
            try { const status = await connectRcon(interaction.guild.id, client); await interaction.editReply({ content: `✅ ${status}` }); } catch (e) { await interaction.editReply({ content: `❌ ${e.message}` }); }
            return;
        }
        if (customId === 'hub_link_account') {
            const servers = await GameServer.findAll({ where: { guildId: interaction.guild.id } });
            if (!servers || servers.length === 0) {
                const modal = new ModalBuilder().setCustomId('modal_link_account_global').setTitle('Link Rust Account');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel("Your exact in-game Rust name").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }
            const options = servers.map(s => ({ label: s.serverName, value: `link_server_${s.id}`, emoji: '🖥️' }));
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_link_server_target').setPlaceholder('Select which server to link your account to...').addOptions(options));
            return interaction.reply({ content: '🔗 **Account Linking:** Please select the specific server you want to link your gamertag to:', components: [row], flags: 64 });
        }
        if (customId.startsWith('lb_refresh_')) {
            const category = customId.replace('lb_refresh_', '');
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config ? config.economyCurrency : 'Scrap';
            const allPlayers = await UserEconomy.findAll({ where: { guildId: interaction.guild.id } });
            let leaderboardText = ''; let embedTitle = ''; let embedColor = '';
            if (category === 'wealth') {
                const sortedPlayers = allPlayers.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank)).slice(0, 10);
                embedTitle = '💰 Wealth Leaderboard (Refreshed)'; embedColor = '#FFD700';
                sortedPlayers.forEach((player, index) => { const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`; const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked'; leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **${player.wallet + player.bank}** ${currency}\n`; });
            } else if (category === 'level') {
                const sortedPlayers = allPlayers.sort((a, b) => { if (b.level === a.level) return b.xp - a.xp; return b.level - a.level; }).slice(0, 10);
                embedTitle = '⭐ BuddyPass Leaderboard (Refreshed)'; embedColor = '#00ff00';
                sortedPlayers.forEach((player, index) => { const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`; const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked'; leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **Level ${player.level || 1}** (${player.xp || 0} XP)\n`; });
            } else if (category === 'pvp') {
                const sortedPlayers = allPlayers.sort((a, b) => {
                    const kdRatioA = a.deaths === 0 ? a.pvpKills : (a.pvpKills / a.deaths); const kdRatioB = a.deaths === 0 ? b.pvpKills : (b.pvpKills / b.deaths);
                    if (kdRatioB === kdRatioA) return b.pvpKills - a.pvpKills; return kdRatioB - kdRatioA;
                }).slice(0, 10);
                embedTitle = '⚔️ PvP K/D Leaderboard (Refreshed)'; embedColor = '#e74c3c';
                sortedPlayers.forEach((player, index) => {
                    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`; const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked';
                    const kills = player.pvpKills || 0; const deaths = player.deaths || 0; const kd = deaths === 0 ? kills.toFixed(2) : (kills / deaths).toFixed(2);
                    leaderboardText += `${rank} ${ign} (<@${player.userId}>) — **K: ${kills} | D: ${deaths} | KD: ${kd}**\n`;
                });
            }
            const embed = new EmbedBuilder().setTitle(embedTitle).setDescription(leaderboardText || 'No data recorded yet.').setColor(embedColor).setTimestamp();
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`lb_refresh_${category}`).setLabel('Refresh Leaderboard').setStyle(ButtonStyle.Secondary).setEmoji('🔄'));
            return interaction.update({ embeds: [embed], components: [row] });
        }
        if (customId === 'btn_ai_set_key') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_ai_credentials').setTitle('Configure AI Credentials');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ai_key').setLabel("API Key").setStyle(TextInputStyle.Short).setValue(config?.aiApiKey || '').setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ai_model').setLabel("Model Name (e.g. gpt-4o-mini)").setStyle(TextInputStyle.Short).setValue(config?.aiModel || 'gpt-4o-mini').setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ai_url').setLabel("Base API URL").setStyle(TextInputStyle.Short).setValue(config?.aiBaseUrl || 'https://api.openai.com/v1').setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'btn_ai_toggle') {
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            const newState = config.aiEnabled === false ? true : false;
            await config.update({ aiEnabled: newState });
            return interaction.reply({ content: `✅ AI assistant has been turned **${newState ? 'ON 🟢' : 'OFF 🔴'}**!`, flags: 64 });
        }
        if (customId === 'btn_ai_premade') {
            const modal = new ModalBuilder().setCustomId('modal_ai_add_premade').setTitle('Add Premade AI Response');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('trigger_word').setLabel('Trigger Keyword/Phrase (e.g. wipe)').setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('response_text').setLabel('Bot Response').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        if (customId === 'ak_modal_kit_input') {
            if (!giveKitSessions.has(userId)) giveKitSessions.set(userId, { targetUserId: null, kitName: null });
            const session = giveKitSessions.get(userId);
            session.kitName = interaction.fields.getTextInputValue('kit_name').trim();
            return await renderGiveKitPanel(interaction, session, `📦 Kit name "**${session.kitName}**" saved to session!`);
        }

        if (customId.startsWith('modal_admin_say_')) {
            const hexColor = '#' + customId.replace('modal_admin_say_', '');
            const msg = interaction.fields.getTextInputValue('say_msg').replace(/"/g, "'"); 
            try {
                await sendRconCommand(interaction.guild.id, `say "<color=${hexColor}>${msg}</color>"`);
                return interaction.reply({ content: `📢 **Broadcast sent successfully!**`, flags: 64 });
            } catch(e) {
                return interaction.reply({ content: `❌ Error sending broadcast: \`${e.message}\``, flags: 64 });
            }
        }

        if (customId === 'modal_admin_vip_exec') {
            const target = interaction.fields.getTextInputValue('ign').trim();
            try {
                await sendRconCommand(interaction.guild.id, `ownerid ${target} "VIP Status"`);
                return interaction.reply({ content: `✅ Successfully granted VIP status to **${target}**!`, flags: 64 });
            } catch (e) { return interaction.reply({ content: `❌ RCON Error executing VIP command: \`${e.message}\``, flags: 64 }); }
        }
        if (customId === 'modal_admin_mod_exec') {
            const target = interaction.fields.getTextInputValue('ign').trim();
            try {
                await sendRconCommand(interaction.guild.id, `moderatorid ${target} "Server Moderator"`);
                return interaction.reply({ content: `✅ Successfully granted Moderator rights to **${target}**!`, flags: 64 });
            } catch (e) { return interaction.reply({ content: `❌ RCON Error executing Moderator command: \`${e.message}\``, flags: 64 }); }
        }
        if (customId === 'modal_automod_config') {
            const action = interaction.fields.getTextInputValue('action').trim().toLowerCase();
            const caps = parseInt(interaction.fields.getTextInputValue('caps')) || 70;
            if (!['warn', 'timeout', 'ban'].includes(action)) return interaction.reply({ content: '❌ Action must be either `warn`, `timeout`, or `ban`.', flags: 64 });
            await GuildConfig.upsert({ guildId: interaction.guild.id, autoModAction: action, autoModCapsLimit: caps });
            return interaction.reply({ content: `✅ Auto-Mod settings updated!\n• Punishment: \`${action}\`\n• Caps Limit: \`${caps}%\``, flags: 64 });
        }
        if (customId === 'modal_ai_add_premade') {
            const trigger = interaction.fields.getTextInputValue('trigger_word').trim();
            const responseText = interaction.fields.getTextInputValue('response_text').trim();
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            let list = []; try { list = JSON.parse(config.aiPremadeResponses || '[]'); } catch(e){}
            list.push({ trigger, response: responseText });
            await config.update({ aiPremadeResponses: JSON.stringify(list) });
            return interaction.reply({ content: `✅ Successfully added premade response for trigger: **"${trigger}"**!`, flags: 64 });
        }
        if (customId === 'modal_ai_credentials') {
            const apiKey = interaction.fields.getTextInputValue('ai_key');
            const model = interaction.fields.getTextInputValue('ai_model');
            const baseUrl = interaction.fields.getTextInputValue('ai_url');
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            await config.update({ aiApiKey: apiKey.trim(), aiModel: model.trim(), aiBaseUrl: baseUrl.trim() });
            return interaction.reply({ content: `✅ **AI Assistant Configured!**\n• Model: \`${model}\`\n• Base URL: \`${baseUrl}\`\nMembers can now mention <@${client.user.id}> to ask questions!`, flags: 64 });
        }
        if (customId === 'modal_link_account_global' || customId.startsWith('modal_link_account_')) {
            const ign = interaction.fields.getTextInputValue('ign').trim();
            const serverId = customId === 'modal_link_account_global' ? null : customId.replace('modal_link_account_', '');
            let userRecord = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            if (userRecord) await userRecord.update({ inGameName: ign });
            else await UserEconomy.create({ guildId: interaction.guild.id, userId: interaction.user.id, inGameName: ign, wallet: 0, bank: 0, xp: 0, level: 1 });
            const serverInfo = serverId ? ` to this server` : '';
            return interaction.reply({ content: `✅ Successfully linked your Discord account to **${ign}**${serverInfo}!\nYou can now use the shop, kits, and teleports.`, flags: 64 });
        }
        if (customId.startsWith('modal_admin_give_item_exec_')) {
            try {
                await sendRconCommand(interaction.guild.id, `inventory.giveto "${customId.replace('modal_admin_give_item_exec_', '')}" ${interaction.fields.getTextInputValue('item_name')} ${interaction.fields.getTextInputValue('item_amount')}`);
                return interaction.reply({ content: `✅ Sent!`, flags: 64 });
            } catch(e) { return interaction.reply({ content: `❌ Error`, flags: 64 }); }
        }
        if (customId === 'modal_multiserver_add') {
            const serverName = interaction.fields.getTextInputValue('server_name').trim();
            const rconIp = interaction.fields.getTextInputValue('rcon_ip').trim();
            const rconPort = interaction.fields.getTextInputValue('rcon_port').trim();
            const rconPassword = interaction.fields.getTextInputValue('rcon_pass').trim();
            await GameServer.create({ guildId: interaction.guild.id, serverName, rconIp, rconPort, rconPassword });
            return interaction.reply({ content: `✅ Successfully added game server **${serverName}** (\`${rconIp}:${rconPort}\`)!`, flags: 64 });
        }
        if (customId === 'modal_setup_rcon') {
            const ip = interaction.fields.getTextInputValue('rcon_ip').trim();
            const port = interaction.fields.getTextInputValue('rcon_port').trim();
            const pass = interaction.fields.getTextInputValue('rcon_pass').trim();
            await GuildConfig.upsert({ guildId: interaction.guild.id, rconIp: ip, rconPort: port, rconPassword: pass });
            return interaction.reply({ content: `✅ RCON credentials successfully updated!\n• Server IP: \`${ip}:${port}\`\nClick **Connect RCON** to initialize communication.`, flags: 64 });
        }
        if (customId === 'modal_admin_embed') {
            const channelId = interaction.fields.getTextInputValue('channel_id');
            const title = interaction.fields.getTextInputValue('title');
            const description = interaction.fields.getTextInputValue('description');
            const color = interaction.fields.getTextInputValue('color') || '#2b2d31';
            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (!targetChannel) return interaction.reply({ content: '❌ Invalid Channel ID provided.', flags: 64 });
            const embed = new EmbedBuilder().setTitle(title).setDescription(description.replace(/\\n/g, '\n')).setColor(color).setTimestamp();
            await targetChannel.send({ embeds: [embed] });
            return interaction.reply({ content: `✅ Custom embed successfully posted in <#${targetChannel.id}>!`, flags: 64 });
        }
        if (customId === 'modal_admin_rcon') {
            try {
                await sendRconCommand(interaction.guild.id, interaction.fields.getTextInputValue('rcon_command'));
                return interaction.reply({ content: `✅ Executed!`, flags: 64 });
            } catch(e) { return interaction.reply({ content: `❌ Error`, flags: 64 }); }
        }
    }
};