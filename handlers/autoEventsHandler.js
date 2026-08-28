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

        for (const key of Object.keys(TYPE_INFO)) {
            const ev = allEvents.find(e => e.eventType === key);
            if (ev && ev.isEnabled) activeList += `🟢 **${ev.name}**\n`;
            else if (ev && !ev.isEnabled) inactiveList += `🔴 **${ev.name}** (Disabled)\n`;
            else inactiveList += `⚫ **${TYPE_INFO[key].name}** (*Not Setup*)\n`;
        }

        embed.addFields(
            { name: '🟢 Active Events', value: activeList || "*No events active.*", inline: false },
            { name: '🔴 Inactive / Unconfigured', value: inactiveList || "*All set up!*", inline: false },
            { name: '🛠️ Manage', value: "👇 **Click an event below to open its positions and settings.**", inline: false }
        );

        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        const keys = Object.keys(TYPE_INFO);
        
        for (let i = 0; i < 3; i++) {
            row1.addComponents(new ButtonBuilder().setCustomId(`ae_load_${keys[i]}`).setLabel(TYPE_INFO[keys[i]].name).setEmoji(TYPE_INFO[keys[i]].emoji).setStyle(ButtonStyle.Secondary));
        }
        for (let i = 3; i < keys.length; i++) {
            row2.addComponents(new ButtonBuilder().setCustomId(`ae_load_${keys[i]}`).setLabel(TYPE_INFO[keys[i]].name).setEmoji(TYPE_INFO[keys[i]].emoji).setStyle(ButtonStyle.Secondary));
        }

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ae_btn_disable_mode').setLabel('Disable / Enable Event').setStyle(ButtonStyle.Secondary).setEmoji('⚡'),
            new ButtonBuilder().setCustomId('ae_btn_delete_mode').setLabel('Delete Event').setStyle(ButtonStyle.Danger).setEmoji('💀')
        );
        
        components.push(row1, row2, row3);
    } 
    else if (session.view === 'select_disable' || session.view === 'select_delete') {
        const isDisable = session.view === 'select_disable';
        embed.addFields({ name: 'Action Required', value: isDisable ? "⚡ Select which event you want to Enable/Disable:" : "💀 Select which event you want to completely clear and delete:" });

        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(isDisable ? 'ae_do_disable' : 'ae_do_delete')
                .setPlaceholder(isDisable ? '⚡ Select an event to toggle...' : '💀 Select an event to delete...')
                .addOptions(Object.keys(TYPE_INFO).map(k => ({ label: TYPE_INFO[k].name, value: k, emoji: TYPE_INFO[k].emoji })))
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ae_btn_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );
        components.push(row1, row2);
    } 
    else if (session.view === 'event') {
        const activeEvent = await AutoEvent.findByPk(session.selectedEventId);
        if (!activeEvent) {
            session.view = 'main';
            return await buildPanelPayload(guildId, '❌ Event not found.');
        }

        const eventLocs = await AutoEventLocation.findAll({ where: { eventId: activeEvent.id }, order: [['slot', 'ASC']] });

        embed.setTitle(`${TYPE_INFO[activeEvent.eventType].emoji} Managing: ${activeEvent.name}`);
        
        let locList = eventLocs.length > 0 
            ? eventLocs.map((l, i) => `**${i + 1}.** \`${l.posX}, ${l.posY}, ${l.posZ}\``).join('\n') 
            : '*No positions saved. Click "Add Player Pos" below.*';

        embed.addFields(
            { name: `📊 Event Details`, value: `**Quantity:** Spawns ${activeEvent.amount}\n**Status:** ${activeEvent.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}` },
            { name: `📍 Saved Spawn Locations`, value: locList }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ae_btn_settings').setLabel('Name & Qty').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('ae_btn_getpos').setLabel('Add Player Pos').setStyle(ButtonStyle.Success).setEmoji('📍'),
            new ButtonBuilder().setCustomId('ae_btn_undopos').setLabel('Clear Last Pos').setStyle(ButtonStyle.Secondary).setEmoji('⏪').setDisabled(eventLocs.length === 0),
            new ButtonBuilder().setCustomId('ae_btn_test').setLabel('Test Event').setStyle(ButtonStyle.Primary).setEmoji('🚀').setDisabled(eventLocs.length === 0)
        ));

        components.push(new ActionRowBuilder().addComponents(
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
            role.name.toLowerCase().includes('admin') || 
            role.name.toLowerCase().includes('owner') ||
            role.name.toLowerCase().includes('manager') ||
            role.name.toLowerCase().includes('moderator') ||
            role.name.toLowerCase().includes('mod')
        );

        if (!isOwner && !isAdminPerm && !hasAdminRole) {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                return await interaction.reply({ content: '❌ **Access Denied:** Only Owners, Admins, and Moderators can manage Auto Events.', flags: 64 });
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
            let amount = parseInt(interaction.fields.getTextInputValue('ev_qty'));
            if (isNaN(amount) || amount < 1) amount = 1;

            if (session.selectedEventId) {
                await AutoEvent.update({ name: newName, amount, interval: 60 }, { where: { id: session.selectedEventId } });
            }
            return await renderAEPanel(interaction, `✅ Event Name and Quantity saved!`);
        }

        if (interaction.isStringSelectMenu()) {
            const typeKey = interaction.values[0];
            
            if (customId === 'ae_do_disable') {
                let ev = await AutoEvent.findOne({ where: { guildId, eventType: typeKey } });
                if (!ev) {
                    ev = await AutoEvent.create({ guildId, name: TYPE_INFO[typeKey].name, eventType: typeKey, amount: 1, interval: 60, isEnabled: true });
                } else {
                    await ev.update({ isEnabled: !ev.isEnabled });
                }
                session.view = 'main';
                return await renderAEPanel(interaction, `⚡ Toggled status for **${TYPE_INFO[typeKey].name}**!`);
            }

            if (customId === 'ae_do_delete') {
                const ev = await AutoEvent.findOne({ where: { guildId, eventType: typeKey } });
                if (ev) {
                    await AutoEventLocation.destroy({ where: { eventId: ev.id } });
                    await ev.destroy();
                }
                session.view = 'main';
                return await renderAEPanel(interaction, `💀 Completely deleted **${TYPE_INFO[typeKey].name}**!`);
            }
        }

        if (interaction.isButton()) {
            if (customId.startsWith('ae_load_')) {
                const typeKey = customId.replace('ae_load_', '');
                let ev = await AutoEvent.findOne({ where: { guildId, eventType: typeKey } });
                
                if (!ev) {
                    ev = await AutoEvent.create({ guildId, name: TYPE_INFO[typeKey].name, eventType: typeKey, amount: 1, interval: 60, isEnabled: false });
                }
                session.selectedEventId = ev.id;
                session.view = 'event'; 
                return await renderAEPanel(interaction);
            }

            if (customId === 'ae_btn_disable_mode') {
                session.view = 'select_disable';
                return await renderAEPanel(interaction);
            }
            if (customId === 'ae_btn_delete_mode') {
                session.view = 'select_delete';
                return await renderAEPanel(interaction);
            }
            if (customId === 'ae_btn_cancel' || customId === 'ae_btn_back') {
                session.selectedEventId = null;
                session.view = 'main';
                return await renderAEPanel(interaction);
            }

            if (customId === 'ae_btn_settings') {
                const ev = await AutoEvent.findByPk(session.selectedEventId);
                const modal = new ModalBuilder().setCustomId('modal_ae_settings').setTitle(`Edit Event Name & Amount`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_name').setLabel("Event Name").setStyle(TextInputStyle.Short).setValue(ev.name || 'Custom Event').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ev_qty').setLabel("Quantity of items to spawn").setStyle(TextInputStyle.Short).setValue((ev.amount || 1).toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'ae_btn_undopos') {
                const highestSlot = await AutoEventLocation.findOne({ where: { eventId: session.selectedEventId }, order: [['slot', 'DESC']] });
                if (highestSlot) await highestSlot.destroy();
                return await renderAEPanel(interaction, `⏪ Removed the last saved position.`);
            }

            if (customId === 'ae_btn_getpos') {
                const loadingPayload = await buildPanelPayload(guildId, '⏳ **Extracting your position from the server...**');
                await interaction.update(loadingPayload);
                await queueAdminPos(interaction, 'auto_event', session.selectedEventId);
                return;
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