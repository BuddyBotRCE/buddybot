const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, AutoEventLocation } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); // For grabbing positions

// In-memory session manager
const aeSessions = new Map();

const EVENT_TYPES = {
    hackable: { name: '💻 Hackable Locked Crates', dbPrefix: 'aeHackable' },
    supply: { name: '✈️ Supply Drops', dbPrefix: 'aeSupply' },
    elite: { name: '📦 Elite Crates', dbPrefix: 'aeElite' },
    node: { name: '🪨 Resource Nodes', dbPrefix: 'aeNode' }
};

const autoEventsHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        
        let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- INITIALIZE SESSION ---
        if (!aeSessions.has(guildId)) {
            aeSessions.set(guildId, { selectedEvent: 'hackable', selectedSlot: 1, posX: null, posY: null, posZ: null });
        }
        const session = aeSessions.get(guildId);

        // --- HELPER TO RENDER PANEL ---
        const renderAEPanel = async (inter, messageOverride = '') => {
            let [config] = await GuildConfig.findOrCreate({ where: { guildId } });
            const allLocs = await AutoEventLocation.findAll({ where: { guildId } });
            
            // Generate Live Status Board
            let statusBoard = '';
            for (const [key, data] of Object.entries(EVENT_TYPES)) {
                const isEnabled = config[`${data.dbPrefix}Enabled`];
                const interval = config[`${data.dbPrefix}Interval`] || 60;
                const amount = config[`${data.dbPrefix}Amount`] || 1;
                const slotCount = allLocs.filter(l => l.eventType === key).length;
                statusBoard += `${isEnabled ? '🟢' : '🔴'} **${data.name}:** ${isEnabled ? 'Active' : 'Off'} (${interval}m | x${amount} | ${slotCount} Slots)\n`;
            }

            const activeEvent = EVENT_TYPES[session.selectedEvent];
            const eventLocs = allLocs.filter(l => l.eventType === session.selectedEvent);
            const activeSlotData = eventLocs.find(l => l.slot === session.selectedSlot);

            // Session Coord display (If injected by webhook, or saved in DB)
            const memCoords = (session.posX && session.posY && session.posZ) 
                ? `${session.posX}, ${session.posY}, ${session.posZ}` 
                : 'Pending Webhook...';
            
            const savedCoords = activeSlotData 
                ? `${activeSlotData.posX}, ${activeSlotData.posY}, ${activeSlotData.posZ}` 
                : 'Empty';

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Auto Events Manager')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Automate vanilla Rust events without plugins. Assign up to 10 spawn slots per event type!\n\n**Live Status Board:**\n${statusBoard}\n\n**Currently Editing:** \`${activeEvent.name}\`\n**Editing Slot:** \`${session.selectedSlot}\`\n• Saved Location: \`${savedCoords}\`\n• Unsaved Draft Location: \`${memCoords}\``)
                .setColor('#3498db');

            // ROW 1: Event Type Dropdown
            const row1Event = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_event_select').setPlaceholder(`1. Selected: ${activeEvent.name}`).addOptions(
                    Object.entries(EVENT_TYPES).map(([k, v]) => ({ label: v.name, value: k }))
                )
            );

            // ROW 2: Slot Selection (1-10)
            const slotOptions = [];
            for (let i = 1; i <= 10; i++) {
                const isSet = eventLocs.some(l => l.slot === i);
                slotOptions.push({ label: `Slot ${i} ${isSet ? '(Saved)' : '(Empty)'}`, value: i.toString(), emoji: isSet ? '✅' : '⬛' });
            }
            const row2Slot = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_slot_select').setPlaceholder(`2. Editing Slot ${session.selectedSlot}`).addOptions(slotOptions)
            );

            // ROW 3: Setup Dropdown (Replaces old buttons)
            const row3Setup = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_setup_select').setPlaceholder('⚙️ 3. Configure Event & Position...')
                    .addOptions([
                        { label: 'Set Interval & Amount', description: 'Configure timers and spawn counts for this event', value: 'ae_set_timers', emoji: '⏱️' },
                        { label: 'Enter Manual XYZ', description: 'Type custom coordinates manually instead of grabbing them', value: 'ae_manual_pos', emoji: '✏️' }
                    ])
            );

            // ROW 4: Slot Saving & Deletion Buttons
            const row4SlotMgmt = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_getpos').setLabel('Get Admin Pos').setStyle(ButtonStyle.Primary).setEmoji('📍'),
                new ButtonBuilder().setCustomId('btn_ae_saveslot').setLabel('Save to Slot').setStyle(ButtonStyle.Success).setEmoji('💾'),
                new ButtonBuilder().setCustomId('btn_ae_delslot').setLabel('Clear Slot').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(!activeSlotData)
            );

            // ROW 5: Master Toggle Button
            const isCurrentlyEnabled = config[`${activeEvent.dbPrefix}Enabled`];
            const row5Toggle = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_toggle').setLabel(isCurrentlyEnabled ? 'Disable Event' : 'Enable Event').setStyle(isCurrentlyEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('⚡')
            );

            const payload = { embeds: [embed], components: [row1Event, row2Slot, row3Setup, row4SlotMgmt, row5Toggle], flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        // --- ENTRY FROM ADMIN PANEL ---
        if (customId === 'admin_menu_select' && selectedValue === 'setup_autoevents') {
            return await renderAEPanel(interaction);
        }

        // --- DROPDOWN HANDLERS ---
        if (interaction.isStringSelectMenu()) {
            if (customId === 'ae_event_select') {
                session.selectedEvent = selectedValue;
                session.selectedSlot = 1; // Reset to slot 1 when switching events
                session.posX = null; session.posY = null; session.posZ = null; // Clear unsaved draft
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction);
            }
            if (customId === 'ae_slot_select') {
                session.selectedSlot = parseInt(selectedValue);
                session.posX = null; session.posY = null; session.posZ = null; // Clear unsaved draft
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction);
            }
            
            // NEW: Setup Dropdown Handler
            if (customId === 'ae_setup_select') {
                if (selectedValue === 'ae_set_timers') {
                    const actEvent = EVENT_TYPES[session.selectedEvent];
                    let [config] = await GuildConfig.findOrCreate({ where: { guildId } });
                    const modal = new ModalBuilder().setCustomId('modal_ae_config').setTitle(`Configure ${actEvent.name}`);
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interval').setLabel("Interval (Minutes)").setStyle(TextInputStyle.Short).setValue((config[`${actEvent.dbPrefix}Interval`] || 60).toString()).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Spawn Amount per Interval").setStyle(TextInputStyle.Short).setValue((config[`${actEvent.dbPrefix}Amount`] || 1).toString()).setRequired(true))
                    );
                    return await interaction.showModal(modal);
                }
                if (selectedValue === 'ae_manual_pos') {
                    const modal = new ModalBuilder().setCustomId('modal_ae_pos').setTitle('Set Custom XYZ');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('x').setLabel("X").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('y').setLabel("Y").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('z').setLabel("Z").setStyle(TextInputStyle.Short).setRequired(true))
                    );
                    return await interaction.showModal(modal);
                }
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
                    return await interaction.reply({ content: '❌ You must click **Get Admin Pos** or enter a manual XYZ before saving to this slot!', flags: 64 });
                }
                
                // Save or Update in DB
                const existing = await AutoEventLocation.findOne({ where: { guildId, eventType: session.selectedEvent, slot: session.selectedSlot } });
                if (existing) {
                    await existing.update({ posX: session.posX, posY: session.posY, posZ: session.posZ });
                } else {
                    await AutoEventLocation.create({ guildId, eventType: session.selectedEvent, slot: session.selectedSlot, posX: session.posX, posY: session.posY, posZ: session.posZ });
                }

                session.posX = null; session.posY = null; session.posZ = null; // Clear draft
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction, `✅ Saved coordinates to **Slot ${session.selectedSlot}**!`);
            }

            if (customId === 'btn_ae_delslot') {
                await AutoEventLocation.destroy({ where: { guildId, eventType: session.selectedEvent, slot: session.selectedSlot } });
                return await renderAEPanel(interaction, `🗑️ Cleared data for **Slot ${session.selectedSlot}**.`);
            }

            if (customId === 'btn_ae_toggle') {
                const actEvent = EVENT_TYPES[session.selectedEvent];
                let [config] = await GuildConfig.findOrCreate({ where: { guildId } });
                const newState = !config[`${actEvent.dbPrefix}Enabled`];
                
                await config.update({ [`${actEvent.dbPrefix}Enabled`]: newState });
                return await renderAEPanel(interaction, `⚡ **${actEvent.name}** is now ${newState ? '🟢 ENABLED' : '🔴 DISABLED'}!`);
            }
        }

        // --- MODAL HANDLERS ---
        if (interaction.isModalSubmit()) {
            if (customId === 'modal_ae_pos') {
                session.posX = interaction.fields.getTextInputValue('x').trim();
                session.posY = interaction.fields.getTextInputValue('y').trim();
                session.posZ = interaction.fields.getTextInputValue('z').trim();
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction, `✅ Draft Coordinates Set! Now click **Save to Slot** to lock them in.`);
            }

            if (customId === 'modal_ae_config') {
                const actEvent = EVENT_TYPES[session.selectedEvent];
                const interval = parseInt(interaction.fields.getTextInputValue('interval')) || 60;
                const amount = parseInt(interaction.fields.getTextInputValue('amount')) || 1;
                
                let [config] = await GuildConfig.findOrCreate({ where: { guildId } });
                await config.update({
                    [`${actEvent.dbPrefix}Interval`]: interval,
                    [`${actEvent.dbPrefix}Amount`]: amount
                });
                return await renderAEPanel(interaction, `✅ Timers updated for **${actEvent.name}**!`);
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