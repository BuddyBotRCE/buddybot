const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { CustomBind, ServerKit } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

const bindSessions = new Map();

// Official Rust Console Edition Radial Quick-Chat Wheel Options
const QUICK_CHAT_WHEEL_OPTIONS = [
    { label: 'Help!', value: 'help', emoji: '🆘', description: 'Quick chat: Help' },
    { label: 'Hello', value: 'hello', emoji: '👋', description: 'Quick chat: Hello' },
    { label: 'Yes / Affirmative', value: 'yes', emoji: '✅', description: 'Quick chat: Yes' },
    { label: 'No / Negative', value: 'no', emoji: '❌', description: 'Quick chat: No' },
    { label: 'Thanks', value: 'thanks', emoji: '🙏', description: 'Quick chat: Thanks' },
    { label: 'Sorry', value: 'sorry', emoji: '🙇', description: 'Quick chat: Sorry' },
    { label: 'Wait / Hold On', value: 'hold', emoji: '⏳', description: 'Quick chat: Hold on' },
    { label: 'Follow Me', value: 'follow', emoji: '👉', description: 'Quick chat: Follow me' },
    { label: 'Cover Me', value: 'cover', emoji: '🛡️', description: 'Quick chat: Cover me' },
    { label: 'Enemies Sighted', value: 'enemies', emoji: '🎯', description: 'Quick chat: Enemies sighted' },
    { label: 'Danger', value: 'danger', emoji: '⚠️', description: 'Quick chat: Danger' },
    { label: 'Need Loot / Resources', value: 'resources', emoji: '💎', description: 'Quick chat: Need resources' },
    { label: 'Base', value: 'base', emoji: '🏠', description: 'Quick chat: Base' },
    { label: 'Loot', value: 'loot', emoji: '🎁', description: 'Quick chat: Loot' },
    { label: 'Nice Shot', value: 'niceshot', emoji: '🔥', description: 'Quick chat: Nice shot' },
    { label: 'Trap', value: 'trap', emoji: '⚡', description: 'Quick chat: Trap' }
];

const buildPanelPayload = async (guildId, messageOverride = '') => {
    if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: null, view: 'main' });
    const session = bindSessions.get(guildId);
    
    const allBinds = await CustomBind.findAll({ where: { guildId }, order: [['id', 'ASC']] });
    let components = [];
    
    const embed = new EmbedBuilder().setColor('#3498db').setTitle('🗣️ Custom Binds & Quick Chat Wheel Manager');
    if (messageOverride) embed.setDescription(`**${messageOverride}**\n\n`);

    if (session.view === 'main') {
        let bindList = '';
        for (const b of allBinds) {
            const typeEmoji = b.actionType === 'kit' ? '📦' : b.actionType === 'teleport' ? '🌀' : '♻️';
            bindList += `${typeEmoji} **${b.name}** [Type: *${b.actionType.toUpperCase()}*] | Wheel: \`${b.emote || 'None'}\` | Cost: ${b.cost || 0} Scrap\n`;
        }

        embed.addFields(
            { name: '📋 Configured Custom Binds', value: bindList || "*No custom binds created yet.*", inline: false },
            { name: '🛠️ Create New Bind', value: "👇 **Click a button below to choose your bind type:**", inline: false }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_create_kit').setLabel('Kit Bind').setStyle(ButtonStyle.Primary).setEmoji('📦'),
            new ButtonBuilder().setCustomId('bind_create_teleport').setLabel('Teleport Bind').setStyle(ButtonStyle.Success).setEmoji('🌀'),
            new ButtonBuilder().setCustomId('bind_create_recycler').setLabel('Recycler Bind').setStyle(ButtonStyle.Secondary).setEmoji('♻️')
        ));

        if (allBinds.length > 0) {
            const row2 = new ActionRowBuilder();
            for (const b of allBinds.slice(0, 4)) {
                row2.addComponents(new ButtonBuilder().setCustomId(`bind_load_${b.id}`).setLabel(b.name.substring(0, 20)).setStyle(ButtonStyle.Secondary).setEmoji('⭐'));
            }
            components.push(row2);
        }
    } 
    else if (session.view === 'bind') {
        const activeBind = await CustomBind.findByPk(session.selectedBindId);
        if (!activeBind) {
            session.view = 'main';
            return await buildPanelPayload(guildId, '❌ Bind not found.');
        }

        const posText = (activeBind.posX && activeBind.posZ) ? `\`X: ${activeBind.posX}, Y: ${activeBind.posY || '0'}, Z: ${activeBind.posZ}\`` : '*Not Set*';

        embed.setTitle(`🗣️ Managing Bind: ${activeBind.name} (${activeBind.actionType.toUpperCase()})`);
        
        embed.addFields(
            { name: `📊 Settings & Requirements`, value: `**Quick Chat Wheel:** ${activeBind.emote || 'Not Set'}\n**Type:** ${activeBind.actionType}\n**Target Kit:** ${activeBind.targetValue || 'N/A'}\n**Coordinates:** ${posText}`, inline: true },
            { name: `🛡️ Economy & Security`, value: `**Cost:** ${activeBind.cost || 0} Scrap\n**Cooldown:** ${activeBind.cooldown || 0}s\n**Required Role ID:** \`${activeBind.roleId || 'None'}\``, inline: true }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_btn_name').setLabel('Rename').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('bind_btn_emote').setLabel('Quick Chat Wheel').setStyle(ButtonStyle.Secondary).setEmoji('💬'),
            new ButtonBuilder().setCustomId('bind_btn_options').setLabel('Cost, CD & Role').setStyle(ButtonStyle.Primary).setEmoji('⚙️')
        ));

        if (activeBind.actionType === 'kit') {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bind_btn_kitselect').setLabel('Select In-Game Kit').setStyle(ButtonStyle.Success).setEmoji('📦')
            ));
        } else if (activeBind.actionType === 'teleport' || activeBind.actionType === 'recycler') {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bind_btn_getpos').setLabel('Set Position (Auto-Capture)').setStyle(ButtonStyle.Success).setEmoji('📍')
            ));
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_btn_delete').setLabel('Delete Bind').setStyle(ButtonStyle.Danger).setEmoji('💀'),
            new ButtonBuilder().setCustomId('bind_btn_back').setLabel('Back to List').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }
    else if (session.view === 'emote_picker') {
        embed.setTitle('💬 Select In-Game Quick Chat Wheel Option').setDescription('Choose which quick-chat wheel phrase triggers this command in-game.');
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('bind_do_emote').setPlaceholder('Select quick chat wheel option...').addOptions(QUICK_CHAT_WHEEL_OPTIONS)
        ));
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_back_bind').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }
    else if (session.view === 'kit_picker') {
        embed.setTitle('📦 Select In-Game Kit').setDescription('Choose which kit this bind will grant to players.');
        const serverKits = await ServerKit.findAll({ where: { guildId } });

        if (serverKits.length > 0) {
            components.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_do_kit').setPlaceholder('Select a server kit...')
                    .addOptions(serverKits.slice(0, 25).map(k => ({ label: k.kitName, value: k.kitName, emoji: '📦' })))
            ));
        } else {
            embed.addFields({ name: '⚠️ No Kits Found', value: 'Please create kits in your kit manager first.' });
        }

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_back_bind').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        ));
    }

    return { embeds: [embed], components, flags: 64 };
};

async function safeRespond(interaction, payload) {
    try {
        if (interaction.isModalSubmit() || interaction.isMessageComponent()) {
            await interaction.update(payload);
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

        if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: null, view: 'main' });
        const session = bindSessions.get(guildId);

        const renderBindPanel = async (inter, messageOverride = '') => {
            const payload = await buildPanelPayload(guildId, messageOverride);
            await safeRespond(inter, payload);
        };

        if (customId === 'admin_menu_select' || customId === 'setup_binds') {
            session.view = 'main';
            return await renderBindPanel(interaction);
        }

        if (customId.startsWith('bind_create_')) {
            const type = customId.replace('bind_create_', '');
            const newBind = await CustomBind.create({ 
                guildId, 
                name: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Bind`, 
                actionType: type, 
                emote: 'Not Set', 
                cost: 0,
                cooldown: 0
            });
            session.selectedBindId = newBind.id;
            session.view = 'bind';
            return await renderBindPanel(interaction, `✨ Created new ${type} bind!`);
        }

        if (customId === 'bind_do_emote' && interaction.isStringSelectMenu()) {
            const wheelOption = QUICK_CHAT_WHEEL_OPTIONS.find(o => o.value === interaction.values[0]);
            const emote = wheelOption ? `${wheelOption.emoji} ${wheelOption.label}` : interaction.values[0];
            await CustomBind.update({ emote, targetValue: interaction.values[0] }, { where: { id: session.selectedBindId } });
            session.view = 'bind';
            return await renderBindPanel(interaction, `💬 Quick chat wheel trigger updated!`);
        }

        if (customId === 'bind_do_kit' && interaction.isStringSelectMenu()) {
            const kitName = interaction.values[0];
            // Standard server plugin kit grant command syntax
            const command = `kit "{player}" "${kitName}"`;
            await CustomBind.update({ targetValue: kitName, command }, { where: { id: session.selectedBindId } });
            session.view = 'bind';
            return await renderBindPanel(interaction, `📦 Bound to kit: **${kitName}**!`);
        }

        if (interaction.isModalSubmit() && customId === 'modal_bind_name') {
            const name = interaction.fields.getTextInputValue('b_name').trim() || "Custom Bind";
            if (session.selectedBindId) {
                await CustomBind.update({ name }, { where: { id: session.selectedBindId } });
            }
            return await renderBindPanel(interaction, `✅ Bind renamed successfully!`);
        }

        if (interaction.isModalSubmit() && customId === 'modal_bind_options') {
            let cost = parseInt(interaction.fields.getTextInputValue('b_cost'));
            let cooldown = parseInt(interaction.fields.getTextInputValue('b_cd'));
            let roleId = interaction.fields.getTextInputValue('b_role').trim() || null;
            if (isNaN(cost) || cost < 0) cost = 0;
            if (isNaN(cooldown) || cooldown < 0) cooldown = 0;
            if (roleId === '' || roleId.toLowerCase() === 'none') roleId = null;

            if (session.selectedBindId) {
                await CustomBind.update({ cost, cooldown, roleId }, { where: { id: session.selectedBindId } });
            }
            return await renderBindPanel(interaction, `⚙️ Options (Cost, Cooldown, Role) saved!`);
        }

        if (interaction.isButton()) {
            if (customId.startsWith('bind_load_')) {
                session.selectedBindId = parseInt(customId.replace('bind_load_', ''));
                session.view = 'bind';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_back' || customId === 'bind_back_bind') {
                session.view = 'bind';
                if (customId === 'bind_btn_back') session.selectedBindId = null;
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_emote') {
                session.view = 'emote_picker';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_kitselect') {
                session.view = 'kit_picker';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_name') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('modal_bind_name').setTitle(`Rename Bind`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_name').setLabel("Bind Name").setStyle(TextInputStyle.Short).setValue(b.name || '').setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_options') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('modal_bind_options').setTitle(`Configure Costs & Security`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cost').setLabel("Scrap Cost (0 for free)").setStyle(TextInputStyle.Short).setValue((b.cost || 0).toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cd').setLabel("Cooldown in Seconds").setStyle(TextInputStyle.Short).setValue((b.cooldown || 0).toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_role').setLabel("Required Discord Role ID (leave blank)").setStyle(TextInputStyle.Short).setValue(b.roleId || '').setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_getpos') {
                const loadingPayload = await buildPanelPayload(guildId, '⏳ **Extracting your position from the server...**');
                await interaction.update(loadingPayload);
                await queueAdminPos(interaction, 'custom_zone', session.selectedBindId);
                return;
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

bindHandler.autoSavePosition = async (guildId, x, y, z, bindId) => {
    if (!bindId) return;
    const bind = await CustomBind.findByPk(bindId);
    if (!bind) return;

    let command = '';
    if (bind.actionType === 'teleport') {
        command = `teleportpos "{player}" "${x},${y},${z}"`;
    } else if (bind.actionType === 'recycler') {
        command = `spawn recycler_static "${x},${y},${z}"`;
    }

    await CustomBind.update({ posX: x, posY: y, posZ: z, command }, { where: { id: bindId } });
};

bindHandler.refreshPanelViaInteraction = async (interaction, messageOverride, bindId = null) => {
    try {
        const guildId = interaction.guild.id;
        if (bindId) {
            if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: bindId, view: 'bind' });
            const session = bindSessions.get(guildId);
            session.selectedBindId = bindId;
            session.view = 'bind';
            bindSessions.set(guildId, session);
        }

        const payload = await buildPanelPayload(guildId, messageOverride);
        await interaction.editReply(payload);
    } catch (e) {
        console.error("Failed to live-refresh Bind panel:", e);
    }
};

module.exports = bindHandler;