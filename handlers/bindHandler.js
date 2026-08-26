const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { CustomBind, ServerKit } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

const bindSessions = new Map();

// Complete Categorized Rust Console Edition Quick-Chat Wheel Options
const RUST_CONSOLE_QUICK_CHAT_OPTIONS = [
    // --- CATEGORY 1: COMBAT ---
    { label: '[Combat] We\'re Under Attack', value: 'combat_under_attack', emoji: '⚔️', description: 'Combat category' },
    { label: '[Combat] Retreat', value: 'combat_retreat', emoji: '🏃', description: 'Combat category' },
    { label: '[Combat] Move Out', value: 'combat_move_out', emoji: '🚀', description: 'Combat category' },
    { label: '[Combat] Don\'t Shoot', value: 'combat_dont_shoot', emoji: '🛑', description: 'Combat category' },
    { label: '[Combat] Be Careful - Better Armed', value: 'combat_better_armed', emoji: '⚠️', description: 'Combat category' },
    { label: '[Combat] I\'m Out of Ammo', value: 'combat_out_of_ammo', emoji: '🔴', description: 'Combat category' },
    { label: '[Combat] I\'m Hurt', value: 'combat_hurt', emoji: '🩸', description: 'Combat category' },

    // --- CATEGORY 2: BUILDING ---
    { label: '[Building] Upgrade Walls', value: 'build_upgrade_walls', emoji: '🧱', description: 'Building category' },
    { label: '[Building] We Need Beds', value: 'build_need_beds', emoji: '🛏️', description: 'Building category' },
    { label: '[Building] I Need Building Auth', value: 'build_need_tc', emoji: '🔑', description: 'Building category' },
    { label: '[Building] What\'s the Door Code?', value: 'build_door_code', emoji: '🔢', description: 'Building category' },
    { label: '[Building] Can I Have a Key?', value: 'build_have_key', emoji: '🗝️', description: 'Building category' },
    { label: '[Building] We Need a Better Door', value: 'build_better_door', emoji: '🚪', description: 'Building category' },
    { label: '[Building] Upkeep Running Low', value: 'build_upkeep_low', emoji: '⏳', description: 'Building category' },
    { label: '[Building] Which Chest is Free Game?', value: 'build_free_chest', emoji: '📦', description: 'Building category' },

    // --- CATEGORY 3: ACTIVITIES ---
    { label: '[Activity] Going for Stone', value: 'act_stone', emoji: '🪨', description: 'Activities category' },
    { label: '[Activity] Going for Wood', value: 'act_wood', emoji: '🪵', description: 'Activities category' },
    { label: '[Activity] Going for Metal', value: 'act_metal', emoji: '⛏️', description: 'Activities category' },
    { label: '[Activity] Going for Food', value: 'act_food', emoji: '🍖', description: 'Activities category' },
    { label: '[Activity] Going for Water', value: 'act_water', emoji: '💧', description: 'Activities category' },
    { label: '[Activity] Going for Scrap', value: 'act_scrap', emoji: '⚙️', description: 'Activities category' },
    { label: '[Activity] Going for Metal Frags', value: 'act_frags', emoji: '🔩', description: 'Activities category' },
    { label: '[Activity] Going for Medicine', value: 'act_meds', emoji: '💉', description: 'Activities category' },

    // --- CATEGORY 4: QUESTIONS ---
    { label: '[Question] Are You Friendly?', value: 'q_friendly', emoji: '🤝', description: 'Questions category' },
    { label: '[Question] Can I Build Around Here?', value: 'q_build_here', emoji: '🏗️', description: 'Questions category' },
    { label: '[Question] Do You Want to Team Up?', value: 'q_team_up', emoji: '👥', description: 'Questions category' },
    { label: '[Question] Do You Need Anything?', value: 'q_need_anything', emoji: '❓', description: 'Questions category' },
    { label: '[Question] Could You Help Me?', value: 'q_help_me', emoji: '🆘', description: 'Questions category' },
    { label: '[Question] Want to Trade?', value: 'q_trade', emoji: '🤝', description: 'Questions category' },
    { label: '[Question] Who\'s There?', value: 'q_whos_there', emoji: '👀', description: 'Questions category' },
    { label: '[Question] Can I Enter?', value: 'q_can_enter', emoji: '🚪', description: 'Questions category' },

    // --- CATEGORY 5: RESPONSES ---
    { label: '[Response] Yes', value: 'resp_yes', emoji: '✅', description: 'Responses category' },
    { label: '[Response] No', value: 'resp_no', emoji: '❌', description: 'Responses category' },
    { label: '[Response] OK', value: 'resp_ok', emoji: '👌', description: 'Responses category' },
    { label: '[Response] Thank You', value: 'resp_thanks', emoji: '🙏', description: 'Responses category' },
    { label: '[Response] No Problem', value: 'resp_no_problem', emoji: '😎', description: 'Responses category' },
    { label: '[Response] Hello', value: 'resp_hello', emoji: '👋', description: 'Responses category' },
    { label: '[Response] Goodbye', value: 'resp_goodbye', emoji: '🚶', description: 'Responses category' },
    { label: '[Response] I\'m Sorry', value: 'resp_sorry', emoji: '🙇', description: 'Responses category' },

    // --- CATEGORY 6: ORDERS ---
    { label: '[Order] Follow Me', value: 'order_follow', emoji: '👉', description: 'Orders category' },
    { label: '[Order] Go Away', value: 'order_go_away', emoji: '🚷', description: 'Orders category' },
    { label: '[Order] Repair This', value: 'order_repair', emoji: '🔨', description: 'Orders category' },
    { label: '[Order] Wait Here', value: 'order_wait', emoji: '✋', description: 'Orders category' },
    { label: '[Order] Come In', value: 'order_come_in', emoji: '📥', description: 'Orders category' },
    { label: '[Order] Let\'s Go', value: 'order_lets_go', emoji: '🏃‍♂️', description: 'Orders category' },
    { label: '[Order] Here, Take This', value: 'order_take_this', emoji: '🎁', description: 'Orders category' },
    { label: '[Order] Hurry Up', value: 'order_hurry', emoji: '⚡', description: 'Orders category' },

    // --- CATEGORY 7: LOCATION ---
    { label: '[Location] North', value: 'loc_north', emoji: '⬆️', description: 'Location category' },
    { label: '[Location] North East', value: 'loc_northeast', emoji: '↗️', description: 'Location category' },
    { label: '[Location] East', value: 'loc_east', emoji: '➡️', description: 'Location category' },
    { label: '[Location] South East', value: 'loc_southeast', emoji: '↘️', description: 'Location category' },
    { label: '[Location] South', value: 'loc_south', emoji: '⬇️', description: 'Location category' },
    { label: '[Location] South West', value: 'loc_southwest', emoji: '↙️', description: 'Location category' },
    { label: '[Location] West', value: 'loc_west', emoji: '⬅️', description: 'Location category' },
    { label: '[Location] North West', value: 'loc_northwest', emoji: '↖️', description: 'Location category' },

    // --- CATEGORY 8: I NEED ---
    { label: '[Need] Scrap', value: 'need_scrap', emoji: '⚙️', description: 'I Need category' },
    { label: '[Need] Low Grade Fuel', value: 'need_fuel', emoji: '⛽', description: 'I Need category' },
    { label: '[Need] Food', value: 'need_food', emoji: '🍖', description: 'I Need category' },
    { label: '[Need] Water', value: 'need_water', emoji: '💧', description: 'I Need category' },
    { label: '[Need] Wood', value: 'need_wood', emoji: '🪵', description: 'I Need category' },
    { label: '[Need] Stones', value: 'need_stones', emoji: '🪨', description: 'I Need category' },
    { label: '[Need] Metal Fragments', value: 'need_frags', emoji: '🔩', description: 'I Need category' },
    { label: '[Need] High Quality Metal', value: 'need_hqm', emoji: '🛡️', description: 'I Need category' },

    // --- CATEGORY 9: I HAVE ---
    { label: '[Have] Scrap', value: 'have_scrap', emoji: '⚙️', description: 'I Have category' },
    { label: '[Have] Low Grade Fuel', value: 'have_fuel', emoji: '⛽', description: 'I Have category' },
    { label: '[Have] Food', value: 'have_food', emoji: '🍖', description: 'I Have category' },
    { label: '[Have] Water', value: 'have_water', emoji: '💧', description: 'I Have category' },
    { label: '[Have] Hunting Bow', value: 'have_bow', emoji: '🏹', description: 'I Have category' },
    { label: '[Have] Pickaxe', value: 'have_pickaxe', emoji: '⛏️', description: 'I Have category' },
    { label: '[Have] Hatchet', value: 'have_hatchet', emoji: '🪓', description: 'I Have category' },
    { label: '[Have] High Quality Metal', value: 'have_hqm', emoji: '🛡️', description: 'I Have category' }
];

const buildPanelPayload = async (guildId, messageOverride = '') => {
    if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: null, view: 'main' });
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
    else if (session.view === 'emote_picker') {
        embed.setTitle('💬 Select Console Quick-Chat Wheel Option').setDescription('Choose which authentic console wheel option triggers this command (Discord allows up to 25 choices per menu).');
        
        // Discord Select Menus have a max of 25 options. We slice the first 25 so it loads safely!
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('bind_do_emote').setPlaceholder('Select radial wheel option...').addOptions(RUST_CONSOLE_QUICK_CHAT_OPTIONS.slice(0, 25))
        ));

        // If you have more than 25, we can include a second row if needed, but 25 covers a massive chunk cleanly.
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_back_bind').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
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

        if (customId === 'bind_do_emote' && interaction.isStringSelectMenu()) {
            const wheelOption = RUST_CONSOLE_QUICK_CHAT_OPTIONS.find(o => o.value === interaction.values[0]);
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

            if (customId === 'bind_btn_emote') {
                session.view = 'emote_picker';
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
                // Fix: Pointing to custom_bind instead of custom_zone
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