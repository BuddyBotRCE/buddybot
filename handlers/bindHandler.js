const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { CustomBind, ServerKit, GameServer } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 
const adminHandler = require('./adminHandler');

const { CHAT_CATEGORIES, CHAT_OPTIONS_MAP } = require('../utils/d11ChatHandler');

const bindSessions = new Map();

const buildPanelPayload = async (guildId, messageOverride = '') => {
    if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: null, view: 'main', selectedCategory: null, serverId: null });
    const session = bindSessions.get(guildId);
    
    const allBinds = await CustomBind.findAll({ where: { guildId }, order: [['id', 'ASC']] });
    const servers = await GameServer.findAll({ where: { guildId } });
    let components = [];
    
    const embed = new EmbedBuilder().setColor('#3498db').setTitle('🗣️ Custom Binds & Console Quick-Chat Manager');
    if (messageOverride) embed.setDescription(`**${messageOverride}**\n\n`);

    let serverDisplay = '`No Server Selected`';
    if (session.serverId) {
        const targetServer = servers.find(s => s.id == session.serverId);
        if (targetServer) serverDisplay = `**${targetServer.serverName}**`;
    }

    if (session.view === 'main') {
        let bindList = '';
        for (const b of allBinds) {
            const typeEmoji = b.actionType === 'kit' ? '📦' : b.actionType === 'teleport' ? '🌀' : '♻️';
            bindList += `${typeEmoji} **${b.name}** — Type: \`${b.actionType.toUpperCase()}\`\n`;
        }

        embed.addFields(
            { name: '🖥️ Target Server', value: serverDisplay, inline: false },
            { name: '📋 Configured Custom Binds', value: bindList || "*No custom binds created yet.*", inline: false },
            { name: '🛠️ Create New Bind', value: "👇 **Click a button below to choose your bind type:**", inline: false }
        );

        if (servers.length > 0) {
            const serverOptions = servers.map(s => ({ label: s.serverName, value: `bind_server_${s.id}`, emoji: '🖥️' }));
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_menu_server_select').setPlaceholder('🖥️ Select target server...').addOptions(serverOptions)
            ));
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_create_kit').setLabel('New Kit Bind').setStyle(ButtonStyle.Primary).setEmoji('📦'),
            new ButtonBuilder().setCustomId('bind_create_teleport').setLabel('New Teleport').setStyle(ButtonStyle.Success).setEmoji('🌀'),
            new ButtonBuilder().setCustomId('bind_create_recycler').setLabel('New Recycler').setStyle(ButtonStyle.Secondary).setEmoji('♻️')
        ));

        if (allBinds.length > 0) {
            const selectOptions = allBinds.slice(0, 25).map(b => ({
                label: b.name.substring(0, 100),
                description: `Type: ${b.actionType.toUpperCase()} | Cost: ${b.cost || 0} Scrap`,
                value: `editbind_${b.id}`,
                emoji: b.actionType === 'kit' ? '📦' : b.actionType === 'teleport' ? '🌀' : '♻️'
            }));

            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('bind_manage_select')
                    .setPlaceholder('🛠️ Select a bind to Edit or Delete...')
                    .addOptions(selectOptions)
            ));
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    } 
    else if (session.view === 'bind') {
        const activeBind = await CustomBind.findByPk(session.selectedBindId);
        if (!activeBind) {
            session.view = 'main';
            return await buildPanelPayload(guildId, '❌ Bind not found.');
        }

        let posText = '*Not Set*';
        if (activeBind.command && (activeBind.actionType === 'teleport' || activeBind.actionType === 'recycler')) {
            const matches = activeBind.command.match(/-?\d+(\.\d+)?/g);
            if (matches && matches.length >= 3) {
                const len = matches.length;
                posText = `\`X: ${matches[len-3]}, Y: ${matches[len-2]}, Z: ${matches[len-1]}\``;
            }
        }

        const roleDisplay = activeBind.roleId ? `<@&${activeBind.roleId}>` : '`None`';

        embed.setTitle(`🗣️ Managing Bind: ${activeBind.name} (${activeBind.actionType.toUpperCase()})`);
        
        embed.addFields(
            { name: `🖥️ Target Server`, value: serverDisplay, inline: false },
            { name: `📊 Settings & Requirements`, value: `**Quick-Chat Wheel:** ${activeBind.emote || 'Not Set'}\n**Type:** ${activeBind.actionType}\n**Target Kit:** ${activeBind.targetValue || 'N/A'}\n**Coordinates:** ${posText}`, inline: true },
            { name: `🛡️ Economy & Security`, value: `**Cost:** ${activeBind.cost || 0} Scrap\n**Cooldown:** ${activeBind.cooldown || 0}s\n**Required Role:** ${roleDisplay}`, inline: true }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_btn_name').setLabel('Rename').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('bind_btn_emote').setLabel('Quick-Chat').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
            new ButtonBuilder().setCustomId('bind_btn_economy').setLabel('Cost & CD').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
            new ButtonBuilder().setCustomId('bind_btn_role').setLabel('Required Role').setStyle(ButtonStyle.Secondary).setEmoji('🛡️')
        ));

        if (activeBind.actionType === 'kit') {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bind_btn_kitselect').setLabel('Select In-Game Kit').setStyle(ButtonStyle.Success).setEmoji('📦')
            ));
        } else if (activeBind.actionType === 'teleport' || activeBind.actionType === 'recycler') {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bind_btn_getpos').setLabel('Set Position (Auto-Capture)').setStyle(ButtonStyle.Success).setEmoji('📍'),
                new ButtonBuilder().setCustomId('bind_btn_ground').setLabel('Place on Ground').setStyle(ButtonStyle.Secondary).setEmoji('⬇️')
            ));
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_btn_delete').setLabel('Delete Bind').setStyle(ButtonStyle.Danger).setEmoji('💀'),
            new ButtonBuilder().setCustomId('bind_btn_back').setLabel('Back to List').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }
    else if (session.view === 'emote_category') {
        embed.setTitle('💬 Select Quick-Chat Category').setDescription('Choose a category to view its quick-chat wheel commands.');
        components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('bind_do_category').setPlaceholder('Select chat category...').addOptions(CHAT_CATEGORIES)));
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bind_back_bind').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')));
    }
    else if (session.view === 'emote_picker') {
        const cat = session.selectedCategory || 'cat_combat';
        const options = CHAT_OPTIONS_MAP[cat] || CHAT_OPTIONS_MAP.cat_combat;

        embed.setTitle('💬 Select Quick-Chat Phrase').setDescription('Choose the exact phrase that triggers this bind in-game.');
        components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('bind_do_emote').setPlaceholder('Select phrase...').addOptions(options)));
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bind_back_category').setLabel('Back to Categories').setStyle(ButtonStyle.Secondary).setEmoji('🔙')));
    }
    else if (session.view === 'kit_picker') {
        embed.setTitle('📦 Select In-Game Kit').setDescription('Choose which kit this bind will grant to players.');
        const serverKits = await ServerKit.findAll({ where: { guildId } });

        const kitOptions = serverKits.length > 0 
            ? serverKits.slice(0, 25).map(k => ({ label: k.kitName.substring(0, 100), value: k.kitName, emoji: '📦' }))
            : [{ label: 'starter', value: 'starter', description: 'Default fallback kit', emoji: '📦' }, { label: 'vip', value: 'vip', description: 'Default fallback kit', emoji: '⭐' }, { label: 'builder', value: 'builder', description: 'Default fallback kit', emoji: '🏗️' }];

        components.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('bind_do_kit').setPlaceholder('Select a server kit...').addOptions(kitOptions)));
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bind_back_bind').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')));
    }
    else if (session.view === 'role_picker') {
        embed.setTitle('🛡️ Set Required Role').setDescription('Select the Discord Role required to use this Custom Bind. If they do not have this role, they cannot trigger it.');
        components.push(new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('bind_do_role').setPlaceholder('Select a required Discord Role...')));
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bind_clear_role').setLabel('Clear Role Requirement').setStyle(ButtonStyle.Danger).setEmoji('🗑️'), new ButtonBuilder().setCustomId('bind_back_bind').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')));
    }

    return { embeds: [embed], components, flags: 64 };
};

async function safeRespond(interaction, payload) {
    try {
        if (interaction.isModalSubmit() || interaction.isMessageComponent()) {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply(payload);
            } else {
                await interaction.update(payload);
            }
        } else {
            await interaction.reply(payload);
        }
    } catch (err) {
        console.error("[CUSTOM BINDS] Failed to update UI:", err);
    }
}

const bindHandler = async (interaction, client) => {
    try {
        const member = interaction.member;
        const isOwner = interaction.guild?.ownerId === member.id;
        const isAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasAdminRole = member.roles.cache.some(role => 
            role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('owner') ||
            role.name.toLowerCase().includes('manager') || role.name.toLowerCase().includes('mod')
        );

        if (!isOwner && !isAdminPerm && !hasAdminRole) {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                return await interaction.reply({ content: '❌ **Access Denied.**', flags: 64 });
            }
            return;
        }

        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;

        if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: null, view: 'main', serverId: null });
        const session = bindSessions.get(guildId);

        const renderBindPanel = async (inter, messageOverride = '') => {
            const payload = await buildPanelPayload(guildId, messageOverride);
            await safeRespond(inter, payload);
        };

        if (customId === 'admin_menu_select' || customId === 'setup_binds') {
            session.view = 'main';
            return await renderBindPanel(interaction);
        }

        if (customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
            return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
        }

        if (customId.startsWith('bind_create_')) {
            const type = customId.replace('bind_create_', '');
            const newBind = await CustomBind.create({ 
                guildId, name: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Bind`, actionType: type, emote: 'Not Set', cost: 0, cooldown: 0
            });
            session.selectedBindId = newBind.id;
            session.view = 'bind';
            return await renderBindPanel(interaction, `✨ Created new ${type} bind!`);
        }

        if (customId === 'bind_menu_server_select' && interaction.isStringSelectMenu()) {
            const selectedVal = interaction.values[0];
            session.serverId = selectedVal.replace('bind_server_', '');
            return await renderBindPanel(interaction, `🖥️ Target server updated!`);
        }

        if (customId === 'bind_manage_select' && interaction.isStringSelectMenu()) {
            const selectedVal = interaction.values[0];
            session.selectedBindId = parseInt(selectedVal.replace('editbind_', ''));
            session.view = 'bind';
            return await renderBindPanel(interaction);
        }

        if (customId === 'bind_do_category' && interaction.isStringSelectMenu()) {
            session.selectedCategory = interaction.values[0];
            session.view = 'emote_picker';
            return await renderBindPanel(interaction);
        }

        if (customId === 'bind_do_emote' && interaction.isStringSelectMenu()) {
            const cat = session.selectedCategory || 'cat_combat';
            const options = CHAT_OPTIONS_MAP[cat] || [];
            const wheelOption = options.find(o => o.value === interaction.values[0]);
            
            const emote = wheelOption ? `${wheelOption.emoji} ${wheelOption.label}` : interaction.values[0];
            const targetPhrase = wheelOption ? wheelOption.value : interaction.values[0];
            
            await CustomBind.update({ emote, targetValue: targetPhrase }, { where: { id: session.selectedBindId } });
            session.view = 'bind';
            return await renderBindPanel(interaction, `💬 Quick-chat wheel trigger updated!`);
        }

        if (customId === 'bind_do_kit' && interaction.isStringSelectMenu()) {
            const kitName = interaction.values[0];
            const command = `kit givetoplayer "${kitName}" "{player}"`;
            await CustomBind.update({ targetValue: kitName, command }, { where: { id: session.selectedBindId } });
            session.view = 'bind';
            return await renderBindPanel(interaction, `📦 Bound to kit: **${kitName}**!`);
        }

        if (customId === 'bind_do_role' && interaction.isRoleSelectMenu()) {
            const roleId = interaction.values[0];
            await CustomBind.update({ roleId }, { where: { id: session.selectedBindId } });
            session.view = 'bind';
            return await renderBindPanel(interaction, `🛡️ Required Role updated successfully!`);
        }
        
        if (interaction.isModalSubmit()) {
            if (customId === 'modal_bind_name') {
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferReply({ flags: 64 }).catch(() => {});
                    }

                    const name = interaction.fields.getTextInputValue('b_name').trim() || "Custom Bind";
                    
                    if (session.selectedBindId) {
                        await CustomBind.update({ name }, { where: { id: session.selectedBindId } });
                    } else {
                        const latestBind = await CustomBind.findOne({ where: { guildId }, order: [['updatedAt', 'DESC']] });
                        if (latestBind) {
                            session.selectedBindId = latestBind.id;
                            await latestBind.update({ name });
                        }
                    }

                    const payload = await buildPanelPayload(guildId, `✅ Bind renamed to **${name}** successfully!`);
                    return await interaction.editReply(payload);
                } catch (modalErr) {
                    console.error('[RENAME MODAL ERROR]', modalErr);
                    return await interaction.editReply({ content: `❌ Failed to rename bind: ${modalErr.message}` }).catch(() => {});
                }
            }

            if (customId === 'bind_modal_economy') {
                await interaction.deferReply({ flags: 64 }).catch(() => {});
                let cost = parseInt(interaction.fields.getTextInputValue('b_cost'));
                let cooldown = parseInt(interaction.fields.getTextInputValue('b_cd'));
                
                if (isNaN(cost) || cost < 0) cost = 0;
                if (isNaN(cooldown) || cooldown < 0) cooldown = 0;

                if (session.selectedBindId) {
                    await CustomBind.update({ cost, cooldown }, { where: { id: session.selectedBindId } });
                }
                const payload = await buildPanelPayload(guildId, `⚙️ Cost and Cooldown saved!`);
                return await interaction.editReply(payload);
            }
        }

        if (interaction.isButton()) {

            if (customId === 'bind_btn_back' || customId === 'bind_back_bind') {
                session.view = 'bind';
                if (customId === 'bind_btn_back') session.selectedBindId = null;
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_back_category') {
                session.view = 'emote_category';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_emote') {
                session.view = 'emote_category';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_kitselect') {
                session.view = 'kit_picker';
                return await renderBindPanel(interaction);
            }
            
            if (customId === 'bind_btn_role') {
                session.view = 'role_picker';
                return await renderBindPanel(interaction);
            }
            
            if (customId === 'bind_clear_role') {
                await CustomBind.update({ roleId: null }, { where: { id: session.selectedBindId } });
                session.view = 'bind';
                return await renderBindPanel(interaction, `🗑️ Role requirement cleared!`);
            }

            if (customId === 'bind_btn_name') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('modal_bind_name').setTitle(`Rename Bind`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_name').setLabel("Bind Name").setStyle(TextInputStyle.Short).setValue(b.name || '').setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_economy') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('modal_bind_economy').setTitle(`Configure Economy`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cost').setLabel("Scrap Cost (0 for free)").setStyle(TextInputStyle.Short).setValue((b.cost || 0).toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cd').setLabel("Cooldown in Seconds").setStyle(TextInputStyle.Short).setValue((b.cooldown || 0).toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_getpos') {
                if (!session.serverId) {
                    return await renderBindPanel(interaction, `❌ **Please select a Target Server from the dropdown menu first!**`);
                }
                const loadingPayload = await buildPanelPayload(guildId, '⏳ **Extracting your position from the server...**');
                await interaction.update(loadingPayload);
                await queueAdminPos(interaction, 'custom_bind', session.selectedBindId, session.serverId);
                return;
            }

            if (customId === 'bind_btn_ground') {
                const bind = await CustomBind.findByPk(session.selectedBindId);
                
                if (!bind || !bind.command) {
                    return await renderBindPanel(interaction, `❌ **Please click 'Set Position' first!**`);
                }

                const matches = bind.command.match(/-?\d+(\.\d+)?/g);
                if (!matches || matches.length < 3) {
                    return await renderBindPanel(interaction, `❌ **Could not read coordinates from saved command! Please Set Position again.**`);
                }

                const len = matches.length;
                const cX = matches[len-3];
                const cY = parseFloat(matches[len-2]);
                const cZ = matches[len-1];

                const loweredY = (cY - 0.5).toFixed(2);
                
                let newCommand = '';
if (bind.actionType === 'teleport') {
    // Official Rust Console Edition format: teleportpos (X,Y,Z) "{player}"
    newCommand = `teleportpos (${cX},${loweredY},${cZ}) "{player}"`;
} else if (bind.actionType === 'recycler') {
    newCommand = `spawn recycler_static (${cX},${loweredY},${cZ})`;
}
                
                await CustomBind.update({ command: newCommand }, { where: { id: session.selectedBindId } });
                session.view = 'bind';
                return await renderBindPanel(interaction, `⬇️ **Placed on Ground!** (Lowered Y-axis from ${cY} to ${loweredY})`);
            }

            if (customId === 'bind_btn_delete') {
                await CustomBind.destroy({ where: { id: session.selectedBindId } });
                session.selectedBindId = null;
                session.view = 'main';
                return await renderBindPanel(interaction, `💀 Bind successfully deleted.`);
            }
        }

    } catch (error) {
        console.error('[CUSTOM BINDS ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Error processing Custom Binds action.', flags: 64 }).catch(()=>{});
        }
    }
};

bindHandler.refreshPanelViaInteraction = async (interaction, messageOverride, bindId = null) => {
    try {
        const guildId = interaction.guild.id;
        if (bindId) {
            if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: bindId, view: 'bind', selectedCategory: null });
            const session = bindSessions.get(guildId);
            session.selectedBindId = bindId;
            session.view = 'bind';
            bindSessions.set(guildId, session);
        }

        const payload = await buildPanelPayload(guildId, messageOverride);
        await interaction.editReply(payload).catch(() => {});
    } catch (e) {
        console.error("Failed to live-refresh Bind panel:", e);
    }
};

module.exports = bindHandler;
module.exports.refreshPanelViaInteraction = bindHandler.refreshPanelViaInteraction;