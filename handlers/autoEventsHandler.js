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

// --- HELPER: RENDER THE PANEL ---
async function renderAEPanel(interaction, guildId, messageOverride = '') {
    const session = aeSessions.get(guildId) || { selectedEventId: null };
    const allEvents = await AutoEvent.findAll({ where: { guildId }, order: [['id', 'ASC']] });
    
    // Status Board
    let statusBoard = allEvents.length === 0 ? '*No auto-events created yet.*' : '';
    for (const ev of allEvents) {
        const locCount = await AutoEventLocation.count({ where: { eventId: ev.id } });
        statusBoard += `${ev.isEnabled ? '🟢' : '🔴'} **${ev.name}** (${TYPE_INFO[ev.eventType].emoji} x${ev.amount} | 📍 ${locCount} Locs)\n`;
    }

    const activeEvent = session.selectedEventId ? await AutoEvent.findByPk(session.selectedEventId) : null;
    const eventLocs = activeEvent ? await AutoEventLocation.findAll({ where: { eventId: activeEvent.id }, order: [['slot', 'ASC']] }) : [];

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Auto Events Manager')
        .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}**Live Status Board:**\n${statusBoard}`)
        .setColor('#3498db');

    let components = [];

    // ROW 1: Event Selector
    let eventOptions = allEvents.map(e => ({ label: e.name, value: `ae_load_${e.id}`, emoji: TYPE_INFO[e.eventType].emoji }));
    eventOptions.push({ label: '➕ Create New Event', value: 'ae_create_new', emoji: '✨' });

    const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ae_event_select').setPlaceholder(activeEvent ? `📂 Loaded: ${activeEvent.name}` : '📂 1. Select or Create an Event...').addOptions(eventOptions.slice(0, 25))
    );
    components.push(row1);

    if (activeEvent) {
        // Embed Details for Active Event
        let locList = eventLocs.length > 0 ? eventLocs.map((l, i) => `**${i + 1}.** \`${l.posX}, ${l.posY}, ${l.posZ}\``).join('\n') : '*No positions saved. Click "Get Pos from RCON".*';
        embed.addFields({ 
            name: `📝 Managing: ${activeEvent.name}`, 
            value: `**Type:** ${TYPE_INFO[activeEvent.eventType].emoji} ${TYPE_INFO[activeEvent.eventType].name}\n**Quantity:** Spawns ${activeEvent.amount}\n\n**📍 Spawn Locations:**\n${locList}` 
        });

        // ROW 2: Event Type
        const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('ae_type_select').setPlaceholder(`🎯 2. Type: ${TYPE_INFO[activeEvent.eventType].name}`)
                .addOptions(Object.keys(TYPE_INFO).map(k => ({ label: TYPE_INFO[k].name, value: `ae_type_${k}`, emoji: TYPE_INFO[k].emoji })))
        );
        components.push(row2);

        // ROW 3: Settings, Toggle, Delete
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_ae_settings').setLabel('Edit Name & Qty').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('btn_ae_toggle').setLabel(activeEvent.isEnabled ? 'Disable Event' : 'Enable Event').setStyle(activeEvent.isEnabled ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('⚡'),
            new ButtonBuilder().setCustomId('btn_ae_delete').setLabel('Delete Event').setStyle(ButtonStyle.Danger).setEmoji('💀')
        );
        components.push(row3);

        // ROW 4: Position Data & Testing
        const row4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_ae_getpos').setLabel('Get Pos from RCON').setStyle(ButtonStyle.Success).setEmoji('📍'),
            new ButtonBuilder().setCustomId('btn_ae_undopos').setLabel('Clear Last Pos').setStyle(ButtonStyle.Secondary).setEmoji('⏪').setDisabled(eventLocs.length === 0),
            new ButtonBuilder().setCustomId('btn_ae_test').setLabel('Test Spawns').setStyle(ButtonStyle.Primary).setEmoji('🚀').setDisabled(eventLocs.length === 0)
        );
        components.push(row4);
    }

    // Safely update the Discord UI
    if (interaction.isModalSubmit() || interaction.isMessageComponent()) {
        await interaction.update({ embeds: [embed], components, flags: 64 }).catch(console.error);
    } else {
        await interaction.reply({ embeds: [embed], components, flags: 64 }).catch(console.error);
    }
}

// --- MAIN HANDLER ---
const autoEventsHandler = async (interaction, client) => {
    const customId = interaction.customId || '';
    const guildId = interaction.guild.id;
    let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (!aeSessions.has(guildId)) aeSessions.set(guildId, { selectedEventId: null });
    const session = aeSessions.get(guildId);

    try {
        // 1. OPEN MENU FROM ADMIN PANEL
        if (customId === 'admin_menu_select' && selectedValue === 'setup_autoevents') {
            return await renderAEPanel(interaction, guildId);
        }

        // 2. MODAL SUBMISSIONS (Name & Quantity)
        if (interaction.isModalSubmit() && customId === 'modal_ae_settings') {
            const rawName = interaction.fields.getTextInputValue('ev_name').trim();
            const newName = rawName || "Custom Event";
            
            let amount = parseInt(interaction.fields.getTextInputValue('ev_qty'));
            if (isNaN(amount) || amount < 1) amount = 1;

            if (session.selectedEventId) {
                await AutoEvent.update({ name: newName, amount }, { where: { id: session.selectedEventId } });
            }
            return await renderAEPanel(interaction, guildId, `✅ Settings saved successfully!`);
        }

        // 3. DROPDOWNS
        if (interaction.isStringSelectMenu()) {
            if (customId === 'ae_event_select') {
                if (selectedValue === 'ae_create_new') {
                    const newEvent = await AutoEvent.create({ guildId, name: 'New Custom Event' });
                    session.selectedEventId = newEvent.id;
                    return await renderAEPanel(interaction, guildId, `✨ New Event Created!`);
                } else {
                    session.selectedEventId = parseInt(selectedValue.replace('ae_load_', ''));
                    return await renderAEPanel(interaction, guildId);
                }
            }

            if (customId === 'ae_type_select') {
                const newType = selectedValue.replace('ae_type_', '');
                await AutoEvent.update({ eventType: newType }, { where: { id: session.selectedEventId } });
                return await renderAEPanel(interaction, guildId, `✅ Event type updated!`);
            }
        }

        // 4. BUTTONS
        if (interaction.isButton()) {
            if (customId === 'btn_ae_settings') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                if (!ev) return;
                const modal = new ModalBuilder().setCustomId('modal_ae_settings').setTitle(`Edit Event Settings`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_name').setLabel("Event Name").setStyle(TextInputStyle.Short).setValue(ev.name || 'Custom Event').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_qty').setLabel("Quantity of items to spawn").setStyle(TextInputStyle.Short).setValue((ev.amount || 1).toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_ae_toggle') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                await ev.update({ isEnabled: !ev.isEnabled });
                return await renderAEPanel(interaction, guildId, `⚡ Event toggled!`);
            }

            if (customId === 'btn_ae_delete') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId } }); 
                await AutoEvent.destroy({ where: { id: session.selectedEventId } }); 
                session.selectedEventId = null;
                return await renderAEPanel(interaction, guildId, `💀 Event permanently deleted.`);
            }

            if (customId === 'btn_ae_undopos') {
                const highestSlot = await AutoEventLocation.findOne({ where: { eventId: session.selectedEventId }, order: [['slot', 'DESC']] });
                if (highestSlot) await highestSlot.destroy();
                return await renderAEPanel(interaction, guildId, `⏪ Cleared last position.`);
            }

            if (customId === 'btn_ae_getpos') {
                // Passing 'auto_event' so rconManager knows where to save it
                await queueAdminPos(interaction, 'auto_event'); 
                return await interaction.reply({ content: '⏳ **Waiting for RCON...** Type `/players` or move in-game to trigger position save!', flags: 64 });
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
                    } catch (e) {}
                }
                return await renderAEPanel(interaction, guildId, `🚀 Spawned **${fired}** ${TYPE_INFO[ev.eventType].name}!`);
            }
        }
    } catch (error) {
        console.error('[AUTO EVENTS ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied) await interaction.reply({ content: '❌ Error processing action.', flags: 64 }).catch(()=>{});
    }
};

// --- RCON AUTO-SAVE RECEIVER ---
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

module.exports = autoEventsHandler;