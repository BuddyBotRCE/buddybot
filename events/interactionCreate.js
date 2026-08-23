// ============================================================================
// MASTER ROUTER: events/interactionCreate.js
// ============================================================================

// --- 1. IMPORT ALL OUR MODULAR HANDLERS ---
const autoEventsHandler = require('../handlers/autoEventsHandler');
const economyHandler = require('../handlers/economyHandler');
const premiumHandler = require('../handlers/premiumHandler');
const suggestionHandler = require('../handlers/suggestionHandler');
const ticketHandler = require('../handlers/ticketHandler');
const giveawayHandler = require('../handlers/giveawayHandler');
const shopHandler = require('../handlers/shopHandler');
const clanHandler = require('../handlers/clanHandler');
const buddyPassHandler = require('../handlers/buddyPassHandler');
const casinoHandler = require('../handlers/casinoHandler');
const bountyHandler = require('../handlers/bountyHandler');
const kitHandler = require('../handlers/kitHandler');
const pveHandler = require('../handlers/pveHandler');
const bindHandler = require('../handlers/bindHandler');
const adminHandler = require('../handlers/adminHandler');

module.exports = async (interaction, client) => {
    try {
        // --- 2. HANDLE STANDARD SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // ====================================================================
        // 🚦 3. ADMIN PANEL DROPDOWN ROUTER
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
            if (selectedValue === 'setup_pvezones') return await pveHandler(interaction, client);
            if (selectedValue === 'setup_binds') return await bindHandler(interaction, client);
            
            // Everything else (Logging, Automod, Wipes, Reaction Roles) goes to Admin
            return await adminHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 4. BUTTON & MODAL ROUTER
        // ====================================================================

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
        if (customId.includes('clan')) {
            return await clanHandler(interaction, client);
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

        // --- CATCH ALL REMAINING LOGIC ---
        // Includes: RCON configs, Server Links, Wipes, Reaction Roles, Admin Tools, Leaderboards
        return await adminHandler(interaction, client);

    } catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (interaction.deferred || interaction.replied) await interaction.followUp({ content: 'Error occurred.', flags: 64 }).catch(()=>{});
        else await interaction.reply({ content: 'Error occurred.', flags: 64 }).catch(()=>{});
    }
};