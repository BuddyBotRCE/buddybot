const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ServerKit } = require('../database/db');

const RUST_ITEMS = [
    { n: 'Assault Rifle (AK47)', s: 'rifle.ak' }, { n: 'LR-300', s: 'rifle.lr300' }, { n: 'M249', s: 'lmg.m249' }, { n: 'Custom SMG', s: 'smg.2' }, 
    { n: 'Thompson', s: 'smg.thompson' }, { n: 'MP5A4', s: 'smg.mp5' }, { n: 'Pump Shotgun', s: 'shotgun.pump' }, { n: 'Double Barrel', s: 'shotgun.double' }, 
    { n: 'Medical Syringe', s: 'syringe.medical' }, { n: 'Wood', s: 'wood' }, { n: 'Stone', s: 'stones' }, { n: 'Metal Fragments', s: 'metal.fragments' }, 
    { n: 'High Quality Metal', s: 'metal.refined' }, { n: 'Scrap', s: 'scrap' }, { n: '5.56 Rifle Ammo', s: 'ammo.rifle' }, { n: 'Pistol Ammo', s: 'ammo.pistol' }, 
    { n: 'Rocket', s: 'ammo.rocket.basic' }, { n: 'C4 (Timed Explosive)', s: 'explosive.timed' }, { n: 'Satchel Charge', s: 'explosive.satchel' }
];

const activeKitBuilders = new Map(); 

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (customId === 'admin_menu_select' && selectedValue === 'setup_kits') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_kit_create').setLabel('Create Kit Wizard').setStyle(ButtonStyle.Success), 
            new ButtonBuilder().setCustomId('btn_kit_list').setLabel('View Kits').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ content: '🎒 **Kit Builder**', components: [row], flags: 64 });
    }

    if (interaction.isButton()) {
        if (customId === 'btn_kit_create') {
            const modal = new ModalBuilder().setCustomId('modal_kit_start').setTitle('Start Kit Wizard');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kit_name').setLabel("Kit Name").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'btn_kit_add_item') {
            const modal = new ModalBuilder().setCustomId('modal_kit_search').setTitle('Search Item');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('search_term').setLabel("Type item name").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'btn_kit_save') {
            const builder = activeKitBuilders.get(interaction.user.id);
            if (!builder || builder.items.length === 0) return interaction.reply({ content: '❌ Cannot save an empty kit.', flags: 64 });
            await ServerKit.create({ guildId: interaction.guild.id, kitName: builder.name, items: builder.items.join(',') });
            activeKitBuilders.delete(interaction.user.id);
            return interaction.update({ content: `✅ Kit **${builder.name}** saved!`, components: [] });
        }
        if (customId === 'btn_kit_list') {
            const kits = await ServerKit.findAll({ where: { guildId: interaction.guild.id } });
            const list = kits.length ? kits.map(k => `**${k.kitName}**\n\`${k.items}\``).join('\n\n') : 'No kits found.';
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎒 Server Kits').setDescription(list).setColor('#3498db')], flags: 64 });
        }
    }

    if (interaction.isStringSelectMenu() && customId === 'select_kit_item') {
        const modal = new ModalBuilder().setCustomId(`modal_kit_amount_${selectedValue}`).setTitle('Set Amount');
        if (selectedValue === 'custom_shortname') modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('custom_name').setLabel("Exact Shortname (e.g. rifle.ak)").setStyle(TextInputStyle.Short).setRequired(true)));
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_amount').setLabel("Amount").setStyle(TextInputStyle.Short).setRequired(true).setValue('1')));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        if (customId === 'modal_kit_start') {
            const name = interaction.fields.getTextInputValue('kit_name');
            activeKitBuilders.set(interaction.user.id, { name: name, items: [] });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_kit_add_item').setLabel('🔍 Add Item').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('btn_kit_save').setLabel('💾 Save Kit').setStyle(ButtonStyle.Success));
            return interaction.reply({ content: `🎒 **Kit Builder:** ${name}\n\n*Click Add Item.*`, components: [row], flags: 64 });
        }
        if (customId === 'modal_kit_search') {
            const term = interaction.fields.getTextInputValue('search_term').toLowerCase();
            const matches = RUST_ITEMS.filter(i => i.n.toLowerCase().includes(term) || i.s.toLowerCase().includes(term)).slice(0, 24);
            const options = matches.map(m => ({ label: m.n, description: m.s, value: m.s }));
            options.push({ label: 'Not finding it? Add Custom Shortname', value: 'custom_shortname' });
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_kit_item').setPlaceholder('Select an item...').addOptions(options));
            return interaction.reply({ content: `🔍 Search results for "**${term}**":`, components: [row], flags: 64 }); 
        }
        if (customId.startsWith('modal_kit_amount_')) {
            let shortname = customId.replace('modal_kit_amount_', '');
            if (shortname === 'custom_shortname') shortname = interaction.fields.getTextInputValue('custom_name');
            const builder = activeKitBuilders.get(interaction.user.id);
            builder.items.push(`${shortname} ${interaction.fields.getTextInputValue('item_amount')}`);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_kit_add_item').setLabel('🔍 Add Another Item').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('btn_kit_save').setLabel('💾 Save Kit').setStyle(ButtonStyle.Success));
            return interaction.update({ content: `🎒 **Kit Builder:** ${builder.name}\n\n**Items:**\n${builder.items.map(i => `• \`${i}\``).join('\n')}`, components: [row] });
        }
    }
};