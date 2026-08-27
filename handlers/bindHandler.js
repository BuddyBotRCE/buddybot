const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { CustomBind } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

const bindSessions = new Map();

// 9 Categories for Rust Console Edition Quick-Chat Wheel Options
const CHAT_CATEGORIES = [
    { label: 'Combat', value: 'cat_combat', emoji: '⚔️', description: 'Under attack, retreat, move out, etc.' },
    { label: 'Building', value: 'cat_building', emoji: '🧱', description: 'Walls, beds, door codes, upkeep' },
    { label: 'Activities', value: 'cat_activities', emoji: '⛏️', description: 'Going for wood, stone, scrap, etc.' },
    { label: 'Questions', value: 'cat_questions', emoji: '❓', description: 'Are you friendly, team up, trade' },
    { label: 'Responses', value: 'cat_responses', emoji: '✅', description: 'Yes, no, ok, thank you' },
    { label: 'Orders', value: 'cat_orders', emoji: '👉', description: 'Follow me, repair, wait here' },
    { label: 'Location', value: 'cat_location', emoji: '🧭', description: 'North, south, east, west' },
    { label: 'I Need', value: 'cat_need', emoji: '💎', description: 'I need scrap, fuel, food, wood' },
    { label: 'I Have', value: 'cat_have', emoji: '🎒', description: 'I have scrap, bow, pickaxe' }
];

const CHAT_OPTIONS_MAP = {
    cat_combat: [
        { label: 'We\'re Under Attack', value: 'd11_quick_chat_combat_slot_0', emoji: '⚔️' },
        { label: 'Retreat', value: 'd11_quick_chat_combat_slot_1', emoji: '🏃' },
        { label: 'Move Out', value: 'd11_quick_chat_combat_slot_2', emoji: '🚀' },
        { label: 'Don\'t Shoot', value: 'd11_quick_chat_combat_slot_3', emoji: '🛑' },
        { label: 'Be Careful - Better Armed', value: 'd11_quick_chat_combat_slot_4', emoji: '⚠️' },
        { label: 'I\'m Out of Ammo', value: 'd11_quick_chat_combat_slot_5', emoji: '🔴' },
        { label: 'I\'m Hurt', value: 'd11_quick_chat_combat_slot_6', emoji: '🩸' }
    ],
    cat_building: [
        { label: 'Upgrade Walls', value: 'd11_quick_chat_building_slot_0', emoji: '🧱' },
        { label: 'We Need Beds', value: 'd11_quick_chat_building_slot_1', emoji: '🛏️' },
        { label: 'I Need Building Auth', value: 'd11_quick_chat_building_slot_2', emoji: '🔑' },
        { label: 'What\'s the Door Code?', value: 'd11_quick_chat_building_slot_3', emoji: '🔢' },
        { label: 'Can I Have a Key?', value: 'd11_quick_chat_building_slot_4', emoji: '🗝️' },
        { label: 'We Need a Better Door', value: 'd11_quick_chat_building_slot_5', emoji: '🚪' },
        { label: 'Upkeep Running Low', value: 'd11_quick_chat_building_slot_6', emoji: '⏳' },
        { label: 'Which Chest is Free Game?', value: 'd11_quick_chat_building_slot_7', emoji: '📦' }
    ],
    cat_activities: [
        { label: 'Going for Stone', value: 'd11_quick_chat_activities_slot_0', emoji: '🪨' },
        { label: 'Going for Wood', value: 'd11_quick_chat_activities_slot_1', emoji: '🪵' },
        { label: 'Going for Metal', value: 'd11_quick_chat_activities_slot_2', emoji: '⛏️' },
        { label: 'Going for Food', value: 'd11_quick_chat_activities_slot_3', emoji: '🍖' },
        { label: 'Going for Water', value: 'd11_quick_chat_activities_slot_4', emoji: '💧' },
        { label: 'Going for Scrap', value: 'd11_quick_chat_activities_slot_5', emoji: '⚙️' },
        { label: 'Going for Metal Frags', value: 'd11_quick_chat_activities_slot_6', emoji: '🔩' },
        { label: 'Going for Medicine', value: 'd11_quick_chat_activities_slot_7', emoji: '💉' }
    ],
    cat_questions: [
        { label: 'Are You Friendly?', value: 'd11_quick_chat_questions_slot_0', emoji: '🤝' },
        { label: 'Can I Build Around Here?', value: 'd11_quick_chat_questions_slot_1', emoji: '🏗️' },
        { label: 'Do You Want to Team Up?', value: 'd11_quick_chat_questions_slot_2', emoji: '👥' },
        { label: 'Do You Need Anything?', value: 'd11_quick_chat_questions_slot_3', emoji: '❓' },
        { label: 'Could You Help Me?', value: 'd11_quick_chat_questions_slot_4', emoji: '🆘' },
        { label: 'Want to Trade?', value: 'd11_quick_chat_questions_slot_5', emoji: '🤝' },
        { label: 'Who\'s There?', value: 'd11_quick_chat_questions_slot_6', emoji: '👀' },
        { label: 'Can I Enter?', value: 'd11_quick_chat_questions_slot_7', emoji: '🚪' }
    ],
    cat_responses: [
        { label: 'Yes', value: 'd11_quick_chat_responses_slot_0', emoji: '✅' },
        { label: 'No', value: 'd11_quick_chat_responses_slot_1', emoji: '❌' },
        { label: 'OK', value: 'd11_quick_chat_responses_slot_2', emoji: '👌' },
        { label: 'Thank You', value: 'd11_quick_chat_responses_slot_3', emoji: '🙏' },
        { label: 'No Problem', value: 'd11_quick_chat_responses_slot_4', emoji: '😎' },
        { label: 'Hello', value: 'd11_quick_chat_responses_slot_5', emoji: '👋' },
        { label: 'Goodbye', value: 'd11_quick_chat_responses_slot_6', emoji: '🚶' },
        { label: 'I\'m Sorry', value: 'd11_quick_chat_responses_slot_7', emoji: '🙇' }
    ],
    cat_orders: [
        { label: 'Follow Me', value: 'd11_quick_chat_orders_slot_0', emoji: '👉' },
        { label: 'Go Away', value: 'd11_quick_chat_orders_slot_1', emoji: '🚷' },
        { label: 'Repair This', value: 'd11_quick_chat_orders_slot_2', emoji: '🔨' },
        { label: 'Wait Here', value: 'd11_quick_chat_orders_slot_3', emoji: '✋' },
        { label: 'Come In', value: 'd11_quick_chat_orders_slot_4', emoji: '📥' },
        { label: 'Let\'s Go', value: 'd11_quick_chat_orders_slot_5', emoji: '🏃‍♂️' },
        { label: 'Here, Take This', value: 'd11_quick_chat_orders_slot_6', emoji: '🎁' },
        { label: 'Hurry Up', value: 'd11_quick_chat_orders_slot_7', emoji: '⚡' }
    ],
    cat_location: [
        { label: 'North', value: 'd11_quick_chat_location_slot_0', emoji: '⬆️' },
        { label: 'North East', value: 'd11_quick_chat_location_slot_1', emoji: '↗️' },
        { label: 'East', value: 'd11_quick_chat_location_slot_2', emoji: '➡️' },
        { label: 'South East', value: 'd11_quick_chat_location_slot_3', emoji: '↘️' },
        { label: 'South', value: 'd11_quick_chat_location_slot_4', emoji: '⬇️' },
        { label: 'South West', value: 'd11_quick_chat_location_slot_5', emoji: '↙️' },
        { label: 'West', value: 'd11_quick_chat_location_slot_6', emoji: '⬅️' },
        { label: 'North West', value: 'd11_quick_chat_location_slot_7', emoji: '↖️' }
    ],
    cat_need: [
        { label: 'I Need Scrap', value: 'd11_quick_chat_need_slot_0', emoji: '⚙️' },
        { label: 'I Need Low Grade Fuel', value: 'd11_quick_chat_need_slot_1', emoji: '⛽' },
        { label: 'I Need Food', value: 'd11_quick_chat_need_slot_2', emoji: '🍖' },
        { label: 'I Need Water', value: 'd11_quick_chat_need_slot_3', emoji: '💧' },
        { label: 'I Need Wood', value: 'd11_quick_chat_need_slot_4', emoji: '🪵' },
        { label: 'I Need Stones', value: 'd11_quick_chat_need_slot_5', emoji: '🪨' },
        { label: 'I Need Metal Fragments', value: 'd11_quick_chat_need_slot_6', emoji: '🔩' },
        { label: 'I Need High Quality Metal', value: 'd11_quick_chat_need_slot_7', emoji: '🛡️' }
    ],
    cat_have: [
        { label: 'I Have Scrap', value: 'd11_quick_chat_have_slot_0', emoji: '⚙️' },
        { label: 'I Have Low Grade Fuel', value: 'd11_quick_chat_have_slot_1', emoji: '⛽' },
        { label: 'I Have Food', value: 'd11_quick_chat_have_slot_2', emoji: '🍖' },
        { label: 'I Have Water', value: 'd11_quick_chat_have_slot_3', emoji: '💧' },
        { label: 'I Have Hunting Bow', value: 'd11_quick_chat_have_slot_4', emoji: '🏹' },
        { label: 'I Have Pickaxe', value: 'd11_quick_chat_have_slot_5', emoji: '⛏️' },
        { label: 'I Have Hatchet', value: 'd11_quick_chat_have_slot_6', emoji: '🪓' },
        { label: 'I Have High Quality Metal', value: 'd11_quick_chat_have_slot_7', emoji: '🛡️' }
    ]
};

const buildPanelPayload = async (guildId, messageOverride = '') => {
    if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: null, view: 'main', selectedCategory: null });
    const session = bindSessions.get(guildId);
    
    const allBinds = await CustomBind.findAll({ where: { guildId }, order: [['id', 'ASC']] });
    let components = [];
    
    const embed = new EmbedBuilder().setColor('#3498db').setTitle('🗣️ Custom Binds & Console Quick-Chat Manager');
    if (messageOverride) embed.setDescription(`**${messageOverride}**\n\n`);

    if (session.view === 'main') {
        let bindList = '';
        for (const b of allBinds) {
            const typeEmoji = b.actionType === 'kit' ? '📦' : b.actionType === 'teleport' ? '🌀' : '♻️';
            bindList += `${typeEmoji} **${b.name}** — Type: \`${b.actionType.toUpperCase()}\`\n`;
        }

        embed.addFields(
            { name: '📋 Configured Custom Binds', value: bindList || "*No custom binds created yet.*", inline: false },
            { name: '🛠️ Create New Bind', value: "👇 **Click a button below to choose your bind type:**", inline: false }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_create_kit').setLabel('New Kit Bind').setStyle(ButtonStyle.Primary).setEmoji('📦'),
            new ButtonBuilder().setCustomId('bind_create_teleport').setLabel('New Teleport').setStyle(ButtonStyle.Success).setEmoji('🌀'),
            new ButtonBuilder().setCustomId('bind_create_recycler').setLabel('New Recycler').setStyle(ButtonStyle.Secondary).setEmoji('♻️')
        ));

        if (allBinds.length > 0) {
            const selectOptions = allBinds.slice(0, 25).map(b => ({
                label: b.name.substring(0, 100),
                description: `Type: ${b.actionType.toUpperCase()} | Cost: ${b.cost || 0} Scrap`,
                value: `editbind_${b.id}`,
                emoji: b.actionType === 'kit' ? '📦' : b.actionType === 'teleport' ? '🌀' : '♻️'
            }));

            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('bind_manage_select')
                    .setPlaceholder('🛠️ Select a bind to Edit or Delete...')
                    .addOptions(selectOptions)
            ));
        }
    } 
    else if (session.view === 'bind') {
        const activeBind = await CustomBind.findByPk(session.selectedBindId);
        if (!activeBind) {
            session.view = 'main';
            return await buildPanelPayload(guildId, '❌ Bind not found.');
        }

        let posText = '*Not Set*';
        if (activeBind.command && (activeBind.actionType === 'teleport' || activeBind.actionType === 'recycler')) {
            const matches = activeBind.command.match(/-?\d+(\.\d+)?/g);
            if (matches && matches.length >= 3) {
                const len = matches.length;
                posText = `\`X: ${matches[len-3]}, Y: ${matches[len-2]}, Z: ${matches[len-1]}\``;
            }
        }

        const roleDisplay = activeBind.roleId ? `<@&${activeBind.roleId}>` : '`None`';

        embed.setTitle(`🗣️ Managing Bind: ${activeBind.name} (${activeBind.actionType.toUpperCase()})`);
        
        embed.addFields(
            { name: `📊 Settings & Requirements`, value: `**Quick-Chat Wheel:** ${activeBind.emote || 'Not Set'}\n**Type:** ${activeBind.actionType}\n**Target Kit:** ${activeBind.targetValue || 'N/A'}\n**Coordinates:** ${posText}`, inline: true },
            { name: `🛡️ Economy & Security`, value: `**Cost:** ${activeBind.cost || 0} Scrap\n**Cooldown:** ${activeBind.cooldown || 0}s\n**Required Role:** ${roleDisplay}`, inline: true }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_btn_name').setLabel('Rename').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('bind_btn_emote').setLabel('Quick-Chat').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
            new ButtonBuilder().setCustomId('bind_btn_economy').setLabel('Cost & CD').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
            new ButtonBuilder().setCustomId('bind_btn_role').setLabel('Required Role').setStyle(ButtonStyle.Secondary).setEmoji('🛡️')
        ));

        if (activeBind.actionType === 'kit') {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bind_btn_kitselect').setLabel('Select In-Game Kit').setStyle(ButtonStyle.Success).setEmoji('📦')
            ));
        } else if (activeBind.actionType === 'teleport' || activeBind.actionType === 'recycler') {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bind_btn_getpos').setLabel('Set Position (Auto-Capture)').setStyle(ButtonStyle.Success).setEmoji('📍'),
                new ButtonBuilder().setCustomId('bind_btn_ground').setLabel('Place on Ground').setStyle(ButtonStyle.Secondary).setEmoji('⬇️')
            ));
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_btn_delete').setLabel('Delete Bind').setStyle(ButtonStyle.Danger).setEmoji('💀'),
            new ButtonBuilder().setCustomId('bind_btn_back').setLabel('Back to List').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }
    else if (session.view === 'emote_category') {
        embed.setTitle('💬 Select Quick-Chat Category').setDescription('Choose a category to view its quick-chat wheel commands.');
        
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('bind_do_category').setPlaceholder('Select chat category...')
                .addOptions(CHAT_CATEGORIES)
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_back_bind').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }
    else if (session.view === 'emote_picker') {
        const cat = session.selectedCategory || 'cat_combat';
        const options = CHAT_OPTIONS_MAP[cat] || CHAT_OPTIONS_MAP.cat_combat;

        embed.setTitle('💬 Select Quick-Chat Phrase').setDescription('Choose the exact phrase that triggers this bind in-game.');
        
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('bind_do_emote').setPlaceholder('Select phrase...').addOptions(options)
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_back_category').setLabel('Back to Categories').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }
    else if (session.view === 'role_picker') {
        embed.setTitle('🛡️ Set Required Role').setDescription('Select the Discord Role required to use this Custom Bind. If they do not have this role, they cannot trigger it.');

        components.push(new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder().setCustomId('bind_do_role').setPlaceholder('Select a required Discord Role...')
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_clear_role').setLabel('Clear Role Requirement').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
            new ButtonBuilder().setCustomId('bind_back_bind').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }

    return { embeds: [embed], components, flags: 64 };
};

async function safeRespond(interaction, payload) {
    try {
        if (interaction.isModalSubmit() || interaction.isMessageComponent()) {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(payload);
            } else {
                await interaction.update(payload);
            }
        } else {
            await interaction.reply(payload);
        }
    } catch (err) {
        console.error("[CUSTOM BINDS] Failed to update UI:", err);
    }
}

const bindHandler = async (interaction, client) => {
    try {
        const member = interaction.member;
        const isOwner = interaction.guild?.ownerId === member.id;
        const isAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdminRole = member.roles.cache.some(role => 
            role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('owner') ||
            role.name.toLowerCase().includes('manager') || role.name.toLowerCase().includes('mod')
        );

        if (!isOwner && !isAdminPerm && !hasAdminRole) {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                return await interaction.reply({ content: '❌ **Access Denied.**', flags: 64 });
            }
            return;
        }

        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;

        if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: null, view: 'main' });
        const session = bindSessions.get(guildId);

        const renderBindPanel = async (inter, messageOverride = '') => {
            const payload = await buildPanelPayload(guildId, messageOverride);
            await safeRespond(inter, payload);
        };

        if (customId === 'admin_menu_select' || customId === 'setup_binds') {
            session.view = 'main';
            return await renderBindPanel(interaction);
        }

        if (customId.startsWith('bind_create_')) {
            const type = customId.replace('bind_create_', '');
            const newBind = await CustomBind.create({ 
                guildId, 
                name: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Bind`, 
                actionType: type, 
                emote: 'Not Set', 
                cost: 0,
                cooldown: 0
            });
            session.selectedBindId = newBind.id;
            session.view = 'bind';
            return await renderBindPanel(interaction, `✨ Created new ${type} bind!`);
        }

        if (customId === 'bind_manage_select' && interaction.isStringSelectMenu()) {
            const selectedVal = interaction.values[0];
            session.selectedBindId = parseInt(selectedVal.replace('editbind_', ''));
            session.view = 'bind';
            return await renderBindPanel(interaction);
        }

        if (customId === 'bind_do_category' && interaction.isStringSelectMenu()) {
            session.selectedCategory = interaction.values[0];
            session.view = 'emote_picker';
            return await renderBindPanel(interaction);
        }

        if (customId === 'bind_do_emote' && interaction.isStringSelectMenu()) {
            const cat = session.selectedCategory || 'cat_combat';
            const options = CHAT_OPTIONS_MAP[cat] || [];
            const wheelOption = options.find(o => o.value === interaction.values[0]);
            
            const emote = wheelOption ? `${wheelOption.emoji} ${wheelOption.label}` : interaction.values[0];
            const targetPhrase = wheelOption ? wheelOption.value : interaction.values[0];
            
            await CustomBind.update({ emote, targetValue: targetPhrase }, { where: { id: session.selectedBindId } });
            session.view = 'bind';
            return await renderBindPanel(interaction, `💬 Quick-chat wheel trigger updated!`);
        }

        if (customId === 'bind_do_role' && interaction.isRoleSelectMenu()) {
            const roleId = interaction.values[0];
            await CustomBind.update({ roleId }, { where: { id: session.selectedBindId } });
            session.view = 'bind';
            return await renderBindPanel(interaction, `🛡️ Required Role updated successfully!`);
        }

        if (interaction.isModalSubmit()) {
            if (customId === 'bind_modal_name') {
                const name = interaction.fields.getTextInputValue('b_name').trim() || "Custom Bind";
                if (session.selectedBindId) {
                    await CustomBind.update({ name }, { where: { id: session.selectedBindId } });
                }
                return await renderBindPanel(interaction, `✅ Bind renamed successfully!`);
            }

            if (customId === 'modal_bind_kit') {
                const kitName = interaction.fields.getTextInputValue('kit_name').trim();
                const command = `kit.give "{player}" "${kitName}"`;
                if (session.selectedBindId) {
                    await CustomBind.update({ targetValue: kitName, command }, { where: { id: session.selectedBindId } });
                }
                return await renderBindPanel(interaction, `📦 Successfully bound to kit: **${kitName}**!`);
            }

            if (customId === 'bind_modal_economy') {
                let cost = parseInt(interaction.fields.getTextInputValue('b_cost'));
                let cooldown = parseInt(interaction.fields.getTextInputValue('b_cd'));
                
                if (isNaN(cost) || cost < 0) cost = 0;
                if (isNaN(cooldown) || cooldown < 0) cooldown = 0;

                if (session.selectedBindId) {
                    await CustomBind.update({ cost, cooldown }, { where: { id: session.selectedBindId } });
                }
                return await renderBindPanel(interaction, `⚙️ Cost and Cooldown saved!`);
            }
        }

        if (interaction.isButton()) {

            if (customId === 'bind_btn_back' || customId === 'bind_back_bind') {
                session.view = 'bind';
                if (customId === 'bind_btn_back') session.selectedBindId = null;
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_back_category') {
                session.view = 'emote_category';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_emote') {
                session.view = 'emote_category';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_kitselect') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('modal_bind_kit').setTitle(`Bind to Kit`);
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('kit_name').setLabel("Exact Kit Name (e.g. vip, starter)").setStyle(TextInputStyle.Short).setValue(b.targetValue || '').setRequired(true)
                ));
                return await interaction.showModal(modal);
            }
            
            if (customId === 'bind_btn_role') {
                session.view = 'role_picker';
                return await renderBindPanel(interaction);
            }
            
            if (customId === 'bind_clear_role') {
                await CustomBind.update({ roleId: null }, { where: { id: session.selectedBindId } });
                session.view = 'bind';
                return await renderBindPanel(interaction, `🗑️ Role requirement cleared!`);
            }

            if (customId === 'bind_btn_name') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('bind_modal_name').setTitle(`Rename Bind`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_name').setLabel("Bind Name").setStyle(TextInputStyle.Short).setValue(b.name || '').setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_economy') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('bind_modal_economy').setTitle(`Configure Economy`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cost').setLabel("Scrap Cost (0 for free)").setStyle(TextInputStyle.Short).setValue((b.cost || 0).toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cd').setLabel("Cooldown in Seconds").setStyle(TextInputStyle.Short).setValue((b.cooldown || 0).toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_getpos') {
                const loadingPayload = await buildPanelPayload(guildId, '⏳ **Extracting your position from the server...**');
                await interaction.update(loadingPayload);
                await queueAdminPos(interaction, 'custom_bind', session.selectedBindId);
                return;
            }

            if (customId === 'bind_btn_ground') {
                const bind = await CustomBind.findByPk(session.selectedBindId);
                
                if (!bind || !bind.command) {
                    return await renderBindPanel(interaction, `❌ **Please click 'Set Position' first!**`);
                }

                const matches = bind.command.match(/-?\d+(\.\d+)?/g);
                if (!matches || matches.length < 3) {
                    return await renderBindPanel(interaction, `❌ **Could not read coordinates from saved command! Please Set Position again.**`);
                }

                const len = matches.length;
                const cX = matches[len-3];
                const cY = parseFloat(matches[len-2]);
                const cZ = matches[len-1];

                const loweredY = (cY - 0.5).toFixed(2);
                
                let newCommand = '';
                if (bind.actionType === 'teleport') {
                    newCommand = `global.teleportpos (${cX},${loweredY},${cZ}) "{player}"`;
                } else if (bind.actionType === 'recycler') {
                    newCommand = `spawn recycler_static (${cX},${loweredY},${cZ})`;
                }
                
                await CustomBind.update({ command: newCommand }, { where: { id: session.selectedBindId } });
                session.view = 'bind';
                return await renderBindPanel(interaction, `⬇️ **Placed on Ground!** (Lowered Y-axis from ${cY} to ${loweredY})`);
            }

            if (customId === 'bind_btn_delete') {
                await CustomBind.destroy({ where: { id: session.selectedBindId } });
                session.selectedBindId = null;
                session.view = 'main';
                return await renderBindPanel(interaction, `💀 Bind successfully deleted.`);
            }
        }

    } catch (error) {
        console.error('[CUSTOM BINDS ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Error processing Custom Binds action.', flags: 64 }).catch(()=>{});
        }
    }
};

bindHandler.refreshPanelViaInteraction = async (interaction, messageOverride, bindId = null) => {
    try {
        const guildId = interaction.guild.id;
        if (bindId) {
            if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: bindId, view: 'bind', selectedCategory: null });
            const session = bindSessions.get(guildId);
            session.selectedBindId = bindId;
            session.view = 'bind';
            bindSessions.set(guildId, session);
        }

        const payload = await buildPanelPayload(guildId, messageOverride);
        await interaction.editReply(payload).catch(() => {});
    } catch (e) {
        console.error("Failed to live-refresh Bind panel:", e);
    }
};

module.exports = bindHandler;