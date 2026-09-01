const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../database/db');
const adminHandler = require('./adminHandler');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');
const { queueAdminPos } = require('../utils/rconManager');

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

const buildGGPanelPayload = async (guildId, messageOverride = '') => {
    const ArenaSpawn = db.ArenaSpawn;
    const GunGameWeapon = db.GunGameWeapon;
    const ArenaPrize = db.ArenaPrize;
    const GameServer = db.GameServer;

    const spawns = ArenaSpawn ? await ArenaSpawn.count({ where: { guildId } }).catch(() => 0) : 0;
    const weapons = GunGameWeapon ? await GunGameWeapon.count({ where: { guildId } }).catch(() => 0) : 0;
    const prizes = ArenaPrize ? await ArenaPrize.count({ where: { guildId } }).catch(() => 0) : 0;
    const prizeShare = prizes > 0 ? (100 / prizes).toFixed(1) : 0;
    const servers = GameServer ? await GameServer.findAll({ where: { guildId } }).catch(() => []) : [];

    let serverDisplay = '`Default / Main Server`';
    const ggSession = global.ggSessions || new Map();
    const session = ggSession.get(guildId) || { serverId: null };
    if (session.serverId) {
        const targetServer = servers.find(s => s.id == session.serverId);
        if (targetServer) serverDisplay = `**${targetServer.serverName}**`;
    }

    const embed = new EmbedBuilder()
        .setTitle('🎯 Gun Game Event Manager')
        .setColor('#e67e22')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Configure automated Gun Game parameters for Rust Console Edition.\n\n` +
            `• **Target Server:** ${serverDisplay}\n` +
            `• **Arena Spawns Mapped:** \`${spawns}\`\n` +
            `• **Active Tiers Set:** \`${weapons} / 21 Tiers\`\n` +
            `• **Lucky Dip Prizes:** \`${prizes} items (${prizeShare}% each)\``
        );

    let components = [];

    if (servers.length > 0) {
        const serverOptions = [{ label: 'Default / Main Server', value: 'gg_server_default', emoji: '🌐' }, ...servers.map(s => ({ label: s.serverName, value: `gg_server_${s.id}`, emoji: '🖥️' }))];
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('gg_menu_server_select').setPlaceholder('🖥️ Select target server...').addOptions(serverOptions)
        ));
    }

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('gg_btn_add_spawn').setLabel('Add Spawn').setStyle(ButtonStyle.Success).setEmoji('📍'),
        new ButtonBuilder().setCustomId('gg_btn_preset').setLabel('Load Preset').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
        new ButtonBuilder().setCustomId('gg_btn_manual').setLabel('Manual Tier').setStyle(ButtonStyle.Primary).setEmoji('🔫'),
        new ButtonBuilder().setCustomId('gg_btn_prizes').setLabel('Prizes').setStyle(ButtonStyle.Primary).setEmoji('🎁'),
        new ButtonBuilder().setCustomId('gg_btn_clear').setLabel('Clear').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    components.push(row1, row2);

    return { embeds: [embed], components, flags: 64 };
};

const gunGameHandler = async (interaction, client) => {
    try {
        const guildId = interaction.guild.id;
        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

        if (!global.ggSessions) global.ggSessions = new Map();
        if (!global.ggSessions.has(guildId)) global.ggSessions.set(guildId, { serverId: null });
        const session = global.ggSessions.get(guildId);

        if (customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
            return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
        }

        if (customId === 'admin_menu_select' && selectedValue === 'setup_gungame') {
            const payload = await buildGGPanelPayload(guildId);
            return interaction.update(payload).catch(() => interaction.reply(payload));
        }

        if (customId === 'gg_btn_add_spawn') {
            const loadingPayload = await buildGGPanelPayload(guildId, '⏳ **Extracting your position from the server for Gun Game Spawn...**');
            await interaction.update(loadingPayload);
            await queueAdminPos(interaction, 'custom_zone', 'gg_spawn', session.serverId);
            return;
        }

        if (customId === 'gg_btn_preset') {
            if (db.GunGameWeapon) {
                await db.GunGameWeapon.destroy({ where: { guildId } });
                for (const tierData of BUILT_IN_PRESETS.standard) {
                    await db.GunGameWeapon.create({
                        guildId,
                        tier: tierData.tier,
                        weaponName: tierData.weapon,
                        ammoName: tierData.ammo,
                        ammoAmount: 30
                    });
                }
            }
            const payload = await buildGGPanelPayload(guildId, '⚡ Successfully loaded the Standard 21-Tier Gun Game ladder preset!');
            return interaction.update(payload);
        }

        if (customId === 'gg_btn_manual') {
            const modal = new ModalBuilder().setCustomId('modal_gg_add_weapon').setTitle('Configure Gun Game Tier');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tier').setLabel("Tier Number (1 to 21)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('weapon').setLabel("Weapon Shortname (e.g. rifle.ak)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ammo').setLabel("Ammo Shortname (e.g. ammo.rifle)").setStyle(TextInputStyle.Short).setRequired(false))
            );
            return interaction.showModal(modal);
        }

        if (customId === 'gg_btn_prizes') {
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
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('admin_menu_select_gg_back').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
            );
            return interaction.update({ content: '🎁 **Gun Game Prize Wizard:** Select an item category for the prize pool:', embeds: [], components: [row, backRow], flags: 64 });
        }

        if (customId === 'gg_btn_clear') {
            if (db.ArenaSpawn) await db.ArenaSpawn.destroy({ where: { guildId } });
            const payload = await buildGGPanelPayload(guildId, '✅ All Gun Game arena spawn points cleared.');
            return interaction.update(payload);
        }

        if (customId === 'admin_menu_select_gg_back') {
            const payload = await buildGGPanelPayload(guildId);
            return interaction.update(payload);
        }

        if (interaction.isStringSelectMenu()) {
            if (customId === 'gg_menu_server_select') {
                session.serverId = selectedValue === 'gg_server_default' ? null : selectedValue.replace('gg_server_', '');
                const payload = await buildGGPanelPayload(guildId, '🖥️ Target server updated!');
                return interaction.update(payload);
            }

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

                await db.GunGameWeapon.upsert({ guildId, tier, weaponName, ammoName });
                const payload = await buildGGPanelPayload(guildId, `✅ Successfully saved **Tier ${tier}**: \`${weaponName}\`!`);
                return interaction.update(payload);
            }

            if (customId.startsWith('modal_gg_prize_exec_') && db.ArenaPrize) {
                const shortname = customId.replace('modal_gg_prize_exec_', '');
                const amount = interaction.fields.getTextInputValue('amount') || '1';
                const prizeName = `${amount}x ${shortname}`;
                const command = `inventory.giveto "{player}" ${shortname} ${amount}`;

                await db.ArenaPrize.create({ guildId, prizeName, command });
                const payload = await buildGGPanelPayload(guildId, `✅ Added **${prizeName}** to the Gun Game prize pool!`);
                return interaction.update(payload);
            }
        }
    } catch (error) {
        console.error('[GUN GAME ERROR]', error);
    }
};

gunGameHandler.autoSaveLocation = async (guildId, x, y, z, targetType) => {
    if (targetType === 'gg_spawn' && db.ArenaSpawn) {
        await db.ArenaSpawn.create({ guildId, x: x.toString(), y: y.toString(), z: z.toString() });
    }
};

gunGameHandler.refreshPanelViaInteraction = async (interaction, messageOverride, targetType) => {
    try {
        const guildId = interaction.guild.id;
        const payload = await buildGGPanelPayload(guildId, messageOverride);
        await interaction.editReply(payload);
    } catch (e) {}
};

module.exports = gunGameHandler;
module.exports.autoSaveLocation = gunGameHandler.autoSaveLocation;
module.exports.refreshPanelViaInteraction = gunGameHandler.refreshPanelViaInteraction;