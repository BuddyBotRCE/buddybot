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
const postEmbedHandler = require(handlerPath('postEmbedHandler'));
const customZoneHandler = require(handlerPath('customZoneHandler'));
const reactionRoleHandler = require(handlerPath('reactionRoleHandler'));
const autoModHandler = require(handlerPath('autoModHandler'));
const wipeHandler = require(handlerPath('wipeHandler')); 

module.exports = async (interaction, client) => {
    try {
        // 🚨 THE HOLY GRAIL FIX FOR DROPDOWN 2 🚨
        // This intercepts the 2nd dropdown and aliases it, which instantly fixes 
        // ALL 10 handler files without having to rewrite them manually.
        if (interaction.customId === 'admin_menu_select_2') {
            Object.defineProperty(interaction, 'customId', { value: 'admin_menu_select', writable: true, configurable: true });
        }

        // --- CHAT COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // ====================================================================
        // 🚦 0. UNIVERSAL MODAL SUBMISSION ROUTER
        // ====================================================================
        if (interaction.isModalSubmit()) {
            if (customId.startsWith('modal_givekit_exec_')) return await adminHandler(interaction, client);
            if (customId === 'modal_shop_multiplier' || customId === 'modal_shop_custom' || customId.startsWith('modal_buy_qty_')) return await shopHandler(interaction, client);
            if (customId === 'modal_wipe_full' || customId.startsWith('modal_wipe_sel_') || customId === 'modal_wipe_cooldowns') return await wipeHandler(interaction, client);
            if (customId === 'modal_link_account_global' || customId.startsWith('modal_link_account_')) return await adminHandler(interaction, client);
            if (customId.startsWith('modal_sug_') || customId === 'modal_player_submit_suggestion' || customId.startsWith('modal_sug_decline_reason_')) return await suggestionHandler(interaction, client);
            if (customId === 'modal_verify_email' || customId === 'modal_transfer_license') return await premiumHandler(interaction, client);
            if (
                customId === 'modal_setup_economy' || 
                customId === 'modal_econ_interest' || 
                customId === 'modal_hub_deposit' || 
                customId === 'modal_hub_withdraw' || 
                customId.startsWith('modal_admin_give_exec_') || 
                customId.startsWith('modal_admin_take_exec_')
            ) return await economyHandler(interaction, client);

            if (customId === 'modal_ae_settings' || customId.startsWith('modal_ae_')) return await autoEventsHandler(interaction, client);
            if (customId.startsWith('modal_emb_') || customId === 'modal_admin_embed') return await postEmbedHandler(interaction, client);
            if (customId.startsWith('modal_am_') || customId === 'modal_automod_config') return await autoModHandler(interaction, client);
            if (customId.startsWith('modal_cz_')) return await customZoneHandler(interaction, client);
            if (customId.startsWith('modal_rr_')) return await reactionRoleHandler(interaction, client);
            if (customId.startsWith('modal_clan_') || customId.startsWith('clan_modal_')) return await clanHandler(interaction, client);
            if (customId.startsWith('modal_tk_')) return await ticketHandler(interaction, client);
            if (customId.startsWith('modal_ga_')) return await giveawayHandler(interaction, client);
            
            return await adminHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 1. ADMIN MENU ROUTER
        // ====================================================================
        if (customId === 'admin_menu_select') {
            if (selectedValue === 'setup_wipe') return await wipeHandler(interaction, client);
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
            if (selectedValue === 'setup_binds') return await bindHandler(interaction, client);
            if (selectedValue === 'setup_postembed' || selectedValue.includes('embed')) return await postEmbedHandler(interaction, client);
            if (selectedValue.includes('pve') || selectedValue.includes('zone') || selectedValue === 'setup_custom_zones') return await customZoneHandler(interaction, client);
            if (selectedValue === 'setup_reactionroles' || selectedValue === 'setup_verification') return await reactionRoleHandler(interaction, client); 
            if (selectedValue === 'setup_automod') return await autoModHandler(interaction, client);
            
            return await adminHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 2. COMPONENT ROUTING STATION (Buttons & Select Menus)
        // ====================================================================
        if (customId === 'hub_clans' || customId.includes('clan') || customId.includes('bank')) return await clanHandler(interaction, client);

        if (
            customId === 'hub_economy_menu' || 
            customId === 'hub_balance' || 
            customId === 'hub_daily' || 
            customId === 'hub_deposit' || 
            customId === 'hub_withdraw' || 
            customId.includes('econ') || 
            customId === 'btn_admin_give' || 
            customId === 'btn_admin_take' || 
            customId === 'select_admin_give_target' || 
            customId === 'select_admin_take_target'
        ) return await economyHandler(interaction, client);

        if (customId === 'hub_shop_menu' || customId === 'hub_shop_browse' || customId === 'hub_shop_pricelist' || customId.startsWith('player_shop_') || customId.includes('shop')) return await shopHandler(interaction, client);
        if (customId === 'hub_casino' || customId === 'casino_game_select' || customId.startsWith('modal_play_') || customId.includes('casino')) return await casinoHandler(interaction, client);
        if (customId === 'hub_buddypass_view' || customId.startsWith('bp_') || customId.includes('buddypass')) return await buddyPassHandler(interaction, client);
        if (customId === 'ticket_create' || customId.startsWith('tk_') || customId.includes('ticket')) return await ticketHandler(interaction, client);
        if (customId.includes('sug_') || customId === 'btn_player_open_suggestion') return await suggestionHandler(interaction, client);
        if (customId === 'hub_leaderboards' || customId === 'hub_lb_select' || customId.startsWith('lb_refresh_')) return await adminHandler(interaction, client);
        
        if (customId === 'hub_vote_info') {
            return await interaction.reply({ content: `🗳️ **Vote & Claim:** Link your vote tracking with your Rust server to automatically reward players with free currency or kits! (Configure via your voting site webhook).`, components: [], flags: 64 }).catch(()=>{});
        }

        if (customId === 'btn_wipe_full' || customId === 'btn_wipe_selective' || customId === 'btn_wipe_cooldowns' || customId === 'select_wipe_custom') return await wipeHandler(interaction, client);

        if (
            customId === 'btn_admin_kit' || 
            customId.startsWith('ak_panel_') ||
            customId === 'ak_panel_kit_select' ||
            customId === 'admin_kit_choice_select' || 
            customId.startsWith('admin_kit_target_') || 
            customId === 'admin_kit_target_select' ||
            customId === 'hub_link_account' ||
            customId === 'select_link_server_target'
        ) return await adminHandler(interaction, client);

        if (customId === 'toggle_tier_status' || customId === 'btn_manage_stripe' || customId === 'btn_transfer_license' || customId === 'btn_open_verify_modal') return await premiumHandler(interaction, client);
        if (customId.startsWith('btn_log_') || customId.startsWith('select_log_chan_')) return await loggingHandler(interaction, client);
        if (customId.startsWith('am_') || customId.startsWith('btn_am_')) return await autoModHandler(interaction, client);
        if (customId.startsWith('cz_') || customId.startsWith('btn_cz_') || customId === 'select_custom_zone' || customId.includes('pve') || customId.includes('zone')) return await customZoneHandler(interaction, client);
        if (customId.startsWith('rr_') || customId.startsWith('select_rr_') || customId.startsWith('btn_rr_') || customId.includes('reaction') || customId.includes('verify') || customId.includes('verification')) return await reactionRoleHandler(interaction, client);
        if (customId.startsWith('btn_emb_') || customId === 'select_emb_target_channel' || customId === 'select_emb_template') return await postEmbedHandler(interaction, client);
        if (customId.startsWith('ae_') || customId === 'btn_finalize_tpl_aeslot') return await autoEventsHandler(interaction, client);
        if (customId.includes('ga_') || customId.includes('giveaway')) return await giveawayHandler(interaction, client);
        if (customId.includes('bounty') || customId.includes('bounties')) return await bountyHandler(interaction, client);
        if (customId.startsWith('bind_') || customId.startsWith('btn_bind_') || customId === 'bind_do_kit' || customId.includes('bind')) return await bindHandler(interaction, client);
        if (customId.includes('kit') && !customId.includes('ticket')) return await kitHandler(interaction, client);

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