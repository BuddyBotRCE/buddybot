const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { CustomBind } = require('../database/db');
const { queueAdminPos, sendRconCommand } = require('../utils/rconManager'); 

const bindSessions = new Map();

const buildPanelPayload = async (guildId, messageOverride = '') => {
    if (!bindSessions.has(guildId)) bindSessions.set(guildId, { selectedBindId: null, view: 'main', tempPos: null });
    const session = bindSessions.get(guildId);
    
    const allBinds = await CustomBind.findAll({ where: { guildId }, order: [['id', 'ASC']] });
    let components = [];
    
    const embed = new EmbedBuilder().setColor('#3498db').setTitle('🗣️ Custom Binds Manager');
    if (messageOverride) embed.setDescription(`**${messageOverride}**\n\n`);

    if (session.view === 'main') {
        let bindList = '';
        for (const b of allBinds) {
            bindList += `${b.emote || '⭐'} **${b.name}** (Triggers: \`${b.targetValue || b.emote}\`)\n`;
        }

        embed.addFields(
            { name: '📋 Configured Binds', value: bindList || "*No custom binds created yet.*", inline: false },
            { name: '🛠️ Manage Binds', value: "👇 **Click a bind below to edit it, or create a new one.**", inline: false }
        );

        const row1 = new ActionRowBuilder();
        for (const b of allBinds.slice(0, 4)) {
            row1.addComponents(new ButtonBuilder().setCustomId(`bind_load_${b.id}`).setLabel(b.name.substring(0, 20)).setStyle(ButtonStyle.Secondary).setEmoji(b.emote || '⭐'));
        }
        
        row1.addComponents(new ButtonBuilder().setCustomId('bind_create_new').setLabel('➕ Create Bind').setStyle(ButtonStyle.Primary));
        components.push(row1);
    } 
    else if (session.view === 'bind') {
        const activeBind = await CustomBind.findByPk(session.selectedBindId);
        if (!activeBind) {
            session.view = 'main';
            return await buildPanelPayload(guildId, '❌ Custom bind not found.');
        }

        embed.setTitle(`🗣️ Managing Bind: ${activeBind.name}`);
        
        embed.addFields(
            { name: `📊 Bind Configuration`, value: `**Trigger / Emote:** ${activeBind.emote} (\`${activeBind.targetValue || activeBind.emote}\`)\n**Cost:** ${activeBind.cost || 0} Scrap\n**Cooldown:** ${activeBind.cooldown || 0}s`, inline: true },
            { name: `⚙️ RCON Command Executed`, value: `\`\`\`${activeBind.command || 'None'}\`\`\``, inline: false }
        );

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_btn_settings').setLabel('Edit Name & Command').setStyle(ButtonStyle.Primary).setEmoji('📝'),
            new ButtonBuilder().setCustomId('bind_btn_cost').setLabel('Cost & Cooldown').setStyle(ButtonStyle.Secondary).setEmoji('💰')
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bind_btn_test').setLabel('Test Command').setStyle(ButtonStyle.Success).setEmoji('🚀'),
            new ButtonBuilder().setCustomId('bind_btn_delete').setLabel('Delete Bind').setStyle(ButtonStyle.Danger).setEmoji('💀'),
            new ButtonBuilder().setCustomId('bind_btn_back').setLabel('Back to List').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
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

        // --- MODAL SUBMISSIONS ---
        if (interaction.isModalSubmit() && customId === 'modal_bind_settings') {
            const name = interaction.fields.getTextInputValue('bind_name').trim() || "Custom Bind";
            const targetValue = interaction.fields.getTextInputValue('bind_trigger').trim() || "!kit";
            const command = interaction.fields.getTextInputValue('bind_cmd').trim() || "";

            if (session.selectedBindId) {
                await CustomBind.update({ name, targetValue, command }, { where: { id: session.selectedBindId } });
            }
            return await renderBindPanel(interaction, `✅ Custom Bind settings saved!`);
        }

        if (interaction.isModalSubmit() && customId === 'modal_bind_cost') {
            let cost = parseInt(interaction.fields.getTextInputValue('bind_cost'));
            let cooldown = parseInt(interaction.fields.getTextInputValue('bind_cd'));
            if (isNaN(cost) || cost < 0) cost = 0;
            if (isNaN(cooldown) || cooldown < 0) cooldown = 0;

            if (session.selectedBindId) {
                await CustomBind.update({ cost, cooldown }, { where: { id: session.selectedBindId } });
            }
            return await renderBindPanel(interaction, `💰 Cost and Cooldown saved!`);
        }

        // --- BUTTONS ---
        if (interaction.isButton()) {
            if (customId === 'bind_create_new') {
                const newBind = await CustomBind.create({ 
                    guildId, 
                    name: 'New Bind', 
                    emote: '⭐', 
                    targetValue: '!cmd', 
                    command: 'say "Hello World!"',
                    cost: 0,
                    cooldown: 0
                });
                session.selectedBindId = newBind.id;
                session.view = 'bind';
                return await renderBindPanel(interaction, `✨ Created a new custom bind!`);
            }

            if (customId.startsWith('bind_load_')) {
                session.selectedBindId = parseInt(customId.replace('bind_load_', ''));
                session.view = 'bind';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_back') {
                session.selectedZoneId = null;
                session.view = 'main';
                return await renderBindPanel(interaction);
            }

            if (customId === 'bind_btn_settings') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('modal_bind_settings').setTitle(`Edit Bind Details`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bind_name').setLabel("Bind Name").setStyle(TextInputStyle.Short).setValue(b.name || '').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bind_trigger').setLabel("In-game Chat Trigger (e.g. !kit)").setStyle(TextInputStyle.Short).setValue(b.targetValue || '').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bind_cmd').setLabel("RCON Command (Use {player})").setStyle(TextInputStyle.Paragraph).setValue(b.command || '').setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_cost') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                const modal = new ModalBuilder().setCustomId('modal_bind_cost').setTitle(`Edit Cost & Cooldown`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bind_cost').setLabel("Cost in Scrap (0 for free)").setStyle(TextInputStyle.Short).setValue((b.cost || 0).toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bind_cd').setLabel("Cooldown in Seconds (0 for none)").setStyle(TextInputStyle.Short).setValue((b.cooldown || 0).toString()).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'bind_btn_test') {
                const b = await CustomBind.findByPk(session.selectedBindId);
                try {
                    const testCmd = b.command.replace(/{player}/gi, `"${interaction.user.username}"`);
                    await sendRconCommand(guildId, testCmd);
                    return await renderBindPanel(interaction, `🚀 Test command sent to server successfully!`);
                } catch (e) {
                    return await renderBindPanel(interaction, `❌ Failed to execute command. Is RCON connected?`);
                }
            }

            if (customId === 'bind_btn_delete') {
                await CustomBind.destroy({ where: { id: session.selectedBindId } });
                session.selectedBindId = null;
                session.view = 'main';
                return await renderBindPanel(interaction, `💀 Custom Bind deleted.`);
            }
        }

    } catch (error) {
        console.error('[CUSTOM BINDS ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Error processing Custom Binds action.', flags: 64 }).catch(()=>{});
        }
    }
};

// Required for compatibility with RCON position capture if used in commands
bindHandler.autoSavePosition = async (guildId, x, y, z) => {
    // Reserved for position-based custom binds if needed
};

module.exports = bindHandler;