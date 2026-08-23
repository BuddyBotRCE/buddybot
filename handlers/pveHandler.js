const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { PveZone, UserEconomy } = require('../database/db');
const { sendRconCommand, queueAdminPos } = require('../utils/rconManager');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (customId === 'admin_menu_select' && selectedValue === 'setup_pvezones') {
        const zones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
        const zoneList = zones.length ? zones.map(z => `• **${z.zoneName}** (${z.shape.toUpperCase()}, Size: ${z.size})`).join('\n') : 'No custom PVE zones configured yet.';
        const embed = new EmbedBuilder().setTitle('🏕️ PVE Custom Zones Manager').setDescription(`Create and manage custom PVE zones with distinct boundaries, colors, and enter/exit alerts.\n\n**Registered Zones:**\n${zoneList}`).setColor('#1abc9c');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_pve_create').setLabel('Create PVE Zone').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('btn_pve_list').setLabel('View Zone Details').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
            new ButtonBuilder().setCustomId('btn_pve_delete_menu').setLabel('Delete Zone').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
            new ButtonBuilder().setCustomId('btn_pve_wipe_all').setLabel('Wipe All Zones').setStyle(ButtonStyle.Danger).setEmoji('☢️')
        );
        return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }

    if (interaction.isButton()) {
        if (customId === 'btn_pve_create') {
            const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            if (!userProfile || !userProfile.inGameName) return interaction.reply({ content: '❌ Link your Rust account first using `/playerpanel`!', flags: 64 });
            queueAdminPos(userProfile.inGameName, interaction.guild.id, interaction.user.id, interaction.channel.id, 'pvezone', client);
            return interaction.reply({ content: `⏳ Stand at the center point where you want your PVE zone created... grabbing coordinates via RCON.`, flags: 64 });
        }
        if (customId === 'btn_pve_list') {
            const zones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
            if (zones.length === 0) return interaction.reply({ content: '❌ No PVE zones registered.', flags: 64 });
            const list = zones.map(z => `🏕️ **${z.zoneName}**\n• Shape: \`${z.shape}\` | Size: \`${z.size}\` | Color: \`${z.color}\`\n• Pos: \`X: ${z.x}, Y: ${z.y}, Z: ${z.z}\`\n`).join('\n');
            const options = zones.map(z => ({ label: `Toggle Outline: ${z.zoneName}`, description: `Turn visual boundary on/off`, value: `toggle_zone_${z.zoneName}` }));
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_pve_toggle_area').setPlaceholder('Select a zone to toggle in-game outline...').addOptions(options));
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏕️ Registered PVE Zones').setDescription(list).setColor('#1abc9c')], components: [row], flags: 64 });
        }
        if (customId === 'btn_pve_delete_menu') {
            const zones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
            if (zones.length === 0) return interaction.reply({ content: '❌ No PVE zones registered to delete.', flags: 64 });
            const options = zones.map(z => ({ label: z.zoneName, description: `Shape: ${z.shape.toUpperCase()} | Size: ${z.size}`, value: z.id.toString() }));
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_pve_delete_exec').setPlaceholder('Select a zone to delete...').addOptions(options));
            return interaction.reply({ content: '🗑️ **Delete PVE Zone:** Choose the zone you want to remove:', components: [row], flags: 64 });
        }
        if (customId === 'btn_pve_wipe_all') {
            await interaction.deferReply({ flags: 64 });
            const zones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
            if (zones.length === 0) return interaction.editReply({ content: '❌ No PVE zones to wipe.' });
            for (const z of zones) { try { await sendRconCommand(interaction.guild.id, `zones.deletecustomzone "${z.zoneName}"`); } catch (e) {} }
            await PveZone.destroy({ where: { guildId: interaction.guild.id } });
            return interaction.editReply({ content: `☢️ Successfully wiped **all PVE zones** from the database and in-game server!` });
        }
        if (customId.startsWith('btn_finalize_tpl_pvezone_')) {
            await interaction.message.delete().catch(() => {});
            const parts = customId.split('_'); 
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`pve_shape_${parts[4]}_${parts[5]}_${parts[6]}`).setPlaceholder('Select Zone Shape...').addOptions([{ label: 'Sphere Zone (Default: 50m)', value: 'sphere', emoji: '🔵' }, { label: 'Box Zone (Default: 250,250,250)', value: 'box', emoji: '📦' }])
            );
            return interaction.reply({ content: `🏕️ **Step 2:** Select the boundary shape for your custom PVE zone:`, components: [row], flags: 64 });
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (customId === 'select_pve_delete_exec') {
            await interaction.deferUpdate();
            const zone = await PveZone.findByPk(selectedValue);
            if (!zone) return interaction.followUp({ content: '❌ Zone not found or already deleted.', flags: 64 });
            await zone.destroy();
            try { await sendRconCommand(interaction.guild.id, `zones.deletecustomzone "${zone.zoneName}"`); } catch (e) {}
            return interaction.editReply({ content: `✅ Successfully deleted the PVE Zone **"${zone.zoneName}"**!`, components: [] });
        }
        if (customId === 'select_pve_toggle_area') {
            const zoneName = selectedValue.replace('toggle_zone_', '');
            await sendRconCommand(interaction.guild.id, `zones.editcustomzone "${zoneName}" "showarea" 1`);
            return interaction.update({ content: `👁️ Visual outline toggled ON in-game for zone **"${zoneName}"**!`, components: [] });
        }
        if (customId.startsWith('pve_shape_')) {
            const parts = customId.split('_'); const shape = selectedValue; 
            const x = parts[2]; const y = parts[3]; const z = parts[4];
            const defaultSize = shape === 'box' ? '250,250,250' : '50';
            const modal = new ModalBuilder().setCustomId(`modal_pve_final_${shape}_${x}_${y}_${z}`).setTitle(`Configure PVE ${shape.toUpperCase()} Zone`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zone_name').setLabel("Zone Name (e.g. Trader Town)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zone_size').setLabel(shape === 'box' ? "Box Dimensions (X,Y,Z)" : "Sphere Radius (meters)").setStyle(TextInputStyle.Short).setValue(defaultSize).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zone_color').setLabel("Visual Color (green, blue, red)").setStyle(TextInputStyle.Short).setValue('green').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zone_enabled').setLabel("Zone Enabled? (1 for On, 0 for Off)").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('enter_msg').setLabel("Enter & Exit Msgs (Enter | Exit)").setStyle(TextInputStyle.Short).setValue('Entered Safe Zone. | Left Safe Zone.').setRequired(true))
            );
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && customId.startsWith('modal_pve_final_')) {
        const parts = customId.split('_'); const shape = parts[3];
        const x = parseFloat(parts[4]); const y = parseFloat(parts[5]); const z = parseFloat(parts[6]);
        const zoneName = interaction.fields.getTextInputValue('zone_name');
        const sizeInput = interaction.fields.getTextInputValue('zone_size');
        const colorInput = interaction.fields.getTextInputValue('zone_color').toLowerCase();
        const zoneEnabled = interaction.fields.getTextInputValue('zone_enabled') || '1';
        const rawMsgs = interaction.fields.getTextInputValue('enter_msg').split('|');
        const enterMessage = rawMsgs[0]?.trim() || 'You have entered a PVE Safe Zone.';
        const exitMessage = rawMsgs[1]?.trim() || 'You have left the PVE Safe Zone.';

        let finalSize = sizeInput; if (shape === 'sphere') finalSize = parseFloat(sizeInput) || 50;

        await PveZone.create({ guildId: interaction.guild.id, zoneName, shape, x, y, z, size: finalSize, color: colorInput, enterMessage, exitMessage });
        let rgbColor = "0,255,0";
        if (colorInput.includes('blue')) rgbColor = "0,0,255"; else if (colorInput.includes('red')) rgbColor = "255,0,0"; else if (colorInput.includes('yellow')) rgbColor = "255,255,0"; else if (colorInput.includes('purple')) rgbColor = "128,0,128"; else if (colorInput.includes('cyan')) rgbColor = "0,255,255";
        
        const rconShape = shape === 'box' ? 'Box' : 'Sphere';
        const formattedSize = shape === 'box' ? `(${finalSize})` : finalSize;
        
        await sendRconCommand(interaction.guild.id, `zones.createcustomzone "${zoneName}" (${x},${y},${z}) 0 ${rconShape} ${formattedSize} 0 0 0 0 1`);
        await sendRconCommand(interaction.guild.id, `zones.editcustomzone "${zoneName}" "enabled" "${zoneEnabled}"`);
        await sendRconCommand(interaction.guild.id, `zones.editcustomzone "${zoneName}" "showarea" 1`);
        await sendRconCommand(interaction.guild.id, `zones.editcustomzone "${zoneName}" "color" "(${rgbColor})"`);
        await sendRconCommand(interaction.guild.id, `zones.editcustomzone "${zoneName}" "entermessage" "${enterMessage}"`);
        await sendRconCommand(interaction.guild.id, `zones.editcustomzone "${zoneName}" "leavemessage" "${exitMessage}"`);

        return interaction.reply({ content: `✅ Custom PVE Zone **"${zoneName}"** created and outlined in-game!`, flags: 64 });
    }
};