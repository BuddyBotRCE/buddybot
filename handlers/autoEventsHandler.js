const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { AutoEvent, AutoEventLocation } = require('../database/db');
const { sendRconCommand, queueAdminPos } = require('../utils/rconManager'); 

const aeSessions = new Map();

const TYPE_INFO = { 
    hackable: { name: 'Timed Crates', emoji: '💻', prefab: 'codelockedhackablecrate' }, 
    supply: { name: 'Supply Drops', emoji: '✈️', prefab: 'supply_drop' }, 
    elite: { name: 'Elite Crates', emoji: '📦', prefab: 'crate_elite' }, 
    node: { name: 'Resource Nodes', emoji: '🪨', prefab: 'stone-ore' },
    cargo: { name: 'Docked Cargo', emoji: '🚢', prefab: 'cargoshipdynamic1' }
};

const buildPanelPayload = async (guildId, messageOverride = '') => {
    if (!aeSessions.has(guildId)) aeSessions.set(guildId, { selectedEventId: null, view: 'main' });
    const session = aeSessions.get(guildId);
    const allEvents = await AutoEvent.findAll({ where: { guildId } });
    let components = [];
    
    const embed = new EmbedBuilder().setColor('#3498db').setTitle('⚙️ Auto Events Manager');
    if (messageOverride) embed.setDescription(`**${messageOverride}**\n\n`);

    if (session.view === 'main') {
        let activeList = '';
        let inactiveList = '';

        if (allEvents.length === 0) {
            embed.addFields({ name: '📋 Configured Events', value: '*No auto events created yet. Click "Create New Event" below to get started!*' });
        } else {
            for (const ev of allEvents) {
                const info = TYPE_INFO[ev.eventType] || { emoji: '⚙️', name: ev.eventType };
                const text = `${info.emoji} **${ev.name}** — Type: \`${info.name}\` | Interval: \`${ev.interval || 60}m\` | Qty: \`${ev.amount}\`\n`;
                if (ev.isEnabled) activeList += text;
                else inactiveList += text;
            }
            if (activeList) embed.addFields({ name: '🟢 Active Events', value: activeList, inline: false });
            if (inactiveList) embed.addFields({ name: '🔴 Inactive / Disabled Events', value: inactiveList, inline: false });
        }

        embed.addFields({ name: '🛠️ Controls', value: '👇 **Select an event to configure, or create a new one.**' });

        const selectOptions = allEvents.length > 0 
            ? allEvents.slice(0, 25).map(ev => ({ label: ev.name.substring(0, 100), description: `Type: ${TYPE_INFO[ev.eventType]?.name || ev.eventType} | Every ${ev.interval}m`, value: `ae_select_${ev.id}`, emoji: TYPE_INFO[ev.eventType]?.emoji || '⚙️' }))
            : [{ label: 'No events created yet', value: 'none', emoji: '❌' }];

        const rowSelect = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ae_menu_manage_select')
                .setPlaceholder('⚙️ Select an event to configure / manage...')
                .setDisabled(allEvents.length === 0)
                .addOptions(selectOptions)
        );

        const rowActions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ae_btn_create_prompt').setLabel('Create New Event').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );

        components.push(rowSelect, rowActions);
    } 
    else if (session.view === 'create_type_select') {
        embed.addFields({ name: '➕ Step 1: Select Event Type', value: 'Choose which type of game event you want to create an instance for:' });

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ae_do_create_type')
                .setPlaceholder('Select event category...')
                .addOptions(Object.keys(TYPE_INFO).map(k => ({ label: TYPE_INFO[k].name, value: k, emoji: TYPE_INFO[k].emoji })))
        );

        const rowBack = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ae_btn_back').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );
        components.push(row, rowBack);
    }
    else if (session.view === 'event') {
        const activeEvent = await AutoEvent.findByPk(session.selectedEventId);
        if (!activeEvent) {
            session.view = 'main';
            return await buildPanelPayload(guildId, '❌ Event not found.');
        }

        const eventLocs = await AutoEventLocation.findAll({ where: { eventId: activeEvent.id }, order: [['slot', 'ASC']] });
        const typeData = TYPE_INFO[activeEvent.eventType] || { emoji: '⚙️', name: activeEvent.eventType };

        embed.setTitle(`${typeData.emoji} Managing: ${activeEvent.name}`);
        
        let locList = eventLocs.length > 0 
            ? eventLocs.map((l, i) => `**${i + 1}.** \`${l.posX}, ${l.posY}, ${l.posZ}\``).join('\n') 
            : '*No positions saved. Click "Add Player Pos" below.*';

        embed.addFields(
            { name: `📊 Event Details`, value: `**Type:** ${typeData.name}\n**Quantity per Trigger:** Spawns ${activeEvent.amount}\n**Timer Interval:** Every **${activeEvent.interval || 60} minutes**\n**Status:** ${activeEvent.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}` },
            { name: `📍 Saved Spawn Locations`, value: locList }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ae_btn_settings').setLabel('Name, Qty & Timer').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('ae_btn_toggle_status').setLabel(activeEvent.isEnabled ? 'Disable Event' : 'Enable Event').setStyle(activeEvent.isEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(activeEvent.isEnabled ? '🔴' : '🟢'),
            new ButtonBuilder().setCustomId('ae_btn_getpos').setLabel('Add Player Pos').setStyle(ButtonStyle.Success).setEmoji('📍'),
            new ButtonBuilder().setCustomId('ae_btn_undopos').setLabel('Clear Last Pos').setStyle(ButtonStyle.Secondary).setEmoji('⏪').setDisabled(eventLocs.length === 0)
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ae_btn_test').setLabel('Test Event').setStyle(ButtonStyle.Primary).setEmoji('🚀').setDisabled(eventLocs.length === 0),
            new ButtonBuilder().setCustomId('ae_btn_delete_single').setLabel('Delete Event').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
            new ButtonBuilder().setCustomId('ae_btn_back').setLabel('Back to Main Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }

    return { embeds: [embed], components, flags: 64 };
};

async function safeRespond(interaction, payload) {
    try {
        if (interaction.isModalSubmit() || interaction.isMessageComponent()) {
            await interaction.update(payload);
        } else {
            await interaction.reply(payload);
        }
    } catch (err) {
        console.error("[AUTO EVENTS] Failed to update UI:", err);
    }
}

const autoEventsHandler = async (interaction, client) => {
    try {
        const member = interaction.member;
        const isOwner = interaction.guild?.ownerId === member.id;
        const isAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdminRole = member.roles.cache.some(role => 
            role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('owner') || role.name.toLowerCase().includes('mod')
        );

        if (!isOwner && !isAdminPerm && !hasAdminRole) {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                return await interaction.reply({ content: '❌ **Access Denied.**', flags: 64 });
            }
            return;
        }

        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;

        if (!aeSessions.has(guildId)) aeSessions.set(guildId, { selectedEventId: null, view: 'main' });
        const session = aeSessions.get(guildId);

        const renderAEPanel = async (inter, messageOverride = '') => {
            const payload = await buildPanelPayload(guildId, messageOverride);
            await safeRespond(inter, payload);
        };

        if (customId === 'admin_menu_select') {
            session.view = 'main';
            return await renderAEPanel(interaction);
        }

        if (interaction.isModalSubmit() && customId === 'modal_ae_settings') {
            const newName = interaction.fields.getTextInputValue('ev_name').trim() || "Custom Event";
            let amount = parseInt(interaction.fields.getTextInputValue('ev_qty')) || 1;
            let interval = parseInt(interaction.fields.getTextInputValue('ev_interval')) || 60;
            if (isNaN(amount) || amount < 1) amount = 1;
            if (isNaN(interval) || interval < 1) interval = 60;

            if (session.selectedEventId) {
                await AutoEvent.update({ name: newName, amount, interval }, { where: { id: session.selectedEventId } });
            }
            return await renderAEPanel(interaction, `✅ Event Settings saved successfully!`);
        }

        if (interaction.isStringSelectMenu()) {
            const value = interaction.values[0];

            if (customId === 'ae_menu_manage_select') {
                session.selectedEventId = value.replace('ae_select_', '');
                session.view = 'event';
                return await renderAEPanel(interaction);
            }

            if (customId === 'ae_do_create_type') {
                session.pendingTypeKey = value;
                const modal = new ModalBuilder().setCustomId('modal_ae_create_instance').setTitle('Create New Event');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_name').setLabel("Event Name").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_qty').setLabel("Quantity to Spawn").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_interval').setLabel("Timer Interval (in Minutes)").setStyle(TextInputStyle.Short).setValue('60').setRequired(true))
                );
                return await interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit() && customId === 'modal_ae_create_instance') {
            const typeKey = session.pendingTypeKey || 'hackable';
            const name = interaction.fields.getTextInputValue('ev_name').trim() || 'Custom Event';
            let amount = parseInt(interaction.fields.getTextInputValue('ev_qty')) || 1;
            let interval = parseInt(interaction.fields.getTextInputValue('ev_interval')) || 60;
            if (isNaN(amount) || amount < 1) amount = 1;
            if (isNaN(interval) || interval < 1) interval = 60;

            const newEv = await AutoEvent.create({ guildId, name, eventType: typeKey, amount, interval, isEnabled: false });

            session.selectedEventId = newEv.id;
            session.view = 'event';
            return await renderAEPanel(interaction, `✅ Created **${name}** successfully! Add spawn coordinates below.`);
        }

        if (interaction.isButton()) {
            if (customId === 'ae_btn_create_prompt') {
                session.view = 'create_type_select';
                return await renderAEPanel(interaction);
            }
            if (customId === 'ae_btn_back' || customId === 'ae_btn_cancel') {
                session.selectedEventId = null;
                session.view = 'main';
                return await renderAEPanel(interaction);
            }
            if (customId === 'ae_btn_toggle_status') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                if (ev) await ev.update({ isEnabled: !ev.isEnabled });
                return await renderAEPanel(interaction, `⚡ Updated status for **${ev?.name}**!`);
            }
            if (customId === 'ae_btn_delete_single') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                if (ev) {
                    await AutoEventLocation.destroy({ where: { eventId: ev.id } });
                    await ev.destroy();
                }
                session.selectedEventId = null;
                session.view = 'main';
                return await renderAEPanel(interaction, `🗑️ Successfully deleted event.`);
            }
            if (customId === 'ae_btn_settings') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const modal = new ModalBuilder().setCustomId('modal_ae_settings').setTitle(`Edit Event Settings`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_name').setLabel("Event Name").setStyle(TextInputStyle.Short).setValue(ev?.name || 'Custom Event').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_qty').setLabel("Quantity to Spawn").setStyle(TextInputStyle.Short).setValue((ev?.amount || 1).toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_interval').setLabel("Clock Interval (in Minutes)").setStyle(TextInputStyle.Short).setValue((ev?.interval || 60).toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            // === POSITION LOGIC KEPT EXACTLY THE SAME - JUST USING ev.id ===
            if (customId === 'ae_btn_undopos') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                if (ev) {
                    const highestSlot = await AutoEventLocation.findOne({ where: { eventId: ev.id }, order: [['slot', 'DESC']] });
                    if (highestSlot) await highestSlot.destroy();
                }
                return await renderAEPanel(interaction, `⏪ Removed the last saved position.`);
            }

            if (customId === 'ae_btn_getpos') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const loadingPayload = await buildPanelPayload(guildId, '⏳ **Extracting your position from the server...**');
                await interaction.update(loadingPayload);
                await queueAdminPos(interaction, 'auto_event', ev.id);
                return;
            }

            if (customId === 'ae_btn_test') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const locs = await AutoEventLocation.findAll({ where: { eventId: ev.id } });
                const prefab = TYPE_INFO[ev.eventType].prefab;
                
                let fired = 0;
                for (let i = 0; i < (ev.amount || 1); i++) {
                    for (const loc of locs) {
                        try {
                            await sendRconCommand(guildId, `spawn ${prefab} "${loc.posX},${loc.posY},${loc.posZ}"`);
                            fired++;
                        } catch (e) {}
                    }
                }
                return await renderAEPanel(interaction, `🚀 Sent **${fired}** spawn commands to the server!`);
            }
        }

    } catch (error) {
        console.error('[AUTO EVENTS ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Error processing auto events action.', flags: 64 }).catch(()=>{});
        }
    }
};

// === LOCATION SAVER KEPT EXACTLY THE SAME ===
autoEventsHandler.autoSaveLocation = async (guildId, x, y, z, eventId) => {
    if (!eventId) return;

    const highestSlot = await AutoEventLocation.findOne({ where: { eventId: eventId }, order: [['slot', 'DESC']] });
    const nextSlotNum = highestSlot ? highestSlot.slot + 1 : 1;

    await AutoEventLocation.create({
        guildId,
        eventId: eventId,
        slot: nextSlotNum,
        posX: x.toString(),
        posY: y.toString(),
        posZ: z.toString()
    });
};

autoEventsHandler.refreshPanelViaInteraction = async (interaction, messageOverride) => {
    try {
        const payload = await buildPanelPayload(interaction.guild.id, messageOverride);
        await interaction.editReply(payload);
    } catch (e) {
        console.error("Failed to live-refresh panel:", e);
    }
};

module.exports = autoEventsHandler;