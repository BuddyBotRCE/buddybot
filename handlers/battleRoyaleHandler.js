const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../database/db');
const adminHandler = require('./adminHandler');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');
const { queueAdminPos } = require('../utils/rconManager');

const brSessions = new Map();

const buildBRPanelPayload = async (guildId, messageOverride = '') => {
    if (!brSessions.has(guildId)) brSessions.set(guildId, { view: 'main', serverId: null });
    const session = brSessions.get(guildId);
    
    const ArenaCratePoint = db.ArenaCratePoint;
    const ArenaSpawn = db.ArenaSpawn;
    const ArenaConfig = db.ArenaConfig;
    const ArenaPrize = db.ArenaPrize;
    const GameServer = db.GameServer;

    const cratesMapped = ArenaCratePoint ? await ArenaCratePoint.count({ where: { guildId } }).catch(() => 0) : 0;
    const spawnsMapped = ArenaSpawn ? await ArenaSpawn.count({ where: { guildId } }).catch(() => 0) : 0;
    const [config] = ArenaConfig ? await ArenaConfig.findOrCreate({ where: { guildId } }).catch(() => [{}]) : [{}];
    const prizes = ArenaPrize ? await ArenaPrize.count({ where: { guildId } }).catch(() => 0) : 0;
    const prizeShare = prizes > 0 ? (100 / prizes).toFixed(1) : 0;
    const servers = GameServer ? await GameServer.findAll({ where: { guildId } }).catch(() => []) : [];

    let serverDisplay = '`Default / Main Server`';
    if (session.serverId) {
        const targetServer = servers.find(s => s.id == session.serverId);
        if (targetServer) serverDisplay = `**${targetServer.serverName}**`;
    }

    let components = [];

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Battle Royale Event Manager')
        .setColor('#3498db')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Manage Rust Console Edition randomized crate-spawn Battle Royale arenas.\n\n` +
            `• **Target Server:** ${serverDisplay}\n` +
            `• **Player Spawn Points Mapped:** \`${spawnsMapped}\`\n` +
            `• **Elite Crate Points Mapped:** \`${cratesMapped}\`\n` +
            `• **Active Crate Fill Rate:** \`${config.crateSpawnPercentage || 35}% of mapped points\`\n` +
            `• **Lucky Dip Prizes:** \`${prizes} items (${prizeShare}% each)\``
        );

    if (servers.length > 0) {
        const serverOptions = [{ label: 'Default / Main Server', value: 'br_server_default', emoji: '🌐' }, ...servers.map(s => ({ label: s.serverName, value: `br_server_${s.id}`, emoji: '🖥️' }))];
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('br_menu_server_select').setPlaceholder('🖥️ Select target server...').addOptions(serverOptions)
        ));
    }

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('br_btn_add_spawn').setLabel('Add Player Spawn').setStyle(ButtonStyle.Success).setEmoji('📍'),
        new ButtonBuilder().setCustomId('br_btn_add_crate').setLabel('Add Elite Crate').setStyle(ButtonStyle.Success).setEmoji('📦'),
        new ButtonBuilder().setCustomId('br_btn_percentage').setLabel('Fill Rate %').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
        new ButtonBuilder().setCustomId('br_btn_prizes').setLabel('Prizes').setStyle(ButtonStyle.Primary).setEmoji('🎁'),
        new ButtonBuilder().setCustomId('br_btn_clear').setLabel('Clear All').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    components.push(row1, row2);

    return { embeds: [embed], components, flags: 64 };
};

const battleRoyaleHandler = async (interaction, client) => {
    try {
        const guildId = interaction.guild.id;
        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

        if (!brSessions.has(guildId)) brSessions.set(guildId, { view: 'main', serverId: null });
        const session = brSessions.get(guildId);

        if (customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
            return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
        }

        if (customId === 'admin_menu_select' && selectedValue === 'setup_battleroyale') {
            const payload = await buildBRPanelPayload(guildId);
            return interaction.update(payload).catch(() => interaction.reply(payload));
        }

        if (customId === 'br_btn_add_spawn') {
            const loadingPayload = await buildBRPanelPayload(guildId, '⏳ **Extracting your position from the server for Player Spawn...**');
            await interaction.update(loadingPayload);
            await queueAdminPos(interaction, 'custom_zone', 'br_spawn', session.serverId);
            return;
        }

        if (customId === 'br_btn_add_crate') {
            const loadingPayload = await buildBRPanelPayload(guildId, '⏳ **Extracting your position from the server for Elite Crate...**');
            await interaction.update(loadingPayload);
            await queueAdminPos(interaction, 'custom_zone', 'br_crate', session.serverId);
            return;
        }

        if (customId === 'br_btn_percentage') {
            const modal = new ModalBuilder().setCustomId('modal_br_percentage').setTitle('Set Crate Spawn Fill %');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('percentage').setLabel("Spawn Percentage (e.g. 35)").setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        if (customId === 'br_btn_prizes') {
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
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('admin_menu_select_br_back').setLabel('Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
            );
            return interaction.update({ content: '🎁 **Battle Royale Prize Wizard:** Select an item category for the prize pool:', embeds: [], components: [row, backRow], flags: 64 });
        }

        if (customId === 'br_btn_clear') {
            if (db.ArenaCratePoint) await db.ArenaCratePoint.destroy({ where: { guildId } });
            if (db.ArenaSpawn) await db.ArenaSpawn.destroy({ where: { guildId } });
            const payload = await buildBRPanelPayload(guildId, '✅ All mapped Battle Royale spawn points and crate points have been cleared.');
            return interaction.update(payload);
        }

        if (customId === 'admin_menu_select_br_back') {
            const payload = await buildBRPanelPayload(guildId);
            return interaction.update(payload);
        }

        if (interaction.isStringSelectMenu()) {
            if (customId === 'br_menu_server_select') {
                session.serverId = selectedValue === 'br_server_default' ? null : selectedValue.replace('br_server_', '');
                const payload = await buildBRPanelPayload(guildId, '🖥️ Target server updated!');
                return interaction.update(payload);
            }

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
                await db.ArenaConfig.upsert({ guildId, crateSpawnPercentage: val });
                const payload = await buildBRPanelPayload(guildId, `✅ Battle Royale crate spawn fill rate successfully updated to **${val}%**!`);
                return interaction.update(payload);
            }

            if (customId.startsWith('modal_br_prize_exec_') && db.ArenaPrize) {
                const shortname = customId.replace('modal_br_prize_exec_', '');
                const amount = interaction.fields.getTextInputValue('amount') || '1';
                const prizeName = `${amount}x ${shortname}`;
                const command = `inventory.giveto "{player}" ${shortname} ${amount}`;

                await db.ArenaPrize.create({ guildId, prizeName, command });
                const payload = await buildBRPanelPayload(guildId, `✅ Added **${prizeName}** to the Battle Royale prize pool!`);
                return interaction.update(payload);
            }
        }
    } catch (error) {
        console.error('[BATTLE ROYALE ERROR]', error);
    }
};

battleRoyaleHandler.autoSaveLocation = async (guildId, x, y, z, targetType) => {
    if (targetType === 'br_spawn' && db.ArenaSpawn) {
        await db.ArenaSpawn.create({ guildId, x: x.toString(), y: y.toString(), z: z.toString() });
    } else if (targetType === 'br_crate' && db.ArenaCratePoint) {
        await db.ArenaCratePoint.create({ guildId, x: x.toString(), y: y.toString(), z: z.toString() });
    }
};

battleRoyaleHandler.refreshPanelViaInteraction = async (interaction, messageOverride, targetType) => {
    try {
        const guildId = interaction.guild.id;
        const payload = await buildBRPanelPayload(guildId, messageOverride);
        await interaction.editReply(payload);
    } catch (e) {}
};

module.exports = battleRoyaleHandler;
module.exports.autoSaveLocation = battleRoyaleHandler.autoSaveLocation;
module.exports.refreshPanelViaInteraction = battleRoyaleHandler.refreshPanelViaInteraction;