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

// Helper function to safely update the panel without crashing
async function safeRespond(interaction, payload) {
    try {
        if (interaction.isModalSubmit() || interaction.isMessageComponent()) {
            await interaction.update(payload);
        } else {
            await interaction.reply(payload);
        }
    } catch (err) {
        console.error("Failed to respond to interaction", err);
    }
}

const autoEventsHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        if (!aeSessions.has(guildId)) aeSessions.set(guildId, { selectedEventId: null });
        const session = aeSessions.get(guildId);

        const renderAEPanel = async (inter, messageOverride = '') => {
            const allEvents = await AutoEvent.findAll({ where: { guildId }, order: [['id', 'ASC']] });
            const activeEvent = session.selectedEventId ? await AutoEvent.findByPk(session.selectedEventId) : null;
            const eventLocs = activeEvent ? await AutoEventLocation.findAll({ where: { eventId: activeEvent.id }, order: [['slot', 'ASC']] }) : [];

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Auto Events Manager')
                .setColor('#3498db');

            let desc = messageOverride ? `**${messageOverride}**\n\n` : '';
            
            if (!activeEvent) {
                desc += "👇 **Please select an event below or create a new one to get started.**";
            } else {
                let locList = eventLocs.length > 0 
                    ? eventLocs.map((l, i) => `**${i + 1}.** \`${l.posX}, ${l.posY}, ${l.posZ}\``).join('\n') 
                    : '*No positions saved. Click "Get Pos from RCON".*';

                desc += `**📝 Managing:** ${activeEvent.name}\n`;
                desc += `**🎯 Type:** ${TYPE_INFO[activeEvent.eventType].emoji} ${TYPE_INFO[activeEvent.eventType].name}\n`;
                desc += `**📦 Quantity:** Spawns ${activeEvent.amount}\n`;
                desc += `**⚡ Status:** ${activeEvent.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}\n\n`;
                desc += `**📍 Saved Spawn Locations:**\n${locList}`;
            }
            embed.setDescription(desc);

            let components = [];

            // 1. Dropdown for Events
            let eventOptions = allEvents.map(e => ({ label: e.name, value: `ae_load_${e.id}`, emoji: TYPE_INFO[e.eventType].emoji }));
            eventOptions.push({ label: '➕ Create New Event', value: 'ae_create_new', emoji: '✨' });
            
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('ae_select_event').setPlaceholder(activeEvent ? `📂 Loaded: ${activeEvent.name}` : '📂 1. Select or Create an Event...').addOptions(eventOptions.slice(0, 25))
            ));

            if (activeEvent) {
                // 2. Dropdown for Type
                components.push(new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('ae_select_type').setPlaceholder(`🎯 Type: ${TYPE_INFO[activeEvent.eventType].name}`)
                        .addOptions(Object.keys(TYPE_INFO).map(k => ({ label: TYPE_INFO[k].name, value: `ae_type_${k}`, emoji: TYPE_INFO[k].emoji })))
                ));

                // 3. Main Action Buttons (Name, Get Pos, Clear Pos, Test)
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ae_btn_settings').setLabel('Set Name & Quantity').setStyle(ButtonStyle.Primary).setEmoji('📝'),
                    new ButtonBuilder().setCustomId('ae_btn_getpos').setLabel('Get Pos from RCON').setStyle(ButtonStyle.Success).setEmoji('📍'),
                    new ButtonBuilder().setCustomId('ae_btn_undopos').setLabel('Clear Last Pos').setStyle(ButtonStyle.Secondary).setEmoji('⏪').setDisabled(eventLocs.length === 0),
                    new ButtonBuilder().setCustomId('ae_btn_test').setLabel('Test Event Spawns').setStyle(ButtonStyle.Primary).setEmoji('🚀').setDisabled(eventLocs.length === 0)
                ));

                // 4. Management Buttons (Toggle, Clear Event)
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ae_btn_toggle').setLabel(activeEvent.isEnabled ? 'Disable Event' : 'Enable Event').setStyle(activeEvent.isEnabled ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('⚡'),
                    new ButtonBuilder().setCustomId('ae_btn_delete').setLabel('Clear / Delete Event').setStyle(ButtonStyle.Danger).setEmoji('💀')
                ));
            }

            await safeRespond(inter, { embeds: [embed], components, flags: 64 });
        };

        // ==========================================
        // ROUTING
        // ==========================================

        // Admin Panel Entry
        if (customId === 'admin_menu_select' && selectedValue === 'setup_autoevents') {
            return await renderAEPanel(interaction);
        }

        // Modal Submissions
        if (interaction.isModalSubmit() && customId === 'modal_ae_settings') {
            const newName = interaction.fields.getTextInputValue('ev_name').trim() || "Custom Event";
            let amount = parseInt(interaction.fields.getTextInputValue('ev_qty'));
            if (isNaN(amount) || amount < 1) amount = 1;

            if (session.selectedEventId) {
                // Ensure interval isn't overwritten as null
                await AutoEvent.update({ name: newName, amount, interval: 60 }, { where: { id: session.selectedEventId } });
            }
            return await renderAEPanel(interaction, `✅ Event Name and Quantity saved!`);
        }

        // Dropdowns
        if (interaction.isStringSelectMenu()) {
            if (customId === 'ae_select_event') {
                if (selectedValue === 'ae_create_new') {
                    const newEvent = await AutoEvent.create({ guildId, name: 'New Custom Event', amount: 1, interval: 60 });
                    session.selectedEventId = newEvent.id;
                    return await renderAEPanel(interaction, `✨ New Event Created!`);
                } else {
                    session.selectedEventId = parseInt(selectedValue.replace('ae_load_', ''));
                    return await renderAEPanel(interaction);
                }
            }
            if (customId === 'ae_select_type') {
                const newType = selectedValue.replace('ae_type_', '');
                await AutoEvent.update({ eventType: newType }, { where: { id: session.selectedEventId } });
                return await renderAEPanel(interaction, `✅ Event type updated!`);
            }
        }

        // Buttons
        if (interaction.isButton()) {
            if (customId === 'ae_btn_settings') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const modal = new ModalBuilder().setCustomId('modal_ae_settings').setTitle(`Edit Event Name & Amount`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_name').setLabel("Event Name").setStyle(TextInputStyle.Short).setValue(ev.name || 'Custom Event').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_qty').setLabel("Quantity of items to spawn").setStyle(TextInputStyle.Short).setValue((ev.amount || 1).toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'ae_btn_toggle') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                await ev.update({ isEnabled: !ev.isEnabled });
                return await renderAEPanel(interaction, `⚡ Event status changed!`);
            }

            if (customId === 'ae_btn_delete') {
                await AutoEventLocation.destroy({ where: { eventId: session.selectedEventId } });
                await AutoEvent.destroy({ where: { id: session.selectedEventId } });
                session.selectedEventId = null;
                return await renderAEPanel(interaction, `💀 Event completely cleared and deleted.`);
            }

            if (customId === 'ae_btn_undopos') {
                const highestSlot = await AutoEventLocation.findOne({ where: { eventId: session.selectedEventId }, order: [['slot', 'DESC']] });
                if (highestSlot) await highestSlot.destroy();
                return await renderAEPanel(interaction, `⏪ Removed the last saved position.`);
            }

            if (customId === 'ae_btn_getpos') {
                await queueAdminPos(interaction, 'auto_event');
                return await interaction.reply({ content: '⏳ **Waiting for RCON...** Type `/players` or move in-game to trigger a position save!', flags: 64 });
            }

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