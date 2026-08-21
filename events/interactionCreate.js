// ============================================================================
// MASTER INTERACTION HANDLER - BUDDYBOT RCE (CLEAN RESET)
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

        if (interaction.isButton()) {
            if (interaction.customId === 'hub_clans') {
                return interaction.reply({ content: '🛡️ Clan Hub opened.', flags: 64 });
            }
            if (interaction.customId === 'hub_shop_menu') {
                return interaction.reply({ content: '🛒 Shop menu opened.', flags: 64 });
            }
            if (interaction.customId === 'hub_economy_menu') {
                return interaction.reply({ content: '🏦 Economy menu opened.', flags: 64 });
            }
            if (interaction.customId === 'hub_casino') {
                return interaction.reply({ content: '🎰 Casino opened.', flags: 64 });
            }
            if (interaction.customId === 'hub_bounties') {
                return interaction.reply({ content: '🎯 Bounties opened.', flags: 64 });
            }
            if (interaction.customId === 'hub_leaderboards') {
                return interaction.reply({ content: '🏆 Leaderboards opened.', flags: 64 });
            }
            if (interaction.customId === 'hub_vote_info') {
                return interaction.reply({ content: '🗳️ Vote info opened.', flags: 64 });
            }
            if (interaction.customId === 'hub_suggestion') {
                return interaction.reply({ content: '💡 Suggestions opened.', flags: 64 });
            }
            if (interaction.customId === 'hub_link_account') {
                return interaction.reply({ content: '🔗 Link account modal triggered.', flags: 64 });
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'admin_menu_select') {
                const module = interaction.values[0];
                return interaction.reply({ content: `✅ Admin module selected: \`${module}\``, flags: 64 });
            }
        }

    } catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while processing this interaction.', flags: 64 }).catch(() => {});
        }
    }
};