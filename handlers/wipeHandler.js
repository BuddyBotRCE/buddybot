const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, UserEconomy, PveZone, CustomBind, ShopCooldown, BindCooldown, BountyCooldown, HomeTeleportCooldown, HomeTeleportLocation, GameServer } = require('../database/db');
const { sendRconCommand } = require('../utils/rconManager');
const adminHandler = require('./adminHandler');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const guildId = interaction.guild.id;

    try {
        if (customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
            return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
        }

        if (interaction.isStringSelectMenu() && interaction.values && interaction.values[0] === 'setup_wipe') {
            const embed = new EmbedBuilder()
                .setTitle('☢️ Server Wipe Manager')
                .setDescription('Select how you want to wipe the server databases or reset server cooldowns.\n\n**Full Wipe:** Wipes all economy, stats, zones, home teleports, and custom binds.\n**Selective Wipe:** Choose exactly which databases to clear.\n**Clear All Cooldowns:** Resets all player shop, command bind, bounty, and home teleport cooldown timers instantly.')
                .setColor('#e74c3c');
                
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_wipe_full').setLabel('Full Wipe').setStyle(ButtonStyle.Danger).setEmoji('☢️'), 
                new ButtonBuilder().setCustomId('btn_wipe_selective').setLabel('Selective Wipe').setStyle(ButtonStyle.Primary).setEmoji('🗂️')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_wipe_cooldowns').setLabel('Clear All Cooldowns').setStyle(ButtonStyle.Secondary).setEmoji('⏳')
            );

            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
            );

            return interaction.update({ embeds: [embed], components: [row1, row2, row3], content: null });
        }

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
                        { label: 'Home Teleports & Locations', value: 'wipe_tp', emoji: '🏠' }, 
                        { label: 'PVE Zones', value: 'wipe_zones', emoji: '🏕️' },
                        { label: 'Custom Binds (Wheel)', value: 'wipe_binds', emoji: '🗣️' }
                    ])
                );
                return interaction.update({ content: '🗑️ **Selective Wipe:** Choose exactly which databases to reset below:', components: [row] });
            }
            if (customId === 'btn_wipe_cooldowns') {
                const modal = new ModalBuilder().setCustomId('modal_wipe_cooldowns').setTitle('Confirm Clear All Cooldowns');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm_text').setLabel('Type COOLDOWNS to reset all timers').setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }
        }

        if (interaction.isStringSelectMenu() && customId === 'select_wipe_custom') {
            const sel = interaction.values.join('-');
            const modal = new ModalBuilder().setCustomId(`modal_wipe_sel_${sel}`).setTitle('Confirm Selective Wipe');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm_text').setLabel('Type WIPE to confirm').setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }

        if (interaction.isModalSubmit()) {
            if (customId === 'modal_wipe_cooldowns') {
                if (interaction.fields.getTextInputValue('confirm_text') !== 'COOLDOWNS') return interaction.reply({ content: '❌ Action Cancelled. You must type `COOLDOWNS`.', flags: 64 });
                await ShopCooldown.destroy({ where: { guildId } });
                await BindCooldown.destroy({ where: { guildId } });
                await BountyCooldown.destroy({ where: { guildId } });
                await HomeTeleportCooldown.destroy({ where: { guildId } });
                return interaction.reply({ content: `⏳ **All Cooldowns Cleared!** Shop, bind, bounty, and home teleport cooldown timers have been completely wiped.`, flags: 64 });
            }

            if (customId === 'modal_wipe_full' || customId.startsWith('modal_wipe_sel_')) {
                if (interaction.fields.getTextInputValue('confirm_text') !== 'WIPE') return interaction.reply({ content: '❌ Wipe Cancelled.', flags: 64 });
                
                let updateData = {}; 
                
                if (customId === 'modal_wipe_full') {
                    const allZones = await PveZone.findAll({ where: { guildId } });
                    for (const z of allZones) { try { await sendRconCommand(guildId, `zones.deletecustomzone "${z.zoneName}"`); } catch (e) {} }
                    await PveZone.destroy({ where: { guildId } });
                    await CustomBind.destroy({ where: { guildId } });
                    await ShopCooldown.destroy({ where: { guildId } });
                    await BindCooldown.destroy({ where: { guildId } });
                    await BountyCooldown.destroy({ where: { guildId } });
                    await HomeTeleportCooldown.destroy({ where: { guildId } });
                    await HomeTeleportLocation.destroy({ where: { guildId } });

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
                    if (sel.includes('wipe_tp')) { 
                        updateData.homeX = null; updateData.homeY = null; updateData.homeZ = null; 
                        await HomeTeleportLocation.destroy({ where: { guildId } });
                        await HomeTeleportCooldown.destroy({ where: { guildId } });
                    }
                    if (sel.includes('wipe_zones')) {
                        const selZones = await PveZone.findAll({ where: { guildId } });
                        for (const z of selZones) { try { await sendRconCommand(guildId, `zones.deletecustomzone "${z.zoneName}"`); } catch (e) {} }
                        await PveZone.destroy({ where: { guildId } });
                    }
                    if (sel.includes('wipe_binds')) await CustomBind.destroy({ where: { guildId } });
                }
                
                await GuildConfig.update(updateData, { where: { guildId } });
                await UserEconomy.update(updateData, { where: { guildId } });
                
                return interaction.reply({ content: `☢️ **Server WIPED successfully!** Requested databases and cooldowns have been cleared.`, flags: 64 });
            }
        }
    } catch (err) {
        console.error('[WIPE HANDLER ERROR]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while executing the wipe.', flags: 64 });
        }
    }
};