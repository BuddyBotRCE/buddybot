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

module.exports = async (interaction, client) => {
    try {
        // 🚨 DROPDOWN 2 ALIAS FIX 🚨
        if (interaction.customId === 'admin_menu_select_2') {
            Object.defineProperty(interaction, 'customId', { value: 'admin_menu_select', writable: true, configurable: true });
        }

        // --- COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

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

module.exports = async (interaction, client) => {
    try {
        // 🚨 DROPDOWN 2 ALIAS FIX 🚨
        if (interaction.customId === 'admin_menu_select_2') {
            Object.defineProperty(interaction, 'customId', { value: 'admin_menu_select', writable: true, configurable: true });
        }

        // --- COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

        // ====================================================================
        // 🚦 0. MODAL SUBMISSION ROUTER
        // ====================================================================
        if (interaction.isModalSubmit()) {
            if (customId === 'modal_hometp_settings') return await homeTpHandler(interaction, client);
            if (customId === 'modal_skipnight_percentage') return await skipNightHandler(interaction, client); 
            if (customId.startsWith('modal_givekit_exec_')) return await adminHandler(interaction, client);
            if (customId === 'modal_shop_multiplier' || customId === 'modal_shop_custom' || customId.startsWith('modal_buy_qty_')) return await shopHandler(interaction, client);
            if (customId === 'modal_wipe_full' || customId.startsWith('modal_wipe_sel_') || customId === 'modal_wipe_cooldowns') return await wipeHandler(interaction, client);
            if (customId === 'modal_link_account_global' || customId.startsWith('modal_link_account_')) return await adminHandler(interaction, client);
            if (customId.startsWith('modal_sug_') || customId === 'modal_player_submit_suggestion' || customId.startsWith('modal_sug_decline_reason_')) return await suggestionHandler(interaction, client);
            if (customId === 'modal_verify_email' || customId === 'modal_transfer_license') return await premiumHandler(interaction, client);
            
            // 👇 FIXED: Explicitly catch ALL economy, daily, kill reward, and buddy days modals here! 👇
            if (customId === 'modal_setup_economy' || customId === 'modal_econ_daily' || customId === 'modal_econ_buddydays' || customId.startsWith('modal_econ_bd_') || customId === 'modal_econ_scientist_reward' || customId === 'modal_econ_player_reward' || customId === 'modal_econ_interest' || customId === 'modal_hub_deposit' || customId === 'modal_hub_withdraw' || customId.startsWith('modal_admin_give_exec_') || customId.startsWith('modal_admin_take_exec_')) {
                return await economyHandler(interaction, client);
            }

            if (customId === 'modal_ae_settings' || customId.startsWith('modal_ae_')) return await autoEventsHandler(interaction, client);
            if (customId === 'modal_casino_config') return await casinoHandler(interaction, client);
            if (customId.startsWith('modal_emb_') || customId === 'modal_admin_embed' || customId.startsWith('modal_rr_') || customId === 'modal_edit_embed_prompt' || customId === 'modal_attach_rr_prompt') return await postEmbedHandler(interaction, client);
            if (customId.startsWith('modal_am_') || customId === 'modal_automod_config') return await autoModHandler(interaction, client);
            if (customId.startsWith('modal_cz_')) return await customZoneHandler(interaction, client);
            if (customId.startsWith('modal_clan_') || customId.startsWith('clan_modal_')) return await clanHandler(interaction, client);
            if (customId.startsWith('modal_tk_')) return await ticketHandler(interaction, client);
            if (customId.startsWith('modal_ga_')) return await giveawayHandler(interaction, client);
            
            return await adminHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 1. ADMIN MENU DROPDOWN SELECT ROUTER
        // ====================================================================
        if (customId === 'admin_menu_select') {
            if (selectedValue === 'setup_server_roles') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const adminRoleDisplay = config?.adminRoleId ? `<@&${config.adminRoleId}>` : '`Not Set`';
                const modRoleDisplay = config?.modRoleId ? `<@&${config.modRoleId}>` : '`Not Set`';

                const embed = new EmbedBuilder()
                    .setTitle('👑 Admin & Moderator Roles Manager')
                    .setDescription(`Configure which Discord roles are recognized by BuddyBot as Server Admins and Moderators.\n\n` +
                        `• **Current Admin Role:** ${adminRoleDisplay}\n` +
                        `• **Current Mod Role:** ${modRoleDisplay}`)
                    .setColor('#e67e22');

                const row1 = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder().setCustomId('select_config_admin_role').setPlaceholder('Select Bot Admin Role...').setMinValues(1).setMaxValues(1)
                );
                const row2 = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder().setCustomId('select_config_mod_role').setPlaceholder('Select Bot Moderator Role...').setMinValues(1).setMaxValues(1)
                );

                return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
            }

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

            if (selectedValue === 'setup_skipnight') return await skipNightHandler(interaction, client);
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
            if (selectedValue === 'setup_orp') return await adminHandler(interaction, client);
            if (selectedValue.includes('pve') || selectedValue.includes('zone') || selectedValue === 'setup_custom_zones') return await customZoneHandler(interaction, client);
            if (selectedValue === 'setup_automod') return await autoModHandler(interaction, client);
            if (selectedValue === 'setup_hometp') return await homeTpHandler(interaction, client);

            return await adminHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 2. ROLE SELECT MENUS
        // ====================================================================
        if (interaction.isRoleSelectMenu()) {
            if (customId === 'hometp_select_role') {
                return await homeTpHandler(interaction, client);
            }
            if (customId === 'select_config_admin_role') {
                const roleId = interaction.values[0];
                await GuildConfig.upsert({ guildId: interaction.guild.id, adminRoleId: roleId });
                return interaction.update({ content: `✅ Bot **Admin Role** successfully set to <@&${roleId}>!`, components: [] });
            }
            if (customId === 'select_config_mod_role') {
                const roleId = interaction.values[0];
                await GuildConfig.upsert({ guildId: interaction.guild.id, modRoleId: roleId });
                return interaction.update({ content: `✅ Bot **Moderator Role** successfully set to <@&${roleId}>!`, components: [] });
            }
        }

        // ====================================================================
        // 🚦 3. CHANNEL SELECT MENUS
        // ====================================================================
        if (interaction.isChannelSelectMenu() && customId === 'select_tk_category') {
            return await ticketHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 4. BUTTONS & COMPONENT ROUTING
        // ====================================================================
        
        if (customId === 'btn_toggle_skipnight' || customId === 'btn_set_skipnight_percentage') {
            return await skipNightHandler(interaction, client);
        }

        if (customId === 'hometp_btn_settings' || customId === 'admin_menu_back') {
            return await homeTpHandler(interaction, client);
        }

        if (customId === 'admin_menu_back') {
            const adminHandler = require('./adminHandler');
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
        }  

        if (customId === 'hub_hometp_info') {
            return interaction.reply({ 
                content: `🏠 **Home Teleport Hub Guide:**\n• Use the in-game quick-chat wheel and select **"Can I have a key"** to anchor your home respawn location.\n• Use the quick-chat wheel and select **"Retreat"** to teleport straight back home (subject to role requirements & cooldowns)!`, 
                flags: 64 
            });
        }

        if (customId === 'hub_pvp_areas') {
            const { PveZone } = require('../database/db');
            
            const activePvpZones = await PveZone.findAll({ 
                where: { 
                    guildId: interaction.guild.id, 
                    isEnabled: true, 
                    pvp: true 
                } 
            });

            let pvpText = '### ⚔️ Live Active PvP Areas & Monuments\n\n`All areas are currently Safe PvE (No active PvP zones).`';
            
            if (activePvpZones && activePvpZones.length > 0) {
                pvpText = '### ⚔️ Live Active PvP Areas & Monuments\n\n' + 
                    activePvpZones.map(z => `• 🔴 **${z.name || 'Custom Zone'}** — Radius: \`${z.radius || 50}m\``).join('\n');
            }

            return interaction.reply({ content: pvpText, flags: 64 });
        }

        // Player Hub & Core Modules
        if (customId === 'hub_link_account' || customId === 'select_link_server_target' || customId === 'hub_leaderboards' || customId === 'hub_lb_select' || customId.startsWith('lb_refresh_') || customId === 'btn_admin_kit' || customId.startsWith('ak_panel_') || customId === 'ak_panel_kit_select' || customId.includes('admin_kit_choice') || customId.startsWith('admin_kit_target_') || customId.startsWith('admin_kit_target_select')) {
            return await adminHandler(interaction, client);
        }

        if (customId === 'hub_shop_menu' || customId === 'hub_shop_browse' || customId === 'hub_shop_pricelist' || customId.startsWith('player_shop_') || customId.includes('shop')) {
            return await shopHandler(interaction, client);
        }

        if (customId === 'hub_clans' || customId.includes('clan')) {
            return await clanHandler(interaction, client);
        }

        // 👇 FIXED: Explicitly route ALL economy, daily, buddy days, and kill reward buttons/select menus here! 👇
        if (customId === 'hub_economy_menu' || customId === 'hub_balance' || customId === 'hub_daily' || customId === 'hub_buddydays' || customId === 'select_buddydays_type' || customId === 'btn_econ_daily' || customId === 'btn_econ_buddydays' || customId === 'btn_econ_scientist_reward' || customId === 'btn_econ_player_reward' || customId === 'hub_deposit' || customId === 'hub_withdraw' || customId.includes('bank') || customId.includes('econ') || customId === 'btn_admin_give' || customId === 'btn_admin_take' || customId === 'select_admin_give_target' || customId === 'select_admin_take_target') {
            return await economyHandler(interaction, client);
        }

        if (customId === 'hub_casino' || customId === 'casino_game_select' || customId.startsWith('modal_play_') || customId.includes('casino') || customId === 'btn_casino_settings') {
            return await casinoHandler(interaction, client);
        }

        if (customId === 'hub_buddypass_view' || customId.startsWith('bp_') || customId.includes('buddypass')) {
            return await buddyPassHandler(interaction, client);
        }

        if (customId === 'hub_vote_info') {
            return interaction.reply({ content: `🗳️ **Vote & Claim:** Link your vote tracking with your Rust server to automatically reward players with free currency or kits! (Configure via your voting site webhook).`, flags: 64 }).catch(() => {});
        }

        // 🚨 TICKET ROUTE FIX - Catching all btn_tk_ and tk_ buttons 🚨
        if (customId === 'ticket_create' || customId.startsWith('btn_tk_') || customId.startsWith('tk_') || customId.includes('ticket')) {
            return await ticketHandler(interaction, client);
        }

        if (customId.includes('sug_') || customId === 'btn_player_open_suggestion') {
            return await suggestionHandler(interaction, client);
        }

        // Admin Specific Tools
        if (customId === 'btn_wipe_full' || customId === 'btn_wipe_selective' || customId === 'btn_wipe_cooldowns' || customId === 'select_wipe_custom') {
            return await wipeHandler(interaction, client);
        }

        if (customId === 'unified_embed_select' || customId.startsWith('btn_emb_') || customId.startsWith('select_emb_') || customId.startsWith('rr_') || customId.startsWith('select_rr_') || customId.startsWith('btn_rr_')) {
            return await postEmbedHandler(interaction, client);
        }

        if (customId === 'toggle_tier_status' || customId === 'btn_manage_stripe' || customId === 'btn_transfer_license' || customId === 'btn_open_verify_modal') {
            return await premiumHandler(interaction, client);
        }

        if (customId.startsWith('btn_log_') || customId.startsWith('select_log_chan_')) {
            return await loggingHandler(interaction, client);
        }

        if (customId.startsWith('am_') || customId.startsWith('btn_am_')) {
            return await autoModHandler(interaction, client);
        }

        if (customId.startsWith('cz_') || customId.startsWith('btn_cz_') || customId === 'select_custom_zone' || customId.includes('pve') || customId.includes('zone')) {
            return await customZoneHandler(interaction, client);
        }

        if (customId.startsWith('ae_') || customId === 'btn_finalize_tpl_aeslot') {
            return await autoEventsHandler(interaction, client);
        }

        if (customId.includes('ga_') || customId.includes('giveaway')) {
            return await giveawayHandler(interaction, client);
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

        return await adminHandler(interaction, client);

    } catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ An error occurred processing this interaction.', flags: 64 }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ An error occurred processing this interaction.', flags: 64 }).catch(() => {});
        }
    }
}; // 👈 Correctly ends with just one closing bracket!

        // ====================================================================
        // 🚦 1. ADMIN MENU DROPDOWN SELECT ROUTER
        // ====================================================================
        if (customId === 'admin_menu_select') {
            if (selectedValue === 'setup_server_roles') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const adminRoleDisplay = config?.adminRoleId ? `<@&${config.adminRoleId}>` : '`Not Set`';
                const modRoleDisplay = config?.modRoleId ? `<@&${config.modRoleId}>` : '`Not Set`';

                const embed = new EmbedBuilder()
                    .setTitle('👑 Admin & Moderator Roles Manager')
                    .setDescription(`Configure which Discord roles are recognized by BuddyBot as Server Admins and Moderators.\n\n` +
                        `• **Current Admin Role:** ${adminRoleDisplay}\n` +
                        `• **Current Mod Role:** ${modRoleDisplay}`)
                    .setColor('#e67e22');

                const row1 = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder().setCustomId('select_config_admin_role').setPlaceholder('Select Bot Admin Role...').setMinValues(1).setMaxValues(1)
                );
                const row2 = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder().setCustomId('select_config_mod_role').setPlaceholder('Select Bot Moderator Role...').setMinValues(1).setMaxValues(1)
                );

                return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
            }

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

            if (selectedValue === 'setup_skipnight') return await skipNightHandler(interaction, client);
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
            if (selectedValue === 'setup_orp') return await adminHandler(interaction, client);
            if (selectedValue.includes('pve') || selectedValue.includes('zone') || selectedValue === 'setup_custom_zones') return await customZoneHandler(interaction, client);
            if (selectedValue === 'setup_automod') return await autoModHandler(interaction, client);
            if (selectedValue === 'setup_hometp') return await homeTpHandler(interaction, client);

            return await adminHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 2. ROLE SELECT MENUS
        // ====================================================================
        if (interaction.isRoleSelectMenu()) {
            if (customId === 'hometp_select_role') {
                return await homeTpHandler(interaction, client);
            }
            if (customId === 'select_config_admin_role') {
                const roleId = interaction.values[0];
                await GuildConfig.upsert({ guildId: interaction.guild.id, adminRoleId: roleId });
                return interaction.update({ content: `✅ Bot **Admin Role** successfully set to <@&${roleId}>!`, components: [] });
            }
            if (customId === 'select_config_mod_role') {
                const roleId = interaction.values[0];
                await GuildConfig.upsert({ guildId: interaction.guild.id, modRoleId: roleId });
                return interaction.update({ content: `✅ Bot **Moderator Role** successfully set to <@&${roleId}>!`, components: [] });
            }
        }

        // ====================================================================
        // 🚦 3. CHANNEL SELECT MENUS
        // ====================================================================
        if (interaction.isChannelSelectMenu() && customId === 'select_tk_category') {
            return await ticketHandler(interaction, client);
        }

        // ====================================================================
        // 🚦 4. BUTTONS & COMPONENT ROUTING
        // ====================================================================
        
        if (customId === 'btn_toggle_skipnight' || customId === 'btn_set_skipnight_percentage') {
            return await skipNightHandler(interaction, client);
        }

        if (customId === 'hometp_btn_settings' || customId === 'admin_menu_back') {
            return await homeTpHandler(interaction, client);
        }

        if (customId === 'admin_menu_back') {
            const adminHandler = require('./adminHandler');
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
        }  

        if (customId === 'hub_hometp_info') {
            return interaction.reply({ 
                content: `🏠 **Home Teleport Hub Guide:**\n• Use the in-game quick-chat wheel and select **"Can I have a key"** to anchor your home respawn location.\n• Use the quick-chat wheel and select **"Retreat"** to teleport straight back home (subject to role requirements & cooldowns)!`, 
                flags: 64 
            });
        }

        if (customId === 'hub_pvp_areas') {
            const { PveZone } = require('../database/db');
            
            const activePvpZones = await PveZone.findAll({ 
                where: { 
                    guildId: interaction.guild.id, 
                    isEnabled: true, 
                    pvp: true 
                } 
            });

            let pvpText = '### ⚔️ Live Active PvP Areas & Monuments\n\n`All areas are currently Safe PvE (No active PvP zones).`';
            
            if (activePvpZones && activePvpZones.length > 0) {
                pvpText = '### ⚔️ Live Active PvP Areas & Monuments\n\n' + 
                    activePvpZones.map(z => `• 🔴 **${z.name || 'Custom Zone'}** — Radius: \`${z.radius || 50}m\``).join('\n');
            }

            return interaction.reply({ content: pvpText, flags: 64 });
        }

        // Player Hub & Core Modules
        if (customId === 'hub_link_account' || customId === 'select_link_server_target' || customId === 'hub_leaderboards' || customId === 'hub_lb_select' || customId.startsWith('lb_refresh_') || customId === 'btn_admin_kit' || customId.startsWith('ak_panel_') || customId === 'ak_panel_kit_select' || customId.includes('admin_kit_choice') || customId.startsWith('admin_kit_target_') || customId.startsWith('admin_kit_target_select')) {
            return await adminHandler(interaction, client);
        }

        if (customId === 'hub_shop_menu' || customId === 'hub_shop_browse' || customId === 'hub_shop_pricelist' || customId.startsWith('player_shop_') || customId.includes('shop')) {
            return await shopHandler(interaction, client);
        }

        if (customId === 'hub_clans' || customId.includes('clan')) {
            return await clanHandler(interaction, client);
        }

        // 👇 FIXED: Explicitly route ALL economy, daily, buddy days, and kill reward buttons/select menus here! 👇
        if (customId === 'hub_economy_menu' || customId === 'hub_balance' || customId === 'hub_daily' || customId === 'hub_buddydays' || customId === 'select_buddydays_type' || customId === 'btn_econ_daily' || customId === 'btn_econ_buddydays' || customId === 'btn_econ_scientist_reward' || customId === 'btn_econ_player_reward' || customId === 'hub_deposit' || customId === 'hub_withdraw' || customId.includes('bank') || customId.includes('econ') || customId === 'btn_admin_give' || customId === 'btn_admin_take' || customId === 'select_admin_give_target' || customId === 'select_admin_take_target') {
            return await economyHandler(interaction, client);
        }

        if (customId === 'hub_casino' || customId === 'casino_game_select' || customId.startsWith('modal_play_') || customId.includes('casino') || customId === 'btn_casino_settings') {
            return await casinoHandler(interaction, client);
        }

        if (customId === 'hub_buddypass_view' || customId.startsWith('bp_') || customId.includes('buddypass')) {
            return await buddyPassHandler(interaction, client);
        }

        if (customId === 'hub_vote_info') {
            return interaction.reply({ content: `🗳️ **Vote & Claim:** Link your vote tracking with your Rust server to automatically reward players with free currency or kits! (Configure via your voting site webhook).`, flags: 64 }).catch(() => {});
        }

        // 🚨 TICKET ROUTE FIX - Catching all btn_tk_ and tk_ buttons 🚨
        if (customId === 'ticket_create' || customId.startsWith('btn_tk_') || customId.startsWith('tk_') || customId.includes('ticket')) {
            return await ticketHandler(interaction, client);
        }

        if (customId.includes('sug_') || customId === 'btn_player_open_suggestion') {
            return await suggestionHandler(interaction, client);
        }

        // Admin Specific Tools
        if (customId === 'btn_wipe_full' || customId === 'btn_wipe_selective' || customId === 'btn_wipe_cooldowns' || customId === 'select_wipe_custom') {
            return await wipeHandler(interaction, client);
        }

        if (customId === 'unified_embed_select' || customId.startsWith('btn_emb_') || customId.startsWith('select_emb_') || customId.startsWith('rr_') || customId.startsWith('select_rr_') || customId.startsWith('btn_rr_')) {
            return await postEmbedHandler(interaction, client);
        }

        if (customId === 'toggle_tier_status' || customId === 'btn_manage_stripe' || customId === 'btn_transfer_license' || customId === 'btn_open_verify_modal') {
            return await premiumHandler(interaction, client);
        }

        if (customId.startsWith('btn_log_') || customId.startsWith('select_log_chan_')) {
            return await loggingHandler(interaction, client);
        }

        if (customId.startsWith('am_') || customId.startsWith('btn_am_')) {
            return await autoModHandler(interaction, client);
        }

        if (customId.startsWith('cz_') || customId.startsWith('btn_cz_') || customId === 'select_custom_zone' || customId.includes('pve') || customId.includes('zone')) {
            return await customZoneHandler(interaction, client);
        }

        if (customId.startsWith('ae_') || customId === 'btn_finalize_tpl_aeslot') {
            return await autoEventsHandler(interaction, client);
        }

        if (customId.includes('ga_') || customId.includes('giveaway')) {
            return await giveawayHandler(interaction, client);
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

        return await adminHandler(interaction, client);

    } catch (error) {
        console.error('[INTERACTION ERROR]', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ An error occurred processing this interaction.', flags: 64 }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ An error occurred processing this interaction.', flags: 64 }).catch(() => {});
        }
    }
}; // 👈 Correctly ends with just one closing bracket!