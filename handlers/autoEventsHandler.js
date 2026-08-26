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

// Safe Discord Responder to prevent "Interaction Failed" errors
async function safeRespond(interaction, payload) {
    try {
        if (interaction.isModalSubmit() || interaction.isMessageComponent()) {
            await interaction.update(payload);
        } else {
            await interaction.reply(payload);
        }
    } catch (err) {
        console.error("[AUTO EVENTS] Failed to update Discord UI:", err);
    }
}

const autoEventsHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // Initialize user session
        if (!aeSessions.has(guildId)) aeSessions.set(guildId, { selectedEventId: null });
        const session = aeSessions.get(guildId);

        // =======================================================
        // THE PANEL RENDERER (Exactly as you requested)
        // =======================================================
        const renderAEPanel = async (inter, messageOverride = '') => {
            const allEvents = await AutoEvent.findAll({ where: { guildId }, order: [['id', 'ASC']] });
            const activeEvent = session.selectedEventId ? await AutoEvent.findByPk(session.selectedEventId) : null;
            const eventLocs = activeEvent ? await AutoEventLocation.findAll({ where: { eventId: activeEvent.id }, order: [['slot', 'ASC']] }) : [];

            // 1. Build the Embed Details
            const embed = new EmbedBuilder().setTitle('⚙️ Auto Events Manager').setColor('#3498db');
            let desc = messageOverride ? `**${messageOverride}**\n\n` : '';
            
            if (!activeEvent) {
                desc += "👇 **Click an event below or create a new one to begin.**";
            } else {
                let locList = eventLocs.length > 0 
                    ? eventLocs.map((l, i) => `**${i + 1}.** \`${l.posX}, ${l.posY}, ${l.posZ}\``).join('\n') 
                    : '*No positions saved. Click "Add Player Pos".*';

                desc += `**📝 Selected Event:** ${activeEvent.name}\n`;
                desc += `**🎯 Event Type:** ${TYPE_INFO[activeEvent.eventType].emoji} ${TYPE_INFO[activeEvent.eventType].name}\n`;
                desc += `**📦 Quantity:** Spawns ${activeEvent.amount}\n`;
                desc += `**⚡ Status:** ${activeEvent.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}\n\n`;
                desc += `**📍 Saved Spawn Locations:**\n${locList}`;
            }
            embed.setDescription(desc);

            let components = [];

            // 2. ROW 1: EVENT LIST (AS BUTTONS!)
            const eventRow = new ActionRowBuilder();
            for (const ev of allEvents.slice(0, 4)) {
                eventRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ae_load_${ev.id}`)
                        .setLabel(ev.name.substring(0, 80))
                        .setStyle(session.selectedEventId === ev.id ? ButtonStyle.Success : ButtonStyle.Secondary)
                );
            }
            if (allEvents.length < 4) { // Discord allows max 5 buttons per row
                eventRow.addComponents(
                    new ButtonBuilder().setCustomId('ae_create_new').setLabel('➕ New Event').setStyle(ButtonStyle.Primary)
                );
            }
            components.push(eventRow);

            // 3. IF AN EVENT IS SELECTED, SHOW CONTROLS
            if (activeEvent) {
                // Type Selector (Needed to pick Hackable vs Supply Drop)
                components.push(new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('ae_select_type').setPlaceholder(`🎯 Event Type: ${TYPE_INFO[activeEvent.eventType].name}`)
                        .addOptions(Object.keys(TYPE_INFO).map(k => ({ label: TYPE_INFO[k].name, value: `ae_type_${k}`, emoji: TYPE_INFO[k].emoji })))
                ));

                // Control Buttons: Name/Qty, Add Pos, Clear Pos, Test
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ae_btn_settings').setLabel('Name & Quantity').setStyle(ButtonStyle.Primary).setEmoji('📝'),
                    new ButtonBuilder().setCustomId('ae_btn_getpos').setLabel('Add Player Pos').setStyle(ButtonStyle.Success).setEmoji('📍'),
                    new ButtonBuilder().setCustomId('ae_btn_clearpos').setLabel('Clear Pos').setStyle(ButtonStyle.Secondary).setEmoji('🧹').setDisabled(eventLocs.length === 0),
                    new ButtonBuilder().setCustomId('ae_btn_test').setLabel('Test').setStyle(ButtonStyle.Primary).setEmoji('🚀').setDisabled(eventLocs.length === 0)
                ));

                // Danger Buttons: Disable, Delete
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ae_btn_toggle').setLabel(activeEvent.isEnabled ? 'Disable Event' : 'Enable Event').setStyle(activeEvent.isEnabled ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('⚡'),
                    new ButtonBuilder().setCustomId('ae_btn_delete').setLabel('Delete Event').setStyle(ButtonStyle.Danger).setEmoji('💀')
                ));
            }

            await safeRespond(inter, { embeds: [embed], components, flags: 64 });
        };

        // =======================================================
        // INTERACTION ROUTING LOGIC
        // =======================================================

        // Admin Panel Entry
        if (customId === 'admin_menu_select' && selectedValue === 'setup_autoevents') {
            return await renderAEPanel(interaction);
        }

        // --- 1. MODAL SUBMISSIONS ---
        if (interaction.isModalSubmit() && customId === 'modal_ae_settings') {
            const newName = interaction.fields.getTextInputValue('ev_name').trim() || "Custom Event";
            let amount = parseInt(interaction.fields.getTextInputValue('ev_qty'));
            if (isNaN(amount) || amount < 1) amount = 1;

            if (session.selectedEventId) {
                // Safely update the DB with the new name and amount
                await AutoEvent.update({ name: newName, amount }, { where: { id: session.selectedEventId } });
            }
            return await renderAEPanel(interaction, `✅ Event Name and Quantity saved!`);
        }

        // --- 2. EVENT SELECTOR BUTTONS ---
        if (interaction.isButton() && customId.startsWith('ae_load_')) {
            session.selectedEventId = parseInt(customId.replace('ae_load_', ''));
            return await renderAEPanel(interaction);
        }

        if (interaction.isButton() && customId === 'ae_create_new') {
            const newEvent = await AutoEvent.create({ guildId, name: 'New Custom Event', amount: 1, interval: 60 });
            session.selectedEventId = newEvent.id;
            return await renderAEPanel(interaction, `✨ New Event Created!`);
        }

        // --- 3. EVENT TYPE DROPDOWN ---
        if (interaction.isStringSelectMenu() && customId === 'ae_select_type') {
            const newType = selectedValue.replace('ae_type_', '');
            await AutoEvent.update({ eventType: newType }, { where: { id: session.selectedEventId } });
            return await renderAEPanel(interaction, `✅ Event type updated!`);
        }

        // --- 4. ACTION BUTTONS ---
        if (interaction.isButton()) {
            
            // Name & Quantity Modal
            if (customId === 'ae_btn_settings') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const modal = new ModalBuilder().setCustomId('modal_ae_settings').setTitle(`Edit Event Name & Amount`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_name').setLabel("Event Name").setStyle(TextInputStyle.Short).setValue(ev.name || 'Custom Event').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_qty').setLabel("Quantity of items to spawn").setStyle(TextInputStyle.Short).setValue((ev.amount || 1).toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            // Toggle Enable/Disable
            if (customId === 'ae_btn_toggle') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                await ev.update({ isEnabled: !ev.isEnabled });
                return await renderAEPanel(interaction, `⚡ Event status changed!`);
            }

            // Delete Event
            if (customId === 'ae_btn_delete') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId } });
                await AutoEvent.destroy({ where: { id: session.selectedEventId } });
                session.selectedEventId = null;
                return await renderAEPanel(interaction, `💀 Event completely deleted.`);
            }

            // Clear Pos (Wipes all positions for this event)
            if (customId === 'ae_btn_clearpos') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId } });
                return await renderAEPanel(interaction, `🧹 Cleared all positions for this event.`);
            }

            // Add Player Pos (Triggers RCON)
            if (customId === 'ae_btn_getpos') {
                await queueAdminPos(interaction, 'auto_event');
                return await interaction.reply({ content: '⏳ **Waiting for RCON...** Type `/players` or move in-game to trigger a position save!', flags: 64 });
            }

            // Test
            if (customId === 'ae_btn_test') {
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

// ==========================================
// RCON AUTO-SAVE RECEIVER
// ==========================================
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