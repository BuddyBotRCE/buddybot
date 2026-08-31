const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../database/db');
const adminHandler = require('./adminHandler');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');

const BUILT_IN_PRESETS = {
    standard: [
        { tier: 1, weapon: 'pistol.eoka', ammo: 'ammo.handmade.shell' },
        { tier: 2, weapon: 'pistol.revolver', ammo: 'ammo.pistol' },
        { tier: 3, weapon: 'pistol.nailgun', ammo: 'ammo.nailgun' },
        { tier: 4, weapon: 'shotgun.waterpipe', ammo: 'ammo.shotgun' },
        { tier: 5, weapon: 'shotgun.double', ammo: 'ammo.shotgun' },
        { tier: 6, weapon: 'pistol.python', ammo: 'ammo.pistol' },
        { tier: 7, weapon: 'pistol.semiauto', ammo: 'ammo.pistol' },
        { tier: 8, weapon: 'smg.2', ammo: 'ammo.pistol' },
        { tier: 9, weapon: 'shotgun.pump', ammo: 'ammo.shotgun' },
        { tier: 10, weapon: 'smg.thompson', ammo: 'ammo.pistol' },
        { tier: 11, weapon: 'rifle.semiauto', ammo: 'ammo.rifle' },
        { tier: 12, weapon: 'smg.mp5', ammo: 'ammo.pistol' },
        { tier: 13, weapon: 'shotgun.spas12', ammo: 'ammo.shotgun' },
        { tier: 14, weapon: 'rifle.bolt', ammo: 'ammo.rifle' },
        { tier: 15, weapon: 'rifle.ak', ammo: 'ammo.rifle' },
        { tier: 16, weapon: 'rifle.lr300', ammo: 'ammo.rifle' },
        { tier: 17, weapon: 'rifle.l96', ammo: 'ammo.rifle' },
        { tier: 18, weapon: 'lmg.m249', ammo: 'ammo.rifle' },
        { tier: 19, weapon: 'grenade.f1', ammo: null },
        { tier: 20, weapon: 'crossbow', ammo: 'arrow.wooden' },
        { tier: 21, weapon: 'knife.combat', ammo: null }
    ]
};

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

    if (customId === 'admin_menu_back') {
        if (adminHandler && adminHandler.renderMainPanel) {
            return await adminHandler.renderMainPanel(interaction);
        }
        return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
    }

    if (customId === 'admin_menu_select' && selectedValue === 'setup_gungame') {
        const ArenaSpawn = db.ArenaSpawn;
        const GunGameWeapon = db.GunGameWeapon;
        const ArenaPrize = db.ArenaPrize;

        const spawns = ArenaSpawn ? await ArenaSpawn.count({ where: { guildId: interaction.guild.id } }).catch(() => 0) : 0;
        const weapons = GunGameWeapon ? await GunGameWeapon.count({ where: { guildId: interaction.guild.id } }).catch(() => 0) : 0;
        const prizes = ArenaPrize ? await ArenaPrize.count({ where: { guildId: interaction.guild.id } }).catch(() => 0) : 0;
        const prizeShare = prizes > 0 ? (100 / prizes).toFixed(1) : 0;

        const embed = new EmbedBuilder()
            .setTitle('🎯 Gun Game Event Manager')
            .setDescription(`Configure automated Gun Game parameters for Rust Console Edition.\n\n• **Arena Spawns Mapped:** \`${spawns}\`\n• **Active Tiers Set:** \`${weapons} / 21 Tiers\`\n• **Lucky Dip Prizes:** \`${prizes} items (${prizeShare}% each)\``)
            .setColor('#e67e22');

        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('gungame_action_select').setPlaceholder('Select Gun Game configuration...')
                .addOptions([
                    { label: '📍 Add Player Spawn Point', value: 'gg_add_spawn', description: 'Grabs your current in-game coordinates', emoji: '📍' },
                    { label: '⚡ Load Built-in Ladder Preset', value: 'gg_load_preset', description: 'Instantly load standard balanced weapon tier list', emoji: '⚡' },
                    { label: '🔫 Configure Single Tier Manually', value: 'gg_manual_tier', description: 'Edit specific weapon slots (1-21)', emoji: '🔫' },
                    { label: '🎁 Manage Equal-% Lucky Dip Prizes', value: 'gg_prizes', description: 'Set winner reward commands', emoji: '🎁' },
                    { label: '🗑️ Clear Arena Spawns', value: 'gg_clear_spawns', emoji: '🗑️' }
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

    if (customId === 'gungame_action_select') {
        if (selectedValue === 'gg_add_spawn') {
            return interaction.reply({ content: '📍 **Arena Setup:** Stand at your desired spawn position in-game and type `/arenaspawn gungame` to register your coordinates.', flags: 64 });
        }

        if (selectedValue === 'gg_load_preset') {
            if (db.GunGameWeapon) {
                await db.GunGameWeapon.destroy({ where: { guildId: interaction.guild.id } });
                for (const tierData of BUILT_IN_PRESETS.standard) {
                    await db.GunGameWeapon.create({
                        guildId: interaction.guild.id,
                        tier: tierData.tier,
                        weaponName: tierData.weapon,
                        ammoName: tierData.ammo,
                        ammoAmount: 30
                    });
                }
            }
            return interaction.reply({ content: '⚡ Successfully loaded the Standard 21-Tier Gun Game ladder preset!', flags: 64 });
        }

        if (selectedValue === 'gg_manual_tier') {
            const modal = new ModalBuilder().setCustomId('modal_gg_add_weapon').setTitle('Configure Gun Game Tier');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tier').setLabel("Tier Number (1 to 21)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('weapon').setLabel("Weapon Shortname (e.g. rifle.ak)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ammo').setLabel("Ammo Shortname (e.g. ammo.rifle)").setStyle(TextInputStyle.Short).setRequired(false))
            );
            return interaction.showModal(modal);
        }

        if (selectedValue === 'gg_prizes') {
            const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => ({
                label: RUST_CATEGORIES[catKey].label,
                value: `gg_prize_cat_${catKey}`,
                emoji: RUST_CATEGORIES[catKey].emoji
            }));
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('gg_prize_category_select')
                    .setPlaceholder('Step 1: Select prize category...')
                    .addOptions(catOptions)
            );
            return interaction.reply({ content: '🎁 **Gun Game Prize Wizard:** Select an item category for the prize pool:', components: [row], flags: 64 });
        }

        if (selectedValue === 'gg_clear_spawns') {
            if (db.ArenaSpawn) await db.ArenaSpawn.destroy({ where: { guildId: interaction.guild.id } });
            return interaction.reply({ content: '✅ All Gun Game arena spawn points cleared.', flags: 64 });
        }
    }

    // Catalog Select Menus for Prizes
    if (interaction.isStringSelectMenu()) {
        if (customId === 'gg_prize_category_select') {
            const catKey = selectedValue.replace('gg_prize_cat_', '');
            const categoryData = RUST_CATEGORIES[catKey];
            if (!categoryData || !categoryData.items) return interaction.reply({ content: '❌ Invalid category.', flags: 64 });

            const itemOptions = categoryData.items.slice(0, 25).map(item => ({
                label: item.name,
                description: `Shortname: ${item.shortname}`,
                value: `gg_prize_item_${item.shortname}`
            }));

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('gg_prize_item_select')
                    .setPlaceholder(`Step 2: Choose item from ${categoryData.label}...`)
                    .addOptions(itemOptions)
            );
            return interaction.update({ content: `🎁 **Gun Game Prize Wizard:** Choose the exact item from **${categoryData.label}**:`, components: [row] });
        }

        if (customId === 'gg_prize_item_select') {
            const shortname = selectedValue.replace('gg_prize_item_', '');
            const modal = new ModalBuilder().setCustomId(`modal_gg_prize_exec_${shortname}`).setTitle(`Configure Prize (${shortname})`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Quantity (e.g. 1)").setStyle(TextInputStyle.Short).setValue('1').setRequired(true))
            );
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        if (customId === 'modal_gg_add_weapon' && db.GunGameWeapon) {
            const tier = parseInt(interaction.fields.getTextInputValue('tier'));
            const weaponName = interaction.fields.getTextInputValue('weapon').trim();
            const ammoName = interaction.fields.getTextInputValue('ammo')?.trim() || null;

            await db.GunGameWeapon.upsert({ guildId: interaction.guild.id, tier, weaponName, ammoName });
            return interaction.reply({ content: `✅ Successfully saved **Tier ${tier}**: \`${weaponName}\`!`, flags: 64 });
        }

        if (customId.startsWith('modal_gg_prize_exec_') && db.ArenaPrize) {
            const shortname = customId.replace('modal_gg_prize_exec_', '');
            const amount = interaction.fields.getTextInputValue('amount') || '1';
            const prizeName = `${amount}x ${shortname}`;
            const command = `inventory.giveto "{player}" ${shortname} ${amount}`;

            await db.ArenaPrize.create({ guildId: interaction.guild.id, prizeName, command });
            const totalPrizes = await db.ArenaPrize.count({ where: { guildId: interaction.guild.id } });
            const share = (100 / totalPrizes).toFixed(1);

            return interaction.reply({ content: `✅ Added **${prizeName}** to the Gun Game prize pool! Pool now has ${totalPrizes} items (**${share}%** chance each).`, flags: 64 });
        }
    }
};