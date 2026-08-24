const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { AutoEvent, AutoEventLocation } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

// In-memory session manager
const aeSessions = new Map();

const TYPE_EMOJIS = { hackable: '💻', supply: '✈️', elite: '📦', node: '🪨' };

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
            
            // Build the Live Status Board of ALL created events
            let statusBoard = allEvents.length === 0 ? 'No events created yet.' : '';
            for (const ev of allEvents) {
                const slotCount = await AutoEventLocation.count({ where: { eventId: ev.id } });
                statusBoard += `${ev.isEnabled ? '🟢' : '🔴'} **${ev.name}** [${TYPE_EMOJIS[ev.eventType]}] (${ev.interval}m | x${ev.amount} | ${slotCount} Slots)\n`;
            }

            // Get currently active event profile
            const activeEvent = session.selectedEventId ? await AutoEvent.findByPk(session.selectedEventId) : null;
            const eventLocs = activeEvent ? await AutoEventLocation.findAll({ where: { eventId: activeEvent.id } }) : [];
            const activeSlotData = eventLocs.find(l => l.slot === session.selectedSlot);

            // Draft Coordinates Display
            const memCoords = (session.posX && session.posY && session.posZ) ? `${session.posX}, ${session.posY}, ${session.posZ}` : 'Pending Webhook...';
            const savedCoords = activeSlotData ? `${activeSlotData.posX}, ${activeSlotData.posY}, ${activeSlotData.posZ}` : 'Empty';

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Unlimited Auto Events Engine')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Create limitless custom event profiles. Each profile runs on its own timer and can trigger across 10 custom locations!\n\n**Live Status Board:**\n${statusBoard}`)
                .setColor('#3498db');

            if (activeEvent) {
                embed.addFields({ name: `📝 Currently Editing: ${activeEvent.name}`, value: `• Type: ${TYPE_EMOJIS[activeEvent.eventType]} ${activeEvent.eventType.toUpperCase()}\n• Timers: Every ${activeEvent.interval}m (Spawns ${activeEvent.amount})\n• Slot ${session.selectedSlot}: [Saved: \`${savedCoords}\`] | [Draft: \`${memCoords}\`]` });
            }

            // ROW 1: Event Profile Selection / Creation
            let eventOptions = allEvents.map(e => ({ label: e.name, description: `Edit this ${e.eventType} event`, value: `load_ev_${e.id}`, emoji: TYPE_EMOJIS[e.eventType] }));
            eventOptions.push({ label: '➕ Create New Event Profile', description: 'Make a brand new independent event', value: 'ae_create_new', emoji: '✨' });

            const row1Event = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_event_select').setPlaceholder(activeEvent ? `📂 Loaded: ${activeEvent.name}` : '📂 1. Select or Create an Event Profile...').addOptions(eventOptions.slice(0, 25))
            );

            // If no event is loaded, only render Row 1
            if (!activeEvent) {
                return await inter[inter.replied || inter.deferred ? 'update' : 'reply']({ embeds: [embed], components: [row1Event], flags: 64 });
            }

            // ROW 2: Event Configuration Dropdown (Name, Type, Timers)
            const row2Config = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_config_select').setPlaceholder('⚙️ 2. Configure Event Profile Settings...')
                    .addOptions([
                        { label: 'Rename Event', description: 'Change the display name of this profile', value: 'ae_rename', emoji: '✏️' },
                        { label: 'Set Timers & Amount', description: 'How often it runs and how many spawn', value: 'ae_set_timers', emoji: '⏱️' },
                        { label: 'Change Type: Hackable Crate', value: 'ae_type_hackable', emoji: '💻' },
                        { label: 'Change Type: Supply Drop', value: 'ae_type_supply', emoji: '✈️' },
                        { label: 'Change Type: Elite Crate', value: 'ae_type_elite', emoji: '📦' },
                        { label: 'Change Type: Resource Node', value: 'ae_type_node', emoji: '🪨' }
                    ])
            );

            // ROW 3: Slot Selection (1-10)
            const slotOptions = [];
            for (let i = 1; i <= 10; i++) {
                const isSet = eventLocs.some(l => l.slot === i);
                slotOptions.push({ label: `Slot ${i} ${isSet ? '(Saved)' : '(Empty)'}`, value: i.toString(), emoji: isSet ? '✅' : '⬛' });
            }
            const row3Slot = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_slot_select').setPlaceholder(`🎯 3. Currently Editing Slot ${session.selectedSlot}`).addOptions(slotOptions)
            );

            // ROW 4: Location Setup Buttons
            const row4Pos = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_getpos').setLabel('Get Admin Pos').setStyle(ButtonStyle.Primary).setEmoji('📍'),
                new ButtonBuilder().setCustomId('btn_ae_saveslot').setLabel('Save Location to Slot').setStyle(ButtonStyle.Success).setEmoji('💾'),
                new ButtonBuilder().setCustomId('btn_ae_delslot').setLabel('Clear Slot').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(!activeSlotData)
            );

            // ROW 5: Master Toggles
            const row5Toggle = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_toggle').setLabel(activeEvent.isEnabled ? 'Disable Event' : 'Enable Event').setStyle(activeEvent.isEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('⚡'),
                new ButtonBuilder().setCustomId('btn_ae_delete_event').setLabel('Delete Entire Event Profile').setStyle(ButtonStyle.Danger).setEmoji('💀')
            );

            const payload = { embeds: [embed], components: [row1Event, row2Config, row3Slot, row4Pos, row5Toggle], flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        // --- ENTRY FROM ADMIN PANEL ---
        if (customId === 'admin_menu_select' && selectedValue === 'setup_autoevents') {
            return await renderAEPanel(interaction);
        }

        // --- DROPDOWN HANDLERS ---
        if (interaction.isStringSelectMenu()) {
            
            // 1. EVENT PROFILE SELECTION / CREATION
            if (customId === 'ae_event_select') {
                if (selectedValue === 'ae_create_new') {
                    // Instantly create a new DB profile and load it
                    const newEvent = await AutoEvent.create({ guildId, name: 'New Custom Event' });
                    session.selectedEventId = newEvent.id;
                    session.selectedSlot = 1;
                    session.posX = null; session.posY = null; session.posZ = null;
                    aeSessions.set(guildId, session);
                    return await renderAEPanel(interaction, `✨ New Event created! Configure it below.`);
                } else {
                    session.selectedEventId = parseInt(selectedValue.replace('load_ev_', ''));
                    session.selectedSlot = 1;
                    session.posX = null; session.posY = null; session.posZ = null;
                    aeSessions.set(guildId, session);
                    return await renderAEPanel(interaction);
                }
            }

            // 2. CONFIGURATION MENU
            if (customId === 'ae_config_select') {
                if (selectedValue === 'ae_rename') {
                    const modal = new ModalBuilder().setCustomId('modal_ae_rename').setTitle(`Rename Event Profile`);
                    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('new_name').setLabel("Event Display Name").setStyle(TextInputStyle.Short).setRequired(true)));
                    return await interaction.showModal(modal);
                }
                if (selectedValue === 'ae_set_timers') {
                    const ev = await AutoEvent.findByPk(session.selectedEventId);
                    const modal = new ModalBuilder().setCustomId('modal_ae_timers').setTitle(`Set Timers`);
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interval').setLabel("Interval (Minutes)").setStyle(TextInputStyle.Short).setValue(ev.interval.toString()).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Spawn Amount per Interval").setStyle(TextInputStyle.Short).setValue(ev.amount.toString()).setRequired(true))
                    );
                    return await interaction.showModal(modal);
                }

                // Type Switches
                if (selectedValue.startsWith('ae_type_')) {
                    const newType = selectedValue.replace('ae_type_', '');
                    await AutoEvent.update({ eventType: newType }, { where: { id: session.selectedEventId } });
                    return await renderAEPanel(interaction, `✅ Event type updated to **${newType.toUpperCase()}**!`);
                }
            }

            // 3. SLOT SELECTION
            if (customId === 'ae_slot_select') {
                session.selectedSlot = parseInt(selectedValue);
                session.posX = null; session.posY = null; session.posZ = null;
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction);
            }
        }

        // --- BUTTON HANDLERS ---
        if (interaction.isButton()) {
            if (customId === 'btn_ae_getpos') {
                if (typeof queueAdminPos === 'function') {
                    await queueAdminPos(interaction);
                    return;
                } else return await interaction.reply({ content: '❌ `queueAdminPos` missing.', flags: 64 });
            }

            if (customId === 'btn_ae_saveslot') {
                if (!session.posX || !session.posY || !session.posZ) {
                    return await interaction.reply({ content: '❌ You must click **Get Admin Pos** before saving to this slot!', flags: 64 });
                }
                
                const existing = await AutoEventLocation.findOne({ where: { eventId: session.selectedEventId, slot: session.selectedSlot } });
                if (existing) {
                    await existing.update({ posX: session.posX, posY: session.posY, posZ: session.posZ });
                } else {
                    await AutoEventLocation.create({ guildId, eventId: session.selectedEventId, slot: session.selectedSlot, posX: session.posX, posY: session.posY, posZ: session.posZ });
                }

                session.posX = null; session.posY = null; session.posZ = null; 
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction, `✅ Saved coordinates to **Slot ${session.selectedSlot}**!`);
            }

            if (customId === 'btn_ae_delslot') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId, slot: session.selectedSlot } });
                return await renderAEPanel(interaction, `🗑️ Cleared data for **Slot ${session.selectedSlot}**.`);
            }

            if (customId === 'btn_ae_toggle') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const newState = !ev.isEnabled;
                await ev.update({ isEnabled: newState });
                return await renderAEPanel(interaction, `⚡ Event profile is now ${newState ? '🟢 ENABLED' : '🔴 DISABLED'}!`);
            }

            if (customId === 'btn_ae_delete_event') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId } }); // Wipe slots first
                await AutoEvent.destroy({ where: { id: session.selectedEventId } }); // Wipe profile
                session.selectedEventId = null;
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction, `💀 Event Profile permanently deleted.`);
            }
        }

        // --- MODAL HANDLERS ---
        if (interaction.isModalSubmit()) {
            if (customId === 'modal_ae_rename') {
                const newName = interaction.fields.getTextInputValue('new_name').trim();
                await AutoEvent.update({ name: newName }, { where: { id: session.selectedEventId } });
                return await renderAEPanel(interaction, `✅ Event renamed to **${newName}**!`);
            }

            if (customId === 'modal_ae_timers') {
                const interval = parseInt(interaction.fields.getTextInputValue('interval')) || 60;
                const amount = parseInt(interaction.fields.getTextInputValue('amount')) || 1;
                await AutoEvent.update({ interval, amount }, { where: { id: session.selectedEventId } });
                return await renderAEPanel(interaction, `✅ Timers updated!`);
            }
        }

    } catch (error) {
        console.error('[AUTO EVENTS HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing auto events.', flags: 64 }).catch(() => {});
        }
    }
};

// EXPORT MEMORY SO WEBHOOK CAN INJECT COORDINATES LATER!
autoEventsHandler.aeSessions = aeSessions;

module.exports = autoEventsHandler;