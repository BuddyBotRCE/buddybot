const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { AutoEvent, AutoEventLocation } = require('../database/db');
const { sendRconCommand, queueAdminPos } = require('../utils/rconManager'); 

const aeSessions = new Map();

const TYPE_INFO = { 
    hackable: { name: 'Hackable Crates', emoji: '💻', prefab: 'codelockedhackablecrate' }, 
    supply: { name: 'Supply Drops', emoji: '✈️', prefab: 'supply_drop' }, 
    elite: { name: 'Elite Crates', emoji: '📦', prefab: 'crate_elite' }, 
    node: { name: 'Resource Nodes', emoji: '🪨', prefab: 'stone-ore' } 
};

const autoEventsHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        
        let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- INITIALIZE SESSION ---
        if (!aeSessions.has(guildId)) {
            aeSessions.set(guildId, { selectedEventId: null });
        }
        const session = aeSessions.get(guildId);

        // --- HELPER TO RENDER PANEL ---
        const renderAEPanel = async (inter, messageOverride = '') => {
            const allEvents = await AutoEvent.findAll({ where: { guildId }, order: [['id', 'ASC']] });
            
            let statusBoard = allEvents.length === 0 ? '*No auto-events created yet.*' : '';
            for (const ev of allEvents) {
                const locCount = await AutoEventLocation.count({ where: { eventId: ev.id } });
                statusBoard += `${ev.isEnabled ? '🟢' : '🔴'} **${ev.name}** [${TYPE_INFO[ev.eventType].emoji}] (${ev.interval}m | x${ev.amount} | 📍 ${locCount} Locs)\n`;
            }

            const activeEvent = session.selectedEventId ? await AutoEvent.findByPk(session.selectedEventId) : null;
            const eventLocs = activeEvent ? await AutoEventLocation.findAll({ where: { eventId: activeEvent.id }, order: [['slot', 'ASC']] }) : [];

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Auto Events Engine')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Follow the steps below to setup custom automated events.\n\n**Live Status Board:**\n${statusBoard}`)
                .setColor('#3498db');

            if (activeEvent) {
                let locList = eventLocs.length > 0 
                    ? eventLocs.map((l, i) => `**${i + 1}.** \`${l.posX}, ${l.posY}, ${l.posZ}\``).join('\n') 
                    : '*No positions saved yet. Click "Get Admin Pos" in-game to auto-add one!*';

                embed.addFields({ 
                    name: `📝 Editing Profile: ${activeEvent.name}`, 
                    value: `• **Event Type:** ${TYPE_INFO[activeEvent.eventType].emoji} ${TYPE_INFO[activeEvent.eventType].name}\n• **Quantity:** Spawns ${activeEvent.amount} at a time\n• **Timer:** Every ${activeEvent.interval} minutes\n\n**📍 Saved Spawn Locations:**\n${locList}` 
                });
            }

            let eventOptions = allEvents.map(e => ({ label: e.name, description: `Edit this ${TYPE_INFO[e.eventType].name} event`, value: `load_ev_${e.id}`, emoji: TYPE_INFO[e.eventType].emoji }));
            eventOptions.push({ label: '➕ Create New Event Profile', description: 'Make a brand new independent event', value: 'ae_create_new', emoji: '✨' });

            const row1Event = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_event_select').setPlaceholder(activeEvent ? `📂 Loaded: ${activeEvent.name}` : '📂 1. Select or Create an Event...').addOptions(eventOptions.slice(0, 25))
            );

            if (!activeEvent) {
                return await inter[inter.replied || inter.deferred ? 'update' : 'reply']({ embeds: [embed], components: [row1Event], flags: 64 });
            }

            const row2Type = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_type_select').setPlaceholder(`🎯 2. Selected Type: ${TYPE_INFO[activeEvent.eventType].name}`)
                    .addOptions(Object.keys(TYPE_INFO).map(k => ({ label: TYPE_INFO[k].name, value: `set_type_${k}`, emoji: TYPE_INFO[k].emoji })))
            );

            const row3Setup = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_edit_settings').setLabel('3. Set Name, Quantity & Time').setStyle(ButtonStyle.Primary).setEmoji('📝')
            );

            const row4Pos = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_getpos').setLabel('4. Get Pos (Auto-Saves)').setStyle(ButtonStyle.Success).setEmoji('📍'),
                new ButtonBuilder().setCustomId('btn_ae_undopos').setLabel('Undo Last Pos').setStyle(ButtonStyle.Secondary).setEmoji('⏪').setDisabled(eventLocs.length === 0),
                new ButtonBuilder().setCustomId('btn_ae_clearpos').setLabel('Clear All Pos').setStyle(ButtonStyle.Danger).setEmoji('🧹').setDisabled(eventLocs.length === 0)
            );

            const row5Toggle = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_ae_test').setLabel('Test Spawn Now').setStyle(ButtonStyle.Primary).setEmoji('🚀').setDisabled(eventLocs.length === 0),
                new ButtonBuilder().setCustomId('btn_ae_toggle').setLabel(activeEvent.isEnabled ? 'Disable Event' : 'Enable Event').setStyle(activeEvent.isEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('⚡'),
                new ButtonBuilder().setCustomId('btn_ae_delete_event').setLabel('Delete Event').setStyle(ButtonStyle.Danger).setEmoji('💀')
            );

            const payload = { embeds: [embed], components: [row1Event, row2Type, row3Setup, row4Pos, row5Toggle], flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        // --- 🚦 1. MODAL SUBMISSIONS (Handled first) ---
        if (interaction.isModalSubmit() && customId === 'modal_ae_settings') {
            const newName = interaction.fields.getTextInputValue('ev_name').trim();
            const amount = parseInt(interaction.fields.getTextInputValue('amount')) || 1;
            const interval = parseInt(interaction.fields.getTextInputValue('interval')) || 60;
            
            await AutoEvent.update({ name: newName, amount, interval }, { where: { id: session.selectedEventId } });
            return await renderAEPanel(interaction, `✅ Event details updated!`);
        }

        // --- ENTRY ROUTER ---
        if (customId === 'admin_menu_select' && selectedValue === 'setup_autoevents') {
            return await renderAEPanel(interaction);
        }

        // --- DROPDOWN HANDLERS ---
        if (interaction.isStringSelectMenu()) {
            if (customId === 'ae_event_select') {
                if (selectedValue === 'ae_create_new') {
                    const newEvent = await AutoEvent.create({ guildId, name: 'New Custom Event' });
                    session.selectedEventId = newEvent.id;
                    aeSessions.set(guildId, session);
                    return await renderAEPanel(interaction, `✨ Event Created! Follow the numbers below to set it up.`);
                } else {
                    session.selectedEventId = parseInt(selectedValue.replace('load_ev_', ''));
                    aeSessions.set(guildId, session);
                    return await renderAEPanel(interaction);
                }
            }

            if (customId === 'ae_type_select') {
                const newType = selectedValue.replace('set_type_', '');
                await AutoEvent.update({ eventType: newType }, { where: { id: session.selectedEventId } });
                return await renderAEPanel(interaction, `✅ Event type updated to **${TYPE_INFO[newType].name}**!`);
            }
        }

        // --- BUTTON HANDLERS ---
        if (interaction.isButton()) {
            if (customId === 'btn_ae_edit_settings') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const modal = new ModalBuilder().setCustomId('modal_ae_settings').setTitle(`Configure Event Profile`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_name').setLabel("Event Name").setStyle(TextInputStyle.Short).setValue(ev.name).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Quantity to Spawn").setStyle(TextInputStyle.Short).setValue(ev.amount.toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interval').setLabel("Timer Interval (Minutes)").setStyle(TextInputStyle.Short).setValue(ev.interval.toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_ae_getpos') {
                if (typeof queueAdminPos === 'function') {
                    await queueAdminPos(interaction);
                    return;
                } else return await interaction.reply({ content: '❌ `queueAdminPos` missing.', flags: 64 });
            }

            if (customId === 'btn_ae_undopos') {
                const highestSlot = await AutoEventLocation.findOne({ where: { eventId: session.selectedEventId }, order: [['slot', 'DESC']] });
                if (highestSlot) await highestSlot.destroy();
                return await renderAEPanel(interaction, `⏪ Removed the last saved location.`);
            }

            if (customId === 'btn_ae_clearpos') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId } });
                return await renderAEPanel(interaction, `🧹 All locations cleared.`);
            }

            if (customId === 'btn_ae_test') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const locs = await AutoEventLocation.findAll({ where: { eventId: ev.id } });
                const prefab = TYPE_INFO[ev.eventType].prefab;

                let fired = 0;
                for (const loc of locs) {
                    try {
                        await sendRconCommand(guildId, `spawn ${prefab} "${loc.posX},${loc.posY},${loc.posZ}"`);
                        fired++;
                    } catch (e) {
                        console.error("Test spawn failed:", e);
                    }
                }
                return await renderAEPanel(interaction, `🚀 Sent **${fired}** spawn commands to the server for testing!`);
            }

            if (customId === 'btn_ae_toggle') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                await ev.update({ isEnabled: !ev.isEnabled });
                return await renderAEPanel(interaction, `⚡ Event is now ${!ev.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}!`);
            }

            if (customId === 'btn_ae_delete_event') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId } }); 
                await AutoEvent.destroy({ where: { id: session.selectedEventId } }); 
                session.selectedEventId = null;
                aeSessions.set(guildId, session);
                return await renderAEPanel(interaction, `💀 Event permanently deleted.`);
            }
        }

    } catch (error) {
        console.error('[AUTO EVENTS HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing auto events.', flags: 64 }).catch(() => {});
        }
    }
};

// =========================================================================
// 💥 AUTO-SAVE LOCATION HELPER 💥
// =========================================================================
autoEventsHandler.autoSaveLocation = async (guildId, x, y, z) => {
    const session = aeSessions.get(guildId);
    if (!session || !session.selectedEventId) return;

    const highestSlot = await AutoEventLocation.findOne({ where: { eventId: session.selectedEventId }, order: [['slot', 'DESC']] });
    const nextSlotNum = highestSlot ? highestSlot.slot + 1 : 1;

    await AutoEventLocation.create({
        guildId,
        eventId: session.selectedEventId,
        slot: nextSlotNum,
        posX: x.toString(),
        posY: y.toString(),
        posZ: z.toString()
    });
};

autoEventsHandler.aeSessions = aeSessions;
module.exports = autoEventsHandler;