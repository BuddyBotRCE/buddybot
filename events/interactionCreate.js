// ============================================================================
// MASTER INTERACTION HANDLER - BUDDYBOT RCE (FULL ORGANIZED FILE)
// ============================================================================

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { GuildConfig, UserEconomy, Giveaway, CustomBind, BindCooldown, ServerKit, ShopItem, ShopCooldown, CasinoCooldown, OrpConfig, PlayerOrpBase, BuddyPassChallenge, BuddyPassReward, TicketCategory, PveZone, ActiveBounty, BountyCooldown, Clan, ClanMember, ClanInvite, ClanWar, ReactionRole } = require('../database/db');
const { Op } = require('sequelize'); 
const { connectRcon, sendRconCommand, adminPosQueue, queueAdminPos } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');
const discordTranscripts = require('discord-html-transcripts');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const activeKitBuilders = new Map(); 

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
                    const isPremium = config?.isPremiumServer || false;

                    if (!isPremium) {
                        return interaction.reply({ 
                            content: `🔒 **Premium Feature Locked**\nAutomated Server Events are exclusive to **⭐ Premium Tier** servers. Toggle your server tier status in the License Manager to unlock this feature!`, 
                            flags: 64 
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('🚁 Premium Auto-Events Manager Hub')
                        .setDescription(`Select a specific world event below to configure its independent spawn interval, positions, and parameters.\n\n` +
                            `• **Global Status:** ${config?.autoEventsEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n\n` +
                            `**Configured Features:**\n` +
                            `• 🚢 **Docked Cargo:** Every **${config?.cargoInterval || 60}m** (Duration: **${config?.cargoDurationMinutes || 30}m**, Crates: **${config?.cargoCrateCount || 3}**)\n` +
                            `• 📦 **Supply Drop:** Every **${config?.supplyInterval || 60}m**\n` +
                            `• 💎 **Elite Crate:** Every **${config?.eliteInterval || 60}m**\n` +
                            `• ⏱️ **Timed Crate:** Every **${config?.timedInterval || 60}m**`)
                        .setColor('#f1c40f');

                    const row1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ae_sub_cargo').setLabel('🚢 Docked Cargo Config').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('ae_sub_supply').setLabel('📦 Supply Drop Config').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('ae_sub_elite').setLabel('💎 Elite Crate Config').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('ae_sub_timed').setLabel('⏱️ Timed Crate Config').setStyle(ButtonStyle.Secondary)
                    );
                    const row2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_ae_toggle').setLabel(config?.autoEventsEnabled ? 'Disable Global Events' : 'Enable Global Events').setStyle(config?.autoEventsEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('⚡')
                    );
                    return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
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
                
                // Exactly 5 components to bypass Discord's hard limit
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
        // 6. BUTTON CLICKS
        // ====================================================================
        if (interaction.isButton()) {
            
            // --- NEW PLAYER CLAN HUB ---
            if (interaction.customId === 'hub_clans') {
                const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                if (!userProfile || !userProfile.inGameName) {
                    return interaction.reply({ content: '❌ You must link your Rust account first before using the Clan system!', flags: 64 });
                }

                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const memberData = await ClanMember.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });

                if (!memberData) {
                    // Player is NOT in a clan
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
                    // Player IS in a clan
                    const clan = await Clan.findByPk(memberData.clanId);
                    if (!clan) return interaction.reply({ content: '❌ Clan data corrupted. Please contact an admin.', flags: 64 });
                    
                    const memberCount = await ClanMember.count({ where: { clanId: clan.id } });

                    const embed = new EmbedBuilder()
                        .setTitle(`🛡️ ${clan.tag} ${clan.name}`)
                        .setDescription(`**Your Role:** ${memberData.role}\n**Members:** ${memberCount} / ${clan.maxMembers}\n**Clan Bank:** ${clan.bankBalance} ${config?.economyCurrency || 'Scrap'}\n**Tax Rate:** ${clan.taxRate}%`)
                        .setColor('#f1c40f');

                    // If Leader, show manage options
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
                        // Regular Member / Officer View
                        const row1 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`btn_clan_bank_${clan.id}`).setLabel('Clan Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
                            new ButtonBuilder().setCustomId(`btn_clan_codes_${clan.id}`).setLabel('View Base Codes').setStyle(ButtonStyle.Secondary).setEmoji('🔐'),
                            new ButtonBuilder().setCustomId(`btn_clan_leave_${clan.id}`).setLabel('Leave Clan').setStyle(ButtonStyle.Danger).setEmoji('🚪')
                        );
                        return interaction.reply({ embeds: [embed], components: [row1], flags: 64 });
                    }
                }
            }

            // --- ADMIN CLAN BUTTONS ---
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
                return interaction.reply({ content: `✅ Discord Auto-Sync for clans has been turned **${newState ? 'ON 🟢' : 'OFF 🔴'}**!\n*(If ON, creating a clan will automatically make a private text channel, voice channel, and role).*`, flags: 64 });
            }

            // --- CLAN CREATION MODAL TRIGGER ---
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

            // --- NEW BOUNTIES HUB BUTTON ---
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

            // --- ADMIN BOUNTIES TRIGGER BUTTONS ---
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

            // --- NEW SUGGESTION BUTTON CLICK ---
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

            // --- AUTOMOD TOGGLE & SETTINGS BUTTONS ---
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

            // --- AUTO-EVENT TEST SPRAYS ---
            if (interaction.customId === 'btn_ae_test_cargo') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                if (config && config.cargoDockX !== null && config.cargoDockY !== null && config.cargoDockZ !== null) {
                    const coords = `${config.cargoDockX},${config.cargoDockY},${config.cargoDockZ}`;
                    await sendRconCommand(interaction.guild.id, `spawn cargoshipdynamic1 ${coords}`);
                    
                    const crates = config.cargoCrateCount || 3;
                    for(let i=0; i<crates; i++) {
                        let cX = config.cargoDockX + (i * 8);
                        let cY = config.cargoDockY + 14; 
                        let cZ = config.cargoDockZ;
                        await sendRconCommand(interaction.guild.id, `spawn codelockedhackablecrate ${cX},${cY},${cZ}`);
                    }

                    const duration = config.cargoDurationMinutes || 30;
                    setTimeout(() => {
                        sendRconCommand(interaction.guild.id, 'del cargoshipdynamic1').catch(()=>{});
                    }, duration * 60000);

                    return interaction.reply({ content: `✅ Spawned Docked Cargo Ship with ${crates} crates! It will despawn in ${duration} minutes.`, flags: 64 });
                } else {
                    await sendRconCommand(interaction.guild.id, 'cargoships.spawncargoship');
                    return interaction.reply({ content: `⚠️ No custom dock position set. Triggered standard roaming cargo event test!`, flags: 64 });
                }
            }
            if (interaction.customId === 'btn_ae_test_supply') {
                await sendRconCommand(interaction.guild.id, 'supply.drop');
                return interaction.reply({ content: `✅ Test supply drop triggered successfully!`, flags: 64 });
            }
            if (interaction.customId === 'btn_ae_test_elite') {
                await sendRconCommand(interaction.guild.id, 'spawn codelockedhackablecrate');
                return interaction.reply({ content: `✅ Test elite crate spawned successfully!`, flags: 64 });
            }
            if (interaction.customId === 'btn_ae_test_timed') {
                await sendRconCommand(interaction.guild.id, 'spawn hackablelockedcrate');
                return interaction.reply({ content: `✅ Test timed crate spawned successfully!`, flags: 64 });
            }

            if (interaction.customId.startsWith('lb_refresh_')) {
                const category = interaction.customId.replace('lb_refresh_', '');
                const guildId = interaction.guild.id;
                const config = await GuildConfig.findOne({ where: { guildId } });
                const currency = config ? config.economyCurrency : 'Scrap';
                const allPlayers = await UserEconomy.findAll({ where: { guildId } });
                let leaderboardText = '';
                let embedTitle = '';
                let embedColor = '';

                if (category === 'wealth') {
                    const sortedPlayers = allPlayers.sort((a, b) => (b.wallet + b.bank) - (a.wallet + a.bank)).slice(0, 10);
                    embedTitle = '💰 Wealth Leaderboard (Refreshed)';
                    embedColor = '#FFD700';
                    sortedPlayers.forEach((player, index) => {
                        const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                        leaderboardText += `${rank} **${player.inGameName || 'Unlinked'}** (<@${player.userId}>) - **${player.wallet + player.bank}** ${currency}\n`;
                    });
                } else if (category === 'level') {
                    const sortedPlayers = allPlayers.sort((a, b) => b.level - a.level).slice(0, 10);
                    embedTitle = '⭐ BuddyPass Leaderboard (Refreshed)';
                    embedColor = '#00ff00';
                    sortedPlayers.forEach((player, index) => {
                        const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                        leaderboardText += `${rank} **${player.inGameName || 'Unlinked'}** (<@${player.userId}>) - **Level ${player.level || 1}**\n`;
                    });
                } else if (category === 'pvp') {
                    const sortedPlayers = allPlayers.sort((a, b) => b.pvpKills - a.pvpKills).slice(0, 10);
                    embedTitle = '⚔️ PvP K/D Leaderboard (Refreshed)';
                    embedColor = '#e74c3c';
                    sortedPlayers.forEach((player, index) => {
                        const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
                        leaderboardText += `${rank} **${player.inGameName || 'Unlinked'}** — **K: ${player.pvpKills || 0} | D: ${player.deaths || 0}**\n`;
                    });
                }

                const embed = new EmbedBuilder().setTitle(embedTitle).setDescription(leaderboardText || 'No data.').setColor(embedColor).setTimestamp();
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`lb_refresh_${category}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'));
                return interaction.update({ embeds: [embed], components: [row] });
            }

            if (interaction.customId === 'btn_ai_set_key') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const modal = new ModalBuilder().setCustomId('modal_ai_credentials').setTitle('Configure AI Credentials');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ai_key').setLabel("API Key").setStyle(TextInputStyle.Short).setValue(config?.aiApiKey || '').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ai_model').setLabel("Model Name").setStyle(TextInputStyle.Short).setValue(config?.aiModel || 'gpt-4o-mini').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ai_url').setLabel("Base API URL").setStyle(TextInputStyle.Short).setValue(config?.aiBaseUrl || 'https://api.openai.com/v1').setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_econ_name') {
                const modal = new ModalBuilder().setCustomId('modal_setup_economy').setTitle('Configure Currency');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('currency_name').setLabel("Currency Name").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_admin_give') {
                const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('select_admin_give_target').setPlaceholder('Select player...'));
                return interaction.reply({ content: '➕ Select player:', components: [row], flags: 64 });
            }
            if (interaction.customId === 'btn_admin_take') {
                const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('select_admin_take_target').setPlaceholder('Select player...'));
                return interaction.reply({ content: '➖ Select player:', components: [row], flags: 64 });
            }

            if (interaction.customId === 'btn_econ_interest') {
                const modal = new ModalBuilder().setCustomId('modal_econ_interest').setTitle('Configure Bank Interest');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interest_rate').setLabel("Interest Rate %").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interest_hours').setLabel("Interval in Hours").setStyle(TextInputStyle.Short).setValue('24').setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'btn_open_verify_modal') {
                const modal = new ModalBuilder().setCustomId('modal_verify_email').setTitle('Verify Stripe Subscription');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stripe_email').setLabel("Stripe Email").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'hub_economy_menu') {
                const embed = new EmbedBuilder().setTitle('🏦 Economy & Bank Hub').setColor('#2ecc71');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('hub_balance').setLabel('Balance').setStyle(ButtonStyle.Secondary).setEmoji('💰'),
                    new ButtonBuilder().setCustomId('hub_daily').setLabel('Daily').setStyle(ButtonStyle.Success).setEmoji('🎁'),
                    new ButtonBuilder().setCustomId('hub_deposit').setLabel('Deposit').setStyle(ButtonStyle.Primary).setEmoji('📥'),
                    new ButtonBuilder().setCustomId('hub_withdraw').setLabel('Withdraw').setStyle(ButtonStyle.Secondary).setEmoji('📤')
                );
                return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
            }

            if (interaction.customId === 'hub_leaderboards') {
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('hub_lb_select').setPlaceholder('Choose leaderboard...')
                        .addOptions([
                            { label: 'Wealth Leaderboard', value: 'wealth', emoji: '💰' },
                            { label: 'BuddyPass Level Leaderboard', value: 'level', emoji: '⭐' },
                            { label: 'PvP K/D Leaderboard', value: 'pvp', emoji: '⚔️' }
                        ])
                );
                return interaction.reply({ content: '🏆 Select category:', components: [row], flags: 64 });
            }

            if (interaction.customId === 'hub_deposit') {
                const modal = new ModalBuilder().setCustomId('modal_hub_deposit').setTitle('Deposit');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Amount (or 'all')").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'hub_withdraw') {
                const modal = new ModalBuilder().setCustomId('modal_hub_withdraw').setTitle('Withdraw');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Amount (or 'all')").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'hub_vote_info') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const embed = new EmbedBuilder().setTitle('🗳️ Support Server').setDescription(`[Vote Link](${config?.voteUrl || 'https://rust-servers.net'})`).setColor('#e67e22');
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            if (interaction.customId === 'btn_admin_embed_helper') {
                const modal = new ModalBuilder().setCustomId('modal_admin_embed').setTitle('Create Custom Embed');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id').setLabel("Channel ID").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel("Title").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel("Description").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel("Color").setStyle(TextInputStyle.Short).setValue('#2b2d31').setRequired(false))
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'rcon_quick_connect') {
                await interaction.reply({ content: '⏳ Connecting...', flags: 64 });
                try {
                    const status = await connectRcon(interaction.guild.id, client);
                    await interaction.editReply({ content: `✅ ${status}` });
                } catch (e) { await interaction.editReply({ content: `❌ ${e.message}` }); }
                return;
            }
            if (interaction.customId === 'btn_rcon_setup') {
                const modal = new ModalBuilder().setCustomId('modal_setup_rcon').setTitle('Configure RCON');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_ip').setLabel("IP").setStyle(TextInputStyle.Short).setRequired(true)), 
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_port').setLabel("Port").setStyle(TextInputStyle.Short).setRequired(true)), 
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_pass').setLabel("Password").setStyle(TextInputStyle.Short).setRequired(true))
                );
                return interaction.showModal(modal);
            }
            if (interaction.customId === 'btn_admin_item') {
                const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('select_give_item_target').setPlaceholder('Select player...'));
                return interaction.reply({ content: '🎁 Select player:', components: [row], flags: 64 });
            }
            if (interaction.customId === 'btn_admin_rcon') {
                const modal = new ModalBuilder().setCustomId('modal_admin_rcon').setTitle('Send RCON');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_command').setLabel("Command").setStyle(TextInputStyle.Paragraph).setRequired(true)));
                return interaction.showModal(modal);
            }
            if (interaction.customId === 'wipe_panel_open') {
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_wipe_full').setLabel('Full Wipe').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('btn_wipe_selective').setLabel('Selective Wipe').setStyle(ButtonStyle.Primary));
                return interaction.reply({ content: '☢️ Wipe Manager', components: [row], flags: 64 });
            }
            if (interaction.customId === 'btn_wipe_full') {
                const modal = new ModalBuilder().setCustomId('modal_wipe_full').setTitle('Confirm Wipe');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confirm_text').setLabel('Type WIPE').setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('btn_finalize_tpl_')) {
                const parts = interaction.customId.split('_'); 
                const type = parts[3]; 
                await interaction.message.delete().catch(() => {});
                if (type === 'pvezone') {
                    const row = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId(`pve_shape_${parts[4]}_${parts[5]}_${parts[6]}`).setPlaceholder('Select Shape...').addOptions([
                            { label: 'Sphere', value: 'sphere', emoji: '🔵' },
                            { label: 'Box', value: 'box', emoji: '📦' }
                        ])
                    );
                    return interaction.reply({ content: `🏕️ Select shape:`, components: [row], flags: 64 });
                }
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`bind_emote_${type}_${parts[4]}_${parts[5]}_${parts[6]}`).setPlaceholder('Select Quick-Chat...').addOptions(RUST_EMOTES));
                return interaction.reply({ content: `🗣️ Select Quick-Chat:`, components: [row], flags: 64 });
            }

            if (interaction.customId === 'btn_dismiss_coord') {
                await interaction.message.delete().catch(() => {});
                return interaction.reply({ content: '❌ Dismissed.', flags: 64 });
            }

            if (interaction.customId === 'hub_shop_menu') {
                const embed = new EmbedBuilder().setTitle('🛒 Store').setColor('#e67e22');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('hub_shop_browse').setLabel('Browse').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('hub_shop_pricelist').setLabel('Price List').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
            }

            if (interaction.customId === 'hub_shop_browse') {
                const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
                const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => {
                    const count = dbItems.filter(i => i.category === catKey).length;
                    return { label: `${RUST_CATEGORIES[catKey].label} (${count})`, value: catKey, emoji: RUST_CATEGORIES[catKey].emoji };
                });
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('player_shop_cat_select').setPlaceholder('Choose category...').addOptions(catOptions));
                return interaction.reply({ content: '🛒 Select category:', components: [row], flags: 64 });
            }

            if (interaction.customId === 'hub_shop_pricelist') {
                const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
                const embed = new EmbedBuilder().setTitle('📋 Price List').setDescription(dbItems.map(i => `• ${i.name} - ${i.price}`).join('\n') || 'Empty').setColor('#3498db');
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            if (interaction.customId === 'hub_link_account') {
                const modal = new ModalBuilder().setCustomId('modal_link_account').setTitle('Link Account');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ign').setLabel("In-Game Name").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'hub_balance') {
                const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                return interaction.reply({ content: `💰 Wallet: ${user?.wallet || 0} | Bank: ${user?.bank || 0}`, flags: 64 });
            }
            
            if (interaction.customId === 'hub_daily') {
                const [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                const now = new Date();
                if (user.lastDaily && (now - new Date(user.lastDaily)) < 86400000) return interaction.reply({ content: `⏳ Wait 24h!`, flags: 64 });
                await user.update({ wallet: user.wallet + 100, lastDaily: now });
                return interaction.reply({ content: `🎁 Claimed 100!`, flags: 64 });
            }

            if (interaction.customId === 'hub_casino') {
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('casino_game_select').setPlaceholder('Select minigame...')
                        .addOptions([
                            { label: 'Coinflip', val: 'coinflip', emoji: '🪙' },
                            { label: 'Slots', val: 'slots', emoji: '🎰' },
                            { label: 'Dice Roll', val: 'dice', emoji: '🎲' }
                        ])
                );
                return interaction.reply({ content: '🎰 Casino:', components: [row], flags: 64 });
            }

            if (interaction.customId === 'ticket_create') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const modal = new ModalBuilder().setCustomId('modal_ticket_reason_General').setTitle('Open Ticket');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel("Reason").setStyle(TextInputStyle.Paragraph).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'ticket_close') {
                const modal = new ModalBuilder().setCustomId('modal_ticket_close_reason').setTitle('Close Ticket');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('close_reason').setLabel("Reason").setStyle(TextInputStyle.Paragraph).setRequired(true)));
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
        }

        // ====================================================================
        // 7. MODAL SUBMISSIONS
        // ====================================================================
        if (interaction.isModalSubmit()) {
            
            // --- REACTION ROLE MODAL EXECUTIONS ---
            if (interaction.customId === 'modal_rr_create') {
                const channelId = interaction.fields.getTextInputValue('channel_id');
                const emoji = interaction.fields.getTextInputValue('emoji');
                const roleId = interaction.fields.getTextInputValue('role_id');
                const isVerify = interaction.fields.getTextInputValue('is_verify') === '1';
                const panelText = interaction.fields.getTextInputValue('panel_text');

                const targetChannel = interaction.guild.channels.cache.get(channelId);
                if (!targetChannel) return interaction.reply({ content: '❌ Invalid Channel ID provided.', flags: 64 });

                const embed = new EmbedBuilder()
                    .setTitle(isVerify ? '✅ Server Verification' : '🔘 Reaction Roles')
                    .setDescription(panelText)
                    .setColor(isVerify ? '#2ecc71' : '#3498db')
                    .setTimestamp();

                const msg = await targetChannel.send({ embeds: [embed] });
                await msg.react(emoji).catch(() => {});

                await ReactionRole.create({
                    guildId: interaction.guild.id,
                    messageId: msg.id,
                    emoji: emoji,
                    roleId: roleId,
                    isVerifyOnly: isVerify
                });

                return interaction.reply({ content: `✅ Reaction role panel successfully posted in <#${targetChannel.id}>!`, flags: 64 });
            }

            if (interaction.customId === 'modal_rr_remove') {
                const msgId = interaction.fields.getTextInputValue('message_id');
                const deleted = await ReactionRole.destroy({ where: { guildId: interaction.guild.id, messageId: msgId } });
                if (deleted) {
                    return interaction.reply({ content: `✅ Successfully removed reaction role configurations for message ID \`${msgId}\`.`, flags: 64 });
                } else {
                    return interaction.reply({ content: `❌ No reaction role found with that message ID.`, flags: 64 });
                }
            }

            // --- AUTOMOD CONFIG MODAL ---
            if (interaction.customId === 'modal_automod_config') {
                const action = interaction.fields.getTextInputValue('action').trim().toLowerCase();
                const caps = parseInt(interaction.fields.getTextInputValue('caps')) || 70;
                
                if (!['warn', 'timeout', 'ban'].includes(action)) {
                    return interaction.reply({ content: '❌ Action must be either `warn`, `timeout`, or `ban`.', flags: 64 });
                }

                await GuildConfig.upsert({ guildId: interaction.guild.id, autoModAction: action, autoModCapsLimit: caps });
                return interaction.reply({ content: `✅ Auto-Mod settings updated!\n• Punishment: \`${action}\`\n• Caps Limit: \`${caps}%\``, flags: 64 });
            }

            // --- CLAN CREATION MODAL SUBMISSION ---
            if (interaction.customId === 'modal_clan_create') {
                await interaction.deferReply({ flags: 64 });
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                
                if (user.wallet < (config?.clanCreationCost || 1000)) {
                    return interaction.editReply({ content: `❌ You do not have enough funds to create a clan.` });
                }

                const rawName = interaction.fields.getTextInputValue('clan_name').trim();
                const rawTag = interaction.fields.getTextInputValue('clan_tag').trim().toUpperCase();

                const existingClan = await Clan.findOne({ where: { guildId: interaction.guild.id, tag: rawTag } });
                if (existingClan) {
                    return interaction.editReply({ content: `❌ The clan tag **${rawTag}** is already taken!` });
                }

                let roleId = null;
                let textId = null;
                let voiceId = null;

                if (config?.clanDiscordSyncEnabled) {
                    try {
                        const newRole = await interaction.guild.roles.create({ name: `${rawTag} Member`, color: '#e67e22', reason: 'Clan Creation Auto-Sync' });
                        roleId = newRole.id;
                        await interaction.member.roles.add(newRole);

                        const category = await interaction.guild.channels.create({
                            name: `🛡️ ${rawTag} Clan`,
                            type: ChannelType.GuildCategory,
                            permissionOverwrites: [
                                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                { id: newRole.id, allow: [PermissionFlagsBits.ViewChannel] }
                            ]
                        });

                        const textChan = await interaction.guild.channels.create({ name: 'clan-chat', type: ChannelType.GuildText, parent: category.id });
                        const voiceChan = await interaction.guild.channels.create({ name: 'Clan Voice', type: ChannelType.GuildVoice, parent: category.id });
                        textId = textChan.id;
                        voiceId = voiceChan.id;
                    } catch (err) {
                        console.error('[CLAN SYNC ERROR]', err);
                    }
                }

                await user.update({ wallet: user.wallet - (config?.clanCreationCost || 1000) });
                
                const newClan = await Clan.create({
                    guildId: interaction.guild.id,
                    name: rawName,
                    tag: rawTag,
                    leaderId: interaction.user.id,
                    maxMembers: config?.clanDefaultMaxMembers || 4,
                    discordRoleId: roleId,
                    discordTextChannelId: textId,
                    discordVoiceChannelId: voiceId
                });

                await ClanMember.create({
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    clanId: newClan.id,
                    role: 'Leader'
                });

                return interaction.editReply({ content: `✅ Successfully created clan **${rawTag} ${rawName}**!` });
            }

            if (interaction.customId === 'modal_clan_config') {
                const cost = parseInt(interaction.fields.getTextInputValue('cost')) || 1000;
                const maxMembers = parseInt(interaction.fields.getTextInputValue('max_members')) || 4;
                await GuildConfig.upsert({ guildId: interaction.guild.id, clanCreationCost: cost, clanDefaultMaxMembers: maxMembers });
                return interaction.reply({ content: `✅ Clan creation settings updated!`, flags: 64 });
            }

            if (interaction.customId === 'modal_bounty_config') {
                const kills = parseInt(interaction.fields.getTextInputValue('kills')) || 5;
                const reward = parseInt(interaction.fields.getTextInputValue('reward')) || 500;
                const cooldown = parseInt(interaction.fields.getTextInputValue('cooldown')) || 60;
                
                await GuildConfig.upsert({ guildId: interaction.guild.id, bountyKillsToActivate: kills, bountyRewardAmount: reward, bountyCooldownMinutes: cooldown });
                return interaction.reply({ content: `✅ Bounty system configured!`, flags: 64 });
            }

            if (interaction.customId === 'modal_hub_suggestion') {
                const title = interaction.fields.getTextInputValue('suggestion_title');
                const desc = interaction.fields.getTextInputValue('suggestion_desc');
                
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                if (!config?.suggestionChannelId) return interaction.reply({ content: '❌ Suggestions channel not configured.', flags: 64 });
                
                const channel = interaction.guild.channels.cache.get(config.suggestionChannelId);
                if (!channel) return interaction.reply({ content: '❌ Channel not found.', flags: 64 });

                const embed = new EmbedBuilder().setTitle(`💡 Suggestion: ${title}`).setDescription(desc).setColor('#f1c40f').setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
                const pingText = config.suggestionPingRoleId ? `<@&${config.suggestionPingRoleId}>` : '';
                
                const msg = await channel.send({ content: pingText, embeds: [embed] });
                await msg.react('👍');
                await msg.react('👎');
                return interaction.reply({ content: '✅ Suggestion submitted!', flags: 64 });
            }

            if (interaction.customId === 'modal_ai_credentials') {
                const apiKey = interaction.fields.getTextInputValue('ai_key');
                const model = interaction.fields.getTextInputValue('ai_model');
                const baseUrl = interaction.fields.getTextInputValue('ai_url');
                let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
                await config.update({ aiApiKey: apiKey.trim(), aiModel: model.trim(), aiBaseUrl: baseUrl.trim() });
                return interaction.reply({ content: `✅ AI Configured!`, flags: 64 });
            }

            if (interaction.customId === 'modal_link_account') {
                const ign = interaction.fields.getTextInputValue('ign');
                let [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id }, defaults: { wallet: 0 } });
                await user.update({ inGameName: ign });
                return interaction.reply({ content: `✅ Linked account to **${ign}**!`, flags: 64 });
            }

            if (interaction.customId === 'modal_setup_economy') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, economyCurrency: interaction.fields.getTextInputValue('currency_name') });
                return interaction.reply({ content: `✅ Currency updated!`, flags: 64 });
            }
            
            if (interaction.customId.startsWith('modal_admin_give_exec_')) {
                const targetUserId = interaction.customId.replace('modal_admin_give_exec_', '');
                const amount = parseInt(interaction.fields.getTextInputValue('amount'));
                let [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: targetUserId }, defaults: { wallet: 0 } });
                await user.update({ wallet: user.wallet + amount });
                return interaction.reply({ content: `✅ Gave ${amount} currency!`, flags: 64 });
            }
            if (interaction.customId.startsWith('modal_admin_take_exec_')) {
                const targetUserId = interaction.customId.replace('modal_admin_take_exec_', '');
                const amount = parseInt(interaction.fields.getTextInputValue('amount'));
                let [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: targetUserId }, defaults: { wallet: 0 } });
                await user.update({ wallet: Math.max(0, user.wallet - amount) });
                return interaction.reply({ content: `✅ Took ${amount} currency!`, flags: 64 });
            }

            if (interaction.customId === 'modal_verify_email') {
                await interaction.deferReply({ flags: 64 });
                const email = interaction.fields.getTextInputValue('stripe_email').trim().toLowerCase();
                const customers = await stripe.customers.list({ email: email, limit: 1 });
                if (customers.data.length === 0) return interaction.editReply({ content: `❌ No customer found with email ${email}.` });
                const subscriptions = await stripe.subscriptions.list({ customer: customers.data[0].id, status: 'active', limit: 1 });
                if (subscriptions.data.length === 0) return interaction.editReply({ content: `❌ No active subscriptions found.` });
                await GuildConfig.upsert({ guildId: interaction.guild.id, isPremiumServer: true, subscriptionStatus: 'active' });
                return interaction.editReply({ content: `⭐ Premium Verified Successfully!` });
            }

            if (interaction.customId === 'modal_hub_deposit') {
                const input = interaction.fields.getTextInputValue('amount').trim().toLowerCase();
                const [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id }, defaults: { wallet: 0, bank: 0 } });
                let amount = input === 'all' ? user.wallet : parseInt(input);
                if (user.wallet < amount) return interaction.reply({ content: `❌ Not enough funds in wallet!`, flags: 64 });
                await user.update({ wallet: user.wallet - amount, bank: user.bank + amount });
                return interaction.reply({ content: `🏦 Deposited ${amount}!`, flags: 64 });
            }

            if (interaction.customId === 'modal_hub_withdraw') {
                const input = interaction.fields.getTextInputValue('amount').trim().toLowerCase();
                const [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id }, defaults: { wallet: 0, bank: 0 } });
                let amount = input === 'all' ? user.bank : parseInt(input);
                if (user.bank < amount) return interaction.reply({ content: `❌ Not enough funds in bank!`, flags: 64 });
                await user.update({ bank: user.bank - amount, wallet: user.wallet + amount });
                return interaction.reply({ content: `🏧 Withdrew ${amount}!`, flags: 64 });
            }

            if (interaction.customId === 'modal_admin_embed') {
                const channelId = interaction.fields.getTextInputValue('channel_id');
                const title = interaction.fields.getTextInputValue('title');
                const description = interaction.fields.getTextInputValue('description');
                const color = interaction.fields.getTextInputValue('color') || '#2b2d31';
                const targetChannel = interaction.guild.channels.cache.get(channelId);
                if (!targetChannel) return interaction.reply({ content: '❌ Invalid Channel ID.', flags: 64 });
                const embed = new EmbedBuilder().setTitle(title).setDescription(description.replace(/\\n/g, '\n')).setColor(color).setTimestamp();
                await targetChannel.send({ embeds: [embed] });
                return interaction.reply({ content: `✅ Embed posted!`, flags: 64 });
            }

            if (interaction.customId === 'modal_econ_interest') {
                const rate = parseFloat(interaction.fields.getTextInputValue('interest_rate'));
                const hours = parseInt(interaction.fields.getTextInputValue('interest_hours')) || 24;
                await GuildConfig.upsert({ guildId: interaction.guild.id, bankInterestRate: rate, bankInterestHours: hours });
                return interaction.reply({ content: `✅ Interest configured!`, flags: 64 });
            }

            if (interaction.customId === 'modal_casino_config') {
                const maxBet = parseInt(interaction.fields.getTextInputValue('max_bet')) || 1000;
                const cooldown = parseInt(interaction.fields.getTextInputValue('cooldown_sec')) || 5;
                await GuildConfig.upsert({ guildId: interaction.guild.id, casinoMaxBet: maxBet, casinoCooldownSeconds: cooldown });
                return interaction.reply({ content: `✅ Casino config updated!`, flags: 64 });
            }

            if (interaction.customId.startsWith('modal_play_')) {
                const gameType = interaction.customId.replace('modal_play_', '');
                const bet = parseInt(interaction.fields.getTextInputValue('bet'));
                const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                if (!user || user.wallet < bet) return interaction.reply({ content: '❌ Not enough funds!', flags: 64 });
                const win = Math.random() < 0.5;
                const payout = win ? bet * 2 : 0;
                await user.update({ wallet: (user.wallet - bet) + payout });
                return interaction.reply({ content: win ? `🎉 You won +${bet}!` : `😢 You lost -${bet}.`, flags: 64 });
            }

            if (interaction.customId === 'modal_tk_add_cat') {
                const name = interaction.fields.getTextInputValue('cat_name');
                const description = interaction.fields.getTextInputValue('cat_desc') || 'Support';
                await TicketCategory.create({ guildId: interaction.guild.id, name, description });
                return interaction.reply({ content: `✅ Category added!`, flags: 64 });
            }

            if (interaction.customId === 'modal_ticket_close_reason') {
                await interaction.reply({ content: `🔒 Closing ticket...` });
                setTimeout(() => interaction.channel.delete().catch(()=>{}), 2000);
                return;
            }

            if (interaction.customId.startsWith('modal_ticket_reason_')) {
                const categoryName = interaction.customId.replace('modal_ticket_reason_', '');
                const reason = interaction.fields.getTextInputValue('reason');
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const channel = await interaction.guild.channels.create({
                    name: `🎫-ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText, parent: config.ticketCategoryId,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        { id: config.ticketAdminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });
                const embed = new EmbedBuilder().setTitle(`Ticket: ${categoryName}`).setDescription(reason).setColor('#e67e22');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setStyle(ButtonStyle.Danger)
                );
                await channel.send({ content: `<@&${config.ticketAdminRoleId}> | <@${interaction.user.id}>`, embeds: [embed], components: [row] });
                return interaction.reply({ content: `✅ Ticket created: <#${channel.id}>`, flags: 64 });
            }

            // --- AUTO EVENT MODALS ---
            if (interaction.customId === 'modal_ae_int_cargo') {
                const mins = parseInt(interaction.fields.getTextInputValue('interval')) || 60;
                const duration = parseInt(interaction.fields.getTextInputValue('duration')) || 30;
                await GuildConfig.upsert({ guildId: interaction.guild.id, cargoInterval: mins, cargoDurationMinutes: duration });
                return interaction.reply({ content: `✅ Cargo Ship configured!\n• Spawns every **${mins} mins**\n• Stays docked for **${duration} mins**`, flags: 64 });
            }
            if (interaction.customId === 'modal_ae_int_supply') {
                const mins = parseInt(interaction.fields.getTextInputValue('interval')) || 60;
                await GuildConfig.upsert({ guildId: interaction.guild.id, supplyInterval: mins });
                return interaction.reply({ content: `✅ Supply interval set to ${mins} mins!`, flags: 64 });
            }
            if (interaction.customId === 'modal_ae_int_elite') {
                const mins = parseInt(interaction.fields.getTextInputValue('interval')) || 60;
                await GuildConfig.upsert({ guildId: interaction.guild.id, eliteInterval: mins });
                return interaction.reply({ content: `✅ Elite Crate interval set to ${mins} mins!`, flags: 64 });
            }
            if (interaction.customId === 'modal_ae_int_timed') {
                const mins = parseInt(interaction.fields.getTextInputValue('interval')) || 60;
                await GuildConfig.upsert({ guildId: interaction.guild.id, timedInterval: mins });
                return interaction.reply({ content: `✅ Timed Crate interval set to ${mins} mins!`, flags: 64 });
            }
            if (interaction.customId === 'modal_ae_crates') {
                const crates = parseInt(interaction.fields.getTextInputValue('crate_amount')) || 3;
                await GuildConfig.upsert({ guildId: interaction.guild.id, cargoCrateCount: crates });
                return interaction.reply({ content: `✅ Cargo ship crate quantity successfully set to **${crates} crates**!`, flags: 64 });
            }

            if (interaction.customId === 'modal_giveaway_start') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const targetChannel = client.channels.cache.get(config?.giveawayChannelId || interaction.channel.id);
                const endTime = new Date(Date.now() + parseInt(interaction.fields.getTextInputValue('minutes')) * 60000);
                const embed = new EmbedBuilder().setTitle('🎉 GIVEAWAY 🎉').setDescription(`Prize: ${interaction.fields.getTextInputValue('prize')}`).setColor('#9b59b6');
                const msg = await targetChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('enter_giveaway').setLabel('Enter').setStyle(ButtonStyle.Success))] });
                await Giveaway.create({ messageId: msg.id, guildId: interaction.guild.id, channelId: targetChannel.id, prize: interaction.fields.getTextInputValue('prize'), endTime: endTime });
                return interaction.reply({ content: `✅ Giveaway started!`, flags: 64 });
            }

            if (interaction.customId === 'modal_kit_start') {
                const name = interaction.fields.getTextInputValue('kit_name');
                activeKitBuilders.set(interaction.user.id, { name: name, items: [] });
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_kit_add_item').setLabel('Add Item').setStyle(ButtonStyle.Primary), 
                    new ButtonBuilder().setCustomId('btn_kit_save').setLabel('Save Kit').setStyle(ButtonStyle.Success)
                );
                return interaction.reply({ content: `🎒 Kit Builder: ${name}`, components: [row], flags: 64 });
            }

            if (interaction.customId === 'modal_kit_search') {
                const term = interaction.fields.getTextInputValue('search_term').toLowerCase();
                const matches = RUST_ITEMS.filter(i => i.n.toLowerCase().includes(term) || i.s.toLowerCase().includes(term)).slice(0, 24);
                const options = matches.map(m => ({ label: m.n, description: m.s, value: m.s }));
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_kit_item').setPlaceholder('Select item...').addOptions(options));
                return interaction.reply({ content: `🔍 Matches:`, components: [row], flags: 64 }); 
            }

            if (interaction.customId.startsWith('modal_kit_amount_')) {
                const shortname = interaction.customId.replace('modal_kit_amount_', '');
                const builder = activeKitBuilders.get(interaction.user.id);
                builder.items.push(`${shortname} ${interaction.fields.getTextInputValue('item_amount')}`);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_kit_add_item').setLabel('Add Another').setStyle(ButtonStyle.Primary), 
                    new ButtonBuilder().setCustomId('btn_kit_save').setLabel('Save Kit').setStyle(ButtonStyle.Success)
                );
                return interaction.update({ content: `🎒 Items:\n${builder.items.join('\n')}`, components: [row] });
            }

            if (interaction.customId.startsWith('modal_give_item_')) {
                await sendRconCommand(interaction.guild.id, `inventory.giveto "${interaction.customId.replace('modal_give_item_', '')}" ${interaction.fields.getTextInputValue('item_name')} ${interaction.fields.getTextInputValue('item_amount')}`);
                return interaction.reply({ content: `✅ Sent item!`, flags: 64 });
            }
            if (interaction.customId === 'modal_admin_rcon') {
                await sendRconCommand(interaction.guild.id, interaction.fields.getTextInputValue('rcon_command'));
                return interaction.reply({ content: `✅ Executed!`, flags: 64 });
            }
            if (interaction.customId === 'modal_setup_rcon') {
                await GuildConfig.upsert({ guildId: interaction.guild.id, rconIp: interaction.fields.getTextInputValue('rcon_ip'), rconPort: interaction.fields.getTextInputValue('rcon_port'), rconPassword: interaction.fields.getTextInputValue('rcon_pass') });
                return interaction.reply({ content: `✅ RCON Saved!`, flags: 64 });
            }
            if (interaction.customId.startsWith('modal_add_catalog_item_')) {
                const shortname = interaction.customId.replace('modal_add_catalog_item_', '');
                const name = interaction.fields.getTextInputValue('custom_name');
                const amount = interaction.fields.getTextInputValue('amount');
                const cd = parseInt(interaction.fields.getTextInputValue('cooldown')) || 0;
                let basePrice = 100;
                for (const catKey in RUST_CATEGORIES) {
                    const found = RUST_CATEGORIES[catKey].items.find(i => i.shortname === shortname);
                    if (found) { basePrice = found.basePrice; break; }
                }
                let catKeyCategory = 'custom';
                for (const catKey in RUST_CATEGORIES) {
                    if (RUST_CATEGORIES[catKey].items.some(i => i.shortname === shortname)) { catKeyCategory = catKey; break; }
                }
                const newItem = await ShopItem.create({ guildId: interaction.guild.id, name, command: `inventory.giveto "{player}" ${shortname} ${amount}`, price: basePrice, category: catKeyCategory, cooldownSeconds: cd });
                const roleMenu = new RoleSelectMenuBuilder().setCustomId(`shop_role_${newItem.id}`).setPlaceholder('Select required Discord role (Optional)...');
                return interaction.reply({ content: `✅ **${name}** added to store! Optional role restriction:`, components: [new ActionRowBuilder().addComponents(roleMenu)], flags: 64 });
            }
            if (interaction.customId === 'modal_shop_custom') {
                const name = interaction.fields.getTextInputValue('item_name');
                const cmd = interaction.fields.getTextInputValue('item_cmd');
                const price = parseInt(interaction.fields.getTextInputValue('item_price')) || 100;
                const cd = parseInt(interaction.fields.getTextInputValue('item_cooldown')) || 0;
                const newItem = await ShopItem.create({ guildId: interaction.guild.id, name, command: cmd, price, category: 'custom', cooldownSeconds: cd });
                const roleMenu = new RoleSelectMenuBuilder().setCustomId(`shop_role_${newItem.id}`).setPlaceholder('Select required Discord role (Optional)...');
                return interaction.reply({ content: `✅ Custom item **${name}** added! Optional role restriction:`, components: [new ActionRowBuilder().addComponents(roleMenu)], flags: 64 });
            }
            if (interaction.customId === 'modal_shop_multiplier') {
                const mult = parseInt(interaction.fields.getTextInputValue('multiplier'));
                await GuildConfig.upsert({ guildId: interaction.guild.id, shopMultiplier: mult });
                return interaction.reply({ content: `✅ Global price multiplier set to **${mult}%**!`, flags: 64 });
            }
            if (interaction.customId.startsWith('modal_setup_')) {
                return interaction.reply({ content: `✅ Config saved!`, flags: 64 });
            }
            if (interaction.customId === 'modal_wipe_full' || interaction.customId.startsWith('modal_wipe_sel_')) {
                if (interaction.fields.getTextInputValue('confirm_text') !== 'WIPE') return interaction.reply({ content: '❌ Cancelled.', flags: 64 });
                let updateData = {}; 
                if (interaction.customId === 'modal_wipe_full') {
                    const allZones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
                    for (const z of allZones) {
                        try { await sendRconCommand(interaction.guild.id, `zones.deletecustomzone "${z.zoneName}"`); } catch (e) {}
                    }
                    await PveZone.destroy({ where: { guildId: interaction.guild.id } });
                    updateData = { wallet: 0, xp: 0, level: 1, homeX: null, homeY: null, homeZ: null };
                } else {
                    const sel = interaction.customId.replace('modal_wipe_sel_', '').split('-');
                    if (sel.includes('wipe_econ')) updateData.wallet = 0;
                    if (sel.includes('wipe_bp')) { updateData.xp = 0; updateData.level = 1; }
                    if (sel.includes('wipe_tp')) { updateData.homeX = null; updateData.homeY = null; updateData.homeZ = null; }
                    if (sel.includes('wipe_zones')) {
                        const selZones = await PveZone.findAll({ where: { guildId: interaction.guild.id } });
                        for (const z of selZones) {
                            try { await sendRconCommand(interaction.guild.id, `zones.deletecustomzone "${z.zoneName}"`); } catch (e) {}
                        }
                        await PveZone.destroy({ where: { guildId: interaction.guild.id } });
                    }
                }
                await UserEconomy.update(updateData, { where: { guildId: interaction.guild.id } });
                return interaction.reply({ content: `☢️ WIPED!` });
            }
        }
    } catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (interaction.deferred || interaction.replied) await interaction.followUp({ content: 'Error occurred.', flags: 64 }).catch(()=>{});
        else await interaction.reply({ content: 'Error occurred.', flags: 64 }).catch(()=>{});
    }
};