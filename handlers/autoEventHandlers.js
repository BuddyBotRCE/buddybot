const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, UserEconomy } = require('../database/db');
const { sendRconCommand, queueAdminPos } = require('../utils/rconManager');

async function renderAutoEventHub(interaction) {
    let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
    
    const supplyStatus = config.autoSupplyEnabled ? '🟢 Active' : '🔴 Disabled';
    const eliteStatus = config.autoEliteEnabled ? '🟢 Active' : '🔴 Disabled';
    const timedStatus = config.autoTimedEnabled ? '🟢 Active' : '🔴 Disabled';

    const embed = new EmbedBuilder()
        .setTitle('🚁 Auto-Events Main Hub')
        .setDescription(`**Current Live Events:**\n\n` +
            `📦 **${config.supplyEventName || 'Supply Drops'}**: ${supplyStatus} (Qty: ${config.supplySpawnCount || 1})\n` +
            `💎 **${config.eliteEventName || 'Elite Crates'}**: ${eliteStatus} (Qty: ${config.eliteSpawnCount || 1})\n` +
            `⏱️ **${config.timedEventName || 'Timed Crates'}**: ${timedStatus} (Qty: ${config.timedSpawnCount || 1})\n\n` +
            `*Use the dropdown menus below to configure, disable, or wipe an event.*`)
        .setColor('#f1c40f');

    const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ae_hub_configure').setPlaceholder('⚙️ Select Event to Configure...').addOptions([
            { label: 'Supply Drops', value: 'supply', emoji: '📦' },
            { label: 'Elite Crates', value: 'elite', emoji: '💎' },
            { label: 'Timed Crates', value: 'timed', emoji: '⏱️' }
        ])
    );

    const row2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ae_hub_toggle').setPlaceholder('⚡ Select Event to Enable / Disable...').addOptions([
            { label: 'Toggle Supply Drops', value: 'supply', emoji: '📦' },
            { label: 'Toggle Elite Crates', value: 'elite', emoji: '💎' },
            { label: 'Toggle Timed Crates', value: 'timed', emoji: '⏱️' }
        ])
    );

    const row3 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ae_hub_wipe').setPlaceholder('🗑️ Select Event to Wipe Data...').addOptions([
            { label: 'Wipe Supply Drops Data', value: 'supply', emoji: '📦' },
            { label: 'Wipe Elite Crates Data', value: 'elite', emoji: '💎' },
            { label: 'Wipe Timed Crates Data', value: 'timed', emoji: '⏱️' }
        ])
    );

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [row1, row2, row3], content: null });
    } else if (interaction.isStringSelectMenu() || interaction.isButton()) {
        await interaction.update({ embeds: [embed], components: [row1, row2, row3], content: null });
    } else {
        await interaction.reply({ embeds: [embed], components: [row1, row2, row3], flags: 64 });
    }
}

async function renderEventPanel(interaction, eventType) {
    let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
    
    const customName = config.get(`${eventType}EventName`) || (eventType === 'supply' ? 'Supply Drops' : eventType === 'elite' ? 'Elite Crates' : 'Timed Crates');
    const count = config.get(`${eventType}SpawnCount`) || 1;
    const interval = config.get(`${eventType}Interval`) || 60;
    const isEnabledPrefix = eventType.charAt(0).toUpperCase() + eventType.slice(1);
    const isEnabled = config.get(`auto${isEnabledPrefix}Enabled`) || false;

    let locDesc = '';
    for (let i = 1; i <= count; i++) {
        let x = config[`${eventType}Slot${i}X`];
        let y = config[`${eventType}Slot${i}Y`];
        let z = config[`${eventType}Slot${i}Z`];
        if (x !== null && x !== undefined) {
            locDesc += `**Slot ${i}:** ✅ \`X: ${Math.round(x)}, Y: ${Math.round(y)}, Z: ${Math.round(z)}\`\n`;
        } else {
            locDesc += `**Slot ${i}:** 🔴 Not Set\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Configuring: ${customName}`)
        .setDescription(`**Event Status:** ${isEnabled ? '🟢 Active' : '🔴 Disabled'}\n` +
            `**Quantity per interval:** ${count} item(s)\n` +
            `**Repeat Interval:** Every ${interval} mins\n\n` +
            `**📍 Current Positions:**\n${locDesc}`)
        .setColor(isEnabled ? '#2ecc71' : '#3498db');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ae_btn_config_${eventType}`).setLabel('Set Name & Qty').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
        new ButtonBuilder().setCustomId(`ae_btn_setpos_${eventType}`).setLabel('Set Position').setStyle(ButtonStyle.Success).setEmoji('📍'),
        new ButtonBuilder().setCustomId(`ae_btn_test_${eventType}`).setLabel('Test Spawn').setStyle(ButtonStyle.Secondary).setEmoji('🧪')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ae_btn_toggle_${eventType}`).setLabel(isEnabled ? 'Disable Event' : 'Enable Event').setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('⚡'),
        new ButtonBuilder().setCustomId(`ae_hub_back`).setLabel('Go Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [row1, row2], content: null });
    } else {
        await interaction.update({ embeds: [embed], components: [row1, row2], content: null });
    }
}

module.exports = async (interaction, client) => {
    const customId = interaction.customId;

    // --- HUB ROUTING ---
    if (customId === 'setup_autoevents' || customId === 'ae_hub_back') {
        return await renderAutoEventHub(interaction);
    }

    if (interaction.isStringSelectMenu()) {
        const module = interaction.values[0];

        if (customId === 'ae_hub_configure') return await renderEventPanel(interaction, module);

        if (customId === 'ae_hub_toggle') {
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            const prefix = module.charAt(0).toUpperCase() + module.slice(1);
            await config.update({ [`auto${prefix}Enabled`]: !(config.get(`auto${prefix}Enabled`) || false) });
            return await renderAutoEventHub(interaction);
        }

        if (customId === 'ae_hub_wipe') {
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            const resetObj = {
                [`${module}SpawnCount`]: 1,
                [`${module}Interval`]: 60,
                [`${module}EventName`]: module === 'supply' ? 'Supply Drops' : module === 'elite' ? 'Elite Crates' : 'Timed Crates'
            };
            resetObj[`auto${module.charAt(0).toUpperCase() + module.slice(1)}Enabled`] = false;
            for (let i = 1; i <= 10; i++) { 
                resetObj[`${module}Slot${i}X`] = null; 
                resetObj[`${module}Slot${i}Y`] = null; 
                resetObj[`${module}Slot${i}Z`] = null; 
            }
            await config.update(resetObj);
            return await renderAutoEventHub(interaction);
        }

        if (customId.startsWith('ae_loc_select_')) {
            const eventType = customId.replace('ae_loc_select_', '');
            const slotNum = module;
            const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            
            if (!userProfile || !userProfile.inGameName) {
                return interaction.reply({ content: `❌ Link your Rust account first using \`/playerpanel\`!`, flags: 64 });
            }

            queueAdminPos(userProfile.inGameName, interaction.guild.id, interaction.user.id, interaction.channel.id, `aeslot_${eventType}_${slotNum}`, client);
            return interaction.update({ content: `⏳ Stand exactly where you want it. Capturing coordinates for **Slot ${slotNum}**...`, embeds: [], components: [] });
        }
    }

    // --- BUTTON CLICKS ---
    if (interaction.isButton()) {
        if (customId.startsWith('ae_btn_config_')) {
            const eventType = customId.replace('ae_btn_config_', '');
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currentName = config?.get(`${eventType}EventName`) || (eventType === 'supply' ? 'Supply Drops' : eventType === 'elite' ? 'Elite Crates' : 'Timed Crates');
            const count = config?.get(`${eventType}SpawnCount`) || 1;
            const interval = config?.get(`${eventType}Interval`) || 60;

            const modal = new ModalBuilder().setCustomId(`modal_ae_config_${eventType}`).setTitle(`Configure Event Data`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel("Custom Event Name").setStyle(TextInputStyle.Short).setValue(`${currentName}`).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('qty').setLabel("Quantity to Spawn (1-10)").setStyle(TextInputStyle.Short).setValue(`${count}`).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interval').setLabel("Repeat Interval (Minutes)").setStyle(TextInputStyle.Short).setValue(`${interval}`).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        if (customId.startsWith('ae_btn_setpos_')) {
            const eventType = customId.replace('ae_btn_setpos_', '');
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const count = config?.get(`${eventType}SpawnCount`) || 1;

            const slotOptions = [];
            for (let i = 1; i <= count; i++) {
                slotOptions.push({ label: `Map Position for Slot ${i}`, value: `${i}`, emoji: '📍' });
            }

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId(`ae_loc_select_${eventType}`).setPlaceholder('Select which slot to map...').addOptions(slotOptions)
            );

            return interaction.reply({ content: `📍 Which position slot would you like to set?`, components: [row], flags: 64 });
        }

        if (customId.startsWith('ae_btn_toggle_')) {
            const eventType = customId.replace('ae_btn_toggle_', '');
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            const prefix = eventType.charAt(0).toUpperCase() + eventType.slice(1);
            await config.update({ [`auto${prefix}Enabled`]: !(config.get(`auto${prefix}Enabled`) || false) });
            return await renderEventPanel(interaction, eventType);
        }

        if (customId.startsWith('ae_btn_test_')) {
            await interaction.deferReply({ flags: 64 });
            const eventType = customId.replace('ae_btn_test_', '');
            let config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            
            const count = config?.get(`${eventType}SpawnCount`) || 1;
            const shortname = eventType === 'supply' ? 'supply_drop' : eventType === 'elite' ? 'crate_elite' : 'hackablelockedcrate';
            let spawned = 0;

            for (let i = 1; i <= count; i++) {
                const x = config?.get(`${eventType}Slot${i}X`);
                const y = config?.get(`${eventType}Slot${i}Y`);
                const z = config?.get(`${eventType}Slot${i}Z`);

                if (x !== null && x !== undefined && y !== null && z !== null) {
                    await sendRconCommand(interaction.guild.id, `spawn ${shortname} ${x},${y},${z}`);
                    spawned++;
                }
            }

            if (spawned === 0) {
                if (eventType === 'supply') await sendRconCommand(interaction.guild.id, 'supply.drop');
                else await sendRconCommand(interaction.guild.id, `spawn ${shortname}`);
                return interaction.editReply({ content: `⚠️ No mapped slots found. Triggered a default random test spawn instead!` });
            }
            return interaction.editReply({ content: `✅ Test-spawned **${spawned}x** items successfully at mapped locations!` });
        }

        // 🚀 HARD INTERCEPTOR: CAPTURED COORDINATES
        if (customId.startsWith('btn_finalize_tpl_aeslot_')) {
            await interaction.message.delete().catch(() => {});
            const parts = customId.split('_'); 
            const eventType = parts[4]; 
            const slotNum = parts[5];
            const x = parseFloat(parts[6]);
            const y = parseFloat(parts[7]);
            const z = parseFloat(parts[8]);

            let [cfg] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            await cfg.update({
                [`${eventType}Slot${slotNum}X`]: x,
                [`${eventType}Slot${slotNum}Y`]: y,
                [`${eventType}Slot${slotNum}Z`]: z
            });
            
            await interaction.reply({ content: `✅ Location successfully saved for **Slot ${slotNum}**!`, flags: 64 });
            return await renderEventPanel(interaction, eventType); // Re-renders the panel to show the green checkmark
        }
    }

    // --- MODALS ---
    if (interaction.isModalSubmit()) {
        if (customId.startsWith('modal_ae_config_')) {
            const eventType = customId.replace('modal_ae_config_', '');
            const customName = interaction.fields.getTextInputValue('name').trim();
            let qty = parseInt(interaction.fields.getTextInputValue('qty')) || 1;
            qty = Math.max(1, Math.min(10, qty)); // Force 1-10 limit
            const interval = parseInt(interaction.fields.getTextInputValue('interval')) || 60;

            let [cfg] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            await cfg.update({
                [`${eventType}EventName`]: customName,
                [`${eventType}SpawnCount`]: qty,
                [`${eventType}Interval`]: interval
            });
            return await renderEventPanel(interaction, eventType);
        }
    }
};