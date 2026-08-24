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
                enterMessage: null, 
                exitMessage: null,
                zoneColor: null, // Track Color
                isEditing: false // Tracks if we loaded an existing zone
            });
        }
        const session = czSessions.get(guildId);

        // --- HELPER TO RENDER THE PANEL ---
        const renderZonePanel = async (inter, messageOverride = '') => {
            const allZones = await PveZone.findAll({ where: { guildId } });
            
            // Format the Embed Draft Data
            const zName = session.zoneName || '❌ Not Set';
            const zRadius = session.radius ? `${session.radius} meters` : '❌ Not Set';
            const zColor = session.zoneColor ? session.zoneColor.toUpperCase() : '❌ Not Set';
            const zEnter = session.enterMessage || '❌ Not Set';
            const zExit = session.exitMessage || '❌ Not Set';

            const embed = new EmbedBuilder()
                .setTitle('🗺️ Custom Zone Builder')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Build, edit, or manage custom map zones (safe zones, arenas, VIP areas).\n\n**Current Draft:**\n• **Zone Name:** \`${zName}\`\n• **Size / Radius:** \`${zRadius}\`\n• **Map Color:** \`${zColor}\`\n• **Enter Message:** \`${zEnter}\`\n• **Exit Message:** \`${zExit}\`\n\n**Total Active Zones:** \`${allZones.length}\``)
                .setColor('#f39c12');

            // Dropdown to load existing zones
            let zoneOptions = allZones.slice(0, 25).map(z => ({
                label: `Zone: ${z.zoneName}`,
                description: `Load this zone to edit or delete it.`,
                value: `load_zone_${z.id}`,
                emoji: '📍'
            }));

            if (zoneOptions.length === 0) {
                zoneOptions = [{ label: 'No custom zones created yet.', value: 'none', description: 'Use the buttons below to create one.' }];
            }

            const dropdownRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_custom_zone')
                    .setPlaceholder('📂 Load an existing Custom Zone...')
                    .addOptions(zoneOptions)
                    .setDisabled(allZones.length === 0)
            );

            // FULLY EXPANDED 25-COLOR DROPDOWN (Discord's Maximum Limit)
            const colorRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('cz_color_select')
                    .setPlaceholder(session.zoneColor ? `🎨 Color Selected: ${session.zoneColor}` : '🎨 Select a Map Color...')
                    .addOptions([
                        { label: 'Red', value: 'red', emoji: '🔴' },
                        { label: 'Green', value: 'green', emoji: '🟢' },
                        { label: 'Blue', value: 'blue', emoji: '🔵' },
                        { label: 'Yellow', value: 'yellow', emoji: '🟡' },
                        { label: 'Orange', value: 'orange', emoji: '🟠' },
                        { label: 'Purple', value: 'purple', emoji: '🟣' },
                        { label: 'Pink', value: 'pink', emoji: '🩷' },
                        { label: 'Light Blue', value: 'lightblue', emoji: '🩵' },
                        { label: 'Cyan', value: 'cyan', emoji: '🌐' },
                        { label: 'Teal', value: 'teal', emoji: '🦚' },
                        { label: 'Lime', value: 'lime', emoji: '🍋' },
                        { label: 'Magenta', value: 'magenta', emoji: '🌺' },
                        { label: 'Violet', value: 'violet', emoji: '🔮' },
                        { label: 'Indigo', value: 'indigo', emoji: '🌌' },
                        { label: 'Navy', value: 'navy', emoji: '⚓' },
                        { label: 'Maroon', value: 'maroon', emoji: '🍷' },
                        { label: 'Brown', value: 'brown', emoji: '🟤' },
                        { label: 'Olive', value: 'olive', emoji: '🫒' },
                        { label: 'Coral', value: 'coral', emoji: '🪸' },
                        { label: 'Gold', value: 'gold', emoji: '🪙' },
                        { label: 'Silver', value: 'silver', emoji: '🥈' },
                        { label: 'Black', value: 'black', emoji: '⚫' },
                        { label: 'Grey', value: 'grey', emoji: '🩶' },
                        { label: 'White', value: 'white', emoji: '⚪' },
                        { label: 'Clear / Invisible', value: 'clear', emoji: '🫥' }
                    ])
            );

            // Action Buttons
            const actionRow1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_cz_basic').setLabel('Set Name & Size').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_cz_msgs').setLabel('Set Enter/Exit Text').setStyle(ButtonStyle.Primary).setEmoji('💬')
            );

            const actionRow2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_cz_deploy').setLabel(session.isEditing ? 'Update Zone' : 'Deploy New Zone').setStyle(ButtonStyle.Success).setEmoji('📦'),
                new ButtonBuilder().setCustomId('btn_cz_delete').setLabel('Delete Loaded Zone').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(!session.isEditing),
                new ButtonBuilder().setCustomId('btn_cz_clear').setLabel('Clear Draft').setStyle(ButtonStyle.Secondary).setEmoji('🧹')
            );

            const payload = { embeds: [embed], components: [dropdownRow, colorRow, actionRow1, actionRow2], flags: 64 };

            if (inter.isRepliable() && !inter.replied && !inter.deferred) {
                return await inter.reply(payload);
            } else {
                return await inter.update(payload).catch(() => inter.followUp(payload));
            }
        };

        // --- ENTRY FROM ADMIN PANEL ---
        if (customId === 'admin_menu_select' && selectedValue === 'setup_pve_zones') {
            czSessions.set(guildId, { zoneName: null, radius: null, enterMessage: null, exitMessage: null, zoneColor: null, isEditing: false });
            return await renderZonePanel(interaction);
        }

        // --- HANDLE ZONE COLOR SELECTION ---
        if (interaction.isStringSelectMenu() && customId === 'cz_color_select') {
            session.zoneColor = selectedValue;
            czSessions.set(guildId, session);
            return await renderZonePanel(interaction, `✅ Map color set to **${selectedValue.toUpperCase()}**!`);
        }

        // --- LOAD EXISTING ZONE FROM DROPDOWN ---
        if (interaction.isStringSelectMenu() && customId === 'select_custom_zone') {
            if (selectedValue === 'none') return await interaction.deferUpdate(); 
            
            const dbZoneId = selectedValue.replace('load_zone_', '');
            const existingZone = await PveZone.findByPk(dbZoneId);
            
            if (!existingZone) return await interaction.reply({ content: '❌ Zone no longer exists in DB.', flags: 64 });

            // Load DB data into memory session
            session.zoneName = existingZone.zoneName;
            session.radius = existingZone.radius || 50; 
            session.zoneColor = existingZone.zoneColor || 'green'; // Load color
            session.enterMessage = existingZone.enterMessage || '';
            session.exitMessage = existingZone.exitMessage || '';
            session.isEditing = existingZone.id; 
            czSessions.set(guildId, session);

            return await renderZonePanel(interaction, `✅ Successfully loaded zone: **${existingZone.zoneName}**`);
        }

        // --- BUTTONS ---
        if (interaction.isButton()) {
            if (customId === 'btn_cz_clear') {
                czSessions.set(guildId, { zoneName: null, radius: null, enterMessage: null, exitMessage: null, zoneColor: null, isEditing: false });
                return await renderZonePanel(interaction, '🧹 Draft cleared. Ready to make a new zone!');
            }

            if (customId === 'btn_cz_basic') {
                const modal = new ModalBuilder().setCustomId('modal_cz_basic').setTitle('Zone Name & Size');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_name').setLabel("Zone Name (No spaces, e.g. vip_arena)").setStyle(TextInputStyle.Short).setValue(session.zoneName || '').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_radius').setLabel("Radius in meters (e.g. 50)").setStyle(TextInputStyle.Short).setValue(session.radius ? session.radius.toString() : '').setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_cz_msgs') {
                const modal = new ModalBuilder().setCustomId('modal_cz_msgs').setTitle('Zone Messages');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_enter').setLabel("Enter Message").setStyle(TextInputStyle.Paragraph).setValue(session.enterMessage || '').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cz_exit').setLabel("Exit Message").setStyle(TextInputStyle.Paragraph).setValue(session.exitMessage || '').setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_cz_deploy') {
                if (!session.zoneName || !session.radius) {
                    return await interaction.reply({ content: '❌ You must set a Zone Name and Radius before deploying!', flags: 64 });
                }

                // Database Save / Update
                if (session.isEditing) {
                    await PveZone.update({
                        zoneName: session.zoneName,
                        radius: session.radius,
                        zoneColor: session.zoneColor || 'green', // Save Color
                        enterMessage: session.enterMessage,
                        exitMessage: session.exitMessage
                    }, { where: { id: session.isEditing } });
                } else {
                    await PveZone.create({
                        guildId,
                        zoneName: session.zoneName,
                        radius: session.radius,
                        zoneColor: session.zoneColor || 'green', // Save Color
                        enterMessage: session.enterMessage,
                        exitMessage: session.exitMessage
                    });
                }

                // Send RCON Command
                try {
                    await sendRconCommand(guildId, `zone add ${session.zoneName} ${session.radius}`);
                    
                    // Sending Color if plugin supports it:
                    if (session.zoneColor) {
                        await sendRconCommand(guildId, `zone color ${session.zoneName} ${session.zoneColor}`);
                    }

                    if (session.enterMessage) await sendRconCommand(guildId, `zone enter_message ${session.zoneName} "${session.enterMessage}"`);
                    if (session.exitMessage) await sendRconCommand(guildId, `zone leave_message ${session.zoneName} "${session.exitMessage}"`);
                } catch (e) {
                    console.log("[RCON ERROR] Failed to send zone commands. DB updated though.");
                }

                const actionWord = session.isEditing ? 'updated' : 'created';
                czSessions.set(guildId, { zoneName: null, radius: null, enterMessage: null, exitMessage: null, zoneColor: null, isEditing: false }); // Reset
                return await renderZonePanel(interaction, `✅ Zone **${session.zoneName}** successfully ${actionWord} and sent to server!`);
            }

            if (customId === 'btn_cz_delete') {
                if (!session.isEditing) return;

                await PveZone.destroy({ where: { id: session.isEditing } });
                
                try {
                    await sendRconCommand(guildId, `zones.deletecustomzone "${session.zoneName}"`);
                } catch (e) {
                    console.log("[RCON ERROR] Failed to delete zone via RCON.");
                }

                const deletedName = session.zoneName;
                czSessions.set(guildId, { zoneName: null, radius: null, enterMessage: null, exitMessage: null, zoneColor: null, isEditing: false }); // Reset
                return await renderZonePanel(interaction, `🗑️ Zone **${deletedName}** has been deleted from the database and server.`);
            }
        }

        // --- HANDLE MODALS ---
        if (interaction.isModalSubmit()) {
            if (customId === 'modal_cz_basic') {
                session.zoneName = interaction.fields.getTextInputValue('cz_name').trim().replace(/\s+/g, '_'); 
                session.radius = interaction.fields.getTextInputValue('cz_radius').trim();
                czSessions.set(guildId, session);
                return await renderZonePanel(interaction, `✅ Saved Name & Size to draft!`);
            }
            if (customId === 'modal_cz_msgs') {
                session.enterMessage = interaction.fields.getTextInputValue('cz_enter').trim();
                session.exitMessage = interaction.fields.getTextInputValue('cz_exit').trim();
                czSessions.set(guildId, session);
                return await renderZonePanel(interaction, `✅ Saved Enter & Exit messages to draft!`);
            }
        }

    } catch (error) {
        console.error('[CUSTOM ZONE HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing custom zones.', flags: 64 }).catch(() => {});
        }
    }
};