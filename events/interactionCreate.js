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
        // 🚦 0. UNIVERSAL MODAL SUBMISSION ROUTER (Catch modals first)
        // ====================================================================
        if (interaction.isModalSubmit()) {
            if (customId.startsWith('modal_givekit_exec_')) {
                return await adminHandler(interaction, client);
            }

            // 👇 ROUTE ECONOMY MODALS 👇
            if (
                customId === 'modal_setup_economy' || 
                customId === 'modal_econ_interest' || 
                customId === 'modal_hub_deposit' || 
                customId === 'modal_hub_withdraw' || 
                customId.startsWith('modal_admin_give_exec_') || 
                customId.startsWith('modal_admin_take_exec_')
            ) {
                return await economyHandler(interaction, client);
            }

            if (customId === 'modal_ae_settings' || customId.startsWith('modal_ae_')) {
                return await autoEventsHandler(interaction, client);
            }
            if (customId.startsWith('modal_emb_') || customId === 'modal_admin_embed') {
                return await postEmbedHandler(interaction, client);
            }
            if (customId.startsWith('modal_sug_')) {
                return await suggestionHandler(interaction, client);
            }
            if (customId.startsWith('modal_am_') || customId === 'modal_automod_config') {
                return await autoModHandler(interaction, client);
            }
            if (customId.startsWith('modal_cz_')) {
                return await customZoneHandler(interaction, client);
            }
            if (customId.startsWith('modal_rr_')) {
                return await reactionRoleHandler(interaction, client);
            }
            if (customId.startsWith('modal_clan_') || customId.startsWith('clan_modal_')) {
                return await clanHandler(interaction, client);
            }
            if (customId.startsWith('modal_tk_')) {
                return await ticketHandler(interaction, client);
            }
            if (customId.startsWith('modal_ga_')) {
                return await giveawayHandler(interaction, client);
            }
            return await adminHandler(interaction, client);
        }

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
            if (selectedValue === 'setup_tier') return await premiumHandler(interaction, client);
            if (selectedValue === 'setup_binds') return await bindHandler(interaction, client);
            if (selectedValue === 'setup_postembed' || selectedValue.includes('embed')) return await postEmbedHandler(interaction, client);
            
            if (selectedValue.includes('pve') || selectedValue.includes('zone')) return await customZoneHandler(interaction, client);
            if (selectedValue === 'setup_reactionroles' || selectedValue === 'setup_verification') return await reactionRoleHandler(interaction, client); 
            if (selectedValue === 'setup_automod') return await autoModHandler(interaction, client);
            
            return await adminHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 2. COMPONENT ROUTING STATION (Buttons & Select Menus)
        // ====================================================================

        if (
            customId === 'btn_admin_kit' || 
            customId.startsWith('ak_panel_') ||
            customId === 'ak_panel_kit_select' ||
            customId === 'admin_kit_choice_select' || 
            customId.startsWith('admin_kit_target_') || 
            customId === 'admin_kit_target_select'
        ) {
            return await adminHandler(interaction, client);
        }

        if (customId.startsWith('btn_log_') || customId.startsWith('select_log_chan_')) {
            return await loggingHandler(interaction, client);
        }

        if (customId.startsWith('sug_') || customId === 'select_sug_channel' || customId === 'select_sug_role' || customId === 'btn_player_open_suggestion') {
            return await suggestionHandler(interaction, client);
        }

        if (customId.startsWith('am_') || customId.startsWith('btn_am_')) {
            return await autoModHandler(interaction, client);
        }

        if (customId.startsWith('cz_') || customId.startsWith('btn_cz_') || customId === 'select_custom_zone' || customId.includes('pve') || customId.includes('zone')) {
            return await customZoneHandler(interaction, client);
        }

        if (customId.startsWith('rr_') || customId.startsWith('select_rr_') || customId.startsWith('btn_rr_') || customId.includes('reaction') || customId.includes('verify') || customId.includes('verification')) {
            if (customId === 'btn_open_verify_modal') {
                return await premiumHandler(interaction, client);
            }
            return await reactionRoleHandler(interaction, client);
        }

        if (customId.includes('clan') || customId.includes('bank') || customId.startsWith('btn_clan_') || customId.startsWith('btn_bank_') || customId.startsWith('select_clan_')) {
            return await clanHandler(interaction, client);
        }

        if (customId.startsWith('btn_emb_') || customId === 'select_emb_target_channel' || customId === 'select_emb_template') {
            return await postEmbedHandler(interaction, client);
        }

        if (customId.startsWith('ae_') || customId === 'btn_finalize_tpl_aeslot') {
            return await autoEventsHandler(interaction, client);
        }

        // 👇 ROUTE ALL ECONOMY BUTTONS, HUBS, AND USER SELECT MENUS 👇
        if (
            customId.includes('econ') || 
            customId.includes('hub_') || 
            customId.startsWith('btn_econ_') || 
            customId === 'btn_admin_give' || 
            customId === 'btn_admin_take' || 
            customId === 'select_admin_give_target' || 
            customId === 'select_admin_take_target'
        ) {
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

        if (customId.includes('casino')) {
            return await casinoHandler(interaction, client);
        }

        if (customId.includes('bounty') || customId.includes('bounties')) {
            return await bountyHandler(interaction, client);
        }

        if (customId.startsWith('bind_') || customId.startsWith('btn_bind_') || customId === 'bind_do_kit' || customId.includes('bind')) {
            return await bindHandler(interaction, client);
        } 

        if (customId.includes('kit') && !customId.includes('ticket')) {
            return await kitHandler(interaction, client);
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