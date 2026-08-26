const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { PveZone } = require('../database/db'); // Your Custom Zone database table
const { queueAdminPos } = require('../utils/rconManager'); 

const czSessions = new Map();

// =======================================================
// LAYOUT BUILDER (Decoupled for Live RCON Refresh!)
// =======================================================
const buildPanelPayload = async (guildId, messageOverride = '') => {
    if (!czSessions.has(guildId)) czSessions.set(guildId, { selectedZoneId: null, view: 'main' });
    const session = czSessions.get(guildId);
    
    // Fetch all custom zones for this server
    const allZones = await PveZone.findAll({ where: { guildId }, order: [['id', 'ASC']] });
    let components = [];
    
    const embed = new EmbedBuilder().setColor('#e67e22').setTitle('🗺️ Custom Zone Builder');
    if (messageOverride) embed.setDescription(`**${messageOverride}**\n\n`);

    // ---------------------------------------------------
    // PAGE 1: MAIN PANEL
    // ---------------------------------------------------
    if (session.view === 'main') {
        let activeList = '';
        let inactiveList = '';

        for (const z of allZones) {
            const display = `**${z.name || 'Unnamed Zone'}** (Radius: ${z.radius}m)\n`;
            if (z.isEnabled) activeList += `🟢 ${display}`;
            else inactiveList += `🔴 ${display}`;
        }

        embed.addFields(
            { name: '🟢 Active Zones', value: activeList || "*No active zones.*", inline: false },
            { name: '🔴 Disabled Zones', value: inactiveList || "*None.*", inline: false },
            { name: '🛠️ Manage Zones', value: "👇 **Click a zone below to manage it, or create a new one.**", inline: false }
        );

        // Build Dynamic Zone Buttons (Max 4 per row, leaving 1 slot for "Create New")
        const row1 = new ActionRowBuilder();
        for (const z of allZones.slice(0, 4)) {
            row1.addComponents(new ButtonBuilder().setCustomId(`cz_load_${z.id}`).setLabel(z.name || 'Unnamed Zone').setStyle(ButtonStyle.Secondary).setEmoji('📍'));
        }
        
        row1.addComponents(new ButtonBuilder().setCustomId('cz_create_new').setLabel('➕ Create Zone').setStyle(ButtonStyle.Primary));
        components.push(row1);
    } 
    // ---------------------------------------------------
    // PAGE 2: INSIDE THE ZONE (Positions & Config)
    // ---------------------------------------------------
    else if (session.view === 'zone') {
        const activeZone = await PveZone.findByPk(session.selectedZoneId);
        if (!activeZone) {
            session.view = 'main';
            return await buildPanelPayload(guildId, '❌ Zone not found.');
        }

        embed.setTitle(`📍 Managing Zone: ${activeZone.name || 'Unnamed Zone'}`);
        
        const posText = (activeZone.posX && activeZone.posZ) 
            ? `\`X: ${activeZone.posX}, Y: ${activeZone.posY || '0'}, Z: ${activeZone.posZ}\`` 
            : '*No center position saved. Click "Set Zone Center" below.*';

        embed.addFields(
            { name: `📊 Zone Settings`, value: `**Radius:** ${activeZone.radius || 0} meters\n**Status:** ${activeZone.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}` },
            { name: `🎯 Zone Center Coordinates`, value: posText }
        );

        // Row 1: Tools
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_settings').setLabel('Set Name & Radius').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('cz_btn_getpos').setLabel('Set Zone Center (Auto)').setStyle(ButtonStyle.Success).setEmoji('🎯')
        ));

        // Row 2: Management
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_toggle').setLabel(activeZone.isEnabled ? 'Disable Zone' : 'Enable Zone').setStyle(activeZone.isEnabled ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('⚡'),
            new ButtonBuilder().setCustomId('cz_btn_delete').setLabel('Delete Zone').setStyle(ButtonStyle.Danger).setEmoji('💀'),
            new ButtonBuilder().setCustomId('cz_btn_back').setLabel('Back to Menu').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }

    return { embeds: [embed], components, flags: 64 };
};

// Safe Discord Responder
async function safeRespond(interaction, payload) {
    try {
        if (interaction.isModalSubmit() || interaction.isMessageComponent()) {
            await interaction.update(payload);
        } else {
            await interaction.reply(payload);
        }
    } catch (err) {
        console.error("[CUSTOM ZONES] Failed to update UI:", err);
    }
}

const customZoneHandler = async (interaction, client) => {
    try {
        // 🛡️ SECURITY BARRIER
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
                return await interaction.reply({ content: '❌ **Access Denied:** Only Owners, Admins, and Moderators can manage Custom Zones.', flags: 64 });
            }
            return;
        }

        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;

        if (!czSessions.has(guildId)) czSessions.set(guildId, { selectedZoneId: null, view: 'main' });
        const session = czSessions.get(guildId);

        const renderCZPanel = async (inter, messageOverride = '') => {
            const payload = await buildPanelPayload(guildId, messageOverride);
            await safeRespond(inter, payload);
        };

        // =======================================================
        // INTERACTION ROUTING LOGIC
        // =======================================================
        
        // Admin Panel Entry
        if (customId === 'admin_menu_select' || customId === 'setup_custom_zones') {
            session.view = 'main';
            return await renderCZPanel(interaction);
        }

        // --- MODAL SUBMISSIONS ---
        if (interaction.isModalSubmit() && customId === 'modal_cz_settings') {
            const newName = interaction.fields.getTextInputValue('cz_name').trim() || "New Zone";
            let radius = parseInt(interaction.fields.getTextInputValue('cz_radius'));
            if (isNaN(radius) || radius < 1) radius = 50; // Default 50m radius

            if (session.selectedZoneId) {
                await PveZone.update({ name: newName, radius: radius }, { where: { id: session.selectedZoneId } });
            }
            return await renderCZPanel(interaction, `✅ Zone Name and Radius saved!`);
        }

        // --- BUTTONS ---
        if (interaction.isButton()) {
            
            // Create New Zone
            if (customId === 'cz_create_new') {
                const newZone = await PveZone.create({ guildId, name: 'New Zone', radius: 50, isEnabled: false });
                session.selectedZoneId = newZone.id;
                session.view = 'zone';
                return await renderCZPanel(interaction, `✨ Created a new zone!`);
            }

            // Load Existing Zone
            if (customId.startsWith('cz_load_')) {
                session.selectedZoneId = parseInt(customId.replace('cz_load_', ''));
                session.view = 'zone';
                return await renderCZPanel(interaction);
            }

            // Back Button
            if (customId === 'cz_btn_back') {
                session.selectedZoneId = null;
                session.view = 'main';
                return await renderCZPanel(interaction);
            }

            // Edit Name & Radius Modal
            if (customId === 'cz_btn_settings') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                const modal = new ModalBuilder().setCustomId('modal_cz_settings').setTitle(`Edit Zone Settings`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_name').setLabel("Zone Name").setStyle(TextInputStyle.Short).setValue(z.name || 'New Zone').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_radius').setLabel("Radius (in meters)").setStyle(TextInputStyle.Short).setValue((z.radius || 50).toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            // Toggle Enable/Disable
            if (customId === 'cz_btn_toggle') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                await z.update({ isEnabled: !z.isEnabled });
                return await renderCZPanel(interaction, `⚡ Zone status toggled!`);
            }

            // Delete Zone
            if (customId === 'cz_btn_delete') {
                await PveZone.destroy({ where: { id: session.selectedZoneId } });
                session.selectedZoneId = null;
                session.view = 'main';
                return await renderCZPanel(interaction, `💀 Zone completely deleted.`);
            }

            // 🎯 HERE IS THE MAGIC LIVE-LINK FOR CUSTOM ZONES!
            if (customId === 'cz_btn_getpos') {
                // 1. Visually update the panel IMMEDIATELY to show it is loading
                const loadingPayload = await buildPanelPayload(guildId, '⏳ **Extracting your position from the server...**');
                await interaction.update(loadingPayload);
                
                // 2. Hand the interaction over to the RCON scanner ('custom_zone' type)
                await queueAdminPos(interaction, 'custom_zone', session.selectedZoneId);
                return;
            }
        }

    } catch (error) {
        console.error('[CUSTOM ZONES ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Error processing Custom Zones action.', flags: 64 }).catch(()=>{});
        }
    }
};

// ==========================================
// RCON AUTO-SAVE RECEIVER
// ==========================================
// We explicitly accept the zone ID from the RCON scanner
customZoneHandler.autoSaveLocation = async (guildId, x, y, z, zoneId) => {
    if (!zoneId) return;

    // Update the existing zone with the new coordinates
    await PveZone.update({
        posX: x.toString(),
        posY: y.toString(),
        posZ: z.toString()
    }, { where: { id: zoneId } });
};

// LIVE UPDATE HOOK FOR RCON MANAGER
customZoneHandler.refreshPanelViaInteraction = async (interaction, messageOverride) => {
    try {
        const payload = await buildPanelPayload(interaction.guild.id, messageOverride);
        await interaction.editReply(payload);
    } catch (e) {
        console.error("Failed to live-refresh Custom Zone panel:", e);
    }
};

module.exports = customZoneHandler;