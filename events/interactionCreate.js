// ============================================================================
// MASTER INTERACTION HANDLER - BUDDYBOT RCE (VERIFIED & SAFE)
// ============================================================================

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { GuildConfig, UserEconomy, Giveaway, CustomBind, BindCooldown, ServerKit, ShopItem, ShopCooldown, CasinoCooldown, OrpConfig, PlayerOrpBase, BuddyPassChallenge, BuddyPassReward, TicketCategory, PveZone, ActiveBounty, BountyCooldown, Clan, ClanMember, ClanInvite, ClanWar, ReactionRole } = require('../database/db');
const { Op } = require('sequelize'); 
const { connectRcon, sendRconCommand, adminPosQueue, queueAdminPos } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');
const discordTranscripts = require('discord-html-transcripts');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const activeKitBuilders = new Map(); 

module.exports = async (interaction, client) => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        if (interaction.isStringSelectMenu()) {
            const module = interaction.values[0];

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

                if (module === 'setup_autoevents') {
                    await interaction.deferUpdate();
                    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                    const isPremium = config?.isPremiumServer || false;

                    if (!isPremium) {
                        return interaction.followUp({ 
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
                    return interaction.editReply({ embeds: [embed], components: [row1, row2] });
                }

                // Fallback for other modules
                const embed = new EmbedBuilder().setTitle(`⚙️ Manager: ${module}`).setDescription('Module ready for configuration.').setColor('#3498db');
                return interaction.reply({ embeds: [embed], flags: 64 });
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'hub_clans') {
                return interaction.reply({ content: '🛡️ Clan Hub opened successfully.', flags: 64 });
            }
            if (interaction.customId === 'hub_shop_menu') {
                return interaction.reply({ content: '🛒 Store opened successfully.', flags: 64 });
            }
        }

    } catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while processing this action.', flags: 64 }).catch(() => {});
        } else {
            await interaction.followUp({ content: '❌ An error occurred.', flags: 64 }).catch(() => {});
        }
    }
};