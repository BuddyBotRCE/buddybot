const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../database/db');
const adminHandler = require('./adminHandler');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

    if (customId === 'admin_menu_back') {
        if (adminHandler && adminHandler.renderMainPanel) {
            return await adminHandler.renderMainPanel(interaction);
        }
        return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
    }

    if (customId === 'admin_menu_select' && selectedValue === 'setup_battleroyale') {
        const ArenaCratePoint = db.ArenaCratePoint;
        const ArenaConfig = db.ArenaConfig;
        const ArenaPrize = db.ArenaPrize;

        const cratesMapped = ArenaCratePoint ? await ArenaCratePoint.count({ where: { guildId: interaction.guild.id } }).catch(() => 0) : 0;
        const [config] = ArenaConfig ? await ArenaConfig.findOrCreate({ where: { guildId: interaction.guild.id } }).catch(() => [{}]) : [{}];
        const prizes = ArenaPrize ? await ArenaPrize.count({ where: { guildId: interaction.guild.id } }).catch(() => 0) : 0;
        const prizeShare = prizes > 0 ? (100 / prizes).toFixed(1) : 0;

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Battle Royale Event Manager')
            .setDescription(`Manage Rust Console Edition randomized crate-spawn Battle Royale arenas.\n\n• **Elite Crate Points Mapped:** \`${cratesMapped}\`\n• **Active Crate Fill Rate:** \`${config.crateSpawnPercentage || 35}% of mapped points\`\n• **Lucky Dip Prizes:** \`${prizes} items (${prizeShare}% each)\``)
            .setColor('#3498db');

        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('br_action_select').setPlaceholder('Select Battle Royale configuration...')
                .addOptions([
                    { label: '📦 Add Elite Crate Spawn Point', value: 'br_add_crate', description: 'Logs your current position as a potential crate drop site', emoji: '📦' },
                    { label: '⚙️ Set Crate Fill Percentage', value: 'br_set_percentage', description: 'Configure what % of crates spawn per match (e.g. 35%)', emoji: '⚙️' },
                    { label: '🎁 Manage Equal-% Lucky Dip Prizes', value: 'br_prizes', description: 'Shared prize pool with Gun Game', emoji: '🎁' },
                    { label: '🗑️ Clear Mapped Crate Points', value: 'br_clear_crates', emoji: '🗑️' }
                ])
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );

        if (!interaction.deferred && !interaction.replied) {
            return interaction.update({ embeds: [embed], components: [row1, row2] }).catch(() => 
                interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 })
            );
        }
        return interaction.followUp({ embeds: [embed], components: [row1, row2], flags: 64 });
    }

    if (customId === 'br_action_select') {
        if (selectedValue === 'br_add_crate') {
            return interaction.reply({ content: '📦 **BR Setup:** Stand at your desired elite crate location in-game and type `/arenaspawn brcrate` to log the coordinates.', flags: 64 });
        }

        if (selectedValue === 'br_set_percentage') {
            const modal = new ModalBuilder().setCustomId('modal_br_percentage').setTitle('Set Crate Spawn Fill %');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('percentage').setLabel("Spawn Percentage (e.g. 35)").setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        if (selectedValue === 'br_prizes') {
            const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => ({
                label: RUST_CATEGORIES[catKey].label,
                value: `br_prize_cat_${catKey}`,
                emoji: RUST_CATEGORIES[catKey].emoji
            }));
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('br_prize_category_select')
                    .setPlaceholder('Step 1: Select prize category...')
                    .addOptions(catOptions)
            );
            return interaction.reply({ content: '🎁 **Battle Royale Prize Wizard:** Select an item category for the prize pool:', components: [row], flags: 64 });
        }

        if (selectedValue === 'br_clear_crates') {
            if (db.ArenaCratePoint) await db.ArenaCratePoint.destroy({ where: { guildId: interaction.guild.id } });
            return interaction.reply({ content: '✅ All mapped Battle Royale elite crate points have been cleared.', flags: 64 });
        }
    }

    // Catalog Select Menus for BR Prizes
    if (interaction.isStringSelectMenu()) {
        if (customId === 'br_prize_category_select') {
            const catKey = selectedValue.replace('br_prize_cat_', '');
            const categoryData = RUST_CATEGORIES[catKey];
            if (!categoryData || !categoryData.items) return interaction.reply({ content: '❌ Invalid category.', flags: 64 });

            const itemOptions = categoryData.items.slice(0, 25).map(item => ({
                label: item.name,
                description: `Shortname: ${item.shortname}`,
                value: `br_prize_item_${item.shortname}`
            }));

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('br_prize_item_select')
                    .setPlaceholder(`Step 2: Choose item from ${categoryData.label}...`)
                    .addOptions(itemOptions)
            );
            return interaction.update({ content: `🎁 **Battle Royale Prize Wizard:** Choose the exact item from **${categoryData.label}**:`, components: [row] });
        }

        if (customId === 'br_prize_item_select') {
            const shortname = selectedValue.replace('br_prize_item_', '');
            const modal = new ModalBuilder().setCustomId(`modal_br_prize_exec_${shortname}`).setTitle(`Configure Prize (${shortname})`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Quantity (e.g. 1)").setStyle(TextInputStyle.Short).setValue('1').setRequired(true))
            );
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        if (customId === 'modal_br_percentage' && db.ArenaConfig) {
            const val = parseInt(interaction.fields.getTextInputValue('percentage')) || 35;
            await db.ArenaConfig.upsert({ guildId: interaction.guild.id, crateSpawnPercentage: val });
            return interaction.reply({ content: `✅ Battle Royale crate spawn fill rate successfully updated to **${val}%** of mapped points per match!`, flags: 64 });
        }

        if (customId.startsWith('modal_br_prize_exec_') && db.ArenaPrize) {
            const shortname = customId.replace('modal_br_prize_exec_', '');
            const amount = interaction.fields.getTextInputValue('amount') || '1';
            const prizeName = `${amount}x ${shortname}`;
            const command = `inventory.giveto "{player}" ${shortname} ${amount}`;

            await db.ArenaPrize.create({ guildId: interaction.guild.id, prizeName, command });
            const totalPrizes = await db.ArenaPrize.count({ where: { guildId: interaction.guild.id } });
            const share = (100 / totalPrizes).toFixed(1);

            return interaction.reply({ content: `✅ Added **${prizeName}** to the Battle Royale prize pool! Pool now has ${totalPrizes} items (**${share}%** chance each).`, flags: 64 });
        }
    }
};