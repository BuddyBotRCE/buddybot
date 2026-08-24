const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { GuildConfig, GameServer, UserEconomy, ReactionRole, PveZone } = require('../database/db');
const { connectRcon, sendRconCommand } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

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
        
        // --- UPDATED REACTION ROLE MENU GENERATION ---
        if (selectedValue === 'setup_reaction_roles') {
            const embed = new EmbedBuilder().setTitle('🔘 Reaction Roles & Verification Manager').setDescription('Select an option below to create a panel or manage existing ones.').setColor('#3498db');
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('rr_action_select')
                    .setPlaceholder('⚙️ Choose Role Panel Type to Create...')
                    .addOptions([
                        { label: 'Create Reaction Roles', value: 'create_reaction_roles', description: 'Toggleable roles (Add/Remove)', emoji: '🔄' }, 
                        { label: 'Create Verification Panel', value: 'create_verification_panel', description: 'One-time click (Add-Only)', emoji: '✅' },
                        { label: 'Remove Reaction Role', value: 'rr_remove', description: 'Delete a panel configuration by ID', emoji: '🗑️' }
                    ])
            );
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }

        if (selectedValue === 'setup_automod') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const embed = new EmbedBuilder().setTitle('🛡️ Auto-Moderation Suite').setDescription(`Configure automated chat filters.\n\n• **Status:** ${config?.autoModEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n• **Action Type:** \`${config?.autoModAction || 'timeout'}\`\n• **Caps Limit:** ${config?.autoModCapsLimit || 70}%`).setColor('#e74c3c');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_automod_toggle').setLabel(config?.autoModEnabled ? 'Disable Auto-Mod' : 'Enable Auto-Mod').setStyle(config?.autoModEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('⚡'), new ButtonBuilder().setCustomId('btn_automod_settings').setLabel('Configure Limits & Actions').setStyle(ButtonStyle.Primary).setEmoji('⚙️'));
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }
        if (selectedValue === 'setup_multiserver') {
            const servers = await GameServer.findAll({ where: { guildId: interaction.guild.id } });
            const serverList = servers.length ? servers.map(s => `• **${s.serverName}** (\`${s.rconIp}:${s.rconPort}\`)`).join('\n') : 'No game servers configured yet.';
            const embed = new EmbedBuilder().setTitle('🌐 RCON Connect & Server Manager').setDescription(`**Configured Servers:**\n${serverList}`).setColor('#3498db');
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_multiserver_add').setLabel('Add Game Server').setStyle(ButtonStyle.Success).setEmoji('➕'), new ButtonBuilder().setCustomId('rcon_quick_connect').setLabel('Connect RCON').setStyle(ButtonStyle.Primary).setEmoji('🔌'));
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }
        if (selectedValue === 'setup_wipe') {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_wipe_full').setLabel('Full Wipe').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('btn_wipe_selective').setLabel('Selective Wipe').setStyle(ButtonStyle.Primary));
            return interaction.reply({ content: '☢️ Server Wipe Manager', components: [row], flags: 64 });
        }
        if (selectedValue === 'setup_embed') {
            const modal = new ModalBuilder().setCustomId('modal_admin_embed').setTitle('Create Custom Embed');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id').setLabel("Target Channel ID").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel("Embed Title").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel("Description (supports \\n)").setStyle(TextInputStyle.Paragraph).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel("Hex Color (e.g. #3498db)").setStyle(TextInputStyle.Short).setValue('#2b2d31').setRequired(false)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'setup_ai') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const embed = new EmbedBuilder().setTitle('🤖 AI Integration Settings').setDescription(`• **Provider:** \`${config?.aiProvider || 'openai'}\`\n• **Model:** \`${config?.aiModel || 'gpt-4o-mini'}\`\n• **API Key:** ${config?.aiApiKey ? 'Configured' : 'Not Set'}\n• **Base URL:** \`${config?.aiBaseUrl || 'https://api.openai.com/v1'}\``).setColor('#9b59b6');
            const row1 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_ai_provider').setPlaceholder('Choose AI Platform / Provider...').addOptions([{ label: 'OpenAI', value: 'openai' }, { label: 'OpenRouter', value: 'openrouter' }, { label: 'Groq', value: 'groq' }, { label: 'DeepSeek', value: 'deepseek' }, { label: 'Custom', value: 'custom' }]));
            const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ai_set_key').setLabel('Set API Key & Model').setStyle(ButtonStyle.Primary).setEmoji('🔑'));
            return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
        }
        if (selectedValue === 'setup_rcon') {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_rcon_setup').setLabel('Set Credentials').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('rcon_quick_connect').setLabel('Connect RCON').setStyle(ButtonStyle.Success));
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🌐 RCON Setup').setColor('#3498db')], components: [row], flags: 64 });
        }
        if (selectedValue === 'admin_tools') {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_admin_item').setLabel('Give Items').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('btn_admin_rcon').setLabel('Send Cmd').setStyle(ButtonStyle.Danger));
            return interaction.reply({ content: '🧰 Live Admin Tools', components: [row], flags: 64 });
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
                    const kdRatioA = a.deaths === 0 ? a.pvpKills : (a.pvpKills / a.deaths); const kdRatioB = b.deaths === 0 ? b.pvpKills : (b.pvpKills / b.deaths);
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
            const modal = new ModalBuilder().setCustomId(`modal_admin_give_item_exec_${targetUserId}_${shortname}`).setTitle(`Give ${shortname} to ${targetUser ? targetUser.inGameName : 'Player'}`);
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Enter Amount to Send").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'select_ai_provider') {
            let defaultUrl = 'https://api.openai.com/v1'; let defaultModel = 'gpt-4o-mini';
            if (selectedValue === 'openrouter') { defaultUrl = 'https://openrouter.ai/api/v1'; defaultModel = 'openai/gpt-4o-mini'; } 
            else if (selectedValue === 'groq') { defaultUrl = 'https://api.groq.com/openai/v1'; defaultModel = 'llama-3.3-70b-versatile'; } 
            else if (selectedValue === 'deepseek') { defaultUrl = 'https://api.deepseek.com/v1'; defaultModel = 'deepseek-chat'; } 
            else if (selectedValue === 'gemini') { defaultUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/'; defaultModel = 'gemini-3.7-flash'; }
            else if (selectedValue === 'custom') { defaultUrl = 'http://localhost:11434/v1'; defaultModel = 'llama3'; }
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            await config.update({ aiProvider: selectedValue, aiBaseUrl: defaultUrl, aiModel: defaultModel });
            const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ai_set_key').setLabel('Set API Key & Model').setStyle(ButtonStyle.Primary).setEmoji('🔑'));
            return interaction.update({ content: `✅ AI Platform set to **${selectedValue.toUpperCase()}**! Now click **Set API Key & Model**.`, embeds: [], components: [row2] });
        }
    }

    if (interaction.isUserSelectMenu()) {
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
            const modal = new ModalBuilder().setCustomId(`modal_give_item_${targetUser.inGameName}`).setTitle(`Give Item to ${targetUser.inGameName}`);
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_name').setLabel("Item Shortname (e.g. rifle.ak)").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_amount').setLabel("Amount").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
    }

    if (interaction.isButton()) {
        if (customId === 'btn_wipe_full') {
            const modal = new ModalBuilder().setCustomId('modal_wipe_full').setTitle('Confirm FULL Wipe');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm_text').setLabel('Type WIPE to permanently delete everything').setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'btn_wipe_selective') {
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_wipe_custom').setPlaceholder('Select data to wipe...').setMinValues(1).setMaxValues(4).addOptions([{ label: 'Economy & Banks', value: 'wipe_econ', emoji: '💰' }, { label: 'BuddyPass Progress', value: 'wipe_bp', emoji: '⭐' }, { label: 'Home Teleports', value: 'wipe_tp', emoji: '🏠' }, { label: 'PVE Zones', value: 'wipe_zones', emoji: '🏕️' }]));
            return interaction.reply({ content: '🗑️ **Selective Wipe:** Choose exactly which databases to reset below:', components: [row], flags: 64 });
        }
        if (customId === 'btn_rcon_setup') {
            const modal = new ModalBuilder().setCustomId('modal_setup_rcon').setTitle('Configure RCON Credentials');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_ip').setLabel("Server IP").setStyle(TextInputStyle.Short).setRequired(true)), 
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_port').setLabel("Port").setStyle(TextInputStyle.Short).setRequired(true)), 
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_pass').setLabel("Password").setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }
        if (customId === 'btn_multiserver_add') {
            const modal = new ModalBuilder().setCustomId('modal_multiserver_add').setTitle('Add Game Server');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server_name').setLabel("Server Name (e.g. Main 2X)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_ip').setLabel("RCON IP Address").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_port').setLabel("RCON Port").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_pass').setLabel("RCON Password").setStyle(TextInputStyle.Short).setRequired(true))
            );
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
                    const kdRatioA = a.deaths === 0 ? a.pvpKills : (a.pvpKills / a.deaths); const kdRatioB = b.deaths === 0 ? b.pvpKills : (b.pvpKills / b.deaths);
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
    }

    if (interaction.isModalSubmit()) {
        if (customId === 'modal_automod_config') {
            const action = interaction.fields.getTextInputValue('action').trim().toLowerCase();
            const caps = parseInt(interaction.fields.getTextInputValue('caps')) || 70;
            if (!['warn', 'timeout', 'ban'].includes(action)) return interaction.reply({ content: '❌ Action must be either `warn`, `timeout`, or `ban`.', flags: 64 });
            await GuildConfig.upsert({ guildId: interaction.guild.id, autoModAction: action, autoModCapsLimit: caps });
            return interaction.reply({ content: `✅ Auto-Mod settings updated!\n• Punishment: \`${action}\`\n• Caps Limit: \`${caps}%\``, flags: 64 });
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
        if (customId === 'modal_wipe_full' || customId.startsWith('modal_wipe_sel_')) {
            if (interaction.fields.getTextInputValue('confirm_text') !== 'WIPE') return interaction.reply({ content: '❌ Cancelled.', flags: 64 });
            let updateData = {}; 
            if (customId === 'modal_wipe_full') {
                const allZones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
                for (const z of allZones) { try { await sendRconCommand(interaction.guild.id, `zones.deletecustomzone "${z.zoneName}"`); } catch (e) {} }
                await PveZone.destroy({ where: { guildId: interaction.guild.id } });
                updateData = { wallet: 0, xp: 0, level: 1, homeX: null, homeY: null, homeZ: null, autoSupplyEnabled: false, autoEliteEnabled: false, autoTimedEnabled: false, supplySpawnCount: 1, eliteSpawnCount: 1, timedSpawnCount: 1 };
                for (let i = 1; i <= 10; i++) {
                    updateData[`supplySlot${i}X`] = null; updateData[`supplySlot${i}Y`] = null; updateData[`supplySlot${i}Z`] = null;
                    updateData[`eliteSlot${i}X`] = null; updateData[`eliteSlot${i}Y`] = null; updateData[`eliteSlot${i}Z`] = null;
                    updateData[`timedSlot${i}X`] = null; updateData[`timedSlot${i}Y`] = null; updateData[`timedSlot${i}Z`] = null;
                }
            } else {
                const sel = customId.replace('modal_wipe_sel_', '').split('-');
                if (sel.includes('wipe_econ')) updateData.wallet = 0;
                if (sel.includes('wipe_bp')) { updateData.xp = 0; updateData.level = 1; }
                if (sel.includes('wipe_tp')) { updateData.homeX = null; updateData.homeY = null; updateData.homeZ = null; }
                if (sel.includes('wipe_zones')) {
                    const selZones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
                    for (const z of selZones) { try { await sendRconCommand(interaction.guild.id, `zones.deletecustomzone "${z.zoneName}"`); } catch (e) {} }
                    await PveZone.destroy({ where: { guildId: interaction.guild.id } });
                }
            }
            await GuildConfig.update(updateData, { where: { guildId: interaction.guild.id } });
            await UserEconomy.update(updateData, { where: { guildId: interaction.guild.id } });
            return interaction.reply({ content: `☢️ Server WIPED successfully! All auto event configurations cleared.` });
        }
    }
};