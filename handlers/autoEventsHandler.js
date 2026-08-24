const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { AutoEvent, AutoEventLocation } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

// In-memory session manager
const aeSessions = new Map();

// Simplified Event Type Cycler
const TYPE_ARRAY = ['hackable', 'supply', 'elite', 'node'];
const TYPE_INFO = { 
    hackable: { name: 'Hackable Crates', emoji: '💻' }, 
    supply: { name: 'Supply Drops', emoji: '✈️' }, 
    elite: { name: 'Elite Crates', emoji: '📦' }, 
    node: { name: 'Resource Nodes', emoji: '🪨' } 
};

const autoEventsHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        
        let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- INITIALIZE SESSION ---
        if (!aeSessions.has(guildId)) {
            aeSessions.set(guildId, { selectedEventId: null, selectedSlot: 1, posX: null, posY: null, posZ: null });
        }
        const session = aeSessions.get(guildId);

        // --- HELPER TO RENDER PANEL ---
        const renderAEPanel = async (inter, messageOverride = '') => {
            const allEvents = await AutoEvent.findAll({ where: { guildId } });
            
            // Build the Live Status Board
            let statusBoard = allEvents.length === 0 ? '*No auto-events created yet.*' : '';
            for (const ev of allEvents) {
                const slotCount = await AutoEventLocation.count({ where: { eventId: ev.id } });
                const tInfo = TYPE_INFO[ev.eventType];
                statusBoard += `${ev.isEnabled ? '🟢' : '🔴'} **${ev.name}** [${tInfo.emoji}] (${ev.interval}m | x${ev.amount} | ${slotCount} Slots)\n`;
            }

            const activeEvent = session.selectedEventId ? await AutoEvent.findByPk(session.selectedEventId) : null;
            const eventLocs = activeEvent ? await AutoEventLocation.findAll({ where: { eventId: activeEvent.id } }) : [];
            const activeSlotData = eventLocs.find(l => l.slot === session.selectedSlot);

            // Draft Coordinates Display
            const memCoords = (session.posX && session.posY && session.posZ) ? `${session.posX}, ${session.posY}, ${session.posZ}` : 'Pending Webhook...';
            const savedCoords = activeSlotData ? `${activeSlotData.posX}, ${activeSlotData.posY}, ${activeSlotData.posZ}` : 'Empty';

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Auto Events Engine')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Manage your automated server events below.\n\n**Live Status Board:**\n${statusBoard}`)
                .setColor('#3498db');

            if (activeEvent) {
                embed.addFields({ 
                    name: `📝 Currently Editing: ${activeEvent.name}`, 
                    value: `• **Type:** ${TYPE_INFO[activeEvent.eventType].emoji} ${TYPE_INFO[activeEvent.eventType].name}\n• **Timers:** Every ${activeEvent.interval}m (Spawns ${activeEvent.amount})\n• **Slot ${session.selectedSlot}:** [Saved: \`${savedCoords}\`] | [Draft: \`${memCoords}\`]` 
                });
            }

            // ROW 1: Event Profile Selection
            let eventOptions = allEvents.map(e => ({ label: e.name, description: `Edit this ${TYPE_INFO[e.eventType].name} event`, value: `load_ev_${e.id}`, emoji: TYPE_INFO[e.eventType].emoji }));
            eventOptions.push({ label: '➕ Create New Event Profile', description: 'Make a brand new independent event', value: 'ae_create_new', emoji: '✨' });

            const row1Event = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_event_select').setPlaceholder(activeEvent ? `📂 Loaded: ${activeEvent.name}` : '📂 1. Select or Create an Event...').addOptions(eventOptions.slice(0, 25))
            );

            if (!activeEvent) {
                return await inter[inter.replied || inter.deferred ? 'update' : 'reply']({ embeds: [embed], components: [row1Event], flags: 64 });
            }

            // ROW 2: Direct Setup Buttons (Replaced the confusing dropdown!)
            const row2Config = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_edit_settings').setLabel('Edit Name & Timers').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_ae_cycle_type').setLabel(`Type: ${TYPE_INFO[activeEvent.eventType].name}`).setStyle(ButtonStyle.Secondary).setEmoji('🔄')
            );

            // ROW 3: Slot Selection
            const slotOptions = [];
            for (let i = 1; i <= 10; i++) {
                const isSet = eventLocs.some(l => l.slot === i);
                slotOptions.push({ label: `Slot ${i} ${isSet ? '(Saved)' : '(Empty)'}`, value: i.toString(), emoji: isSet ? '✅' : '⬛' });
            }
            const row3Slot = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_slot_select').setPlaceholder(`🎯 Currently Editing Slot ${session.selectedSlot}`).addOptions(slotOptions)
            );

            // ROW 4: Position Controls
            const row4Pos = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_getpos').setLabel('Get Admin Pos').setStyle(ButtonStyle.Primary).setEmoji('📍'),
                new ButtonBuilder().setCustomId('btn_ae_saveslot').setLabel('Save Location to Slot').setStyle(ButtonStyle.Success).setEmoji('💾'),
                new ButtonBuilder().setCustomId('btn_ae_delslot').setLabel('Clear Slot').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(!activeSlotData)
            );

            // ROW 5: Master Controls
            const row5Toggle = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_toggle').setLabel(activeEvent.isEnabled ? 'Disable Event' : 'Enable Event').setStyle(activeEvent.isEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('⚡'),
                new ButtonBuilder().setCustomId('btn_ae_delete_event').setLabel('Delete Event').setStyle(ButtonStyle.Danger).setEmoji('💀')
            );

            const payload = { embeds: [embed], components: [row1Event, row2Config, row3Slot, row4Pos, row5Toggle], flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        // --- ENTRY ROUTER ---
        if (customId === 'admin_menu_select' && selectedValue === 'setup_autoevents') {
            return await renderAEPanel(interaction);
        }

        // --- DROPDOWN HANDLERS ---
        if (interaction.isStringSelectMenu()) {
            if (customId === 'ae_event_select') {
                if (selectedValue === 'ae_create_new') {
                    const newEvent = await AutoEvent.create({ guildId, name: 'New Auto Event' });
                    session.selectedEventId = newEvent.id;
                    session.selectedSlot = 1;
                    session.posX = null; session.posY = null; session.posZ = null;
                    aeSessions.set(guildId, session);
                    return await renderAEPanel(interaction, `✨ Created a new event! Setup the details below.`);
                } else {
                    session.selectedEventId = parseInt(selectedValue.replace('load_ev_', ''));
                    session.selectedSlot = 1;
                    session.posX = null; session.posY = null; session.posZ = null;
                    aeSessions.set(guildId, session);
                    return await renderAEPanel(interaction);
                }
            }

            if (customId === 'ae_slot_select') {
                session.selectedSlot = parseInt(selectedValue);
                session.posX = null; session.posY = null; session.posZ = null;
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction);
            }
        }

        // --- BUTTON HANDLERS ---
        if (interaction.isButton()) {
            
            // 🔄 CYCLE EVENT TYPE BUTTON (One-click toggle through types!)
            if (customId === 'btn_ae_cycle_type') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                let currentIndex = TYPE_ARRAY.indexOf(ev.eventType);
                let nextIndex = (currentIndex + 1) % TYPE_ARRAY.length;
                await ev.update({ eventType: TYPE_ARRAY[nextIndex] });
                return await renderAEPanel(interaction, `✅ Event type changed to **${TYPE_INFO[TYPE_ARRAY[nextIndex]].name}**!`);
            }

            // ✏️ EDIT NAME & TIMERS BUTTON
            if (customId === 'btn_ae_edit_settings') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const modal = new ModalBuilder().setCustomId('modal_ae_settings').setTitle(`Event Settings`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_name').setLabel("Event Display Name").setStyle(TextInputStyle.Short).setValue(ev.name).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interval').setLabel("Interval (Minutes)").setStyle(TextInputStyle.Short).setValue(ev.interval.toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Spawn Amount per Interval").setStyle(TextInputStyle.Short).setValue(ev.amount.toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            // 📍 GET POS BUTTON
            if (customId === 'btn_ae_getpos') {
                if (typeof queueAdminPos === 'function') {
                    await queueAdminPos(interaction);
                    return;
                } else return await interaction.reply({ content: '❌ `queueAdminPos` missing.', flags: 64 });
            }

            // 💾 SAVE SLOT
            if (customId === 'btn_ae_saveslot') {
                if (!session.posX || !session.posY || !session.posZ) return await interaction.reply({ content: '❌ You must click **Get Admin Pos** before saving!', flags: 64 });
                
                const existing = await AutoEventLocation.findOne({ where: { eventId: session.selectedEventId, slot: session.selectedSlot } });
                if (existing) await existing.update({ posX: session.posX, posY: session.posY, posZ: session.posZ });
                else await AutoEventLocation.create({ guildId, eventId: session.selectedEventId, slot: session.selectedSlot, posX: session.posX, posY: session.posY, posZ: session.posZ });

                session.posX = null; session.posY = null; session.posZ = null; 
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction, `✅ Saved coordinates to **Slot ${session.selectedSlot}**!`);
            }

            // 🗑️ CLEAR SLOT
            if (customId === 'btn_ae_delslot') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId, slot: session.selectedSlot } });
                return await renderAEPanel(interaction, `🗑️ Cleared data for **Slot ${session.selectedSlot}**.`);
            }

            // ⚡ TOGGLE ENABLE
            if (customId === 'btn_ae_toggle') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                await ev.update({ isEnabled: !ev.isEnabled });
                return await renderAEPanel(interaction, `⚡ Event profile is now ${!ev.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}!`);
            }

            // 💀 DELETE EVENT
            if (customId === 'btn_ae_delete_event') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId } }); 
                await AutoEvent.destroy({ where: { id: session.selectedEventId } }); 
                session.selectedEventId = null;
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction, `💀 Event Profile permanently deleted.`);
            }
        }

        // --- MODAL HANDLERS ---
        if (interaction.isModalSubmit() && customId === 'modal_ae_settings') {
            const newName = interaction.fields.getTextInputValue('ev_name').trim();
            const interval = parseInt(interaction.fields.getTextInputValue('interval')) || 60;
            const amount = parseInt(interaction.fields.getTextInputValue('amount')) || 1;
            
            await AutoEvent.update({ name: newName, interval, amount }, { where: { id: session.selectedEventId } });
            return await renderAEPanel(interaction, `✅ Event Settings updated!`);
        }

    } catch (error) {
        console.error('[AUTO EVENTS HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing auto events.', flags: 64 }).catch(() => {});
        }
    }
};

autoEventsHandler.aeSessions = aeSessions;
module.exports = autoEventsHandler;