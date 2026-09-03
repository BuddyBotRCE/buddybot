// ============================================================================
// MASTER ROUTER: events/interactionCreate.js
// ============================================================================
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const { GuildConfig } = require('../database/db');

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
const bindHandler = require(handlerPath('bindHandler'));
const adminHandler = require(handlerPath('adminHandler'));
const loggingHandler = require(handlerPath('loggingHandler'));
const postEmbedHandler = require(handlerPath('postEmbedHandler'));
const customZoneHandler = require(handlerPath('customZoneHandler'));
const autoModHandler = require(handlerPath('autoModHandler'));
const wipeHandler = require(handlerPath('wipeHandler')); 
const homeTpHandler = require(handlerPath('homeTpHandler'));
const skipNightHandler = require(handlerPath('skipNightHandler'));
const leaderboardHandler = require(handlerPath('leaderboardHandler'));
const orpHandler = require(handlerPath('orpHandler'));

const buddyGamesHandler = require(handlerPath('buddyGamesHandler'));
const gunGameHandler = require(handlerPath('gunGameHandler'));
const battleRoyaleHandler = require(handlerPath('battleRoyaleHandler'));

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        let selectedValue = '';

        if (interaction.isStringSelectMenu() && interaction.values) {
            selectedValue = interaction.values[0];
        }

        console.log(`[ROUTER DEBUG] Type: ${interaction.type} | CustomId: "${customId}" | SelectedValue: "${selectedValue}"`);

        // 1. Handle Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        // 2. Handle String Select Menus (Panel 1 & Panel 2 Dropdowns)
        if (interaction.isStringSelectMenu()) {
            if (customId === 'admin_menu_select' || customId === 'admin_menu_select_2' || customId.includes('admin_menu')) {
                console.log(`[PANEL ROUTER] Processing selection: "${selectedValue}" from "${customId}"`);

                if (selectedValue === 'setup_buddy_games') return await buddyGamesHandler(interaction, client);
                if (selectedValue === 'setup_autoevents') return await autoEventsHandler(interaction, client);
                if (selectedValue === 'setup_automod') return await autoModHandler(interaction, client);
                if (selectedValue === 'setup_buddypass') return await buddyPassHandler(interaction, client);
                if (selectedValue === 'setup_clans') return await clanHandler(interaction, client);
                if (selectedValue === 'setup_bounties') return await bountyHandler(interaction, client);
                if (selectedValue === 'setup_binds') return await bindHandler(interaction, client);
                if (selectedValue === 'setup_ai') return await adminHandler(interaction, client);
                if (selectedValue === 'setup_tier') return await premiumHandler(interaction, client);
                if (selectedValue === 'setup_embeds_roles') {
                    const embed = new EmbedBuilder()
                        .setTitle('🎨 Embeds & Interactive Panels')
                        .setDescription('Choose what type of panel or announcement you want to build and deploy to your server.')
                        .setColor('#9b59b6');
                    const row = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId('unified_embed_select').setPlaceholder('Select panel type...')
                        .addOptions([
                            { label: 'Create New Embed', value: 'setup_postembed', description: 'Create and send a new announcement', emoji: '📢' },
                            { label: 'Edit Existing Embed', value: 'edit_postembed', description: 'Edit an embed already in chat', emoji: '✏️' },
                            { label: 'Create Reaction Panel', value: 'create_reaction_panel', description: 'Send a new role claimer', emoji: '🎭' },
                            { label: 'Create Verification Panel', value: 'create_verification_panel', description: 'Send a new verify button', emoji: '🔐' },
                            { label: 'Attach Roles to Message', value: 'attach_reaction_panel', description: 'Add buttons to an existing message', emoji: '📎' }
                        ])
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                }
                if (selectedValue === 'setup_giveaways') return await giveawayHandler(interaction, client);
                if (selectedValue === 'setup_suggestions') return await suggestionHandler(interaction, client);
                if (selectedValue === 'setup_hometp') return await homeTpHandler(interaction, client);
                if (selectedValue === 'setup_skipnight') return await skipNightHandler(interaction, client);
                if (selectedValue === 'setup_shop') return await shopHandler(interaction, client);
                if (selectedValue === 'setup_economy') return await economyHandler(interaction, client);
                if (selectedValue === 'setup_tickets') return await ticketHandler(interaction, client);
                if (selectedValue === 'setup_logging') return await loggingHandler(interaction, client);
                if (selectedValue === 'setup_wipe') return await wipeHandler(interaction, client);
                if (selectedValue === 'setup_custom_zones') return await customZoneHandler(interaction, client);
                if (selectedValue === 'setup_server_roles') return await adminHandler(interaction, client);
                if (selectedValue === 'setup_crosschat') return await adminHandler(interaction, client);

                return await adminHandler(interaction, client);
            }

            if (customId === 'casino_game_select') return await casinoHandler(interaction, client);
            if (customId === 'unified_embed_select' || customId.startsWith('select_emb_')) return await postEmbedHandler(interaction, client);
        }

        // 3. Handle Modals
        if (interaction.isModalSubmit()) {
            if (customId.startsWith('modal_gg_')) return await gunGameHandler(interaction, client);
            if (customId.startsWith('modal_br_')) return await battleRoyaleHandler(interaction, client);
            if (customId === 'modal_hometp_settings') return await homeTpHandler(interaction, client);
            if (customId === 'modal_skipnight_percentage') return await skipNightHandler(interaction, client); 
            if (customId.startsWith('modal_givekit_exec_')) return await adminHandler(interaction, client);
            if (customId.includes('shop')) return await shopHandler(interaction, client);
            if (customId.includes('wipe')) return await wipeHandler(interaction, client);
            if (customId.includes('sug_')) return await suggestionHandler(interaction, client);
            if (customId.includes('econ') || customId.includes('hub_deposit')) return await economyHandler(interaction, client);
            if (customId.includes('ae_')) return await autoEventsHandler(interaction, client);
            if (customId.includes('casino')) return await casinoHandler(interaction, client);
            if (customId.includes('emb_') || customId.includes('rr_')) return await postEmbedHandler(interaction, client);
            if (customId.includes('am_')) return await autoModHandler(interaction, client);
            if (customId.includes('cz_')) return await customZoneHandler(interaction, client);
            if (customId.includes('clan')) return await clanHandler(interaction, client);
            if (customId.includes('tk_')) return await ticketHandler(interaction, client);
            if (customId.includes('ga_')) return await giveawayHandler(interaction, client);

            return await adminHandler(interaction, client);
        }

        // 4. Handle Buttons & Other Components
        if (customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) return await adminHandler.renderMainPanel(interaction);
        }
        if (customId.includes('giveaway') || customId.startsWith('ga_')) return await giveawayHandler(interaction, client);
        if (customId.includes('hometp')) return await homeTpHandler(interaction, client);
        if (customId.includes('skipnight')) return await skipNightHandler(interaction, client);
        if (customId.includes('shop')) return await shopHandler(interaction, client);
        if (customId.includes('clan')) return await clanHandler(interaction, client);
        if (customId.includes('econ') || customId.includes('bank')) return await economyHandler(interaction, client);
        if (customId.includes('casino') || customId.startsWith('g_')) return await casinoHandler(interaction, client);
        if (customId.includes('ticket') || customId.startsWith('btn_tk_')) return await ticketHandler(interaction, client);
        if (customId.includes('sug_')) return await suggestionHandler(interaction, client);
        if (customId.includes('wipe')) return await wipeHandler(interaction, client);
        if (customId.includes('emb_') || customId.startsWith('btn_emb_')) return await postEmbedHandler(interaction, client);
        if (customId.includes('tier') || customId.includes('stripe')) return await premiumHandler(interaction, client);
        if (customId.includes('log_')) return await loggingHandler(interaction, client);
        if (customId.includes('am_')) return await autoModHandler(interaction, client);
        if (customId.includes('cz_') || customId.includes('pve')) return await customZoneHandler(interaction, client);
        if (customId.startsWith('ae_')) return await autoEventsHandler(interaction, client);
        if (customId.includes('bounty')) return await bountyHandler(interaction, client);
        if (customId.includes('bind')) return await bindHandler(interaction, client);
        if (customId.includes('kit')) return await kitHandler(interaction, client);

        return await adminHandler(interaction, client);

    } catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: `❌ Error: ${error.message}`, flags: 64 }).catch(() => {});
        }
    }
};