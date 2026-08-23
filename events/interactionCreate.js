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
const pveHandler = require(handlerPath('pveHandler'));
const bindHandler = require(handlerPath('bindHandler'));
const adminHandler = require(handlerPath('adminHandler'));

module.exports = async (interaction, client) => {
    console.log(`[INTERACTION DEBUG] Type: ${interaction.type} | CustomID: ${interaction.customId || 'N/A'} | Command: ${interaction.commandName || 'N/A'}`);
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

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
            if (selectedValue === 'setup_pvezones') return await pveHandler(interaction, client);
            if (selectedValue === 'setup_binds') return await bindHandler(interaction, client);
            return await adminHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 3. COMPONENT & MODAL ROUTING STATION (CLANS FIRST TO PREVENT CONFLICTS)
        // ====================================================================

        // --- CLANS ROUTER (PLACED FIRST SO 'deposit' DOESN'T HIJACK IT) ---
        if (customId.includes('clan') || customId.includes('bank') || customId.startsWith('modal_clan_') || customId.startsWith('btn_clan_') || customId.startsWith('btn_bank_') || customId.startsWith('clan_modal_') || customId.startsWith('select_clan_')) {
            return await clanHandler(interaction, client);
        }

        if (customId.startsWith('ae_') || customId.startsWith('modal_ae_') || customId.startsWith('btn_finalize_tpl_aeslot')) {
            return await autoEventsHandler(interaction, client);
        }
        if (customId.includes('econ') || customId.includes('balance') || customId.includes('daily') || customId.includes('deposit') || customId.includes('withdraw') || customId.includes('admin_give') || customId.includes('admin_take')) {
            return await economyHandler(interaction, client);
        }
        if (customId === 'toggle_tier_status' || customId === 'btn_open_verify_modal' || customId === 'modal_verify_email') {
            return await premiumHandler(interaction, client);
        }
        if (customId.includes('suggestion')) {
            return await suggestionHandler(interaction, client);
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
        if (customId.includes('pve') || customId.includes('zone')) {
            return await pveHandler(interaction, client);
        }
        if (customId.includes('bind') || customId.startsWith('tpl_') || customId === 'btn_dismiss_coord' || customId.startsWith('btn_finalize_tpl_') || customId.startsWith('modal_final_')) {
            return await bindHandler(interaction, client);
        }
        if (customId.includes('verify') || customId.includes('verification')) {
            return await verificationHandler(interaction, client);
        }
        if (customId.includes('rr_') || customId.includes('reaction') || customId.includes('select_rr')) {
            return await reactionRoleHandler(interaction, client);
        }

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