const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, AttachmentBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, TicketCategory, GameServer } = require('../database/db');
const { connectRcon, sendRconCommand } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');
const wipeHandler = require('./wipeHandler'); 
const WebSocket = require('ws');
const { activeConnections } = require('../utils/rconManager');

const giveKitSessions = new Map();
const adminActionSessions = new Map(); 

// --- ⚙️ MASTER SWITCHBOARD DEFINITION ⚙️ ---
const MODULES_LIST = [
    { id: 'economyEnabled', name: 'Economy System', emoji: '💰' },
    { id: 'shopEnabled', name: 'Shop & Store', emoji: '🛒' },
    { id: 'ticketsEnabled', name: 'Ticket System', emoji: '🎫' },
    { id: 'giveawaysEnabled', name: 'Giveaways', emoji: '🎉' },
    { id: 'suggestionsEnabled', name: 'Suggestions', emoji: '💡' },
    { id: 'casinoEnabled', name: 'Minigames Casino', emoji: '🎰' },
    { id: 'buddypassEnabled', name: 'BuddyPass', emoji: '⭐' },
    { id: 'clansEnabled', name: 'Clan System', emoji: '🛡️' },
    { id: 'bountiesEnabled', name: 'Bounties', emoji: '🎯' },
    { id: 'customZonesEnabled', name: 'Custom Zones', emoji: '🗺️' },
    { id: 'autoEventsEnabled', name: 'Auto-Events', emoji: '🚁' },
    { id: 'autoModEnabled', name: 'Auto-Mod', emoji: '🛡️' },
    { id: 'orpEnabled', name: 'ORP Manager', emoji: '🛡️' },
    { id: 'aiEnabled', name: 'AI Assistant', emoji: '🤖' },
    { id: 'homeTpEnabled', name: 'Home Teleport', emoji: '🏠' },
    { id: 'skipNightEnabled', name: 'Skip Night', emoji: '🌙' },
    { id: 'recyclerEnabled', name: 'Recycler System', emoji: '♻️' } // 🛑 NEW: Recycler Toggle
];

async function renderBotSettings(interaction, guildId, action = 'reply') {
    const [config] = await GuildConfig.findOrCreate({ where: { guildId } });

    let description = '**Current Module Status:**\n*Use the dropdown below to select which modules you want active. Any module left unselected will be disabled!*\n\n';
    
    MODULES_LIST.forEach(m => {
        const isEnabled = config[m.id] !== false;
        description += `${m.emoji} **${m.name}:** ${isEnabled ? '🟢 ON' : '🔴 OFF'}\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Global Bot Settings & Toggles')
        .setDescription(description)
        .setColor('#2ecc71');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('bot_settings_toggle_select')
        .setPlaceholder('Check the boxes to ENABLE modules...')
        .setMinValues(0)
        .setMaxValues(MODULES_LIST.length)
        .addOptions(MODULES_LIST.map(m => ({
            label: m.name,
            value: m.id,
            emoji: m.emoji,
            default: config[m.id] !== false
        })));

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    const payload = { content: null, embeds: [embed], components: [row1, row2], flags: 64 };
    
    if (action === 'reply') {
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
        else await interaction.reply(payload);
    } else {
        await interaction.update(payload).catch(() => interaction.editReply(payload));
    }
}

async function renderMainPanel(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🛠️ Admin Panel & Dashboard')
        .setDescription('Configure your server modules, automated systems, shops, and community tools using the categories below.\n\n• **Dropdown 1:** Basic Systems & Upgrades\n• **Dropdown 2:** ⭐ Premium & Advanced Modules')
        .setColor('#2b2d31');

    const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('admin_menu_select').setPlaceholder('⚙️ Basic Systems & Upgrades...')
            .addOptions([
                { label: '⭐ Buy / Upgrade to Premium', value: 'setup_tier', description: 'Unlock all advanced modules and features', emoji: '⭐' },
                { label: 'Bot Settings (Toggles)', value: 'setup_bot_settings', description: 'Enable or disable bot features', emoji: '⚙️' },
                { label: 'RCON & Servers', value: 'setup_multiserver', emoji: '🌐' },
                { label: 'Live Admin Tools', value: 'admin_tools', emoji: '🧰' },
                { label: 'Shop & Store Manager', value: 'setup_shop', emoji: '🛒' },
                { label: 'Economy Manager', value: 'setup_economy', emoji: '💰' },
                { label: 'Minigames Casino', value: 'setup_minigames', emoji: '🎰' },
                { label: 'Ticket System', value: 'setup_tickets', emoji: '🎫' },
                { label: 'Cross-Chat', value: 'setup_crosschat', emoji: '💬' },
                { label: 'Admin & Mod Roles', value: 'setup_server_roles', description: 'Set bot admin/mod roles', emoji: '👑' },
                { label: 'Logging System', value: 'setup_logging', emoji: '📊' },
                { label: 'Custom Zones Builder', value: 'setup_custom_zones', description: 'Create and manage map zones', emoji: '🗺️' },
                { label: 'Server Wipe Panel', value: 'setup_wipe', emoji: '☢️' }
            ])
    );

    const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('admin_menu_select_2').setPlaceholder('⭐ Premium & Advanced Features...')
                .addOptions([
                    { label: '🎮 Buddy Games (Gun Game & BR)', value: 'setup_buddy_games', description: 'Configure automated Rust Console Edition arena events', emoji: '🎮' },
                    { label: 'Auto-Events (Premium)', value: 'setup_autoevents', emoji: '🚁' },
                    { label: 'Auto-Moderation Suite', value: 'setup_automod', emoji: '🛡️' },
                    { label: 'BuddyPass Manager', value: 'setup_buddypass', emoji: '⭐' },
                    { label: 'Clan System Manager', value: 'setup_clans', emoji: '🛡️' },
                    { label: 'Bounties System', value: 'setup_bounties', emoji: '🎯' },
                    { label: 'Custom Binds', value: 'setup_binds', emoji: '🗣️' },
                    { label: 'ORP Manager', value: 'setup_orp', emoji: '🛡️' },
                    { label: 'AI Integration Setup', value: 'setup_ai', emoji: '🤖' },
                    { label: 'Premium Status & License', value: 'setup_tier', emoji: '⭐' },
                    { label: 'Embeds & Reaction Roles', value: 'setup_embeds_roles', description: 'Announcements, Verifications, & Roles', emoji: '🎨' },
                    { label: 'Giveaways Manager', value: 'setup_giveaways', emoji: '🎉' },
                    { label: 'Suggestions System', value: 'setup_suggestions', emoji: '💡' },
                    { label: 'Home Teleport System', value: 'setup_hometp', description: 'Configure emote retreat teleports', emoji: '🏠' },
                    { label: 'Recycler Manager', value: 'setup_recycler', description: 'Configure independent recycler tools', emoji: '♻️' },
                    { label: 'Skip Night Settings', value: 'setup_skipnight', emoji: '🌙' }
                ])
        );

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        return await interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }
    return await interaction.update({ embeds: [embed], components: [row1, row2], content: null }).catch(() => {});
}

async function renderAdminMenu(interaction, guildId, action = 'reply') {
    const config = await GuildConfig.findOrCreate({ where: { guildId } });
    const cfg = config[0];
    
    const catDisplay = cfg.ticketCategoryId ? `<#${cfg.ticketCategoryId}>` : '`Not Set`';
    const logDisplay = cfg.ticketTranscriptChannelId ? `<#${cfg.ticketTranscriptChannelId}>` : '`Not Set`';
    const roleDisplay = cfg.ticketAdminRoleId ? `<@&${cfg.ticketAdminRoleId}>` : '`Not Set`';
    const vipRoleDisplay = cfg.ticketVipRoleId ? `<@&${cfg.ticketVipRoleId}>` : '`Not Set`';
    const isTicketAiOn = cfg.ticketAiEnabled !== false;

    const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket System Manager')
        .setDescription(`Configure support tickets for your players.\n\n**Current Setup:**\n📂 **Category:** ${catDisplay}\n📄 **Transcripts:** ${logDisplay}\n👮 **Support Role:** ${roleDisplay}\n⭐ **VIP Priority Role:** ${vipRoleDisplay}\n🤖 **AI Ticket Assistant:** ${isTicketAiOn ? '🟢 ON' : '🔴 OFF'}`)
        .setColor('#3498db');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_tk_setcat').setLabel('Set Category').setStyle(ButtonStyle.Primary).setEmoji('📂'),
        new ButtonBuilder().setCustomId('btn_tk_setlog').setLabel('Set Transcript Log').setStyle(ButtonStyle.Primary).setEmoji('📄'),
        new ButtonBuilder().setCustomId('btn_tk_setrole').setLabel('Set Support Role').setStyle(ButtonStyle.Primary).setEmoji('👮'),
        new ButtonBuilder().setCustomId('btn_tk_setvip').setLabel('Set Priority VIP Role').setStyle(ButtonStyle.Success).setEmoji('⭐')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('toggle_ticket_ai').setLabel(`AI Assistant: ${isTicketAiOn ? 'ON 🟢' : 'OFF 🔴'}`).setStyle(isTicketAiOn ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('🤖'),
        new ButtonBuilder().setCustomId('tk_manage_cats').setLabel('Manage Categories').setStyle(ButtonStyle.Success).setEmoji('📑'),
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    const payload = { content: '', embeds: [embed], components: [row1, row2], flags: 64 };
    if (action === 'reply') await interaction.reply(payload);
    else await interaction.update(payload);
}

async function renderCategoryManager(interaction, guildId, action = 'update') {
    const cats = await TicketCategory.findAll({ where: { guildId } });

    let catList = cats.length > 0
        ? cats.map((c, i) => `**${i + 1}. ${c.name}**\n*${c.description}*`).join('\n\n')
        : '*No custom categories created yet. Players will see default options (General, Report, Priority).*';

    const embed = new EmbedBuilder()
        .setTitle('📑 Ticket Categories')
        .setDescription(`Create custom dropdown options for players when they open a ticket.\n\n${catList}`)
        .setColor('#f1c40f');

    const components = [];

    if (cats.length > 0) {
        const delMenu = new StringSelectMenuBuilder()
            .setCustomId('tk_del_cat')
            .setPlaceholder('🗑️ Select a category to delete...')
            .addOptions(cats.slice(0, 25).map(c => ({ label: c.name.substring(0, 100), value: c.id.toString() })));
        components.push(new ActionRowBuilder().addComponents(delMenu));
    }

    components.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tk_add_cat').setLabel('Add Category').setStyle(ButtonStyle.Primary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('tk_back_main').setLabel('Back to Ticket Setup').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    ));

    const payload = { content: '', embeds: [embed], components, flags: 64 };
    if (action === 'reply') await interaction.reply(payload);
    else await interaction.update(payload);
}

const adminHandler = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';
    const guildId = interaction.guild.id;

    if (customId === 'admin_menu_back') {
        return await renderMainPanel(interaction);
    }

    if (customId === 'admin_menu_select' && selectedValue === 'setup_bot_settings') {
        return await renderBotSettings(interaction, guildId, 'reply');
    }
    
    // 🛑 NEW: Routes to the Recycler Panel
    if (customId === 'admin_menu_select_2' && selectedValue === 'setup_recycler') {
        try {
            const recyclerHandler = require('./recyclerHandler');
            return await recyclerHandler(interaction, client);
        } catch (err) {
            console.error('[RECYCLER HANDLER ERROR]', err);
            return interaction.reply({ content: '❌ The Recycler module is currently unlinked or missing.', flags: 64 });
        }
    }

    if (customId === 'admin_menu_select' && interaction.isStringSelectMenu() && interaction.values[0] === 'setup_tickets') {
        return await renderAdminMenu(interaction, guildId, 'reply');
    }

    if ((customId === 'admin_menu_select' || customId === 'admin_menu_select_2') && selectedValue === 'setup_ai') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const isEnabled = config?.aiEnabled !== false;
        let premadeCount = 0; try { premadeCount = JSON.parse(config?.aiPremadeResponses || '[]').length; } catch(e){}

        const embed = new EmbedBuilder()
            .setTitle('🤖 AI Integration & Premade Responses')
            .setDescription(`Configure your server AI assistant, toggle state, and custom canned answers.\n\n• **Status:** ${isEnabled ? '🟢 ACTIVE' : '🔴 DISABLED'}\n• **Provider:** \`${config?.aiProvider || 'openai'}\`\n• **Model:** \`${config?.aiModel || 'gpt-4o-mini'}\`\n• **API Key:** ${config?.aiApiKey ? '🟢 Configured' : '🔴 Not Set'}\n• **Premade Answers:** \`${premadeCount} configured\``)
            .setColor('#9b59b6');

        const row1 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_ai_provider').setPlaceholder('Choose AI Platform / Provider...').addOptions([{ label: 'OpenAI', value: 'openai', emoji: '🟢' }, { label: 'Anthropic', value: 'anthropic', emoji: '🟠' }, { label: 'Google Gemini', value: 'gemini', emoji: '🔵' }, { label: 'DeepSeek', value: 'deepseek', emoji: '🟣' }, { label: 'Groq', value: 'groq', emoji: '⚡' }, { label: 'OpenRouter', value: 'openrouter', emoji: '🌐' }, { label: 'Custom / Ollama', value: 'custom', emoji: '💻' }]));
        const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ai_toggle').setLabel(isEnabled ? 'Disable AI' : 'Enable AI').setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(isEnabled ? '🔴' : '🟢'), new ButtonBuilder().setCustomId('btn_ai_set_key').setLabel('API Key & Model').setStyle(ButtonStyle.Primary).setEmoji('🔑'), new ButtonBuilder().setCustomId('btn_ai_premade').setLabel('Premade Responses').setStyle(ButtonStyle.Secondary).setEmoji('📝'));
        
        const backRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙'));
        
        const payload = { embeds: [embed], components: [row1, row2, backRow], flags: 64 };
        if (interaction.replied || interaction.deferred) return await interaction.editReply(payload);
        return await interaction.reply(payload);
    }

    if (customId === 'tk_manage_cats') return await renderCategoryManager(interaction, guildId, 'update');
    if (customId === 'tk_back_main') return await renderAdminMenu(interaction, guildId, 'update');

    if (customId === 'toggle_ticket_ai') {
        const [config] = await GuildConfig.findOrCreate({ where: { guildId } });
        const currentState = config.ticketAiEnabled !== false;
        const newState = !currentState;
        
        await config.update({ ticketAiEnabled: newState });
        return await renderAdminMenu(interaction, guildId, 'update');
    }

    if (interaction.isButton()) {
        if (customId === 'btn_tk_setcat') {
            const embed = new EmbedBuilder().setTitle('📂 Select Ticket Category').setDescription('Please select the Discord category where new support tickets will be spawned.').setColor('#3498db');
            const menu = new ChannelSelectMenuBuilder().setCustomId('tk_sel_cat').setPlaceholder('Select target category...').addChannelTypes(ChannelType.GuildCategory);
            return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
        }

        if (customId === 'btn_tk_setlog') {
            const embed = new EmbedBuilder().setTitle('📄 Select Transcript Log').setDescription('Please select the text channel where closed ticket transcripts will be sent.').setColor('#3498db');
            const menu = new ChannelSelectMenuBuilder().setCustomId('tk_sel_log').setPlaceholder('Select transcript channel...').addChannelTypes(ChannelType.GuildText);
            return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
        }

        if (customId === 'btn_tk_setrole') {
            const embed = new EmbedBuilder().setTitle('👮 Select Support Role').setDescription('Please select the role that will be pinged and given access to new tickets.').setColor('#3498db');
            const menu = new RoleSelectMenuBuilder().setCustomId('tk_sel_role').setPlaceholder('Select support staff role...');
            return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
        }

        if (customId === 'btn_tk_setvip') {
            const embed = new EmbedBuilder().setTitle('⭐ Select Priority VIP Role').setDescription('Players with this role will automatically have their tickets flagged as HIGH PRIORITY.').setColor('#e74c3c');
            const menu = new RoleSelectMenuBuilder().setCustomId('tk_sel_vip').setPlaceholder('Select Priority/VIP role...');
            return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
        }

        if (customId === 'tk_add_cat') {
            const modal = new ModalBuilder().setCustomId('modal_tk_addcat').setTitle('Create Ticket Category');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_name').setLabel("Category Name (e.g. Bug Report 🐛)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_desc').setLabel("Brief Description").setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }
    }

    if (interaction.isChannelSelectMenu()) {
        if (customId === 'tk_sel_cat') {
            await GuildConfig.update({ ticketCategoryId: interaction.values[0] }, { where: { guildId } });
            return interaction.update({ content: `✅ Ticket category successfully set to <#${interaction.values[0]}>!`, embeds: [], components: [] });
        }
        if (customId === 'tk_sel_log') {
            await GuildConfig.update({ ticketTranscriptChannelId: interaction.values[0] }, { where: { guildId } });
            return interaction.update({ content: `✅ Transcripts will now be sent to <#${interaction.values[0]}>!`, embeds: [], components: [] });
        }
    }

    if (interaction.isRoleSelectMenu()) {
        if (customId === 'tk_sel_role') {
            await GuildConfig.update({ ticketAdminRoleId: interaction.values[0] }, { where: { guildId } });
            return interaction.update({ content: `✅ Support role set! <@&${interaction.values[0]}> will now have access to tickets.`, embeds: [], components: [] });
        }
        if (customId === 'tk_sel_vip') {
            await GuildConfig.update({ ticketVipRoleId: interaction.values[0] }, { where: { guildId } });
            return interaction.update({ content: `✅ Priority VIP role set! Players with <@&${interaction.values[0]}> will open high-priority tickets.`, embeds: [], components: [] });
        }
    }

    if (interaction.isStringSelectMenu() && customId === 'tk_del_cat') {
        await TicketCategory.destroy({ where: { id: interaction.values[0], guildId } });
        return await renderCategoryManager(interaction, guildId, 'update');
    }

    if (interaction.isModalSubmit() && customId === 'modal_tk_addcat') {
        const name = interaction.fields.getTextInputValue('cat_name').trim();
        const description = interaction.fields.getTextInputValue('cat_desc').trim();
        await TicketCategory.create({ guildId, name, description });
        return await renderCategoryManager(interaction, guildId, 'update');
    }

    if (customId === 'ticket_create') {
        const servers = await GameServer.findAll({ where: { guildId } });
        
        let serverOptions = [
            { label: '🌐 General / Discord Issue', value: 'scope_discord', description: 'Discord, website, or store problem', emoji: '💬' }
        ];

        if (servers.length > 0) {
            servers.forEach(s => {
                serverOptions.push({ label: `🖥️ Server: ${s.serverName}`, value: `scope_server_${s.id}`, description: `In-game issue on ${s.serverName}`, emoji: '🖥️' });
            });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('tk_sel_scope')
            .setPlaceholder('Select what your ticket is regarding...')
            .addOptions(serverOptions);

        return interaction.reply({ content: '🎫 **Support Ticket Setup (Step 1/2):**\nIs your issue related to a specific game server or a general Discord/community problem?', components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
    }

    if (interaction.isStringSelectMenu() && customId === 'tk_sel_scope') {
        const scopeValue = interaction.values[0];
        const cats = await TicketCategory.findAll({ where: { guildId } });

        let options = cats.length === 0 ? [
            { label: 'General Support', description: 'Standard inquiries and help.', value: 'General Support', emoji: '💬' },
            { label: 'Player Report', description: 'Report a rule breaker or cheater.', value: 'Player Report', emoji: '⚠️' }
        ] : cats.slice(0, 25).map(c => ({
            label: c.name.substring(0, 100),
            description: c.description ? c.description.substring(0, 100) : 'Open a ticket for this category.',
            value: c.name.substring(0, 100)
        }));

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`tk_sel_player_cat_${scopeValue}`)
            .setPlaceholder('Select a ticket category...')
            .addOptions(options);

        return interaction.update({ content: '🎫 **Support Ticket Setup (Step 2/2):**\nWhat specific category best describes your issue?', components: [new ActionRowBuilder().addComponents(menu)] });
    }

    if (interaction.isStringSelectMenu() && customId.startsWith('tk_sel_player_cat_')) {
        const scopeValue = customId.replace('tk_sel_player_cat_', '');
        const selectedCategory = interaction.values[0];

        const config = await GuildConfig.findOne({ where: { guildId } });
        if (!config || !config.ticketCategoryId) {
            return interaction.update({ content: '❌ **Ticket System Error:** The support ticket system needs to be set up by an admin first!', components: [] });
        }

        const category = interaction.guild.channels.cache.get(config.ticketCategoryId);
        if (!category) {
            return interaction.update({ content: '❌ **Ticket System Error:** The configured ticket category no longer exists.', components: [] });
        }

        let serverContextName = 'General / Discord';
        if (scopeValue.startsWith('scope_server_')) {
            const targetServerId = scopeValue.replace('scope_server_', '');
            const sObj = await GameServer.findByPk(targetServerId);
            if (sObj) serverContextName = sObj.serverName;
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        const hasVipRole = config.ticketVipRoleId && member.roles.cache.has(config.ticketVipRoleId);
        const isPriorityCat = selectedCategory.toLowerCase().includes('priority');
        const isPriority = hasVipRole || isPriorityCat;
        
        const channelPrefix = isPriority ? 'pri' : 'ticket';
        const embedColor = isPriority ? '#e74c3c' : '#2ecc71';
        const icon = isPriority ? '🚨' : '🎫';
        const priorityTag = isPriority ? '\n\n**⭐ PRIORITY STATUS ACTIVE ⭐**' : '';

        const ticketChannel = await interaction.guild.channels.create({
            name: `${channelPrefix}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: interaction.user.id, 
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] },
                ...(config.ticketAdminRoleId ? [{ id: config.ticketAdminRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }] : [])
            ]
        });

        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${icon} ${selectedCategory} — ${interaction.user.tag}`)
            .setDescription(`Welcome <@${interaction.user.id}>!${priorityTag}\n\n**Target Scope:** \`${serverContextName}\`\n**Category:** ${selectedCategory}\n\nPlease describe your issue. An admin or AI assistant will be with you shortly.`)
            .setColor(embedColor)
            .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tk_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('✋'),
            new ButtonBuilder().setCustomId('tk_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        const pingMsg = config.ticketAdminRoleId 
            ? (isPriority ? `🚨 PRIORITY TICKET 🚨 <@&${config.ticketAdminRoleId}> | <@${interaction.user.id}>` : `<@${interaction.user.id}> | <@&${config.ticketAdminRoleId}>`)
            : `<@${interaction.user.id}>`;
        
        await ticketChannel.send({ content: pingMsg, embeds: [ticketEmbed], components: [actionRow] });
        return interaction.update({ content: `✅ Your ticket has been successfully created! Head over to ${ticketChannel}.`, components: [] });
    }

    if (customId === 'tk_claim') {
        const config = await GuildConfig.findOne({ where: { guildId } });
        const isStaff = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || (config?.ticketAdminRoleId && interaction.member.roles.cache.has(config.ticketAdminRoleId));
        
        if (!isStaff) return interaction.reply({ content: '❌ You do not have permission to claim tickets.', flags: 64 });

        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed)
            .setColor('#f1c40f')
            .addFields({ name: '✋ Claimed By', value: `<@${interaction.user.id}> is now handling this ticket.` });

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tk_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        return interaction.update({ embeds: [newEmbed], components: [actionRow] });
    }

    if (customId === 'tk_close') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tk_confirm_close').setLabel('Yes, Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('✅'),
            new ButtonBuilder().setCustomId('tk_cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('❌')
        );
        return interaction.reply({ content: '⚠️ **Are you sure you want to close this ticket?**', components: [row] });
    }

    if (customId === 'tk_cancel_close') {
        return interaction.message.delete().catch(() => {});
    }

    if (customId === 'tk_confirm_close') {
        await interaction.update({ content: '🔒 **Ticket locked.** Generating transcript...', components: [] });
        const config = await GuildConfig.findOne({ where: { guildId } });
        const ticketCreatorId = interaction.channel.topic; 
        
        if (ticketCreatorId) {
            await interaction.channel.permissionOverwrites.edit(ticketCreatorId, { SendMessages: false }).catch(()=>{});
        }

        let messages = await interaction.channel.messages.fetch({ limit: 100 });
        messages = Array.from(messages.values()).reverse(); 

        const logContent = messages.map(m => `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}`).join('\n\n');
        const buffer = Buffer.from(`TICKET TRANSCRIPT: ${interaction.channel.name}\n\n${logContent}`, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: `${interaction.channel.name}-transcript.txt` });

        if (config?.ticketTranscriptChannelId) {
            const logChannel = interaction.guild.channels.cache.get(config.ticketTranscriptChannelId);
            if (logChannel) {
                await logChannel.send({ embeds: [new EmbedBuilder().setTitle('📄 Ticket Transcript').setColor('#95a5a6')], files: [attachment] }).catch(()=>{});
            }
        }

        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
};

adminHandler.renderMainPanel = renderMainPanel;
module.exports = adminHandler;