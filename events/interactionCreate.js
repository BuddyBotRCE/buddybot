// ============================================================================
// MASTER ROUTER: events/interactionCreate.js
// ============================================================================
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { GuildConfig, GameServer, UserEconomy, CustomBind, ServerKit, OrpConfig, PlayerOrpBase, PveZone, ReactionRole } = require('../database/db');
const { connectRcon, sendRconCommand, queueAdminPos } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');

// --- BULLETPROOF ABSOLUTE PATH IMPORTS FOR HANDLERS ---
const handlerPath = (fileName) => path.join(__dirname, '..', 'handlers', fileName);

const autoEventsHandler = require(handlerPath('autoEventsHandler'));
const economyHandler = require(handlerPath('economyHandler'));
const premiumHandler = require(handlerPath('premiumHandler'));
const suggestionHandler = require(handlerPath('suggestionHandler'));
const ticketHandler = require(handlerPath('ticketHandler'));
const giveawayHandler = require(handlerPath('giveawayHandler'));
const shopHandler = require(handlerPath('shopHandler'));
const clanHandler = require(handlerPath('clanHandler'));
const buddyPassHandler = require(handlerPath('buddyPassHandler'));
const casinoHandler = require(handlerPath('casinoHandler'));
const bountyHandler = require(handlerPath('bountyHandler'));
const kitHandler = require(handlerPath('kitHandler'));
const bindHandler = require('../handlers/bindHandler');
const adminHandler = require(handlerPath('adminHandler'));
const loggingHandler = require(handlerPath('loggingHandler'));

// --- NEW MODULES ---
const customZoneHandler = require(handlerPath('customZoneHandler'));
const reactionRoleHandler = require(handlerPath('reactionRoleHandler'));
const autoModHandler = require(handlerPath('autoModHandler'));

module.exports = async (interaction, client) => {
    console.log(`[INTERACTION DEBUG] Type: ${interaction.type} | CustomID: ${interaction.customId || 'N/A'} | Command: ${interaction.commandName || 'N/A'}`);
    try {
        // --- CHAT COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // ====================================================================
        // 🚦 1. ADMIN MENU ROUTER
        // ====================================================================
        if (customId === 'admin_menu_select') {
            if (selectedValue === 'setup_autoevents') return await autoEventsHandler(interaction, client);
            if (selectedValue === 'setup_economy') return await economyHandler(interaction, client);
            if (selectedValue === 'setup_tier') return await premiumHandler(interaction, client);
            if (selectedValue === 'setup_suggestions') return await suggestionHandler(interaction, client);
            if (selectedValue === 'setup_tickets') return await ticketHandler(interaction, client);
            if (selectedValue === 'setup_giveaways') return await giveawayHandler(interaction, client);
            if (selectedValue === 'setup_shop') return await shopHandler(interaction, client);
            if (selectedValue === 'setup_clans') return await clanHandler(interaction, client);
            if (selectedValue === 'setup_buddypass') return await buddyPassHandler(interaction, client);
            if (selectedValue === 'setup_minigames') return await casinoHandler(interaction, client);
            if (selectedValue === 'setup_bounties') return await bountyHandler(interaction, client);
            if (selectedValue === 'setup_kits') return await kitHandler(interaction, client);
            if (selectedValue === 'setup_logging' || selectedValue.includes('log')) return await loggingHandler(interaction, client);
            if (selectedValue === 'setup_tier') return require('../handlers/premiumHandler')(interaction, client);
            if (selectedValue === 'setup_binds') return require('../handlers/bindHandler')(interaction, client);
            
            // --> NEW ROUTING LINKS <--
            if (selectedValue.includes('pve') || selectedValue.includes('zone')) return await customZoneHandler(interaction, client);
            if (selectedValue === 'setup_reactionroles' || selectedValue === 'setup_verification') return await reactionRoleHandler(interaction, client); 
            if (selectedValue === 'setup_automod') return await autoModHandler(interaction, client);
            
            return await adminHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 2. COMPONENT & MODAL ROUTING STATION
        // ====================================================================

        // --- LOGGING ROUTER ---
        if (customId.startsWith('btn_log_') || customId.startsWith('select_log_chan_')) {
            return await loggingHandler(interaction, client);
        }

        // --- SUGGESTIONS ROUTER ---
        if (customId.startsWith('sug_') || customId === 'select_sug_channel' || customId === 'select_sug_role' || customId === 'btn_player_open_suggestion' || customId.startsWith('modal_sug_')) {
            return await suggestionHandler(interaction, client);
        }

        // --- AUTO MOD ROUTER ---
        if (customId.startsWith('am_') || customId.startsWith('btn_am_') || customId.startsWith('modal_am_')) {
            return await autoModHandler(interaction, client);
        }

        // --- CUSTOM ZONES ROUTER ---
        if (customId.startsWith('cz_') || customId.startsWith('btn_cz_') || customId.startsWith('modal_cz_') || customId === 'select_custom_zone' || customId.includes('pve') || customId.includes('zone')) {
            return await customZoneHandler(interaction, client);
        }

        // --- REACTION ROLES & VERIFICATION ROUTER ---
        if (customId.startsWith('rr_') || customId.startsWith('select_rr_') || customId.startsWith('btn_rr_') || customId.startsWith('modal_rr_') || customId.includes('reaction') || customId.includes('verify') || customId.includes('verification')) {
            if (customId === 'btn_open_verify_modal' || customId === 'modal_verify_email') {
                return await premiumHandler(interaction, client);
            }
            return await reactionRoleHandler(interaction, client);
        }

        // --- CLANS ROUTER ---
        if (customId.includes('clan') || customId.includes('bank') || customId.startsWith('modal_clan_') || customId.startsWith('btn_clan_') || customId.startsWith('btn_bank_') || customId.startsWith('clan_modal_') || customId.startsWith('select_clan_')) {
            return await clanHandler(interaction, client);
        }

        // --- EXISTING MODULE ROUTERS ---
        if (customId.startsWith('ae_') || customId.startsWith('modal_ae_') || customId.startsWith('btn_finalize_tpl_aeslot')) {
            return await autoEventsHandler(interaction, client);
        }
        if (customId.includes('econ') || customId.includes('balance') || customId.includes('daily') || customId.includes('deposit') || customId.includes('withdraw') || customId.includes('admin_give') || customId.includes('admin_take')) {
            return await economyHandler(interaction, client);
        }
        if (customId === 'toggle_tier_status') {
            return await premiumHandler(interaction, client);
        }
        if (customId.startsWith('tk_') || customId.startsWith('btn_tk_') || customId.includes('ticket')) {
            return await ticketHandler(interaction, client);
        }
        if (customId.startsWith('ga_') || customId.includes('giveaway')) {
            return await giveawayHandler(interaction, client);
        }
        if (customId.includes('shop') || customId.startsWith('buy_item_')) {
            return await shopHandler(interaction, client);
        }
        if (customId.startsWith('bp_') || customId.includes('buddypass')) {
            return await buddyPassHandler(interaction, client);
        }
        if (customId.includes('casino') || customId.startsWith('modal_play_')) {
            return await casinoHandler(interaction, client);
        }
        if (customId.includes('bounty') || customId.includes('bounties')) {
            return await bountyHandler(interaction, client);
        }
        if (customId.includes('kit') && !customId.includes('ticket')) {
            return await kitHandler(interaction, client);
        }
        if (customId.startsWith('bind_') || customId.startsWith('btn_bind_') || customId.includes('bind')) {
            return await bindHandler(interaction, client);
        }

        // Fallback for uncaught buttons
        return await adminHandler(interaction, client);

    } catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ An error occurred processing this interaction.', flags: 64 }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ An error occurred processing this interaction.', flags: 64 }).catch(() => {});
        }
    }
};