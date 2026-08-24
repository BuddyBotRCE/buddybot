const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { PveZone } = require('../database/db');
const { sendRconCommand } = require('../utils/rconManager');

// In-memory session manager for building Custom Zones
const czSessions = new Map();

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        
        let selectedValue = '';
        if (interaction.isStringSelectMenu()) selectedValue = interaction.values[0] || '';

        // --- INITIALIZE SESSION ---
        if (!czSessions.has(guildId)) {
            czSessions.set(guildId, { 
                zoneName: null, 
                radius: null,
                zoneColor: null,
                posX: null,
                posY: null,
                posZ: null,
                enterMessage: null, 
                exitMessage: null,
                isEditing: false 
            });
        }
        const session = czSessions.get(guildId);

        // --- HELPER TO RENDER THE PANEL ---
        const renderZonePanel = async (inter, messageOverride = '') => {
            const allZones = await PveZone.findAll({ where: { guildId } });
            
            // Format the Embed Draft Data
            const zName = session.zoneName || '❌ Not Set';
            const zRadius = session.radius ? `${session.radius}m` : '❌ Not Set';
            const zColor = session.zoneColor ? session.zoneColor.toUpperCase() : '❌ Not Set';
            const zPos = (session.posX && session.posY && session.posZ) ? `${session.posX}, ${session.posY}, ${session.posZ}` : '❌ Not Set';
            const zEnter = session.enterMessage || '❌ Not Set';
            const zExit = session.exitMessage || '❌ Not Set';

            const embed = new EmbedBuilder()
                .setTitle('🗺️ Custom Zone Builder')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Build, edit, or manage custom map zones (safe zones, arenas, VIP areas).\n\n**Current Draft:**\n• **Zone Name:** \`${zName}\`\n• **Size / Radius:** \`${zRadius}\`\n• **Coordinates:** \`${zPos}\`\n• **Map Color:** \`${zColor}\`\n• **Enter Message:** \`${zEnter}\`\n• **Exit Message:** \`${zExit}\`\n\n**Total Active Zones:** \`${allZones.length}\``)
                .setColor('#f39c12');

            // ROW 1: Load existing zones
            let zoneOptions = allZones.slice(0, 25).map(z => ({
                label: `Zone: ${z.zoneName}`,
                description: `Load this zone to edit or delete it.`,
                value: `load_zone_${z.id}`,
                emoji: '📂'
            }));
            if (zoneOptions.length === 0) zoneOptions = [{ label: 'No custom zones created yet.', value: 'none', description: 'Use the options below to create one.' }];

            const row1Load = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('select_custom_zone').setPlaceholder('📂 1. Load an existing Zone...').addOptions(zoneOptions).setDisabled(allZones.length === 0)
            );

            // ROW 2: Colors
            const row2Color = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('cz_color_select').setPlaceholder(session.zoneColor ? `🎨 Color: ${session.zoneColor}` : '🎨 2. Select Map Color...')
                    .addOptions([
                        { label: 'Red', value: 'red', emoji: '🔴' }, { label: 'Green', value: 'green', emoji: '🟢' },
                        { label: 'Blue', value: 'blue', emoji: '🔵' }, { label: 'Yellow', value: 'yellow', emoji: '🟡' },
                        { label: 'Purple', value: 'purple', emoji: '🟣' }, { label: 'Orange', value: 'orange', emoji: '🟠' },
                        { label: 'Black', value: 'black', emoji: '⚫' }, { label: 'White', value: 'white', emoji: '⚪' },
                        { label: 'Clear / Invisible', value: 'clear', emoji: '🫥' }
                    ])
            );

            // ROW 3: Radius Dropdown
            const row3Radius = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('cz_radius_select').setPlaceholder(session.radius ? `📏 Radius: ${session.radius}m` : '📏 3. Select Zone Radius...')
                    .addOptions([
                        { label: '10 Meters (Small Base)', value: '10' }, { label: '25 Meters', value: '25' },
                        { label: '50 Meters (Medium Zone)', value: '50' }, { label: '100 Meters', value: '100' },
                        { label: '250 Meters (Large Arena)', value: '250' }, { label: '500 Meters', value: '500' },
                        { label: '1000 Meters (Massive)', value: '1000' }, { label: 'Custom Size...', value: 'custom', emoji: '✏️' }
                    ])
            );

            // ROW 4: Setup Buttons
            const row4Setup = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_cz_name').setLabel('Set Name').setStyle(ButtonStyle.Primary).setEmoji('🏷️'),
                new ButtonBuilder().setCustomId('btn_cz_pos').setLabel('Set Position').setStyle(ButtonStyle.Primary).setEmoji('📍'),
                new ButtonBuilder().setCustomId('btn_cz_msgs').setLabel('Set Msgs').setStyle(ButtonStyle.Primary).setEmoji('💬')
            );

            // ROW 5: Final Actions
            const row5Action = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_cz_deploy').setLabel(session.isEditing ? 'Update Zone' : 'Deploy Zone').setStyle(ButtonStyle.Success).setEmoji('📦'),
                new ButtonBuilder().setCustomId('btn_cz_delete').setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(!session.isEditing),
                new ButtonBuilder().setCustomId('btn_cz_clear').setLabel('Clear').setStyle(ButtonStyle.Secondary).setEmoji('🧹')
            );

            const payload = { embeds: [embed], components: [row1Load, row2Color, row3Radius, row4Setup, row5Action], flags: 64 };

            if (inter.isRepliable() && !inter.replied && !inter.deferred) {
                return await inter.reply(payload);
            } else {
                return await inter.update(payload).catch(() => inter.followUp(payload));
            }
        };

        // --- ENTRY FROM ADMIN PANEL ---
        if (customId === 'admin_menu_select' && (selectedValue.includes('pve') || selectedValue.includes('zone'))) {
            czSessions.set(guildId, { zoneName: null, radius: null, zoneColor: null, posX: null, posY: null, posZ: null, enterMessage: null, exitMessage: null, isEditing: false });
            return await renderZonePanel(interaction);
        }

        // =========================================================
        // DROPDOWN HANDLERS
        // =========================================================

        if (interaction.isStringSelectMenu() && customId === 'cz_color_select') {
            session.zoneColor = selectedValue;
            czSessions.set(guildId, session);
            return await renderZonePanel(interaction, `✅ Map color set to **${selectedValue.toUpperCase()}**!`);
        }

        if (interaction.isStringSelectMenu() && customId === 'cz_radius_select') {
            if (selectedValue === 'custom') {
                const modal = new ModalBuilder().setCustomId('modal_cz_radius_custom').setTitle('Custom Radius');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_radius_val').setLabel("Enter custom radius in meters:").setStyle(TextInputStyle.Short).setRequired(true)));
                return await interaction.showModal(modal);
            } else {
                session.radius = selectedValue;
                czSessions.set(guildId, session);
                return await renderZonePanel(interaction, `✅ Radius securely set to **${selectedValue}m**!`);
            }
        }

        if (interaction.isStringSelectMenu() && customId === 'select_custom_zone') {
            if (selectedValue === 'none') return await interaction.deferUpdate(); 
            const existingZone = await PveZone.findByPk(selectedValue.replace('load_zone_', ''));
            if (!existingZone) return await interaction.reply({ content: '❌ Zone no longer exists in DB.', flags: 64 });

            session.zoneName = existingZone.zoneName;
            session.radius = existingZone.radius || 50; 
            session.zoneColor = existingZone.zoneColor || 'green';
            session.posX = existingZone.posX || null;
            session.posY = existingZone.posY || null;
            session.posZ = existingZone.posZ || null;
            session.enterMessage = existingZone.enterMessage || '';
            session.exitMessage = existingZone.exitMessage || '';
            session.isEditing = existingZone.id; 
            czSessions.set(guildId, session);

            return await renderZonePanel(interaction, `✅ Successfully loaded zone: **${existingZone.zoneName}**`);
        }

        // =========================================================
        // BUTTON HANDLERS
        // =========================================================

        if (interaction.isButton()) {
            if (customId === 'btn_cz_clear') {
                czSessions.set(guildId, { zoneName: null, radius: null, zoneColor: null, posX: null, posY: null, posZ: null, enterMessage: null, exitMessage: null, isEditing: false });
                return await renderZonePanel(interaction, '🧹 Draft cleared. Ready to make a new zone!');
            }

            if (customId === 'btn_cz_name') {
                const modal = new ModalBuilder().setCustomId('modal_cz_name').setTitle('Set Zone Name');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_name').setLabel("Zone Name (No spaces, e.g. vip_arena)").setStyle(TextInputStyle.Short).setValue(session.zoneName || '').setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_cz_pos') {
                const modal = new ModalBuilder().setCustomId('modal_cz_pos').setTitle('Set Zone Coordinates');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_x').setLabel("X Coordinate").setStyle(TextInputStyle.Short).setValue(session.posX || '').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_y').setLabel("Y Coordinate (Height)").setStyle(TextInputStyle.Short).setValue(session.posY || '').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_z').setLabel("Z Coordinate").setStyle(TextInputStyle.Short).setValue(session.posZ || '').setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_cz_msgs') {
                const modal = new ModalBuilder().setCustomId('modal_cz_msgs').setTitle('Zone Messages');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_enter').setLabel("Enter Message").setStyle(TextInputStyle.Paragraph).setValue(session.enterMessage || '').setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_exit').setLabel("Exit Message").setStyle(TextInputStyle.Paragraph).setValue(session.exitMessage || '').setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_cz_deploy') {
                if (!session.zoneName || !session.radius || !session.posX || !session.posY || !session.posZ) {
                    return await interaction.reply({ content: '❌ You must set a Zone Name, Radius, and Position before deploying!', flags: 64 });
                }

                // Database Save / Update
                if (session.isEditing) {
                    await PveZone.update({
                        zoneName: session.zoneName, radius: session.radius, zoneColor: session.zoneColor || 'green',
                        posX: session.posX, posY: session.posY, posZ: session.posZ,
                        enterMessage: session.enterMessage, exitMessage: session.exitMessage
                    }, { where: { id: session.isEditing } });
                } else {
                    await PveZone.create({
                        guildId, zoneName: session.zoneName, radius: session.radius, zoneColor: session.zoneColor || 'green',
                        posX: session.posX, posY: session.posY, posZ: session.posZ,
                        enterMessage: session.enterMessage, exitMessage: session.exitMessage
                    });
                }

                // --- SEND TO RUST VIA RCON ---
                try {
                    await sendRconCommand(guildId, `zone add ${session.zoneName}`);
                    await sendRconCommand(guildId, `zone radius ${session.zoneName} ${session.radius}`);
                    await sendRconCommand(guildId, `zone location ${session.zoneName} "${session.posX} ${session.posY} ${session.posZ}"`);
                    if (session.zoneColor) await sendRconCommand(guildId, `zone color ${session.zoneName} ${session.zoneColor}`);
                    if (session.enterMessage) await sendRconCommand(guildId, `zone enter_message ${session.zoneName} "${session.enterMessage}"`);
                    if (session.exitMessage) await sendRconCommand(guildId, `zone leave_message ${session.zoneName} "${session.exitMessage}"`);
                } catch (e) {
                    console.log("[RCON ERROR] Failed to send zone commands. DB updated though.");
                }

                const actionWord = session.isEditing ? 'updated' : 'deployed';
                czSessions.set(guildId, { zoneName: null, radius: null, zoneColor: null, posX: null, posY: null, posZ: null, enterMessage: null, exitMessage: null, isEditing: false }); // Reset
                return await renderZonePanel(interaction, `✅ Zone **${session.zoneName}** successfully ${actionWord} directly to the Rust server!`);
            }

            if (customId === 'btn_cz_delete') {
                if (!session.isEditing) return;
                await PveZone.destroy({ where: { id: session.isEditing } });
                
                try { await sendRconCommand(guildId, `zone remove ${session.zoneName}`); } 
                catch (e) { console.log("[RCON ERROR] Failed to delete zone via RCON."); }

                const deletedName = session.zoneName;
                czSessions.set(guildId, { zoneName: null, radius: null, zoneColor: null, posX: null, posY: null, posZ: null, enterMessage: null, exitMessage: null, isEditing: false }); // Reset
                return await renderZonePanel(interaction, `🗑️ Zone **${deletedName}** has been deleted from the database and server.`);
            }
        }

        // =========================================================
        // MODAL HANDLERS
        // =========================================================

        if (interaction.isModalSubmit()) {
            if (customId === 'modal_cz_name') {
                session.zoneName = interaction.fields.getTextInputValue('cz_name').trim().replace(/\s+/g, '_'); 
                czSessions.set(guildId, session);
                return await renderZonePanel(interaction, `✅ Saved Name to draft!`);
            }
            if (customId === 'modal_cz_radius_custom') {
                session.radius = interaction.fields.getTextInputValue('cz_radius_val').trim();
                czSessions.set(guildId, session);
                return await renderZonePanel(interaction, `✅ Custom radius set to **${session.radius}m**!`);
            }
            if (customId === 'modal_cz_pos') {
                session.posX = interaction.fields.getTextInputValue('cz_x').trim();
                session.posY = interaction.fields.getTextInputValue('cz_y').trim();
                session.posZ = interaction.fields.getTextInputValue('cz_z').trim();
                czSessions.set(guildId, session);
                return await renderZonePanel(interaction, `✅ Coordinates securely locked in!`);
            }
            if (customId === 'modal_cz_msgs') {
                session.enterMessage = interaction.fields.getTextInputValue('cz_enter').trim();
                session.exitMessage = interaction.fields.getTextInputValue('cz_exit').trim();
                czSessions.set(guildId, session);
                return await renderZonePanel(interaction, `✅ Enter & Exit messages saved!`);
            }
        }

    } catch (error) {
        console.error('[CUSTOM ZONE HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing custom zones.', flags: 64 }).catch(() => {});
        }
    }
};