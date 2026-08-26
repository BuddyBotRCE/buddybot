const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { PveZone } = require('../database/db'); 
const { queueAdminPos } = require('../utils/rconManager'); 

const czSessions = new Map();

// =======================================================
// LAYOUT BUILDER (Decoupled for Live RCON Refresh!)
// =======================================================
const buildPanelPayload = async (guildId, messageOverride = '') => {
    if (!czSessions.has(guildId)) czSessions.set(guildId, { selectedZoneId: null, view: 'main' });
    const session = czSessions.get(guildId);
    
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
            { name: '🛠️ Manage Zones', value: "👇 **Click a zone below to manage its flags and rules.**", inline: false }
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

        // Display Zone Info with all new flags
        embed.addFields(
            { name: `📊 Zone Configuration`, value: `**Radius:** ${activeZone.radius || 0}m\n**Color:** \`${activeZone.color || '#FF0000'}\`\n**Map Visibility:** ${activeZone.visible ? '👁️ Visible' : '🙈 Hidden'}\n**Status:** ${activeZone.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}`, inline: true },
            { name: `⚙️ Rule Flags`, value: `**PvP:** ${activeZone.pvp ? '🟢 ON' : '🔴 OFF'}\n**PvE:** ${activeZone.pve ? '🟢 ON' : '🔴 OFF'}\n**Building:** ${activeZone.build ? '🟢 ON' : '🔴 OFF'}`, inline: true },
            { name: `🎯 Center Coordinates`, value: posText, inline: false }
        );

        // Row 1: Core Configurations (Name, Color, Pos)
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_settings').setLabel('Name & Radius').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('cz_btn_color').setLabel('Set Color').setStyle(ButtonStyle.Primary).setEmoji('🎨'),
            new ButtonBuilder().setCustomId('cz_btn_getpos').setLabel('Set Zone Center').setStyle(ButtonStyle.Success).setEmoji('📍')
        ));

        // Row 2: Game Rule Toggles
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_pvp').setLabel(`PvP: ${activeZone.pvp ? 'ON' : 'OFF'}`).setStyle(activeZone.pvp ? ButtonStyle.Success : ButtonStyle.Danger).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('cz_btn_pve').setLabel(`PvE: ${activeZone.pve ? 'ON' : 'OFF'}`).setStyle(activeZone.pve ? ButtonStyle.Success : ButtonStyle.Danger).setEmoji('🐻'),
            new ButtonBuilder().setCustomId('cz_btn_build').setLabel(`Build: ${activeZone.build ? 'ON' : 'OFF'}`).setStyle(activeZone.build ? ButtonStyle.Success : ButtonStyle.Danger).setEmoji('🔨')
        ));

        // Row 3: Visibility, Enable/Disable, Delete, Back
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_visible').setLabel(activeZone.visible ? 'Visible' : 'Hidden').setStyle(activeZone.visible ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId('cz_btn_toggle').setLabel(activeZone.isEnabled ? 'Disable Zone' : 'Enable Zone').setStyle(activeZone.isEnabled ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('⚡'),
            new ButtonBuilder().setCustomId('cz_btn_delete').setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji('💀'),
            new ButtonBuilder().setCustomId('cz_btn_back').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
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
            if (isNaN(radius) || radius < 1) radius = 50; 

            if (session.selectedZoneId) {
                await PveZone.update({ name: newName, radius: radius }, { where: { id: session.selectedZoneId } });
            }
            return await renderCZPanel(interaction, `✅ Zone Name and Radius saved!`);
        }

        if (interaction.isModalSubmit() && customId === 'modal_cz_color') {
            const newColor = interaction.fields.getTextInputValue('cz_color').trim() || "#FF0000";
            if (session.selectedZoneId) {
                await PveZone.update({ color: newColor }, { where: { id: session.selectedZoneId } });
            }
            return await renderCZPanel(interaction, `🎨 Zone Color saved!`);
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

            // Edit Color Modal
            if (customId === 'cz_btn_color') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                const modal = new ModalBuilder().setCustomId('modal_cz_color').setTitle(`Edit Zone Color`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_color').setLabel("Color Hex (e.g. #FF0000 or red)").setStyle(TextInputStyle.Short).setValue(z.color || '#FF0000').setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            // --- 1-CLICK INSTANT TOGGLES ---
            if (customId === 'cz_btn_pvp') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                await z.update({ pvp: !z.pvp });
                return await renderCZPanel(interaction, `⚔️ PvP is now **${!z.pvp ? 'ON' : 'OFF'}** in this zone!`);
            }
            if (customId === 'cz_btn_pve') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                await z.update({ pve: !z.pve });
                return await renderCZPanel(interaction, `🐻 PvE is now **${!z.pve ? 'ON' : 'OFF'}** in this zone!`);
            }
            if (customId === 'cz_btn_build') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                await z.update({ build: !z.build });
                return await renderCZPanel(interaction, `🔨 Building is now **${!z.build ? 'ON' : 'OFF'}** in this zone!`);
            }
            if (customId === 'cz_btn_visible') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                await z.update({ visible: !z.visible });
                return await renderCZPanel(interaction, `👁️ Map Visibility is now **${!z.visible ? 'VISIBLE' : 'HIDDEN'}**!`);
            }
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
                // Visually update the panel IMMEDIATELY to show it is loading
                const loadingPayload = await buildPanelPayload(guildId, '⏳ **Extracting your position from the server...**');
                await interaction.update(loadingPayload);
                
                // Hand the interaction over to the RCON scanner
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
customZoneHandler.autoSaveLocation = async (guildId, x, y, z, zoneId) => {
    if (!zoneId) return;
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