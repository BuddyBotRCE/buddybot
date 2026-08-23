// ============================================================================
// MASTER INTERACTION HANDLER - BUDDYBOT RCE (COMPLETE FULL FILE)
// ============================================================================

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { GuildConfig, GameServer, UserEconomy, Giveaway, CustomBind, BindCooldown, ServerKit, ShopItem, ShopCooldown, CasinoCooldown, OrpConfig, PlayerOrpBase, BuddyPassChallenge, BuddyPassReward, TicketCategory, PveZone, ActiveBounty, BountyCooldown, Clan, ClanMember, ClanInvite, ClanWar, ReactionRole } = require('../database/db');
const { Op } = require('sequelize'); 
const { connectRcon, sendRconCommand, adminPosQueue, queueAdminPos } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');
const discordTranscripts = require('discord-html-transcripts');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const activeKitBuilders = new Map(); 

// ============================================================================
// 🚁 NEW AUTO-EVENT UI MANAGERS
// ============================================================================
async function renderAutoEventHub(interaction) {
    let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
    
    const supplyStatus = config.autoSupplyEnabled ? '🟢 Active' : '🔴 Disabled';
    const eliteStatus = config.autoEliteEnabled ? '🟢 Active' : '🔴 Disabled';
    const timedStatus = config.autoTimedEnabled ? '🟢 Active' : '🔴 Disabled';

    const embed = new EmbedBuilder()
        .setTitle('🚁 Auto-Events Hub')
        .setDescription(`**Current Active Events:**\n\n` +
            `📦 **${config.supplyEventName || 'Supply Drops'}**: ${supplyStatus} (Spawning ${config.supplySpawnCount || 1})\n` +
            `💎 **${config.eliteEventName || 'Elite Crates'}**: ${eliteStatus} (Spawning ${config.eliteSpawnCount || 1})\n` +
            `⏱️ **${config.timedEventName || 'Timed Crates'}**: ${timedStatus} (Spawning ${config.timedSpawnCount || 1})\n\n` +
            `*Use the dropdown below to select an event to configure.*`)
        .setColor('#f1c40f');

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ae_hub_select').setPlaceholder('🔽 Select Event to Configure...').addOptions([
            { label: 'Supply Drops', value: 'supply', emoji: '📦' },
            { label: 'Elite Crates', value: 'elite', emoji: '💎' },
            { label: 'Timed Crates', value: 'timed', emoji: '⏱️' }
        ])
    );

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [row], content: null });
    } else {
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            await interaction.update({ embeds: [embed], components: [row], content: null });
        } else {
            await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }
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
            locDesc += `**Slot ${i}:** ✅ Mapped (\`X: ${Math.round(x)}, Y: ${Math.round(y)}, Z: ${Math.round(z)}\`)\n`;
        } else {
            locDesc += `**Slot ${i}:** 🔴 Not Set\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Configuring: ${customName}`)
        .setDescription(`**Event Status:** ${isEnabled ? '🟢 Active' : '🔴 Disabled'}\n` +
            `**Quantity:** ${count}\n` +
            `**Interval:** ${interval} mins\n\n` +
            `**📍 Current Positions:**\n${locDesc}\n` +
            `*Use the buttons below to update settings and map locations.*`)
        .setColor(isEnabled ? '#2ecc71' : '#3498db');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ae_btn_config_${eventType}`).setLabel('Set Name, Qty & Time').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
        new ButtonBuilder().setCustomId(`ae_btn_setpos_${eventType}`).setLabel('Set Position').setStyle(ButtonStyle.Success).setEmoji('📍'),
        new ButtonBuilder().setCustomId(`ae_btn_test_${eventType}`).setLabel('Test Spawn').setStyle(ButtonStyle.Secondary).setEmoji('🧪')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ae_btn_toggle_${eventType}`).setLabel(isEnabled ? 'Disable Event' : 'Enable Event').setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('⚡'),
        new ButtonBuilder().setCustomId(`ae_btn_delete_${eventType}`).setLabel('Wipe Data').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
        new ButtonBuilder().setCustomId(`ae_hub_back`).setLabel('Go Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: [row1, row2], content: null });
    } else {
        await interaction.update({ embeds: [embed], components: [row1, row2], content: null });
    }
}
// ============================================================================


const RUST_EMOTES = [
    { label: 'I need wood', value: 'i need wood', emoji: '🪵' }, { label: 'I need stone', value: 'i need stone', emoji: '🪨' },
    { label: 'I need metal', value: 'i need metal', emoji: '⚙️' }, { label: 'I need cloth', value: 'i need cloth', emoji: '🧵' },
    { label: 'I need ammo', value: 'i need ammo', emoji: '🔫' }, { label: 'I need a weapon', value: 'i need a weapon', emoji: '⚔️' },
    { label: 'I need meds', value: 'i need meds', emoji: '💉' }, { label: 'I need food', value: 'i need food', emoji: '🍖' },
    { label: 'I need water', value: 'i need water', emoji: '💧' }, { label: 'Can I have a key', value: 'can i have a key', emoji: '🔑' },
    { label: 'Follow me', value: 'follow me', emoji: '🏃' }, { label: 'Enemies spotted', value: 'enemies spotted', emoji: '🎯' },
    { label: 'Friendly', value: 'friendly', emoji: '🏳️' }, { label: 'Run!', value: 'run', emoji: '💨' },
    { label: 'Retreat', value: 'retreat', emoji: '🔙' }, { label: 'I am looting', value: 'i am looting', emoji: '🎒' },
    { label: 'I am building', value: 'i am building', emoji: '🔨' }, { label: 'I am farming', value: 'i am farming', emoji: '⛏️' },
    { label: 'Hello', value: 'hello', emoji: '👋' }, { label: 'Thanks', value: 'thanks', emoji: '🤝' },
    { label: 'Sorry', value: 'sorry', emoji: '🥺' }, { label: 'Help', value: 'help', emoji: '🆘' },
    { label: 'Yes', value: 'yes', emoji: '✅' }, { label: 'No', value: 'no', emoji: '❌' }
];

const RUST_ITEMS = [
    { n: 'Assault Rifle (AK47)', s: 'rifle.ak' }, { n: 'LR-300', s: 'rifle.lr300' }, { n: 'M249', s: 'lmg.m249' }, { n: 'Custom SMG', s: 'smg.2' }, 
    { n: 'Thompson', s: 'smg.thompson' }, { n: 'MP5A4', s: 'smg.mp5' }, { n: 'Pump Shotgun', s: 'shotgun.pump' }, { n: 'Double Barrel', s: 'shotgun.double' }, 
    { n: 'Medical Syringe', s: 'syringe.medical' }, { n: 'Wood', s: 'wood' }, { n: 'Stone', s: 'stones' }, { n: 'Metal Fragments', s: 'metal.fragments' }, 
    { n: 'High Quality Metal', s: 'metal.refined' }, { n: 'Scrap', s: 'scrap' }, { n: '5.56 Rifle Ammo', s: 'ammo.rifle' }, { n: 'Pistol Ammo', s: 'ammo.pistol' }, 
    { n: 'Rocket', s: 'ammo.rocket.basic' }, { n: 'C4 (Timed Explosive)', s: 'explosive.timed' }, { n: 'Satchel Charge', s: 'explosive.satchel' }
];

module.exports = async (interaction, client) => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId.startsWith('bind_role_menu_')) {
                const bindId = interaction.customId.split('_')[3];
                await CustomBind.update({ roleId: interaction.values[0] }, { where: { id: bindId } });
                return interaction.update({ content: `✅ Bind finalized!`, components: [] });
            }
            if (interaction.customId === 'select_ticket_admin') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, ticketAdminRoleId: interaction.values[0] });
                return interaction.update({ content: `✅ Ticket Admin Role set!`, components: [] });
            }
            if (interaction.customId === 'select_ticket_vip') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, ticketVipRoleId: interaction.values[0] });
                return interaction.update({ content: `✅ Ticket Priority VIP Role set!`, components: [] });
            }
            if (interaction.customId.startsWith('shop_role_')) {
                const itemId = interaction.customId.replace('shop_role_', '');
                await ShopItem.update({ requiredRoleId: interaction.values[0] }, { where: { id: itemId } });
                return interaction.update({ content: `✅ Item role restriction updated successfully!`, components: [] });
            }
            if (interaction.customId === 'select_suggestion_role') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, suggestionPingRoleId: interaction.values[0] });
                return interaction.update({ content: `✅ Suggestion ping role successfully linked!`, components: [] });
            }
        }
        
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'select_crosschat_channel') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, crossChatChannelId: interaction.values[0] });
                return interaction.update({ content: `✅ Cross-Chat linked!`, components: [] });
            }
            if (interaction.customId === 'select_killfeed_channel') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, killfeedChannelId: interaction.values[0] });
                return interaction.update({ content: `✅ Killfeed channel successfully linked!`, components: [] });
            }
            if (interaction.customId === 'select_giveaway_channel') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, giveawayChannelId: interaction.values[0] });
                return interaction.update({ content: `✅ Default Giveaway channel linked!`, components: [] });
            }
            if (interaction.customId === 'select_ticket_category') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, ticketCategoryId: interaction.values[0] });
                return interaction.update({ content: `✅ Ticket Category set!`, components: [] });
            }
            if (interaction.customId === 'select_ticket_transcript') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, ticketTranscriptChannelId: interaction.values[0] });
                return interaction.update({ content: `✅ Ticket Transcript channel set!`, components: [] });
            }
            if (interaction.customId === 'select_log_admin_channel') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, logAdminChannelId: interaction.values[0] });
                return interaction.update({ content: `✅ Admin Logs channel successfully linked!`, components: [] });
            }
            if (interaction.customId === 'select_log_game_channel') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, logGameChannelId: interaction.values[0] });
                return interaction.update({ content: `✅ Game Feeds channel successfully linked!`, components: [] });
            }
            if (interaction.customId === 'select_log_discord_channel') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, logDiscordChannelId: interaction.values[0] });
                return interaction.update({ content: `✅ Discord Logs channel successfully linked!`, components: [] });
            }
            if (interaction.customId === 'select_suggestion_channel') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, suggestionChannelId: interaction.values[0] });
                return interaction.update({ content: `✅ Suggestions channel successfully linked!`, components: [] });
            }
        }
        
        if (interaction.isUserSelectMenu()) {
            if (interaction.customId === 'admin_item_select_player') {
                const targetUserId = interaction.values[0];
                const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: targetUserId } });
                
                if (!targetUser || !targetUser.inGameName) {
                    return interaction.reply({ content: `❌ This user has not linked their Rust account yet!`, flags: 64 });
                }

                const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => ({
                    label: RUST_CATEGORIES[catKey].label,
                    value: `admin_item_cat_${targetUserId}_${catKey}`,
                    emoji: RUST_CATEGORIES[catKey].emoji
                }));

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('admin_item_category_select')
                        .setPlaceholder('Step 2: Select item category...')
                        .addOptions(catOptions)
                );

                return interaction.update({ content: `🎁 **Admin Item Wizard:** Target player set to **${targetUser.inGameName}**. Now select an item category:`, components: [row] });
            }
            if (interaction.customId === 'select_give_item_target') {
                const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.values[0] } });
                if (!targetUser || !targetUser.inGameName) return interaction.reply({ content: `❌ User hasn't linked their Rust account!`, flags: 64 });
                const modal = new ModalBuilder().setCustomId(`modal_give_item_${targetUser.inGameName}`).setTitle(`Give Item to ${targetUser.inGameName}`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_name').setLabel("Item Shortname (e.g. rifle.ak)").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_amount').setLabel("Amount").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }
            if (interaction.customId.startsWith('select_ga_reroll_')) {
                const messageId = interaction.customId.replace('select_ga_reroll_', '');
                const ga = await Giveaway.findByPk(messageId);
                if (!ga) return interaction.reply({ content: '❌ Giveaway not found.', flags: 64 });
                let entries = JSON.parse(ga.entries);
                entries = entries.filter(id => id !== interaction.values[0]);
                await ga.update({ entries: JSON.stringify(entries) });
                if (entries.length === 0) return interaction.reply({ content: '❌ No valid entries left.', flags: 64 });
                const newWinner = entries[Math.floor(Math.random() * entries.length)];
                const channel = client.channels.cache.get(ga.channelId);
                if (channel) channel.send(`🎲 Giveaway Rerolled! <@${interaction.values[0]}> was replaced by our new winner: <@${newWinner}>!`);
                return interaction.update({ content: `✅ Rerolled successfully!`, components: [] });
            }

            if (interaction.customId === 'select_admin_give_target') {
                const targetUserId = interaction.values[0];
                const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: targetUserId } });
                const displayName = targetUser?.inGameName || `<@${targetUserId}>`;
                const modal = new ModalBuilder().setCustomId(`modal_admin_give_exec_${targetUserId}`).setTitle(`Give Currency to ${displayName}`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Amount to GIVE").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }
            if (interaction.customId === 'select_admin_take_target') {
                const targetUserId = interaction.values[0];
                const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: targetUserId } });
                const displayName = targetUser?.inGameName || `<@${targetUserId}>`;
                const modal = new ModalBuilder().setCustomId(`modal_admin_take_exec_${targetUserId}`).setTitle(`Take Currency from ${displayName}`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Amount to TAKE").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }
        }

        if (interaction.isStringSelectMenu()) {
            const module = interaction.values[0];

            // =================================================================
            // AUTO EVENTS ROUTER - SINGLE DROPDOWN SYSTEM
            // =================================================================
            if (interaction.customId === 'ae_hub_select') {
                return await renderEventPanel(interaction, module);
            }
            // =================================================================

            if (interaction.customId === 'select_link_server_target') {
                const serverId = module.replace('link_server_', '');
                const server = await GameServer.findByPk(serverId);
                const serverName = server ? server.serverName : 'Server';

                const modal = new ModalBuilder().setCustomId(`modal_link_account_${serverId}`).setTitle(`Link Account (${serverName})`);
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('ign').setLabel("Your exact in-game Rust name").setStyle(TextInputStyle.Short).setRequired(true)
                ));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'admin_item_category_select') {
                const parts = module.replace('admin_item_cat_', '').split('_');
                const targetUserId = parts[0];
                const catKey = parts.slice(1).join('_');

                const categoryData = RUST_CATEGORIES[catKey];

                if (!categoryData || !categoryData.items || categoryData.items.length === 0) {
                    return interaction.reply({ content: `❌ Invalid item category key: \`${catKey}\`. Please try again.`, flags: 64 });
                }

                const itemOptions = categoryData.items.slice(0, 25).map(item => ({
                    label: item.name,
                    description: `Shortname: ${item.shortname}`,
                    value: `admin_give_final_${targetUserId}_${item.shortname}`
                }));

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('admin_item_final_select')
                        .setPlaceholder(`Step 3: Choose item from ${categoryData.label}...`)
                        .addOptions(itemOptions)
                );

                return interaction.update({ content: `🎁 **Admin Item Wizard:** Target player set to **${targetUser.inGameName}**. Now select an item category:`, components: [row] });
            }

            if (interaction.customId === 'admin_item_final_select') {
                const cleanVal = module.replace('admin_give_final_', '');
                const firstUnderscore = cleanVal.indexOf('_');
                const targetUserId = cleanVal.substring(0, firstUnderscore);
                const shortname = cleanVal.substring(firstUnderscore + 1);

                const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: targetUserId } });
                const ign = targetUser ? targetUser.inGameName : 'Player';

                const modal = new ModalBuilder()
                    .setCustomId(`modal_admin_give_item_exec_${targetUserId}_${shortname}`)
                    .setTitle(`Give ${shortname} to ${ign}`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('amount')
                            .setLabel("Enter Amount to Send")
                            .setStyle(TextInputStyle.Short)
                            .setValue('1')
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal);
            }

            if (interaction.customId === 'select_pve_delete_exec') {
                await interaction.deferUpdate();
                const zoneId = module;
                const zone = await PveZone.findByPk(zoneId);
                if (!zone) return interaction.followUp({ content: '❌ Zone not found or already deleted.', flags: 64 });

                const zoneName = zone.zoneName;
                await zone.destroy();
                try {
                    await sendRconCommand(interaction.guild.id, `zones.deletecustomzone "${zoneName}"`);
                } catch (e) {}
                return interaction.editReply({ content: `✅ Successfully deleted the PVE Zone **"${zoneName}"** from database and in-game server!`, components: [] });
            }

            if (interaction.customId === 'select_pve_toggle_area') {
                const zoneName = module.replace('toggle_zone_', '');
                await sendRconCommand(interaction.guild.id, `zones.editcustomzone "${zoneName}" "showarea" 1`);
                return interaction.update({ content: `👁️ Visual outline toggled ON in-game for zone **"${zoneName}"**!`, components: [] });
            }

            if (interaction.customId === 'hub_lb_select') {
                const category = module;
                const guildId = interaction.guild.id;
                const config = await GuildConfig.findOne({ where: { guildId } });
                const currency = config ? config.economyCurrency : 'Scrap';
                const allPlayers = await UserEconomy.findAll({ where: { guildId } });
                let leaderboardText = '';
                let embedTitle = '';
                let embedColor = '';

                if (category === 'wealth') {
                    const sortedPlayers = allPlayers.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank)).slice(0, 10);
                    embedTitle = '💰 Wealth Leaderboard';
                    embedColor = '#FFD700';
                    sortedPlayers.forEach((player, index) => {
                        const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                        const totalWealth = player.wallet + player.bank;
                        const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked';
                        leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **${totalWealth}** ${currency}\n`;
                    });
                } else if (category === 'level') {
                    const sortedPlayers = allPlayers.sort((a, b) => {
                        if (b.level === a.level) return b.xp - a.xp;
                        return b.level - a.level;
                    }).slice(0, 10);
                    embedTitle = '⭐ BuddyPass Leaderboard';
                    embedColor = '#00ff00';
                    sortedPlayers.forEach((player, index) => {
                        const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                        const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked';
                        leaderboardText += `${rank} ${ign} (<@${player.userId}>) - **Level ${player.level || 1}** (${player.xp || 0} XP)\n`;
                    });
                } else if (category === 'pvp') {
                    const sortedPlayers = allPlayers.sort((a, b) => {
                        const kdRatioA = a.deaths === 0 ? a.pvpKills : (a.pvpKills / a.deaths);
                        const kdRatioB = b.deaths === 0 ? b.pvpKills : (b.pvpKills / b.deaths);
                        if (kdRatioB === kdRatioA) return b.pvpKills - a.pvpKills;
                        return kdRatioB - kdRatioA;
                    }).slice(0, 10);
                    embedTitle = '⚔️ PvP K/D Leaderboard';
                    embedColor = '#e74c3c';
                    sortedPlayers.forEach((player, index) => {
                        const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                        const ign = player.inGameName ? `**${player.inGameName}**` : 'Unlinked';
                        const kills = player.pvpKills || 0;
                        const deaths = player.deaths || 0;
                        const kd = deaths === 0 ? kills.toFixed(2) : (kills / deaths).toFixed(2);
                        leaderboardText += `${rank} ${ign} (<@${player.userId}>) — **K: ${kills} | D: ${deaths} | KD: ${kd}**\n`;
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle(embedTitle)
                    .setDescription(leaderboardText || 'No data recorded yet.')
                    .setColor(embedColor)
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lb_refresh_${category}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄')
                );

                return interaction.update({ content: null, embeds: [embed], components: [row] });
            }

            if (interaction.customId === 'admin_menu_select') {
                await interaction.channel.messages.fetch({ limit: 10 }).then(messages => {
                    const prompts = messages.filter(m => m.content.includes('Grabbing coordinates') || m.content.includes('Stand at your desired'));
                    for (const [_, msg] of prompts) { msg.delete().catch(() => {}); }
                });

                if (module === 'setup_shop') {
                    const embed = new EmbedBuilder().setTitle('🛒 Server Shop Manager').setDescription('Add prebuilt catalog items, custom gear, or adjust pricing multipliers.').setColor('#e67e22');
                    const row = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId('shop_action_select').setPlaceholder('Select shop action...')
                        .addOptions([
                            { label: 'Add Prebuilt Catalog Items (Multi-Select)', value: 'shop_add_catalog', emoji: '📦' },
                            { label: 'Add Custom Shop Item', value: 'shop_add_custom', emoji: '✨' },
                            { label: 'Set Price Multiplier (e.g. 500%)', value: 'shop_multiplier', emoji: '📈' },
                            { label: 'View / Manage Live Store', value: 'shop_manage', emoji: '📋' }
                        ])
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_economy') {
                    const embed = new EmbedBuilder().setTitle('💰 Economy Manager').setDescription('Manage currency names, interest rates, and individual player balances.').setColor('#f1c40f');
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_econ_name').setLabel('Set Currency Name').setStyle(ButtonStyle.Secondary).setEmoji('🏷️'),
                        new ButtonBuilder().setCustomId('btn_admin_give').setLabel('Give Currency').setStyle(ButtonStyle.Success).setEmoji('➕'),
                        new ButtonBuilder().setCustomId('btn_admin_take').setLabel('Take Currency').setStyle(ButtonStyle.Danger).setEmoji('➖'),
                        new ButtonBuilder().setCustomId('btn_econ_interest').setLabel('Set Bank Interest').setStyle(ButtonStyle.Primary).setEmoji('📈')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_clans') {
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const activeClans = await Clan.count({ where: { guildId: interaction.guild.id } });

                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Clan System Manager')
                        .setDescription(`Configure server clan limits, creation costs, and automatic Discord channel syncing.\n\n• **Active Clans:** ${activeClans}\n• **Creation Cost:** ${config?.clanCreationCost || 1000} ${config?.economyCurrency || 'Scrap'}\n• **Default Max Members:** ${config?.clanDefaultMaxMembers || 4}\n• **Discord Auto-Sync:** ${config?.clanDiscordSyncEnabled ? '🟢 Enabled' : '🔴 Disabled'}`)
                        .setColor('#3498db');
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_clan_settings').setLabel('Configure Clan Settings').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
                        new ButtonBuilder().setCustomId('btn_clan_toggle_sync').setLabel(config?.clanDiscordSyncEnabled ? 'Disable Discord Sync' : 'Enable Discord Sync').setStyle(config?.clanDiscordSyncEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('🔄')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_bounties') {
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const activeBounties = await ActiveBounty.count({ where: { guildId: interaction.guild.id } });
                    
                    const embed = new EmbedBuilder()
                        .setTitle('🎯 Bounties System Manager')
                        .setDescription(`Configure automatic killstreak bounties.\n\n• **Kills to Activate:** ${config?.bountyKillsToActivate || 5}\n• **Reward Amount:** ${config?.bountyRewardAmount || 500} ${config?.economyCurrency || 'Scrap'}\n• **Cooldown After Bounty:** ${config?.bountyCooldownMinutes || 60} mins\n\n• **Current Active Bounties:** ${activeBounties}`)
                        .setColor('#e74c3c');
                        
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_bounty_settings').setLabel('Configure Bounties').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
                        new ButtonBuilder().setCustomId('btn_bounty_clear').setLabel('Clear All Active Bounties').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_reaction_roles') {
                    const embed = new EmbedBuilder()
                        .setTitle('🔘 Reaction Roles & Verification Manager')
                        .setDescription('Create interactive reaction role panels or a strict non-toggle "Verify" button.')
                        .setColor('#3498db');

                    const row = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId('rr_action_select').setPlaceholder('Select reaction role action...')
                            .addOptions([
                                { label: 'Create Reaction Role Panel', value: 'rr_create', emoji: '➕' },
                                { label: 'Remove Reaction Role', value: 'rr_remove', emoji: '🗑️' }
                            ])
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_automod') {
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Auto-Moderation Suite')
                        .setDescription(`Configure automated chat filters and punishments.\n\n• **Status:** ${config?.autoModEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n• **Action Type:** \`${config?.autoModAction || 'timeout'}\` (warn, timeout, ban)\n• **Caps Limit:** ${config?.autoModCapsLimit || 70}%`)
                        .setColor('#e74c3c');

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_automod_toggle').setLabel(config?.autoModEnabled ? 'Disable Auto-Mod' : 'Enable Auto-Mod').setStyle(config?.autoModEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('⚡'),
                        new ButtonBuilder().setCustomId('btn_automod_settings').setLabel('Configure Limits & Actions').setStyle(ButtonStyle.Primary).setEmoji('⚙️')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_minigames') {
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const embed = new EmbedBuilder()
                        .setTitle('🎰 Minigames Casino Manager')
                        .setDescription(`Configure global limits for all 20 casino minigames:\n\n• **Max Bet Amount:** ${config?.casinoMaxBet || 1000} Scrap\n• **Game Cooldown:** ${config?.casinoCooldownSeconds || 5} seconds`)
                        .setColor('#e74c3c');
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_casino_settings').setLabel('Configure Casino Limits').setStyle(ButtonStyle.Primary).setEmoji('⚙️')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_multiserver') {
                    const servers = await GameServer.findAll({ where: { guildId: interaction.guild.id } });
                    const serverList = servers.length 
                        ? servers.map(s => `• **${s.serverName}** (\`${s.rconIp}:${s.rconPort}\`)`).join('\n') 
                        : 'No game servers configured yet. Add your first server below!';

                    const embed = new EmbedBuilder()
                        .setTitle('🌐 RCON Connect & Server Manager')
                        .setDescription(`Manage your game server RCON connections.\n\n*Note: You can add multiple game servers here to host and manage them all from the same Discord server!*\n\n**Configured Servers:**\n${serverList}`)
                        .setColor('#3498db');

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_multiserver_add').setLabel('Add Game Server').setStyle(ButtonStyle.Success).setEmoji('➕'),
                        new ButtonBuilder().setCustomId('rcon_quick_connect').setLabel('Connect RCON').setStyle(ButtonStyle.Primary).setEmoji('🔌')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_buddypass') {
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const challenges = await BuddyPassChallenge.findAll({ where: { guildId: interaction.guild.id } });
                    const rewards = await BuddyPassReward.findAll({ where: { guildId: interaction.guild.id } });

                    const embed = new EmbedBuilder()
                        .setTitle('⭐ BuddyPass Manager')
                        .setDescription(`Configure season XP multipliers, challenges, and level progression rewards (Levels 1-50).\n\n• **XP Rate Multiplier:** ${config?.buddyPassXpRate || 10}x\n• **Active Challenges:** ${challenges.length}\n• **Configured Tier Rewards:** ${rewards.length}/50`)
                        .setColor('#f39c12');

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('bp_set_xp').setLabel('Set XP Rate').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
                        new ButtonBuilder().setCustomId('bp_load_preloaded').setLabel('Load Preloaded Challenges').setStyle(ButtonStyle.Success).setEmoji('📥'),
                        new ButtonBuilder().setCustomId('bp_add_custom').setLabel('Add Custom Challenge').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
                        new ButtonBuilder().setCustomId('bp_set_reward').setLabel('Set Level Reward (1-50)').setStyle(ButtonStyle.Danger).setEmoji('🎁')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_orp') {
                    const orpConfig = await OrpConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Offline Raid Protection (ORP) Manager')
                        .setDescription(`Current Settings:\n• **Zone Radius:** ${orpConfig?.zoneSize || 25}m\n• **Online Color:** ${orpConfig?.onlineColor || 'green'}\n• **Offline Color:** ${orpConfig?.offlineColor || 'blue'}\n• **Active Duration:** ${orpConfig?.activeDurationHours || 24} hours`)
                        .setColor('#3498db');
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_orp_settings').setLabel('Configure Zone Settings').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
                        new ButtonBuilder().setCustomId('btn_orp_list').setLabel('View Active Bases').setStyle(ButtonStyle.Secondary).setEmoji('📋')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_pvezones') {
                    const zones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
                    const zoneList = zones.length ? zones.map(z => `• **${z.zoneName}** (${z.shape.toUpperCase()}, Size: ${z.size})`).join('\n') : 'No custom PVE zones configured yet.';

                    const embed = new EmbedBuilder()
                        .setTitle('🏕️ PVE Custom Zones Manager')
                        .setDescription(`Create and manage custom PVE zones with distinct boundaries, colors, and enter/exit alerts.\n\n**Registered Zones:**\n${zoneList}`)
                        .setColor('#1abc9c');

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_pve_create').setLabel('Create PVE Zone').setStyle(ButtonStyle.Success).setEmoji('➕'),
                        new ButtonBuilder().setCustomId('btn_pve_list').setLabel('View Zone Details').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
                        new ButtonBuilder().setCustomId('btn_pve_delete_menu').setLabel('Delete Zone').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
                        new ButtonBuilder().setCustomId('btn_pve_wipe_all').setLabel('Wipe All Zones').setStyle(ButtonStyle.Danger).setEmoji('☢️')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_autoevents') {
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    if (!config?.isPremiumServer) {
                        return interaction.reply({ 
                            content: `🔒 **Premium Feature Locked**\nAutomated Server Events are exclusive to **⭐ Premium Tier** servers. Toggle your server tier status in the License Manager to unlock this feature!`, 
                            flags: 64 
                        });
                    }
                    return await renderAutoEventHub(interaction);
                }

                if (module === 'setup_tier') {
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const isPremium = config?.isPremiumServer || false;

                    const embed = new EmbedBuilder()
                        .setTitle('🏷️ BuddyBot License & Tier Manager')
                        .setDescription(`Current Server Status: **${isPremium ? '⭐ PREMIUM TIER' : '🆓 FREE TIER'}**\n\n` +
                            (isPremium 
                                ? `✅ Your server has full access to all 20 casino minigames, automated RCON auto-events, and advanced modules.\n*Subscription Status:* \`${config?.subscriptionStatus || 'active'}\``
                                : '⚠️ You are currently on the **Free Tier**. Subscribe via Stripe, then click **Verify Subscription** below to activate!'))
                        .setColor(isPremium ? '#f1c40f' : '#95a5a6');

                    const row1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Upgrade to Premium (Stripe)')
                            .setStyle(ButtonStyle.Link)
                            .setURL('https://buy.stripe.com/8x29AU3Hg3vIazV7yn9bO01'),
                        new ButtonBuilder()
                            .setCustomId('btn_open_verify_modal')
                            .setLabel('Verify Subscription')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✔️')
                    );

                    const row2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('toggle_tier_status')
                            .setLabel(isPremium ? 'Switch to Free (Admin)' : 'Force Activate Premium (Admin)')
                            .setStyle(isPremium ? ButtonStyle.Secondary : ButtonStyle.Success)
                    );
                    return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
                }

                if (module === 'setup_tickets') {
                    const cats = await TicketCategory.findAll({ where: { guildId: interaction.guild.id } });
                    const catList = cats.length ? cats.map(c => `• **${c.name}**`).join('\n') : 'No custom categories added yet.';

                    const embed = new EmbedBuilder()
                        .setTitle('🎫 Ticket System Manager')
                        .setDescription(`Configure support categories, roles, and custom ticket types.\n\n**Custom Categories:**\n${catList}`)
                        .setColor('#e67e22');

                    const row1 = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId('ticket_action_select').setPlaceholder('Select ticket configuration...')
                        .addOptions([
                            { label: 'Set Ticket Category Parent', value: 'tk_cat', emoji: '📁' },
                            { label: 'Set Transcript Channel', value: 'tk_trans', emoji: '📜' },
                            { label: 'Set Admin Role', value: 'tk_admin', emoji: '🛡️' },
                            { label: 'Set Priority VIP Role', value: 'tk_vip', emoji: '⭐' },
                            { label: 'Toggle User DM Transcripts', value: 'tk_toggle', emoji: '📩' }
                        ])
                    );

                    const row2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_tk_add_cat').setLabel('Add Custom Category').setStyle(ButtonStyle.Success).setEmoji('➕'),
                        new ButtonBuilder().setCustomId('btn_tk_clear_cats').setLabel('Clear Categories').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                    );

                    return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
                }

                if (module === 'setup_logging') {
                    const embed = new EmbedBuilder()
                        .setTitle('📊 Server Logging & Audit Manager')
                        .setDescription('Route different types of logs to specific channels to keep your server organized.\n\n• **Admin Logs:** RCON commands, item spawns, bans, teleports.\n• **Game Feeds:** Player joins/leaves, killfeed, world events.\n• **Discord Logs:** Message edits/deletes, voice chat activity, server joins/leaves.')
                        .setColor('#3498db');

                    const row = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId('log_action_select').setPlaceholder('Select a log channel to configure...')
                        .addOptions([
                            { label: 'Set Admin Logs Channel', value: 'log_admin', emoji: '🛡️' },
                            { label: 'Set Game Feeds Channel', value: 'log_game', emoji: '🎮' },
                            { label: 'Set Discord Logs Channel', value: 'log_discord', emoji: '💬' }
                        ])
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_suggestions') {
                    const embed = new EmbedBuilder()
                        .setTitle('💡 Suggestions System Manager')
                        .setDescription('Configure where player suggestions are sent and which admin role is pinged when a new suggestion is submitted.')
                        .setColor('#f1c40f');

                    const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_suggestion_channel').setPlaceholder('Select Suggestions Channel...').addChannelTypes(ChannelType.GuildText));
                    const row2 = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_suggestion_role').setPlaceholder('Select Admin Role to Ping (Optional)...'));
                    return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
                }

                if (module === 'setup_giveaways') {
                    const embed = new EmbedBuilder().setTitle('🎉 Giveaway Manager').setDescription('Manage your server giveaways.').setColor('#9b59b6');
                    const row = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId('giveaway_action_select').setPlaceholder('Select a giveaway action...')
                        .addOptions([
                            { label: 'Start Giveaway', value: 'ga_start', emoji: '🚀' },
                            { label: 'Set Default Channel', value: 'ga_channel', emoji: '📺' },
                            { label: 'Set Default Banner', value: 'ga_banner', emoji: '🖼️' },
                            { label: 'Reroll Winner', value: 'ga_reroll', emoji: '🎲' },
                            { label: 'View Participants', value: 'ga_players', emoji: '👥' },
                            { label: 'Cancel Giveaway', value: 'ga_cancel', emoji: '❌' }
                        ])
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }

                if (module === 'setup_wipe') {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_wipe_full').setLabel('Full Wipe').setStyle(ButtonStyle.Danger), 
                        new ButtonBuilder().setCustomId('btn_wipe_selective').setLabel('Selective Wipe').setStyle(ButtonStyle.Primary)
                    );
                    return interaction.reply({ content: '☢️ Server Wipe Manager', components: [row], flags: 64 });
                }

                if (module === 'setup_embed') {
                    const modal = new ModalBuilder().setCustomId('modal_admin_embed').setTitle('Create Custom Embed');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id').setLabel("Target Channel ID").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel("Embed Title").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel("Description (supports \\n)").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel("Hex Color (e.g. #3498db)").setStyle(TextInputStyle.Short).setValue('#2b2d31').setRequired(false))
                    );
                    return interaction.showModal(modal);
                }

                if (module === 'setup_ai') {
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const embed = new EmbedBuilder()
                        .setTitle('🤖 AI Integration Settings')
                        .setDescription(`Configure your server's custom AI assistant for \`@BuddyBot\` chat:\n\n` +
                            `• **Provider:** \`${config?.aiProvider || 'openai'}\`\n` +
                            `• **Model:** \`${config?.aiModel || 'gpt-4o-mini'}\`\n` +
                            `• **API Key:** ${config?.aiApiKey ? '\`••••••••••••••••\` (Configured)' : '❌ Not Set'}\n` +
                            `• **Base URL:** \`${config?.aiBaseUrl || 'https://api.openai.com/v1'}\``)
                        .setColor('#9b59b6');

                    const row1 = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId('select_ai_provider').setPlaceholder('Choose AI Platform / Provider...')
                            .addOptions([
                                { label: 'OpenAI (ChatGPT)', description: 'api.openai.com', value: 'openai', emoji: '🟢' },
                                { label: 'OpenRouter (Claude, Llama, etc.)', description: 'openrouter.ai', value: 'openrouter', emoji: '🌐' },
                                { label: 'Groq (Ultra-Fast)', description: 'api.groq.com', value: 'groq', emoji: '⚡' },
                                { label: 'DeepSeek', description: 'api.deepseek.com', value: 'deepseek', emoji: '🐋' },
                                { label: 'Google Gemini', description: 'generativelanguage.googleapis.com', value: 'gemini', emoji: '🌌' },
                                { label: 'xAI (Grok)', description: 'api.x.ai', value: 'xai', emoji: '✖️' },
                                { label: 'Mistral AI', description: 'api.mistral.ai', value: 'mistral', emoji: '🌪️' },
                                { label: 'Custom / Self-Hosted', description: 'Ollama, vLLM, etc.', value: 'custom', emoji: '🛠️' }
                            ])
                    );
                    const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ai_set_key').setLabel('Set API Key & Model').setStyle(ButtonStyle.Primary).setEmoji('🔑'));
                    return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
                }

                if (module === 'setup_rcon') {
                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_rcon_setup').setLabel('Set Credentials').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('rcon_quick_connect').setLabel('Connect RCON').setStyle(ButtonStyle.Success));
                    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🌐 RCON Setup').setColor('#3498db')], components: [row], flags: 64 });
                }
                if (module === 'admin_tools') {
                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_admin_item').setLabel('Give Items').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('btn_admin_rcon').setLabel('Send Cmd').setStyle(ButtonStyle.Danger));
                    return interaction.reply({ content: '🧰 Live Admin Tools', components: [row], flags: 64 });
                }
                if (module === 'setup_kits') {
                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_kit_create').setLabel('Create Kit Wizard').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('btn_kit_list').setLabel('View Kits').setStyle(ButtonStyle.Secondary));
                    return interaction.reply({ content: '🎒 **Kit Builder**', components: [row], flags: 64 });
                }
                if (module === 'setup_binds') {
                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_bind_add').setLabel('Add Bind').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('btn_bind_remove').setLabel('Remove Bind').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('btn_bind_list').setLabel('List Binds').setStyle(ButtonStyle.Secondary));
                    return interaction.reply({ content: '🗣️ Custom Binds Manager', components: [row], flags: 64 });
                }
                if (module === 'setup_crosschat') {
                    const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_crosschat_channel').setPlaceholder('Select channel...').addChannelTypes(ChannelType.GuildText));
                    return interaction.reply({ content: '💬 Select a text channel:', components: [row], flags: 64 });
                }
                
                const modal = new ModalBuilder().setCustomId(`modal_${module}`).setTitle('Configure Settings');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('setup_input').setLabel('Data').setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'log_action_select') {
                if (module === 'log_admin') {
                    const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_log_admin_channel').setPlaceholder('Select Admin Logs Channel...').addChannelTypes(ChannelType.GuildText));
                    return interaction.reply({ content: '🛡️ Select channel for **Admin Logs**:', components: [row], flags: 64 });
                }
                if (module === 'log_game') {
                    const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_log_game_channel').setPlaceholder('Select Game Feeds Channel...').addChannelTypes(ChannelType.GuildText));
                    return interaction.reply({ content: '🎮 Select channel for **Game Feeds**:', components: [row], flags: 64 });
                }
                if (module === 'log_discord') {
                    const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_log_discord_channel').setPlaceholder('Select Discord Logs Channel...').addChannelTypes(ChannelType.GuildText));
                    return interaction.reply({ content: '💬 Select channel for **Discord Logs**:', components: [row], flags: 64 });
                }
            }

            // --- REACTION ROLE SELECTOR ROUTER ---
            if (interaction.customId === 'rr_action_select') {
                if (module === 'rr_create') {
                    const modal = new ModalBuilder().setCustomId('modal_rr_create').setTitle('Create Reaction Role Panel');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id').setLabel("Target Channel ID").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel("Emoji (e.g. 🎮 or custom id)").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_id').setLabel("Role ID to Assign").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('is_verify').setLabel("Verify Only? (1 for Yes, 0 for No)").setStyle(TextInputStyle.Short).setValue('0').setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('panel_text').setLabel("Embed Description Text").setStyle(TextInputStyle.Paragraph).setRequired(true))
                    );
                    return interaction.showModal(modal);
                }
                if (module === 'rr_remove') {
                    const modal = new ModalBuilder().setCustomId('modal_rr_remove').setTitle('Remove Reaction Role');
                    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message_id').setLabel("Discord Message ID of Panel").setStyle(TextInputStyle.Short).setRequired(true)));
                    return interaction.showModal(modal);
                }
            }

            if (interaction.customId === 'select_ai_provider') {
                const provider = module;
                let defaultUrl = 'https://api.openai.com/v1';
                let defaultModel = 'gpt-4o-mini';

                if (provider === 'openrouter') { defaultUrl = 'https://openrouter.ai/api/v1'; defaultModel = 'openai/gpt-4o-mini'; } 
                else if (provider === 'groq') { defaultUrl = 'https://api.groq.com/openai/v1'; defaultModel = 'llama-3.3-70b-versatile'; } 
                else if (provider === 'deepseek') { defaultUrl = 'https://api.deepseek.com/v1'; defaultModel = 'deepseek-chat'; } 
                else if (provider === 'gemini') { defaultUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/'; defaultModel = 'gemini-3.7-flash'; }
                else if (provider === 'xai') { defaultUrl = 'https://api.x.ai/v1'; defaultModel = 'grok-beta'; }
                else if (provider === 'mistral') { defaultUrl = 'https://api.mistral.ai/v1'; defaultModel = 'mistral-small-latest'; }
                else if (provider === 'custom') { defaultUrl = 'http://localhost:11434/v1'; defaultModel = 'llama3'; }

                let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
                await config.update({ aiProvider: provider, aiBaseUrl: defaultUrl, aiModel: defaultModel });
                
                const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ai_set_key').setLabel('Set API Key & Model').setStyle(ButtonStyle.Primary).setEmoji('🔑'));
                return interaction.update({ content: `✅ AI Platform set to **${provider.toUpperCase()}**! Now click **Set API Key & Model** to enter your credentials.`, embeds: [], components: [row2] });
            }

            if (interaction.customId.startsWith('pve_shape_')) {
                const parts = interaction.customId.split('_');
                const shape = module; 
                const x = parts[2]; const y = parts[3]; const z = parts[4];
                const defaultSize = shape === 'box' ? '250,250,250' : '50';

                const modal = new ModalBuilder()
                    .setCustomId(`modal_pve_final_${shape}_${x}_${y}_${z}`)
                    .setTitle(`Configure PVE ${shape.toUpperCase()} Zone`);
                
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zone_name').setLabel("Zone Name (e.g. Trader Town)").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zone_size').setLabel(shape === 'box' ? "Box Dimensions (X,Y,Z)" : "Sphere Radius (meters)").setStyle(TextInputStyle.Short).setValue(defaultSize).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zone_color').setLabel("Visual Color (green, blue, red)").setStyle(TextInputStyle.Short).setValue('green').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('zone_enabled').setLabel("Zone Enabled? (1 for On, 0 for Off)").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('enter_msg').setLabel("Enter & Exit Msgs (Enter | Exit)").setStyle(TextInputStyle.Short).setValue('Entered Safe Zone. | Left Safe Zone.').setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'casino_game_select') {
                const gameKey = module;
                const modal = new ModalBuilder().setCustomId(`modal_play_${gameKey}`).setTitle(`Play ${gameKey.toUpperCase()}`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bet').setLabel("Enter Bet Amount").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'ticket_category_select') {
                const selectedCategory = module;
                const modal = new ModalBuilder().setCustomId(`modal_ticket_reason_${selectedCategory}`).setTitle('Ticket Reason');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel("Please describe your issue or request").setStyle(TextInputStyle.Paragraph).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'shop_action_select') {
                if (module === 'shop_add_catalog') {
                    const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => ({ label: RUST_CATEGORIES[catKey].label, value: `shop_cat_${catKey}`, emoji: RUST_CATEGORIES[catKey].emoji }));
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('shop_catalog_category').setPlaceholder('Choose a Rust category...').addOptions(catOptions));
                    return interaction.reply({ content: '📦 Select a category to open the item checklist:', components: [row], flags: 64 });
                }
                if (module === 'shop_add_custom') {
                    const modal = new ModalBuilder().setCustomId('modal_shop_custom').setTitle('Add Custom Shop Item');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_name').setLabel("Display Name").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_cmd').setLabel("RCON Command (use {player})").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_price').setLabel("Price").setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_cooldown').setLabel("Cooldown in Seconds (0 = None)").setStyle(TextInputStyle.Short).setValue('0').setRequired(false))
                    );
                    return interaction.showModal(modal);
                }
                if (module === 'shop_multiplier') {
                    const modal = new ModalBuilder().setCustomId('modal_shop_multiplier').setTitle('Set Price Multiplier');
                    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('multiplier').setLabel("Multiplier % (e.g. 100 = Base, 500 = 500%)").setStyle(TextInputStyle.Short).setRequired(true)));
                    return interaction.showModal(modal);
                }
                if (module === 'shop_manage') {
                    const items = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
                    if (items.length === 0) return interaction.reply({ content: '❌ No items in the shop yet.', flags: 64 });
                    const list = items.slice(0, 25).map(i => `• **${i.name}** - 💰 ${i.price} | CD: ${i.cooldownSeconds}s`).join('\n');
                    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('📋 Active Shop Items').setDescription(list).setColor('#2ecc71')], flags: 64 });
                }
            }

            if (interaction.customId === 'shop_catalog_category') {
                const catKey = module.replace('shop_cat_', '');
                const categoryData = RUST_CATEGORIES[catKey];
                const itemOptions = categoryData.items.slice(0, 25).map(item => ({ label: item.name, description: `Shortname: ${item.shortname} | Base: ${item.basePrice}`, value: `${catKey}__${item.shortname}` }));
                
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('shop_catalog_multi_select')
                        .setPlaceholder('Check multiple items to add...')
                        .setMinValues(1)
                        .setMaxValues(itemOptions.length)
                        .addOptions(itemOptions)
                );
                return interaction.update({ content: `📦 **${categoryData.label}**: Check one or more items below, then submit to batch add them!`, components: [row] });
            }

            if (interaction.customId === 'shop_catalog_multi_select') {
                const checkedItems = interaction.values;
                let addedCount = 0;
                for (const val of checkedItems) {
                    const [catKey, shortname] = val.split('__');
                    const catalogItem = RUST_CATEGORIES[catKey]?.items.find(i => i.shortname === shortname);
                    if (catalogItem) {
                        await ShopItem.create({
                            guildId: interaction.guild.id,
                            name: catalogItem.name,
                            command: `inventory.giveto "{player}" ${catalogItem.shortname} 1`,
                            price: catalogItem.basePrice,
                            category: catKey,
                            cooldownSeconds: 0
                        });
                        addedCount++;
                    }
                }
                return interaction.update({ content: `✅ Successfully batch-added **${addedCount} items** to your server shop!`, components: [] });
            }

            if (interaction.customId === 'bp_reward_dropdown_select') {
                const parts = module.split('_');
                const rewardTypeKey = parts[0]; 
                const level = parseInt(parts[parts.length - 1]);
                
                let rewardType = 'coins';
                let rewardValue = '500';

                if (rewardTypeKey === 'coin') {
                    rewardType = 'coins';
                    rewardValue = parts[1]; 
                } else if (rewardTypeKey === 'xp') {
                    rewardType = 'xp';
                    rewardValue = parts[1]; 
                } else if (rewardTypeKey === 'item') {
                    rewardType = 'item';
                    rewardValue = `${parts[1]} ${parts[2]}`;
                }

                await BuddyPassReward.upsert({ guildId: interaction.guild.id, level, rewardType, rewardValue });
                return interaction.update({ content: `✅ Successfully assigned reward for **Level ${level}**: **${rewardType.toUpperCase()} (${rewardValue})**!`, components: [] });
            }

            if (interaction.customId === 'ticket_action_select') {
                if (module === 'tk_cat') {
                    const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_ticket_category').setPlaceholder('Select Ticket Category...').addChannelTypes(ChannelType.GuildCategory));
                    return interaction.reply({ content: '📁 Select Category:', components: [row], flags: 64 });
                }
                if (module === 'tk_trans') {
                    const row = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_ticket_transcript').setPlaceholder('Select Transcript Channel...').addChannelTypes(ChannelType.GuildText));
                    return interaction.reply({ content: '📜 Select Transcript Channel:', components: [row], flags: 64 });
                }
                if (module === 'tk_admin') {
                    const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_ticket_admin').setPlaceholder('Select Admin Role...'));
                    return interaction.reply({ content: '🛡️ Select Admin Role:', components: [row], flags: 64 });
                }
                if (module === 'tk_vip') {
                    const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_ticket_vip').setPlaceholder('Select VIP Role...'));
                    return interaction.reply({ content: '⭐ Select VIP Role:', components: [row], flags: 64 });
                }
                if (module === 'tk_toggle') {
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const newState = !(config?.ticketSendUserTranscript ?? true);
                    await GuildConfig.upsert({ guildId: interaction.guild.id, ticketSendUserTranscript: newState });
                    return interaction.reply({ content: `📩 **User Transcripts:** DMs are now **${newState ? 'ON' : 'OFF'}**.`, flags: 64 });
                }
            }
            
            if (interaction.customId === 'player_shop_cat_select') {
                const catKey = module;
                const categoryData = RUST_CATEGORIES[catKey];
                const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const multiplier = (config?.shopMultiplier || 100) / 100;
                const availableItems = dbItems.filter(i => i.category === catKey || (catKey === 'custom' && i.category === 'custom'));

                if (availableItems.length === 0) return interaction.update({ content: `❌ No items currently available in **${categoryData?.label || 'Custom'}**.`, components: [] });

                const options = availableItems.map(i => ({ label: i.name, description: `Price: ${Math.round(i.price * multiplier)} | CD: ${i.cooldownSeconds}s`, value: `buy_item_${i.id}` }));
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('player_shop_buy_select').setPlaceholder('Select item to buy...').addOptions(options));
                return interaction.update({ content: `🛒 **${categoryData?.label || 'Shop'}**: Select an item to purchase:`, components: [row] });
            }

            if (interaction.customId === 'player_shop_buy_select') {
                const itemId = module.replace('buy_item_', '');
                const shopItem = await ShopItem.findByPk(itemId);
                if (!shopItem) return interaction.reply({ content: '❌ Item not found.', flags: 64 });
                
                const modal = new ModalBuilder().setCustomId(`modal_buy_qty_${itemId}`).setTitle(`Buy: ${shopItem.name}`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantity').setLabel("How many would you like to buy?").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'select_kit_item') {
                const shortname = interaction.values[0];
                const modal = new ModalBuilder().setCustomId(`modal_kit_amount_${shortname}`).setTitle('Set Amount');
                if (shortname === 'custom_shortname') modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('custom_name').setLabel("Exact Shortname (e.g. rifle.ak)").setStyle(TextInputStyle.Short).setRequired(true)));
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_amount').setLabel("Amount").setStyle(TextInputStyle.Short).setRequired(true).setValue('1')));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'select_wipe_custom') {
                const modal = new ModalBuilder().setCustomId(`modal_wipe_sel_${interaction.values.join('-')}`).setTitle('Confirm Wipe');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm_text').setLabel('Type WIPE').setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'bind_template_select') {
                const template = interaction.values[0];
                if (template === 'tpl_kit') {
                    const kits = await ServerKit.findAll({ where: { guildId: interaction.guild.id } });
                    if (kits.length === 0) return interaction.reply({ content: '❌ Create a Kit first!', flags: 64 });
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('bind_kit_select').setPlaceholder('Select Kit...').addOptions(kits.map(k => ({ label: k.kitName, value: k.id.toString() }))));
                    return interaction.reply({ content: '🎁 **Step 1:** Which kit?', components: [row], flags: 64 });
                } 
                else if (template === 'tpl_orp') {
                    const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                    if (!userProfile) return interaction.reply({ content: '❌ Link Rust account first using `/playerpanel`!', flags: 64 });
                    queueAdminPos(userProfile.inGameName, interaction.guild.id, interaction.user.id, interaction.channel.id, 'orp', client);
                    return interaction.reply({ content: `⏳ Stand in the middle of your base and grab coordinates for ORP setup...`, flags: 64 });
                }
                else if (template === 'tpl_custom') {
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`bind_emote_custom`).setPlaceholder('Select Quick-Chat...').addOptions(RUST_EMOTES));
                    return interaction.reply({ content: '🗣️ **Step 1:** Which phrase triggers this command?', components: [row], flags: 64 });
                } 
                else {
                    const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                    if (!userProfile) return interaction.reply({ content: '❌ Link Rust account first!', flags: 64 });
                    queueAdminPos(userProfile.inGameName, interaction.guild.id, interaction.user.id, interaction.channel.id, template, client);
                    return interaction.reply({ content: `⏳ Grabbing coordinates...`, flags: 64 });
                }
            }

            if (interaction.customId === 'bind_kit_select') {
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`bind_emote_kit_${interaction.values[0]}`).setPlaceholder('Select Quick-Chat...').addOptions(RUST_EMOTES));
                return interaction.update({ content: '🗣️ **Step 2:** Which phrase triggers this kit?', components: [row] });
            }

            if (interaction.customId.startsWith('bind_emote_')) {
                const parts = interaction.customId.split('_'); 
                const type = parts[2]; 
                const emoteSelection = interaction.values[0];
                const modalId = type === 'kit' ? `modal_final_kit_${parts[3]}_${emoteSelection}` : (type === 'custom' ? `modal_final_custom_${emoteSelection}` : `modal_final_${type}_${parts[3]}_${parts[4]}_${parts[5]}_${emoteSelection}`);
                const modal = new ModalBuilder().setCustomId(modalId).setTitle('Final Options');
                if (type === 'custom') modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('command_data').setLabel("Command").setStyle(TextInputStyle.Short).setRequired(true)));
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cost').setLabel("Cost (0 = Free)").setStyle(TextInputStyle.Short).setValue('0').setRequired(false)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cooldown').setLabel("Cooldown (seconds)").setStyle(TextInputStyle.Short).setValue('0').setRequired(false)));
                return interaction.showModal(modal);
            }
        }

        // ====================================================================
        // BUTTON CLICKS
        // ====================================================================
        if (interaction.isButton()) {
            
            if (interaction.customId === 'ae_hub_back') {
                return await renderAutoEventHub(interaction);
            }

            if (interaction.customId.startsWith('ae_btn_config_')) {
                const eventType = interaction.customId.replace('ae_btn_config_', '');
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const currentName = config?.get(`${eventType}EventName`) || (eventType === 'supply' ? 'Supply Drops' : eventType === 'elite' ? 'Elite Crates' : 'Timed Crates');
                const count = config?.get(`${eventType}SpawnCount`) || 1;
                const interval = config?.get(`${eventType}Interval`) || 60;

                const modal = new ModalBuilder().setCustomId(`modal_ae_config_${eventType}`).setTitle(`Configure Event Data`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel("Custom Event Name").setStyle(TextInputStyle.Short).setValue(`${currentName}`).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('qty').setLabel("Quantity to Spawn (Max 10)").setStyle(TextInputStyle.Short).setValue(`${count}`).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interval').setLabel("Repeat Interval (Minutes)").setStyle(TextInputStyle.Short).setValue(`${interval}`).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('ae_loc_btn_')) {
                const parts = interaction.customId.split('_');
                const eventType = parts[3];
                const slotNum = parts[4];
                const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                
                if (!userProfile || !userProfile.inGameName) {
                    return interaction.reply({ content: `❌ Link your Rust account first using \`/playerpanel\` before capturing coordinates!`, flags: 64 });
                }

                queueAdminPos(userProfile.inGameName, interaction.guild.id, interaction.user.id, interaction.channel.id, `aeslot_${eventType}_${slotNum}`, client);
                return interaction.reply({ content: `⏳ Stand exactly where you want it. Capturing coordinates for **Slot ${slotNum}** via RCON...`, flags: 64 });
            }

            if (interaction.customId.startsWith('ae_btn_toggle_')) {
                const eventType = interaction.customId.replace('ae_btn_toggle_', '');
                let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
                const isEnabledPrefix = eventType.charAt(0).toUpperCase() + eventType.slice(1);
                const currentState = config.get(`auto${isEnabledPrefix}Enabled`) || false;
                await config.update({ [`auto${isEnabledPrefix}Enabled`]: !currentState });
                return await renderEventPanel(interaction, eventType);
            }

            if (interaction.customId.startsWith('ae_btn_test_')) {
                await interaction.deferReply({ flags: 64 });
                const eventType = interaction.customId.replace('ae_btn_test_', '');
                let config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                
                if (!config) return interaction.editReply({ content: `❌ Guild configuration not found.` });

                const count = config.get(`${eventType}SpawnCount`) || 1;
                const shortname = eventType === 'supply' ? 'supply_drop' : eventType === 'elite' ? 'crate_elite' : 'hackablelockedcrate';
                let spawned = 0;

                for (let i = 1; i <= count; i++) {
                    const x = config.get(`${eventType}Slot${i}X`);
                    const y = config.get(`${eventType}Slot${i}Y`);
                    const z = config.get(`${eventType}Slot${i}Z`);

                    if (x !== null && x !== undefined && y !== null && z !== null) {
                        await sendRconCommand(interaction.guild.id, `spawn ${shortname} ${x},${y},${z}`);
                        spawned++;
                    }
                }

                if (spawned === 0) {
                    if (eventType === 'supply') await sendRconCommand(interaction.guild.id, 'supply.drop');
                    else await sendRconCommand(interaction.guild.id, `spawn ${shortname}`);
                    return interaction.editReply({ content: `⚠️ No mapped position slots were found. Triggered a default random test spawn instead!` });
                }

                return interaction.editReply({ content: `✅ Successfully test-spawned **${spawned}x** items directly at mapped locations!` });
            }

            if (interaction.customId.startsWith('btn_finalize_tpl_')) {
                const parts = interaction.customId.split('_'); 
                const type = parts[3]; 
                
                await interaction.message.delete().catch(() => {});

                // =================================================================
                // 🚀 AUTO-EVENTS INTERCEPTOR (BLOCKS QUICK CHAT COMPLETELY)
                // =================================================================
                if (type === 'aeslot') {
                    const eventType = parts[4]; 
                    const slotNum = parts[5];
                    const x = parseFloat(parts[6]);
                    const y = parseFloat(parts[7]);
                    const z = parseFloat(parts[8]);

                    const updateObj = {};
                    updateObj[`${eventType}Slot${slotNum}X`] = x;
                    updateObj[`${eventType}Slot${slotNum}Y`] = y;
                    updateObj[`${eventType}Slot${slotNum}Z`] = z;

                    let [cfg] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
                    await cfg.update(updateObj);
                    
                    await interaction.reply({ content: `✅ Location saved! Reloading panel...`, flags: 64 });
                    return await renderEventPanel(interaction, eventType);
                }

                if (type === 'pvezone') {
                    const row = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`pve_shape_${parts[4]}_${parts[5]}_${parts[6]}`)
                            .setPlaceholder('Select Zone Shape...')
                            .addOptions([
                                { label: 'Sphere Zone (Default: 50m)', value: 'sphere', emoji: '🔵' },
                                { label: 'Box Zone (Default: 250,250,250)', value: 'box', emoji: '📦' }
                            ])
                    );
                    return interaction.reply({ content: `🏕️ **Step 2:** Select the boundary shape for your custom PVE zone:`, components: [row], flags: 64 });
                }

                if (type === 'orp') {
                    await sendRconCommand(interaction.guild.id, `say "Offline Raid Protection has been setup at ${parts[4]},${parts[5]},${parts[6]}!"`);
                    return interaction.reply({ content: `✅ ORP setup completed.`, flags: 64 });
                }

                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`bind_emote_${type}_${parts[4]}_${parts[5]}_${parts[6]}`).setPlaceholder('Select Quick-Chat...').addOptions(RUST_EMOTES));
                return interaction.reply({ content: `🗣️ **Step 2:** Which Quick-Chat triggers this ${type}?`, components: [row], flags: 64 });
            }

            if (interaction.customId === 'btn_dismiss_coord') {
                await interaction.message.delete().catch(() => {});
                return interaction.reply({ content: '❌ Coordinate prompt dismissed.', flags: 64 });
            }

            if (interaction.customId === 'btn_rcon_setup') {
                const modal = new ModalBuilder().setCustomId('modal_setup_rcon').setTitle('Configure RCON Credentials');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_ip').setLabel("Server IP").setStyle(TextInputStyle.Short).setRequired(true)), 
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_port').setLabel("Port").setStyle(TextInputStyle.Short).setRequired(true)), 
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_pass').setLabel("Password").setStyle(TextInputStyle.Short).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'hub_clans') {
                const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                if (!userProfile || !userProfile.inGameName) {
                    return interaction.reply({ content: '❌ You must link your Rust account first before using the Clan system!', flags: 64 });
                }

                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const memberData = await ClanMember.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });

                if (!memberData) {
                    const invites = await ClanInvite.count({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                    
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Clan System')
                        .setDescription(`You are currently not in a clan.\n\nCreate your own clan for **${config?.clanCreationCost || 1000} ${config?.economyCurrency || 'Scrap'}**, or check if you have any pending invites.`)
                        .setColor('#3498db');
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_clan_create').setLabel('Create Clan').setStyle(ButtonStyle.Success).setEmoji('➕'),
                        new ButtonBuilder().setCustomId('btn_clan_invites').setLabel(`View Invites (${invites})`).setStyle(ButtonStyle.Secondary).setEmoji('📩'),
                        new ButtonBuilder().setCustomId('btn_clan_leaderboard').setLabel('Top Clans').setStyle(ButtonStyle.Primary).setEmoji('🏆')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                } else {
                    const clan = await Clan.findByPk(memberData.clanId);
                    if (!clan) return interaction.reply({ content: '❌ Clan data corrupted. Please contact an admin.', flags: 64 });
                    
                    const memberCount = await ClanMember.count({ where: { clanId: clan.id } });

                    const embed = new EmbedBuilder()
                        .setTitle(`🛡️ ${clan.tag} ${clan.name}`)
                        .setDescription(`**Your Role:** ${memberData.role}\n**Members:** ${memberCount} / ${clan.maxMembers}\n**Clan Bank:** ${clan.bankBalance} ${config?.economyCurrency || 'Scrap'}\n**Tax Rate:** ${clan.taxRate}%`)
                        .setColor('#f1c40f');

                    if (memberData.role === 'Leader') {
                        const row1 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`btn_clan_invite_${clan.id}`).setLabel('Invite Player').setStyle(ButtonStyle.Success).setEmoji('📩'),
                            new ButtonBuilder().setCustomId(`btn_clan_manage_${clan.id}`).setLabel('Manage Members').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
                            new ButtonBuilder().setCustomId(`btn_clan_bank_${clan.id}`).setLabel('Clan Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦')
                        );
                        const row2 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`btn_clan_codes_${clan.id}`).setLabel('Base Codes').setStyle(ButtonStyle.Secondary).setEmoji('🔐'),
                            new ButtonBuilder().setCustomId(`btn_clan_wars_${clan.id}`).setLabel('Clan Wars').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
                            new ButtonBuilder().setCustomId(`btn_clan_disband_${clan.id}`).setLabel('Disband Clan').setStyle(ButtonStyle.Danger).setEmoji('⚠️')
                        );
                        return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
                    } else {
                        const row1 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`btn_clan_bank_${clan.id}`).setLabel('Clan Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
                            new ButtonBuilder().setCustomId(`btn_clan_codes_${clan.id}`).setLabel('View Base Codes').setStyle(ButtonStyle.Secondary).setEmoji('🔐'),
                            new ButtonBuilder().setCustomId(`btn_clan_leave_${clan.id}`).setLabel('Leave Clan').setStyle(ButtonStyle.Danger).setEmoji('🚪')
                        );
                        return interaction.reply({ embeds: [embed], components: [row1], flags: 64 });
                    }
                }
            }

            if (interaction.customId === 'btn_clan_settings') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const modal = new ModalBuilder().setCustomId('modal_clan_config').setTitle('Clan Creation Settings');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cost').setLabel("Creation Cost (e.g. 1000)").setStyle(TextInputStyle.Short).setValue(`${config?.clanCreationCost || 1000}`).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('max_members').setLabel("Default Max Members (e.g. 4 or 8)").setStyle(TextInputStyle.Short).setValue(`${config?.clanDefaultMaxMembers || 4}`).setRequired(true))
                );
                return interaction.showModal(modal);
            }
            if (interaction.customId === 'btn_clan_toggle_sync') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const newState = !(config?.clanDiscordSyncEnabled || false);
                await config.update({ clanDiscordSyncEnabled: newState });
                return interaction.reply({ content: `✅ Discord Auto-Sync for clans has been turned **${newState ? 'ON 🟢' : 'OFF 🔴'}**!`, flags: 64 });
            }

            if (interaction.customId === 'btn_clan_create') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                
                if (user.wallet < (config?.clanCreationCost || 1000)) {
                    return interaction.reply({ content: `❌ You need **${config?.clanCreationCost || 1000} ${config?.economyCurrency || 'Scrap'}** in your wallet to create a clan!`, flags: 64 });
                }

                const modal = new ModalBuilder().setCustomId('modal_clan_create').setTitle('Create Your Clan');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('clan_name').setLabel("Full Clan Name").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('clan_tag').setLabel("Clan Tag (e.g. [BEST]) - Max 4 Chars").setStyle(TextInputStyle.Short).setMaxLength(6).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'hub_buddypass_view') {
                const challenges = await BuddyPassChallenge.findAll({ where: { guildId: interaction.guild.id } });
                const challengeList = challenges.length 
                    ? challenges.map(c => `• **${c.title}** — Target: *${c.targetAmount} ${c.targetType}* | Reward: **+${c.rewardXp} XP**`).join('\n') 
                    : 'No active BuddyPass challenges configured on this server yet.';

                const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                const lvl = user?.level || 1;
                const xp = user?.xp || 0;

                const embed = new EmbedBuilder()
                    .setTitle('⭐ Server BuddyPass & Challenges')
                    .setDescription(`Complete seasonal objectives to earn XP and unlock tier rewards!\n\n**Your Progress:** Level **${lvl}** (${xp} XP)\n\n**Active Season Challenges:**\n${challengeList}`)
                    .setColor('#f39c12')
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            if (interaction.customId === 'btn_multiserver_add') {
                const modal = new ModalBuilder().setCustomId('modal_multiserver_add').setTitle('Add Game Server');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server_name').setLabel("Server Name (e.g. Main 2X)").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_ip').setLabel("RCON IP Address").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_port').setLabel("RCON Port").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_pass').setLabel("RCON Password").setStyle(TextInputStyle.Short).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'hub_bounties') {
                const bounties = await ActiveBounty.findAll({ where: { guildId: interaction.guild.id } });
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const currency = config?.economyCurrency || 'Scrap';

                if (bounties.length === 0) {
                    return interaction.reply({ content: '🎯 There are currently no active bounties on the server. Nobody has reached the killstreak threshold yet!', flags: 64 });
                }

                const list = bounties.map(b => `🎯 **${b.inGameName}** — Reward: **${b.reward} ${currency}**`).join('\n');
                const embed = new EmbedBuilder()
                    .setTitle('🎯 Active Player Bounties')
                    .setDescription(`Hunt down these players to claim their bounty!\n\n${list}`)
                    .setColor('#e74c3c')
                    .setTimestamp();
                
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            if (interaction.customId === 'btn_bounty_settings') {
                const modal = new ModalBuilder().setCustomId('modal_bounty_config').setTitle('Configure Bounties');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kills').setLabel("Kills to Trigger (e.g. 5)").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reward').setLabel("Reward Amount (e.g. 500)").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cooldown').setLabel("Cooldown in Minutes (e.g. 60)").setStyle(TextInputStyle.Short).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_bounty_clear') {
                await ActiveBounty.destroy({ where: { guildId: interaction.guild.id } });
                return interaction.reply({ content: '🗑️ All active bounties have been cleared from the database.', flags: 64 });
            }

            if (interaction.customId === 'hub_suggestion') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                if (!config?.suggestionChannelId) return interaction.reply({ content: '❌ The suggestion system has not been configured by an admin yet.', flags: 64 });

                const modal = new ModalBuilder().setCustomId('modal_hub_suggestion').setTitle('Submit a Suggestion');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('suggestion_title').setLabel("Brief Title").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('suggestion_desc').setLabel("Describe your suggestion").setStyle(TextInputStyle.Paragraph).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_automod_toggle') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const newState = !(config?.autoModEnabled || false);
                await GuildConfig.upsert({ guildId: interaction.guild.id, autoModEnabled: newState });
                return interaction.reply({ content: `✅ Auto-Moderation has been turned **${newState ? 'ON 🟢' : 'OFF 🔴'}**!`, flags: 64 });
            }

            if (interaction.customId === 'btn_automod_settings') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const modal = new ModalBuilder().setCustomId('modal_automod_config').setTitle('Configure Auto-Mod Parameters');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('action').setLabel("Punishment ('warn', 'timeout', 'ban')").setStyle(TextInputStyle.Short).setValue(config?.autoModAction || 'timeout').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('caps').setLabel("Max Caps % Allowed (e.g. 70)").setStyle(TextInputStyle.Short).setValue(`${config?.autoModCapsLimit || 70}`).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'hub_shop_menu') {
                const embed = new EmbedBuilder()
                    .setTitle('🛒 Server Shop')
                    .setDescription('Choose an option below to browse items by category or check the real-time categorized price list.')
                    .setColor('#e67e22');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('hub_shop_browse').setLabel('Browse Store (Categories)').setStyle(ButtonStyle.Primary).setEmoji('🛍️'),
                    new ButtonBuilder().setCustomId('hub_shop_pricelist').setLabel('Live Price List').setStyle(ButtonStyle.Secondary).setEmoji('📋')
                );
                return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
            }

            if (interaction.customId === 'hub_shop_browse') {
                const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
                const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => {
                    const count = dbItems.filter(i => i.category === catKey).length;
                    return { label: `${RUST_CATEGORIES[catKey].label} (${count} items)`, value: catKey, emoji: RUST_CATEGORIES[catKey].emoji };
                });
                const customCount = dbItems.filter(i => i.category === 'custom').length;
                catOptions.push({ label: `Custom / Server Items (${customCount} items)`, value: 'custom', emoji: '✨' });

                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('player_shop_cat_select').setPlaceholder('Choose a shop category...').addOptions(catOptions));
                return interaction.reply({ content: '🛒 **Server Shop Categories:** Select a category below to view items and make purchases:', components: [row], flags: 64 });
            }

            if (interaction.customId === 'hub_shop_pricelist') {
                const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const currency = config?.economyCurrency || 'Scrap';
                const multiplier = (config?.shopMultiplier || 100) / 100;

                if (dbItems.length === 0) {
                    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('hub_shop_menu').setLabel('Go Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙'));
                    return interaction.update({ content: '❌ There are currently no items for sale in the shop.', embeds: [], components: [row] });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📋 Categorized Store Price List')
                    .setDescription('Here are all items currently available for purchase across all categories:')
                    .setColor('#3498db')
                    .setFooter({ text: 'Prices reflect real-time global multipliers.' });

                for (const catKey in RUST_CATEGORIES) {
                    const catData = RUST_CATEGORIES[catKey];
                    const itemsInCat = dbItems.filter(i => i.category === catKey);

                    if (itemsInCat.length > 0) {
                        let itemListText = itemsInCat.map(i => {
                            const finalPrice = Math.round(i.price * multiplier);
                            return `• **${i.name}** — 💰 **${finalPrice} ${currency}** *(CD: ${i.cooldownSeconds}s)*`;
                        }).join('\n');

                        if (itemListText.length > 1024) {
                            itemListText = itemListText.substring(0, 1021) + '...';
                        }

                        embed.addFields({ name: `${catData.emoji} ${catData.label}`, value: itemListText, inline: false });
                    }
                }

                const customItems = dbItems.filter(i => i.category === 'custom');
                if (customItems.length > 0) {
                    let customListText = customItems.map(i => {
                        const finalPrice = Math.round(i.price * multiplier);
                        return `• **${i.name}** — 💰 **${finalPrice} ${currency}** *(CD: ${i.cooldownSeconds}s)*`;
                    }).join('\n');

                    if (customListText.length > 1024) {
                        customListText = customListText.substring(0, 1021) + '...';
                    }

                    embed.addFields({ name: '✨ Custom / Server Items', value: customListText, inline: false });
                }

                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('hub_shop_menu').setLabel('Go Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙'));
                return interaction.update({ embeds: [embed], components: [row] });
            }

            if (interaction.customId === 'hub_link_account') {
                const servers = await GameServer.findAll({ where: { guildId: interaction.guild.id } });
                
                if (!servers || servers.length === 0) {
                    const modal = new ModalBuilder().setCustomId('modal_link_account_global').setTitle('Link Rust Account');
                    modal.addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('ign').setLabel("Your exact in-game Rust name").setStyle(TextInputStyle.Short).setRequired(true)
                    ));
                    return interaction.showModal(modal);
                }

                const options = servers.map(s => ({
                    label: s.serverName,
                    value: `link_server_${s.id}`,
                    emoji: '🖥️'
                }));

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('select_link_server_target')
                        .setPlaceholder('Select which server to link your account to...')
                        .addOptions(options)
                );

                return interaction.reply({ content: '🔗 **Account Linking:** Please select the specific server you want to link your gamertag to:', components: [row], flags: 64 });
            }

            if (interaction.customId === 'hub_balance') {
                const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const currency = config?.economyCurrency || 'Scrap';
                return interaction.reply({ content: `💰 **Wallet:** ${user ? user.wallet : 0} ${currency}\n🏦 **Bank:** ${user ? user.bank : 0} ${currency}`, flags: 64 });
            }
            
            if (interaction.customId === 'hub_daily') {
                const [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                const now = new Date();
                if (user.lastDaily && (now - new Date(user.lastDaily)) < 86400000) return interaction.reply({ content: `⏳ Wait 24h!`, flags: 64 });
                await user.update({ wallet: user.wallet + 100, lastDaily: now });
                return interaction.reply({ content: `🎁 Claimed 100!`, flags: 64 });
            }

            if (interaction.customId === 'hub_casino') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const isPremium = config?.isPremiumServer || false;

                let games = [
                    { label: 'Coinflip', val: 'coinflip', emoji: '🪙' },
                    { label: 'Slots', val: 'slots', emoji: '🎰' },
                    { label: 'Dice Roll', val: 'dice', emoji: '🎲' }
                ];

                if (isPremium) {
                    games.push(
                        { label: 'Roulette', val: 'roulette', emoji: '🎡' },
                        { label: 'Blackjack', val: 'blackjack', emoji: '🃏' },
                        { label: 'Higher / Lower', val: 'hilow', emoji: '🔼' },
                        { label: 'Poker Hands', val: 'poker', emoji: '♠️' },
                        { label: 'Wheel of Fortune', val: 'wheel', emoji: '☸️' },
                        { label: 'Crash multiplier', val: 'crash', emoji: '📈' },
                        { label: 'Baccarat', val: 'baccarat', emoji: '🎴' },
                        { label: 'Red or Black', val: 'redblack', emoji: '🔴' },
                        { label: 'Three Card Brag', val: 'brag', emoji: '🎴' },
                        { label: 'Keno', val: 'keno', emoji: '🎯' },
                        { label: 'Lucky Numbers', val: 'luckynum', emoji: '🔢' },
                        { label: 'Craps', val: 'craps', emoji: '🎲' },
                        { label: 'Sic Bo', val: 'sicbo', emoji: '🏮' },
                        { label: 'Video Poker', val: 'videopoker', emoji: '💻' },
                        { label: 'Pai Gow', val: 'paigow', emoji: '🀄' },
                        { label: 'Rai Raid Gamble', val: 'raidgamble', emoji: '💣' },
                        { label: 'Scrap Scavenger', val: 'scavenger', emoji: '⚙️' }
                    );
                }

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('casino_game_select')
                        .setPlaceholder(isPremium ? 'Select a Minigame (All 20 Unlocked)...' : 'Select a Minigame (Free Tier: 3 Games)...')
                        .addOptions(games.map(g => ({ label: g.label, value: g.val, emoji: g.emoji })))
                );

                const footerText = isPremium 
                    ? '⭐ **Premium Tier Active:** All 20 minigames are unlocked!' 
                    : '💡 **Free Tier:** Upgrade to Premium in the Admin Panel to unlock all 20 minigames!';

                return interaction.reply({ content: `🎰 **Server Casino Hub:**\n${footerText}`, components: [row], flags: 64 });
            }

            if (interaction.customId === 'ticket_create') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                if (!config || !config.ticketCategoryId || !config.ticketAdminRoleId) {
                    return interaction.reply({ content: '❌ Tickets are not fully configured by an admin yet.', flags: 64 });
                }

                const customCats = await TicketCategory.findAll({ where: { guildId: interaction.guild.id } });
                const options = customCats.length > 0 
                    ? customCats.map(c => ({ label: c.name, description: c.description, value: c.name }))
                    : [
                        { label: 'VIP Problems', value: 'VIP Problems' },
                        { label: 'General Help', value: 'General Help' },
                        { label: 'Giveaway Claims', value: 'Giveaway Claims' }
                      ];

                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ticket_category_select')
                        .setPlaceholder('Select a ticket category...')
                        .addOptions(options)
                );

                return interaction.reply({ content: '🎫 Please select a category for your support ticket:', components: [row], flags: 64 });
            }

            if (interaction.customId.startsWith('ticket_claim_')) {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                await interaction.channel.permissionOverwrites.edit(config.ticketAdminRoleId, { ViewChannel: false });
                await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true });
                return interaction.reply({ content: `✋ Claimed by <@${interaction.user.id}>.` });
            }

            if (interaction.customId === 'ticket_close') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_ticket_close_reason')
                    .setTitle('Close Support Ticket');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('close_reason')
                            .setLabel("Reason for closing this ticket")
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('e.g., Issue resolved / Player assisted successfully')
                            .setRequired(true)
                    )
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'enter_giveaway') {
                const giveaway = await Giveaway.findByPk(interaction.message.id);
                if (!giveaway || !giveaway.isActive) return interaction.reply({ content: '❌ Ended!', flags: 64 });
                let entries = JSON.parse(giveaway.entries);
                if (!entries.includes(interaction.user.id)) {
                    entries.push(interaction.user.id);
                    await giveaway.update({ entries: JSON.stringify(entries) });
                }
                return interaction.reply({ content: '🎉 Entered!', flags: 64 });
            }

            if (interaction.customId === 'btn_kit_create') {
                const modal = new ModalBuilder().setCustomId('modal_kit_start').setTitle('Start Kit Wizard');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kit_name').setLabel("Kit Name").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_kit_add_item') {
                const modal = new ModalBuilder().setCustomId('modal_kit_search').setTitle('Search Item');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('search_term').setLabel("Type item name").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_kit_save') {
                const builder = activeKitBuilders.get(interaction.user.id);
                if (!builder || builder.items.length === 0) return interaction.reply({ content: '❌ Cannot save an empty kit.', flags: 64 });
                await ServerKit.create({ guildId: interaction.guild.id, kitName: builder.name, items: builder.items.join(',') });
                activeKitBuilders.delete(interaction.user.id);
                return interaction.update({ content: `✅ Kit **${builder.name}** saved!`, components: [] });
            }

            if (interaction.customId === 'btn_kit_list') {
                const kits = await ServerKit.findAll({ where: { guildId: interaction.guild.id } });
                const list = kits.length ? kits.map(k => `**${k.kitName}**\n\`${k.items}\``).join('\n\n') : 'No kits found.';
                return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎒 Server Kits').setDescription(list).setColor('#3498db')], flags: 64 });
            }
        }
    } 
    catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (interaction.deferred || interaction.replied) await interaction.followUp({ content: 'Error occurred.', flags: 64 }).catch(()=>{});
        else await interaction.reply({ content: 'Error occurred.', flags: 64 }).catch(()=>{});
    }
};