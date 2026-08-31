const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ArenaSpawn, GunGameWeapon, GunGamePreset, ArenaPrize } = require('../database/db');
const adminHandler = require('./adminHandler');

// --- 5 BUILT-IN RUST CONSOLE EDITION GUN GAME PRESETS ---
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
        { tier: 21, weapon: 'knife.combat', ammo: null } // The Knife Finish
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

    // --- MAIN GUN GAME DASHBOARD ---
    if (customId === 'admin_menu_select' && selectedValue === 'setup_gungame') {
        const spawns = await ArenaSpawn.count({ where: { guildId: interaction.guild.id } });
        const weapons = await GunGameWeapon.count({ where: { guildId: interaction.guild.id } });
        const prizes = await ArenaPrize.count({ where: { guildId: interaction.guild.id } });
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
            return interaction.update({ embeds: [embed], components: [row1, row2] });
        }
            return interaction.followUp({ embeds: [embed], components: [row1, row2], flags: 64 });
        }

    if (customId === 'gungame_action_select') {
        if (selectedValue === 'gg_add_spawn') {
            // Note: Admin coordinates will be parsed dynamically when standing in-game or via command prompt
            return interaction.reply({ content: '📍 **Arena Setup:** Stand at your desired spawn position in-game and type `/arenaspawn gungame` to register your coordinates.', flags: 64 });
        }

        if (selectedValue === 'gg_load_preset') {
            // Automatically load the standard balanced 21-tier preset into the database
            await GunGameWeapon.destroy({ where: { guildId: interaction.guild.id } });
            for (const tierData of BUILT_IN_PRESETS.standard) {
                await GunGameWeapon.create({
                    guildId: interaction.guild.id,
                    tier: tierData.tier,
                    weaponName: tierData.weapon,
                    ammoName: tierData.ammo,
                    ammoAmount: 30
                });
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
            const modal = new ModalBuilder().setCustomId('modal_gg_add_prize').setTitle('Add Lucky Dip Prize');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel("Prize Display Name (e.g. M249)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('command').setLabel("RCON Command (inventory.giveto ... )").setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        if (selectedValue === 'gg_clear_spawns') {
            await ArenaSpawn.destroy({ where: { guildId: interaction.guild.id } });
            return interaction.reply({ content: '✅ All Gun Game arena spawn points cleared.', flags: 64 });
        }
    }

    if (interaction.isModalSubmit()) {
        if (customId === 'modal_gg_add_weapon') {
            const tier = parseInt(interaction.fields.getTextInputValue('tier'));
            const weaponName = interaction.fields.getTextInputValue('weapon').trim();
            const ammoName = interaction.fields.getTextInputValue('ammo')?.trim() || null;

            await GunGameWeapon.upsert({ guildId: interaction.guild.id, tier, weaponName, ammoName });
            return interaction.reply({ content: `✅ Successfully saved **Tier ${tier}**: \`${weaponName}\`!`, flags: 64 });
        }

        if (customId === 'modal_gg_add_prize') {
            const prizeName = interaction.fields.getTextInputValue('name').trim();
            const command = interaction.fields.getTextInputValue('command').trim();

            await ArenaPrize.create({ guildId: interaction.guild.id, prizeName, command });
            const totalPrizes = await ArenaPrize.count({ where: { guildId: interaction.guild.id } });
            const share = (100 / totalPrizes).toFixed(1);

            return interaction.reply({ content: `✅ Added **${prizeName}** to the prize pool! Pool now has ${totalPrizes} items (**${share}%** chance each).`, flags: 64 });
        }
    }
};