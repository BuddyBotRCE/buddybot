const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { CustomBind, ServerKit } = require('../database/db');
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
        { label: 'We\'re Under Attack', value: 'combat_under_attack', emoji: '⚔️' },
        { label: 'Retreat', value: 'combat_retreat', emoji: '🏃' },
        { label: 'Move Out', value: 'combat_move_out', emoji: '🚀' },
        { label: 'Don\'t Shoot', value: 'combat_dont_shoot', emoji: '🛑' },
        { label: 'Be Careful - Better Armed', value: 'combat_better_armed', emoji: '⚠️' },
        { label: 'I\'m Out of Ammo', value: 'combat_out_of_ammo', emoji: '🔴' },
        { label: 'I\'m Hurt', value: 'combat_hurt', emoji: '🩸' }
    ],
    cat_building: [
        { label: 'Upgrade Walls', value: 'build_upgrade_walls', emoji: '🧱' },
        { label: 'We Need Beds', value: 'build_need_beds', emoji: '🛏️' },
        { label: 'I Need Building Auth', value: 'build_need_tc', emoji: '🔑' },
        { label: 'What\'s the Door Code?', value: 'build_door_code', emoji: '🔢' },
        { label: 'Can I Have a Key?', value: 'build_have_key', emoji: '🗝️' },
        { label: 'We Need a Better Door', value: 'build_better_door', emoji: '🚪' },
        { label: 'Upkeep Running Low', value: 'build_upkeep_low', emoji: '⏳' },
        { label: 'Which Chest is Free Game?', value: 'build_free_chest', emoji: '📦' }
    ],
    cat_activities: [
        { label: 'Going for Stone', value: 'act_stone', emoji: '🪨' },
        { label: 'Going for Wood', value: 'act_wood', emoji: '🪵' },
        { label: 'Going for Metal', value: 'act_metal', emoji: '⛏️' },
        { label: 'Going for Food', value: 'act_food', emoji: '🍖' },
        { label: 'Going for Water', value: 'act_water', emoji: '💧' },
        { label: 'Going for Scrap', value: 'act_scrap', emoji: '⚙️' },
        { label: 'Going for Metal Frags', value: 'act_frags', emoji: '🔩' },
        { label: 'Going for Medicine', value: 'act_meds', emoji: '💉' }
    ],
    cat_questions: [
        { label: 'Are You Friendly?', value: 'q_friendly', emoji: '🤝' },
        { label: 'Can I Build Around Here?', value: 'q_build_here', emoji: '🏗️' },
        { label: 'Do You Want to Team Up?', value: 'q_team_up', emoji: '👥' },
        { label: 'Do You Need Anything?', value: 'q_need_anything', emoji: '❓' },
        { label: 'Could You Help Me?', value: 'q_help_me', emoji: '🆘' },
        { label: 'Want to Trade?', value: 'q_trade', emoji: '🤝' },
        { label: 'Who\'s There?', value: 'q_whos_there', emoji: '👀' },
        { label: 'Can I Enter?', value: 'q_can_enter', emoji: '🚪' }
    ],
    cat_responses: [
        { label: 'Yes', value: 'resp_yes', emoji: '✅' },
        { label: 'No', value: 'resp_no', emoji: '❌' },
        { label: 'OK', value: 'resp_ok', emoji: '👌' },
        { label: 'Thank You', value: 'resp_thanks', emoji: '🙏' },
        { label: 'No Problem', value: 'resp_no_problem', emoji: '😎' },
        { label: 'Hello', value: 'resp_hello', emoji: '👋' },
        { label: 'Goodbye', value: 'resp_goodbye', emoji: '🚶' },
        { label: 'I\'m Sorry', value: 'resp_sorry', emoji: '🙇' }
    ],
    cat_orders: [
        { label: 'Follow Me', value: 'order_follow', emoji: '👉' },
        { label: 'Go Away', value: 'order_go_away', emoji: '🚷' },
        { label: 'Repair This', value: 'order_repair', emoji: '🔨' },
        { label: 'Wait Here', value: 'order_wait', emoji: '✋' },
        { label: 'Come In', value: 'order_come_in', emoji: '📥' },
        { label: 'Let\'s Go', value: 'order_lets_go', emoji: '🏃‍♂️' },
        { label: 'Here, Take This', value: 'order_take_this', emoji: '🎁' },
        { label: 'Hurry Up', value: 'order_hurry', emoji: '⚡' }
    ],
    cat_location: [
        { label: 'North', value: 'loc_north', emoji: '⬆️' },
        { label: 'North East', value: 'loc_northeast', emoji: '↗️' },
        { label: 'East', value: 'loc_east', emoji: '➡️' },
        { label: 'South East', value: 'loc_southeast', emoji: '↘️' },
        { label: 'South', value: 'loc_south', emoji: '⬇️' },
        { label: 'South West', value: 'loc_southwest', emoji: '↙️' },
        { label: 'West', value: 'loc_west', emoji: '⬅️' },
        { label: 'North West', value: 'loc_northwest', emoji: '↖️' }
    ],
    cat_need: [
        { label: 'I Need Scrap', value: 'need_scrap', emoji: '⚙️' },
        { label: 'I Need Low Grade Fuel', value: 'need_fuel', emoji: '⛽' },
        { label: 'I Need Food', value: 'need_food', emoji: '🍖' },
        { label: 'I Need Water', value: 'need_water', emoji: '💧' },
        { label: 'I Need Wood', value: 'need_wood', emoji: '🪵' },
        { label: 'I Need Stones', value: 'need_stones', emoji: '🪨' },
        { label: 'I Need Metal Fragments', value: 'need_frags', emoji: '🔩' },
        { label: 'I Need High Quality Metal', value: 'need_hqm', emoji: '🛡️' }
    ],
    cat_have: [
        { label: 'I Have Scrap', value: 'have_scrap', emoji: '⚙️' },
        { label: 'I Have Low Grade Fuel', value: 'have_fuel', emoji: '⛽' },
        { label: 'I Have Food', value: 'have_food', emoji: '🍖' },
        { label: 'I Have Water', value: 'have_water', emoji: '💧' },
        { label: 'I Have Hunting Bow', value: 'have_bow', emoji: '🏹' },
        { label: 'I Have Pickaxe', value: 'have_pickaxe', emoji: '⛏️' },
        { label: 'I Have Hatchet', value: 'have_hatchet', emoji: '🪓' },
        { label: 'I Have High Quality Metal', value: 'have_hqm', emoji: '🛡️' }
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
            bindList += `${typeEmoji} **${b.name}** [Type: *${b.actionType.toUpperCase()}*] | Wheel: \`${b.emote || 'None'}\` | Cost: ${b.cost || 0} Scrap\n`;
        }

        embed.addFields(
            { name: '📋 Configured Custom Binds', value: bindList || "*No custom binds created yet.*", inline: false },
            { name: '🛠️ Create New Bind', value: "👇 **Click a button below to choose your bind type:**", inline: false }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_create_kit').setLabel('Kit Bind').setStyle(ButtonStyle.Primary).setEmoji('📦'),
            new ButtonBuilder().setCustomId('bind_create_teleport').setLabel('Teleport Bind').setStyle(ButtonStyle.Success).setEmoji('🌀'),
            new ButtonBuilder().setCustomId('bind_create_recycler').setLabel('Recycler Bind').setStyle(ButtonStyle.Secondary).setEmoji('♻️')
        ));

        if (allBinds.length > 0) {
            const row2 = new ActionRowBuilder();
            for (const b of allBinds.slice(0, 4)) {
                row2.addComponents(new ButtonBuilder().setCustomId(`bind_load_${b.id}`).setLabel(b.name.substring(0, 20)).setStyle(ButtonStyle.Secondary).setEmoji('⭐'));
            }
            components.push(row2);
        }
    } 
    else if (session.view === 'bind') {
        const activeBind = await CustomBind.findByPk(session.selectedBindId);
        if (!activeBind) {
            session.view = 'main';
            return await buildPanelPayload(guildId, '❌ Bind not found.');
        }

        const posText = (activeBind.posX && activeBind.posZ) ? `\`X: ${activeBind.posX}, Y: ${activeBind.posY || '0'}, Z: ${activeBind.posZ}\`` : '*Not Set*';

        embed.setTitle(`🗣️ Managing Bind: ${activeBind.name} (${activeBind.actionType.toUpperCase()})`);
        
        embed.addFields(
            { name: `📊 Settings & Requirements`, value: `**Quick-Chat Wheel:** ${activeBind.emote || 'Not Set'}\n**Type:** ${activeBind.actionType}\n**Target Kit:** ${activeBind.targetValue || 'N/A'}\n**Coordinates:** ${posText}`, inline: true },
            { name: `🛡️ Economy & Security`, value: `**Cost:** ${activeBind.cost || 0} Scrap\n**Cooldown:** ${activeBind.cooldown || 0}s\n**Required Role ID:** \`${activeBind.roleId || 'None'}\``, inline: true }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_btn_name').setLabel('Rename').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('bind_btn_emote').setLabel('Quick-Chat Wheel').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
            new ButtonBuilder().setCustomId('bind_btn_options').setLabel('Cost, CD & Role').setStyle(ButtonStyle.Primary).setEmoji('⚙️')
        ));

        if (activeBind.actionType === 'kit') {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bind_btn_kitselect').setLabel('Select In-Game Kit').setStyle(ButtonStyle.Success).setEmoji('📦')
            ));
        } else if (activeBind.actionType === 'teleport' || activeBind.actionType === 'recycler') {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bind_btn_getpos').setLabel('Set Position (Auto-Capture)').setStyle(ButtonStyle.Success).setEmoji('📍')
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
    else if (session.view === 'kit_picker') {
        embed.setTitle('📦 Select In-Game Kit').setDescription('Choose which kit this bind will grant to players.');
        const serverKits = await ServerKit.findAll({ where: { guildId } });

        if (serverKits.length > 0) {
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_do_kit').setPlaceholder('Select a server kit...')
                    .addOptions(serverKits.slice(0, 25).map(k => ({ label: k.kitName, value: k.kitName, emoji: '📦' })))
            ));
        } else {
            embed.addFields({ name: '⚠️ No Kits Found', value: 'Please create kits in your kit manager first.' });
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_back_bind').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }

    return { embeds: [embed], components, flags: 64 };
};

async function safeRespond(interaction, payload) {
    try {
        if (interaction.isModalSubmit() || interaction.isMessageComponent()) {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(payload);
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
            
            await CustomBind.update({ emote, targetValue: interaction.values[0] }, { where: { id: session.selectedBindId } });
            session.view = 'bind';
            return await renderBindPanel(interaction, `💬 Quick-chat wheel trigger updated!`);
        }

        if (customId === 'bind_do_kit' && interaction.isStringSelectMenu()) {
            const kitName = interaction.values[0];
            const command = `kit "{player}" "${kitName}"`;
            await CustomBind.update({ targetValue: kitName, command }, { where: { id: session.selectedBindId } });
            session.view = 'bind';
            return await renderBindPanel(interaction, `📦 Bound to kit: **${kitName}**!`);
        }

        if (interaction.isModalSubmit()) {
            if (customId === 'modal_bind_name') {
                const name = interaction.fields.getTextInputValue('b_name').trim() || "Custom Bind";
                if (session.selectedBindId) {
                    await CustomBind.update({ name }, { where: { id: session.selectedBindId } });
                }
                return await renderBindPanel(interaction, `✅ Bind renamed successfully!`);
            }

            if (customId === 'modal_bind_options') {
                let cost = parseInt(interaction.fields.getTextInputValue('b_cost'));
                let cooldown = parseInt(interaction.fields.getTextInputValue('b_cd'));
                let roleId = interaction.fields.getTextInputValue('b_role').trim() || null;
                if (isNaN(cost) || cost < 0) cost = 0;
                if (isNaN(cooldown) || cooldown < 0) cooldown = 0;
                if (roleId === '' || roleId.toLowerCase() === 'none') roleId = null;

                if (session.selectedBindId) {
                    await CustomBind.update({ cost, cooldown, roleId }, { where: { id: session.selectedBindId } });
                }
                return await renderBindPanel(interaction, `⚙️ Options (Cost, Cooldown, Role) saved!`);
            }
        }

        if (interaction.isButton()) {
            if (customId.startsWith('bind_load_')) {
                session.selectedBindId = parseInt(customId.replace('bind_load_', ''));
                session.view = 'bind';
                return await renderBindPanel(interaction);
            }

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
                session.view = 'kit_picker';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_name') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('modal_bind_name').setTitle(`Rename Bind`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_name').setLabel("Bind Name").setStyle(TextInputStyle.Short).setValue(b.name || '').setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_options') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('modal_bind_options').setTitle(`Configure Costs & Security`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cost').setLabel("Scrap Cost (0 for free)").setStyle(TextInputStyle.Short).setValue((b.cost || 0).toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cd').setLabel("Cooldown in Seconds").setStyle(TextInputStyle.Short).setValue((b.cooldown || 0).toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_role').setLabel("Required Discord Role ID (leave blank)").setStyle(TextInputStyle.Short).setValue(b.roleId || '').setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_getpos') {
                const loadingPayload = await buildPanelPayload(guildId, '⏳ **Extracting your position from the server...**');
                await interaction.update(loadingPayload);
                // 👈 FIX: THIS IS NOW SET TO 'custom_bind' (WAS 'custom_zone')
                await queueAdminPos(interaction, 'custom_bind', session.selectedBindId);
                return;
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

bindHandler.autoSavePosition = async (guildId, x, y, z, bindId) => {
    if (!bindId) return;
    const bind = await CustomBind.findByPk(bindId);
    if (!bind) return;

    let command = '';
    if (bind.actionType === 'teleport') {
        command = `teleportpos "{player}" "${x},${y},${z}"`;
    } else if (bind.actionType === 'recycler') {
        command = `spawn recycler_static "${x},${y},${z}"`;
    }

    await CustomBind.update({ posX: x, posY: y, posZ: z, command }, { where: { id: bindId } });
};

bindHandler.refreshPanelViaInteraction = async (interaction, messageOverride, bindId = null) => {
    try {
        const guildId = interaction.guild.id;
        if (bindId) {
            if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: bindId, view: 'bind' });
            const session = bindSessions.get(guildId);
            session.selectedBindId = bindId;
            session.view = 'bind';
            bindSessions.set(guildId, session);
        }

        const payload = await buildPanelPayload(guildId, messageOverride);
        if (interaction.isRepliable()) {
            await interaction.editReply(payload);
        }
    } catch (e) {
        console.error("Failed to live-refresh Bind panel:", e);
    }
};

module.exports = bindHandler;