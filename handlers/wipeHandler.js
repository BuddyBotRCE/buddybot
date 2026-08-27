const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, UserEconomy, PveZone, CustomBind } = require('../database/db');
const { sendRconCommand } = require('../utils/rconManager');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';

    try {
        // 1. Initial Panel Trigger (From Admin Menu)
        if (interaction.isStringSelectMenu() && interaction.values && interaction.values[0] === 'setup_wipe') {
            const embed = new EmbedBuilder()
                .setTitle('☢️ Server Wipe Manager')
                .setDescription('Select how you want to wipe the server databases.\n\n**Full Wipe:** Wipes all economy, stats, zones, teleports, and custom binds.\n**Selective Wipe:** Choose exactly which databases to clear.')
                .setColor('#e74c3c');
                
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_wipe_full').setLabel('Full Wipe').setStyle(ButtonStyle.Danger).setEmoji('☢️'), 
                new ButtonBuilder().setCustomId('btn_wipe_selective').setLabel('Selective Wipe').setStyle(ButtonStyle.Primary).setEmoji('🗂️')
            );
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }

        // 2. Button Handlers
        if (interaction.isButton()) {
            if (customId === 'btn_wipe_full') {
                const modal = new ModalBuilder().setCustomId('modal_wipe_full').setTitle('Confirm FULL Wipe');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm_text').setLabel('Type WIPE to permanently delete everything').setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }
            if (customId === 'btn_wipe_selective') {
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('select_wipe_custom').setPlaceholder('Select data to wipe...').setMinValues(1).setMaxValues(5).addOptions([
                        { label: 'Economy & Banks', value: 'wipe_econ', emoji: '💰' }, 
                        { label: 'BuddyPass Progress', value: 'wipe_bp', emoji: '⭐' }, 
                        { label: 'Home Teleports', value: 'wipe_tp', emoji: '🏠' }, 
                        { label: 'PVE Zones', value: 'wipe_zones', emoji: '🏕️' },
                        { label: 'Custom Binds (Wheel)', value: 'wipe_binds', emoji: '🗣️' }
                    ])
                );
                return interaction.reply({ content: '🗑️ **Selective Wipe:** Choose exactly which databases to reset below:', components: [row], flags: 64 });
            }
        }

        // 3. Select Menu Handler for Selective Wipe
        if (interaction.isStringSelectMenu() && customId === 'select_wipe_custom') {
            const sel = interaction.values.join('-');
            const modal = new ModalBuilder().setCustomId(`modal_wipe_sel_${sel}`).setTitle('Confirm Selective Wipe');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm_text').setLabel('Type WIPE to confirm').setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }

        // 4. Modal Submit Handlers (The Actual Wipe Execution)
        if (interaction.isModalSubmit()) {
            if (customId === 'modal_wipe_full' || customId.startsWith('modal_wipe_sel_')) {
                if (interaction.fields.getTextInputValue('confirm_text') !== 'WIPE') return interaction.reply({ content: '❌ Wipe Cancelled.', flags: 64 });
                
                let updateData = {}; 
                
                if (customId === 'modal_wipe_full') {
                    // Zones
                    const allZones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
                    for (const z of allZones) { try { await sendRconCommand(interaction.guild.id, `zones.deletecustomzone "${z.zoneName}"`); } catch (e) {} }
                    await PveZone.destroy({ where: { guildId: interaction.guild.id } });
                    
                    // Custom Binds
                    await CustomBind.destroy({ where: { guildId: interaction.guild.id } });

                    updateData = { wallet: 0, xp: 0, level: 1, homeX: null, homeY: null, homeZ: null, autoSupplyEnabled: false, autoEliteEnabled: false, autoTimedEnabled: false, supplySpawnCount: 1, eliteSpawnCount: 1, timedSpawnCount: 1 };
                    for (let i = 1; i <= 10; i++) {
                        updateData[`supplySlot${i}X`] = null; updateData[`supplySlot${i}Y`] = null; updateData[`supplySlot${i}Z`] = null;
                        updateData[`eliteSlot${i}X`] = null; updateData[`eliteSlot${i}Y`] = null; updateData[`eliteSlot${i}Z`] = null;
                        updateData[`timedSlot${i}X`] = null; updateData[`timedSlot${i}Y`] = null; updateData[`timedSlot${i}Z`] = null;
                    }
                } else {
                    const sel = customId.replace('modal_wipe_sel_', '').split('-');
                    if (sel.includes('wipe_econ')) updateData.wallet = 0;
                    if (sel.includes('wipe_bp')) { updateData.xp = 0; updateData.level = 1; }
                    if (sel.includes('wipe_tp')) { updateData.homeX = null; updateData.homeY = null; updateData.homeZ = null; }
                    if (sel.includes('wipe_zones')) {
                        const selZones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
                        for (const z of selZones) { try { await sendRconCommand(interaction.guild.id, `zones.deletecustomzone "${z.zoneName}"`); } catch (e) {} }
                        await PveZone.destroy({ where: { guildId: interaction.guild.id } });
                    }
                    if (sel.includes('wipe_binds')) {
                        await CustomBind.destroy({ where: { guildId: interaction.guild.id } });
                    }
                }
                
                await GuildConfig.update(updateData, { where: { guildId: interaction.guild.id } });
                await UserEconomy.update(updateData, { where: { guildId: interaction.guild.id } });
                
                return interaction.reply({ content: `☢️ **Server WIPED successfully!** Requested databases have been cleared.`, flags: 64 });
            }
        }
    } catch (err) {
        console.error('[WIPE HANDLER ERROR]', err);
        if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({ content: '❌ An error occurred while executing the wipe.', flags: 64 });
        }
    }
};