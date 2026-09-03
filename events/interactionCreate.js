// ============================================================================
// MASTER ROUTER: events/interactionCreate.js (DIAGNOSTIC VERSION)
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
        const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';
        
        console.log(`[CLICK DEBUG] -----------------------------------------`);
        console.log(`[CLICK DEBUG] Type: ${interaction.type} | CustomId: "${customId}" | Value: "${selectedValue}"`);

        // Instant safe acknowledgment so Discord never throws "Unknown Interaction"
        if (interaction.isRepliable() && !interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 }).catch(() => {});
        }

        const safeEdit = async (payload) => {
            try {
                if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(payload);
                }
                return await interaction.reply({ ...payload, flags: 64 });
            } catch (e) {
                console.error("[SAFE EDIT ERROR]", e.message);
            }
        };

        // 1. Giveaways
        if (customId.includes('giveaway') || selectedValue === 'setup_giveaways') {
            return await giveawayHandler(interaction, client);
        }

        // 2. Universal Panel 1 & Panel 2 Dropdown Catcher
        if (customId.includes('admin_menu_select') || customId.includes('setup_')) {
            const target = selectedValue || customId;
            console.log(`[ROUTER] Routing Panel Selection -> Target: "${target}"`);

            if (target.includes('autoevents')) return await autoEventsHandler(interaction, client);
            if (target.includes('automod')) return await autoModHandler(interaction, client);
            if (target.includes('buddypass')) return await buddyPassHandler(interaction, client);
            if (target.includes('clans')) return await clanHandler(interaction, client);
            if (target.includes('bounties')) return await bountyHandler(interaction, client);
            if (target.includes('binds')) return await bindHandler(interaction, client);
            if (target.includes('tier')) return await premiumHandler(interaction, client);
            if (target.includes('embeds_roles')) {
                const embed = new EmbedBuilder().setTitle('🎨 Embeds & Panels').setDescription('Select panel type:').setColor('#9b59b6');
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('unified_embed_select').setPlaceholder('Select panel type...')
                    .addOptions([
                        { label: 'Create New Embed', value: 'setup_postembed', description: 'Create announcement', emoji: '📢' },
                        { label: 'Edit Existing Embed', value: 'edit_postembed', description: 'Edit embed', emoji: '✏️' }
                    ])
                );
                return safeEdit({ embeds: [embed], components: [row] });
            }
            if (target.includes('suggestions')) return await suggestionHandler(interaction, client);
            if (target.includes('hometp')) return await homeTpHandler(interaction, client);
            if (target.includes('skipnight')) return await skipNightHandler(interaction, client);
            if (target.includes('shop')) return await shopHandler(interaction, client);
            if (target.includes('economy')) return await economyHandler(interaction, client);
            if (target.includes('tickets')) return await ticketHandler(interaction, client);
            if (target.includes('logging')) return await loggingHandler(interaction, client);
            if (target.includes('wipe')) return await wipeHandler(interaction, client);
            if (target.includes('custom_zones')) return await customZoneHandler(interaction, client);
            if (target.includes('buddy_games')) return await buddyGamesHandler(interaction, client);
        }

        // 3. Module specific prefix routing
        if (customId.startsWith('ae_') || customId.includes('autoevent')) return await autoEventsHandler(interaction, client);
        if (customId.startsWith('am_') || customId.includes('automod')) return await autoModHandler(interaction, client);
        if (customId.startsWith('hometp_') || customId.includes('hometp')) return await homeTpHandler(interaction, client);
        if (customId.includes('skipnight')) return await skipNightHandler(interaction, client);
        if (customId.includes('shop')) return await shopHandler(interaction, client);
        if (customId.includes('ticket') || customId.startsWith('tk_')) return await ticketHandler(interaction, client);
        if (customId.includes('sug_')) return await suggestionHandler(interaction, client);
        if (customId.includes('wipe')) return await wipeHandler(interaction, client);
        if (customId.includes('emb_') || customId === 'unified_embed_select') return await postEmbedHandler(interaction, client);
        if (customId.includes('casino') || customId.startsWith('g_')) return await casinoHandler(interaction, client);
        if (customId.includes('kit')) return await kitHandler(interaction, client);

        // Fallback to admin handler
        return await adminHandler(interaction, client);

    } catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (interaction.isRepliable()) {
            await interaction.editReply({ content: `❌ Error: ${error.message}` }).catch(() => {});
        }
    }
};