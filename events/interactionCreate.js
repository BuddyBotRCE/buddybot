// ============================================================================
// MASTER ROUTER: events/interactionCreate.js
// ============================================================================
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const { GuildConfig } = require('../database/db');

const handlerPath = (fileName) => path.join(__dirname, '..', 'handlers', fileName);

const autoEventsHandler = require(handlerPath('autoEventsHandler'));
const autoMessageHandler = require(handlerPath('autoMessageHandler'));
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
const orpHandler = require(handlerPath('orpHandler'));
const customZoneHandler = require(handlerPath('customZoneHandler'));
const autoModHandler = require(handlerPath('autoModHandler'));
const wipeHandler = require(handlerPath('wipeHandler')); 
const homeTpHandler = require(handlerPath('homeTpHandler'));
const skipNightHandler = require(handlerPath('skipNightHandler'));
const recyclerHandler = require(handlerPath('recyclerHandler')); 
const prisonHandler = require(handlerPath('prisonHandler')); 
const gunGameHandler = require(handlerPath('gunGameHandler'));

module.exports = async (interaction, client) => {
    try {
        if (interaction.customId === 'admin_menu_select_2') {
            Object.defineProperty(interaction, 'customId', { value: 'admin_menu_select', writable: true, configurable: true });
        }

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
            if (customId === 'modal_bind_name' || customId.startsWith('bind_') || customId.includes('bind')) {
                return await bindHandler(interaction, client);
            }

            if (customId === 'modal_hometp_settings') return await homeTpHandler(interaction, client);
            if (customId === 'modal_skipnight_percentage') return await skipNightHandler(interaction, client);
            if (customId.startsWith('modal_givekit_exec_')) return await adminHandler(interaction, client);
            if (customId === 'modal_shop_multiplier' || customId === 'modal_shop_custom' || customId.startsWith('modal_buy_qty_')) return await shopHandler(interaction, client);
            if (customId === 'modal_wipe_full' || customId.startsWith('modal_wipe_sel_') || customId === 'modal_wipe_cooldowns') return await wipeHandler(interaction, client);
            if (customId === 'modal_link_account_global' || customId.startsWith('modal_link_account_')) return await adminHandler(interaction, client);
            if (customId.startsWith('modal_sug_') || customId === 'modal_player_submit_suggestion' || customId.startsWith('modal_sug_decline_reason_')) return await suggestionHandler(interaction, client);
            if (customId === 'modal_verify_email' || customId === 'modal_transfer_license') return await premiumHandler(interaction, client);
            if (customId === 'modal_setup_economy' || customId === 'modal_econ_interest' || customId === 'modal_hub_deposit' || customId === 'modal_hub_withdraw' || customId.startsWith('modal_admin_give_exec_') || customId.startsWith('modal_admin_take_exec_')) return await economyHandler(interaction, client);
            if (customId === 'modal_ae_settings' || customId.startsWith('modal_ae_')) return await autoEventsHandler(interaction, client);
            if (customId === 'modal_casino_config') return await casinoHandler(interaction, client);
            if (customId.startsWith('modal_emb_') || customId === 'modal_admin_embed' || customId.startsWith('modal_rr_') || customId.startsWith('modal_edit_embed_prompt') || customId.startsWith('modal_attach_rr_prompt')) return await postEmbedHandler(interaction, client);
            if (customId.startsWith('modal_am_') || customId === 'modal_automod_config') return await autoModHandler(interaction, client);
            if (customId.startsWith('modal_cz_')) return await customZoneHandler(interaction, client);
            if (customId.startsWith('modal_clan_') || customId.startsWith('clan_modal_')) return await clanHandler(interaction, client);
            if (customId.startsWith('modal_tk_')) return await ticketHandler(interaction, client);
            if (customId.startsWith('modal_ga_')) return await giveawayHandler(interaction, client);
            if (customId === 'modal_recycler_cd') return await recyclerHandler(interaction, client);
            if (customId.startsWith('modal_prison_')) return await prisonHandler(interaction, client);
            if (customId === 'modal_automsg_add') return await autoMessageHandler(interaction, client);
            if (customId.startsWith('modal_gg_') || customId === 'modal_gg_add_weapon') return await gunGameHandler(interaction, client);
            if (customId === 'modal_orp_config') return await orpHandler(interaction, client);
            
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
            
            // 🛡️ Fixed ORP Route
            if (selectedValue === 'setup_orp') return await orpHandler(interaction, client);
            
            if (selectedValue.includes('pve') || selectedValue.includes('zone') || selectedValue === 'setup_custom_zones') return await customZoneHandler(interaction, client);
            if (selectedValue === 'setup_automod') return await autoModHandler(interaction, client);
            if (selectedValue === 'setup_hometp') return await homeTpHandler(interaction, client);
            if (selectedValue === 'setup_recycler') return await recyclerHandler(interaction, client);
            if (selectedValue === 'setup_prison' || selectedValue.startsWith('set_cell_')) return await prisonHandler(interaction, client); 
            if (selectedValue === 'setup_automessages') return await autoMessageHandler(interaction, client);
            
            // 🎯 Routed Gun Game opening from dropdown
            if (selectedValue === 'setup_buddy_games' || selectedValue === 'setup_gungame') {
                return await gunGameHandler(interaction, client);
            }

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

        if (customId.includes('recycler')) return await recyclerHandler(interaction, client);
        if (customId.includes('prison') || customId === 'prison_btn_jail' || customId === 'prison_btn_unjail') return await prisonHandler(interaction, client);
        
        if (customId.startsWith('automsg_') || customId.includes('automsg')) {
            return await autoMessageHandler(interaction, client);
        }

        // 🎯 GLOBAL GUN GAME BUTTON & SELECT MENU ROUTER
        if (customId.startsWith('gg_') || customId.includes('gg_')) {
            return await gunGameHandler(interaction, client);
        }

        // 🛡️ ORP Components & Server Select Dropdown Route
        if (customId.startsWith('btn_orp_') || customId.startsWith('orp_') || customId.includes('orp')) {
            return await orpHandler(interaction, client);
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
};