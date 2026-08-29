const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { PveZone } = require('../database/db'); 
const { queueAdminPos, sendRconCommand } = require('../utils/rconManager'); 
const adminHandler = require('./adminHandler');

const czSessions = new Map();

const ZONE_COLORS = [
    { label: 'Red (Hostile / PvP)', value: '#FF0000', emoji: '🔴' },
    { label: 'Green (Safe / PvE)', value: '#00FF00', emoji: '🟢' },
    { label: 'Blue (Neutral)', value: '#0000FF', emoji: '🔵' },
    { label: 'Yellow (Warning)', value: '#FFFF00', emoji: '🟡' },
    { label: 'Purple (Event)', value: '#800080', emoji: '🟣' },
    { label: 'Orange (Build Zone)', value: '#FFA500', emoji: '🟠' },
    { label: 'White (Custom)', value: '#FFFFFF', emoji: '⚪' },
    { label: 'Black (Hidden)', value: '#000000', emoji: '⚫' }
];

const buildPanelPayload = async (guildId, messageOverride = '') => {
    if (!czSessions.has(guildId)) czSessions.set(guildId, { selectedZoneId: null, view: 'main' });
    const session = czSessions.get(guildId);
    
    const allZones = await PveZone.findAll({ where: { guildId }, order: [['id', 'ASC']] });
    let components = [];
    
    const embed = new EmbedBuilder().setColor('#e67e22').setTitle('🗺️ Custom Zone Builder');
    if (messageOverride) embed.setDescription(`**${messageOverride}**\n\n`);

    if (session.view === 'main') {
        let activeList = '';
        let inactiveList = '';

        for (const z of allZones) {
            const display = `**${z.name || 'Unnamed Zone'}** (${z.shape === 'box' ? 'Box' : 'Sphere'}, ${z.radius}m)\n`;
            if (z.isEnabled) activeList += `🟢 ${display}`;
            else inactiveList += `🔴 ${display}`;
        }

        embed.addFields(
            { name: '🟢 Active Zones', value: activeList || "*No active zones.*", inline: false },
            { name: '🔴 Disabled Zones', value: inactiveList || "*None.*", inline: false },
            { name: '🛠️ Manage Zones', value: "👇 **Click a zone below to manage its shape, flags, and rules.**", inline: false }
        );

        const row1 = new ActionRowBuilder();
        for (const z of allZones.slice(0, 4)) {
            row1.addComponents(new ButtonBuilder().setCustomId(`cz_load_${z.id}`).setLabel(z.name || 'Unnamed Zone').setStyle(ButtonStyle.Secondary).setEmoji('📍'));
        }
        
        row1.addComponents(new ButtonBuilder().setCustomId('cz_create_new').setLabel('➕ Create Zone').setStyle(ButtonStyle.Primary));
        components.push(row1);

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );
        components.push(row2);
    } 
    else if (session.view === 'zone') {
        const activeZone = await PveZone.findByPk(session.selectedZoneId);
        if (!activeZone) {
            session.view = 'main';
            return await buildPanelPayload(guildId, '❌ Zone not found.');
        }

        embed.setTitle(`📍 Managing Zone: ${activeZone.name || 'Unnamed Zone'}`);
        
        const rotationDisplay = activeZone.shape === 'box' ? `\n**Rotation:** ${activeZone.rotation || '0'}°` : '';
        const posText = (activeZone.posX && activeZone.posZ) 
            ? `\`X: ${activeZone.posX}, Y: ${activeZone.posY || '0'}, Z: ${activeZone.posZ}\`${rotationDisplay}` 
            : '*No center position saved. Click "Set Zone Center" below.*';

        const colorDisplay = ZONE_COLORS.find(c => c.value === activeZone.color)?.label || activeZone.color || 'Red';
        const shapeDisplay = activeZone.shape === 'box' ? '📦 Box Zone' : '🟢 Sphere Zone';

        embed.addFields(
            { name: `📊 Configuration`, value: `**Shape:** ${shapeDisplay}\n**Radius / Size:** ${activeZone.radius || 0}m\n**Color:** ${colorDisplay}\n**Map Vis:** ${activeZone.visible ? '👁️ Visible' : '🙈 Hidden'}\n**Status:** ${activeZone.isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}`, inline: true },
            { name: `⚙️ Rule Flags`, value: `**PvP:** ${activeZone.pvp ? '🟢 ON' : '🔴 OFF'}\n**PvE:** ${activeZone.pve ? '🟢 ON' : '🔴 OFF'}\n**Build:** ${activeZone.build ? '🟢 ON' : '🔴 OFF'}`, inline: true },
            { name: `💬 In-Game Messages`, value: `**Enter:** ${activeZone.enterMessage || '*None*'}\n**Exit:** ${activeZone.exitMessage || '*None*'}`, inline: false },
            { name: `🎯 Center Coordinates`, value: posText, inline: false }
        );

        const shapeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_settings').setLabel('Name & Size').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('cz_btn_shape').setLabel(`Shape: ${activeZone.shape === 'box' ? 'Box' : 'Sphere'}`).setStyle(ButtonStyle.Secondary).setEmoji('🔷'),
            new ButtonBuilder().setCustomId('cz_btn_color_menu').setLabel('Select Color').setStyle(ButtonStyle.Primary).setEmoji('🎨')
        );
        
        if (activeZone.shape === 'box') {
            shapeRow.addComponents(new ButtonBuilder().setCustomId('cz_btn_rotation').setLabel('Set Box Rotation').setStyle(ButtonStyle.Primary).setEmoji('🔄'));
        }
        
        components.push(shapeRow);

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_messages').setLabel('Set Messages').setStyle(ButtonStyle.Primary).setEmoji('💬'),
            new ButtonBuilder().setCustomId('cz_btn_getpos').setLabel('Set Zone Center').setStyle(ButtonStyle.Success).setEmoji('📍'),
            new ButtonBuilder().setCustomId('cz_btn_visible').setLabel(activeZone.visible ? 'Map Visible' : 'Map Hidden').setStyle(activeZone.visible ? ButtonStyle.Success : ButtonStyle.Secondary).setEmoji('👁️')
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_pvp').setLabel(`PvP: ${activeZone.pvp ? 'ON' : 'OFF'}`).setStyle(activeZone.pvp ? ButtonStyle.Success : ButtonStyle.Danger).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('cz_btn_pve').setLabel(`PvE: ${activeZone.pve ? 'ON' : 'OFF'}`).setStyle(activeZone.pve ? ButtonStyle.Success : ButtonStyle.Danger).setEmoji('🐻'),
            new ButtonBuilder().setCustomId('cz_btn_build').setLabel(`Build: ${activeZone.build ? 'ON' : 'OFF'}`).setStyle(activeZone.build ? ButtonStyle.Success : ButtonStyle.Danger).setEmoji('🔨')
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_toggle').setLabel(activeZone.isEnabled ? 'Disable Zone' : 'Enable Zone').setStyle(activeZone.isEnabled ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('⚡'),
            new ButtonBuilder().setCustomId('cz_btn_delete').setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji('💀'),
            new ButtonBuilder().setCustomId('cz_btn_back').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }
    else if (session.view === 'color_picker') {
        embed.setTitle('🎨 Select Zone Color').setDescription('Choose a color from the list for this zone.');
        
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cz_do_color').setPlaceholder('Select a color...')
            .addOptions(ZONE_COLORS)
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cz_btn_back_zone').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
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
        console.error("[CUSTOM ZONES] Failed to update UI:", err);
    }
}

const customZoneHandler = async (interaction, client) => {
    try {
        const member = interaction.member;
        const isOwner = interaction.guild?.ownerId === member.id;
        const isAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdminRole = member.roles.cache.some(role => 
            role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('owner') ||
            role.name.toLowerCase().includes('manager') || role.name.toLowerCase().includes('mod')
        );

        if (!isOwner && !isAdminPerm && !hasAdminRole) {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                return await interaction.reply({ content: '❌ **Access Denied.**', flags: 64 });
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

        if (customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
            return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
        }

        if (customId === 'admin_menu_select' || customId === 'setup_custom_zones') {
            session.view = 'main';
            return await renderCZPanel(interaction);
        }

        if (interaction.isModalSubmit() && customId === 'modal_cz_settings') {
            const newName = interaction.fields.getTextInputValue('cz_name').trim() || "New Zone";
            let radius = parseInt(interaction.fields.getTextInputValue('cz_radius'));
            if (isNaN(radius) || radius < 1) radius = 50; 

            if (session.selectedZoneId) {
                await PveZone.update({ name: newName, radius: radius.toString() }, { where: { id: session.selectedZoneId } });
            }
            return await renderCZPanel(interaction, `✅ Zone Name and Size saved!`);
        }

        if (interaction.isModalSubmit() && customId === 'modal_cz_messages') {
            const enterMsg = interaction.fields.getTextInputValue('cz_enter').trim();
            const exitMsg = interaction.fields.getTextInputValue('cz_exit').trim();
            if (session.selectedZoneId) {
                await PveZone.update({ enterMessage: enterMsg, exitMessage: exitMsg }, { where: { id: session.selectedZoneId } });
            }
            return await renderCZPanel(interaction, `💬 Zone Messages saved!`);
        }

        if (interaction.isModalSubmit() && customId === 'modal_cz_rotation') {
            let rot = parseInt(interaction.fields.getTextInputValue('cz_rot_val'));
            if (isNaN(rot)) rot = 0;
            if (session.selectedZoneId) {
                await PveZone.update({ rotation: rot.toString() }, { where: { id: session.selectedZoneId } });
            }
            return await renderCZPanel(interaction, `🔄 Zone Rotation saved!`);
        }

        if (customId === 'cz_do_color' && interaction.isStringSelectMenu()) {
            const color = interaction.values[0];
            await PveZone.update({ color }, { where: { id: session.selectedZoneId } });
            session.view = 'zone';
            return await renderCZPanel(interaction, `🎨 Zone Color updated!`);
        }

        if (interaction.isButton()) {
            if (customId === 'cz_create_new') {
                const newZone = await PveZone.create({ guildId, name: 'New Zone', radius: '50', shape: 'sphere', isEnabled: false });
                session.selectedZoneId = newZone.id;
                session.view = 'zone';
                return await renderCZPanel(interaction, `✨ Created a new zone!`);
            }

            if (customId.startsWith('cz_load_')) {
                session.selectedZoneId = parseInt(customId.replace('cz_load_', ''));
                session.view = 'zone';
                return await renderCZPanel(interaction);
            }

            if (customId === 'cz_btn_back') {
                session.selectedZoneId = null;
                session.view = 'main';
                return await renderCZPanel(interaction);
            }

            if (customId === 'cz_btn_back_zone') {
                session.view = 'zone';
                return await renderCZPanel(interaction);
            }

            if (customId === 'cz_btn_settings') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                const modal = new ModalBuilder().setCustomId('modal_cz_settings').setTitle(`Edit Zone Settings`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_name').setLabel("Zone Name").setStyle(TextInputStyle.Short).setValue(z.name || 'New Zone').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_radius').setLabel("Radius / Size (meters)").setStyle(TextInputStyle.Short).setValue((z.radius || '50')).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'cz_btn_rotation') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                const modal = new ModalBuilder().setCustomId('modal_cz_rotation').setTitle(`Set Box Rotation`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('cz_rot_val').setLabel("Rotation (0-360)").setStyle(TextInputStyle.Short).setValue((z.rotation || '0').toString()).setRequired(true)
                    )
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'cz_btn_shape') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                const newShape = z.shape === 'box' ? 'sphere' : 'box';
                await z.update({ shape: newShape });
                return await renderCZPanel(interaction, `🔷 Zone shape changed to **${newShape.toUpperCase()}**!`);
            }

            if (customId === 'cz_btn_color_menu') {
                session.view = 'color_picker';
                return await renderCZPanel(interaction);
            }

            if (customId === 'cz_btn_messages') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                const modal = new ModalBuilder().setCustomId('modal_cz_messages').setTitle(`Enter & Exit Messages`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_enter').setLabel("Enter Message (Leave blank for none)").setStyle(TextInputStyle.Paragraph).setValue(z.enterMessage || '').setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_exit').setLabel("Exit Message (Leave blank for none)").setStyle(TextInputStyle.Paragraph).setValue(z.exitMessage || '').setRequired(false))
                );
                return await interaction.showModal(modal);
            }

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
                const willBeEnabled = !z.isEnabled;
                await z.update({ isEnabled: willBeEnabled });

                try {
                    if (willBeEnabled && z.posX && z.posZ) {
                        let rgbColor = "(255,0,0)";
                        if (z.color && z.color.startsWith('#')) {
                            const hex = z.color.replace('#', '');
                            const r = parseInt(hex.substring(0, 2), 16) || 255;
                            const g = parseInt(hex.substring(2, 4), 16) || 0;
                            const b = parseInt(hex.substring(4, 6), 16) || 0;
                            rgbColor = `(${r},${g},${b})`;
                        }

                        const shapeType = z.shape === 'box' ? 'Box' : 'Sphere';
                        const sizeParam = z.shape === 'box' ? `(${z.radius},${z.radius},${z.radius})` : `${z.radius}`;
                        const pvpVal = z.pvp ? 1 : 0;
                        const pveVal = z.pve ? 1 : 0;
                        const buildDmgVal = 0; 
                        const buildVal = z.build ? 1 : 0;
                        const showAreaVal = z.visible ? 1 : 0;
                        
                        // INJECTING ROTATION HERE (defaults to 0 if none is set)
                        const rotVal = (z.shape === 'box' && z.rotation) ? z.rotation : '0';

                        const createCmd = `zones.createcustomzone "${z.name}" (${z.posX},${z.posY || 35},${z.posZ}) ${rotVal} ${shapeType} ${sizeParam} ${pvpVal} ${pveVal} 0 ${buildDmgVal} ${buildVal}`;
                        await sendRconCommand(guildId, createCmd, client);

                        await sendRconCommand(guildId, `zones.editcustomzone "${z.name}" "showarea" "${showAreaVal}"`, client);
                        await sendRconCommand(guildId, `zones.editcustomzone "${z.name}" "color" "${rgbColor}"`, client);

                        if (z.enterMessage) {
                            await sendRconCommand(guildId, `zones.editcustomzone "${z.name}" "entermessage" "${z.enterMessage}"`, client);
                        }
                        if (z.exitMessage) {
                            await sendRconCommand(guildId, `zones.editcustomzone "${z.name}" "leavemessage" "${z.exitMessage}"`, client);
                        }
                    } else if (!willBeEnabled) {
                        await sendRconCommand(guildId, `zones.deletecustomzone "${z.name}"`, client);
                    }
                } catch (err) {
                    console.error("[RCON NATIVE ZONE ERROR]", err);
                }

                return await renderCZPanel(interaction, `⚡ Zone is now **${willBeEnabled ? 'ENABLED & Ring Spawned' : 'DISABLED & Deleted'}** on the server!`);
            }

            if (customId === 'cz_btn_delete') {
                const z = await PveZone.findByPk(session.selectedZoneId);
                if (z) {
                    try {
                        await sendRconCommand(guildId, `zones.deletecustomzone "${z.name}"`, client);
                    } catch(e) {}
                    await z.destroy();
                }
                
                session.selectedZoneId = null;
                session.view = 'main';
                return await renderCZPanel(interaction, `💀 Zone completely deleted from bot database and live server.`);
            }

            // === POSITION LOGIC KEPT EXACTLY THE SAME ===
            if (customId === 'cz_btn_getpos') {
                const loadingPayload = await buildPanelPayload(guildId, '⏳ **Extracting your position from the server...**');
                await interaction.update(loadingPayload);
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

// === LOCATION SAVER KEPT EXACTLY THE SAME ===
customZoneHandler.autoSaveLocation = async (guildId, x, y, z, zoneId) => {
    if (!zoneId) return;
    await PveZone.update({
        posX: x.toString(),
        posY: y.toString(),
        posZ: z.toString()
    }, { where: { id: zoneId } });
};

// === REFRESH LOGIC KEPT EXACTLY THE SAME ===
customZoneHandler.refreshPanelViaInteraction = async (interaction, messageOverride, zoneId = null) => {
    try {
        const guildId = interaction.guild.id;
        if (zoneId) {
            if (!czSessions.has(guildId)) czSessions.set(guildId, { selectedZoneId: zoneId, view: 'zone' });
            const session = czSessions.get(guildId);
            session.selectedZoneId = zoneId;
            session.view = 'zone';
            czSessions.set(guildId, session);
        }

        const payload = await buildPanelPayload(guildId, messageOverride);
        await interaction.editReply(payload);
    } catch (e) {}
};

module.exports = customZoneHandler;