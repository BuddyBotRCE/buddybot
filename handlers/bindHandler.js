const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder } = require('discord.js');
const { CustomBind, ServerKit, UserEconomy } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

const bindSessions = new Map();

const RUST_EMOTES = [
    { label: '👋 Wave (gesture wave)', value: 'gesture wave', emoji: '👋' },
    { label: '👍 Thumbs Up (gesture thumbsup)', value: 'gesture thumbsup', emoji: '👍' },
    { label: '👎 Thumbs Down (gesture thumbsdown)', value: 'gesture thumbsdown', emoji: '👎' },
    { label: '👉 Point (gesture point)', value: 'gesture point', emoji: '👉' },
    { label: '🤷 Shrug (gesture shrug)', value: 'gesture shrug', emoji: '🤷' },
    { label: '👌 OK (gesture ok)', value: 'gesture ok', emoji: '👌' },
    { label: '👏 Clap (gesture clap)', value: 'gesture clap', emoji: '👏' },
    { label: '🎉 Victory / Cheer (gesture victory)', value: 'gesture victory', emoji: '🎉' },
    { label: '🪵 Callout: I Need Wood', value: 'chat.say "I need wood!"', emoji: '🪵' },
    { label: '🪨 Callout: I Need Stone', value: 'chat.say "I need stone!"', emoji: '🪨' },
    { label: '⚙️ Callout: I Need Metal', value: 'chat.say "I need metal!"', emoji: '⚙️' },
    { label: '🆘 Callout: Help!', value: 'chat.say "Help!"', emoji: '🆘' },
    { label: '🤝 Callout: Friendly!', value: 'chat.say "Friendly!"', emoji: '🤝' },
    { label: '⬆️ Callout: Danger North', value: 'chat.say "Danger to the North!"', emoji: '⬆️' },
    { label: '💀 Suicide (Instant Respawn)', value: 'kill', emoji: '💀' }
];

const FEATURE_TYPES = {
    kit: { name: '🎁 Kit Bind', desc: 'Give an in-game kit', emoji: '🎁' },
    teleport: { name: '📍 Teleport Bind', desc: 'Teleport to saved coordinates', emoji: '📍' },
    recycler: { name: '♻️ Recycler Bind', desc: 'Spawn portable recycler in front of player', emoji: '♻️' },
    custom: { name: '⚡ Custom Command', desc: 'Run custom RCON command', emoji: '⚡' }
};

const bindHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        if (!bindSessions.has(guildId)) {
            bindSessions.set(guildId, { 
                bindId: null, 
                emote: 'gesture wave', 
                actionType: 'kit', 
                targetValue: '', 
                posX: '', posY: '', posZ: '', 
                name: '', 
                cooldown: 0, 
                cost: 0, 
                roleId: null 
            });
        }
        const session = bindSessions.get(guildId);

        const renderDashboard = async (inter, messageOverride = '') => {
            const allBinds = await CustomBind.findAll({ where: { guildId } });
            
            let listText = allBinds.length === 0 ? '*No custom binds created yet.*' : '';
            for (const b of allBinds) {
                listText += `🎭 **${b.name}** [Trigger: \`${b.emote}\`] | Type: \`${b.actionType}\` | CD: ${b.cooldown}s | Cost: ${b.cost} Scrap\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🔗 In-Game Emote & Bind Manager')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Bind server features (Kits, Teleports, Recyclers) directly to your **Rust Console Edition In-Game Emote / Voice Wheel**!\n\n**Active Binds:**\n${listText}`)
                .setColor('#e67e22');

            let bindOptions = allBinds.map(b => ({ label: b.name, description: `Trigger: ${b.emote} | Type: ${b.actionType}`, value: `edit_bind_${b.id}`, emoji: '📂' }));
            if (bindOptions.length === 0) bindOptions.push({ label: 'No binds available', value: 'none' });

            const row1Load = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_select_existing').setPlaceholder('📂 Select an existing bind to edit...').addOptions(bindOptions.slice(0, 25))
            );

            const row2Create = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_start_create').setLabel('Create New Emote Bind').setStyle(ButtonStyle.Success).setEmoji('✨')
            );

            const payload = { embeds: [embed], components: [row1Load, row2Create], flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        const renderWizard = async (inter, messageOverride = '') => {
            const feat = FEATURE_TYPES[session.actionType] || FEATURE_TYPES.custom;
            const chosenEmote = RUST_EMOTES.find(e => e.value === session.emote) || { label: session.emote, emoji: '🎭' };

            let targetStatus = session.targetValue || 'Not Configured';
            if (session.actionType === 'teleport' || session.actionType === 'recycler') {
                targetStatus = session.posX ? `X: ${session.posX}, Y: ${session.posY}, Z: ${session.posZ}` : '❌ Position Not Set';
            }

            const embed = new EmbedBuilder()
                .setTitle(`🛠️ Bind Builder: ${session.name || 'New Emote Bind'}`)
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Configure your in-game emote trigger and mapped feature below.`)
                .addFields(
                    { name: '1️⃣ Trigger Emote / Wheel', value: `${chosenEmote.emoji} **${chosenEmote.label}**`, inline: true },
                    { name: '2️⃣ Mapped Feature & Target', value: `${feat.emoji} **${feat.name}**\n\`${targetStatus}\``, inline: true },
                    { name: '3️⃣ Rules & Costs', value: `• **Cooldown:** ${session.cooldown}s\n• **Required Role:** ${session.roleId ? `<@&${session.roleId}>` : 'None (Everyone)'}\n• **Scrap Cost:** ${session.cost}`, inline: false }
                )
                .setColor('#3498db');

            // ROW 1: Emote Trigger Dropdown
            const row1Emote = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_emote_select').setPlaceholder(`Trigger: ${chosenEmote.label}`)
                    .addOptions(RUST_EMOTES.slice(0, 25))
            );

            // ROW 2: Feature Type Dropdown
            const row2Feature = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_feature_select').setPlaceholder(`Feature: ${feat.name}`)
                    .addOptions(Object.keys(FEATURE_TYPES).map(k => ({ label: FEATURE_TYPES[k].name, description: FEATURE_TYPES[k].desc, value: k, emoji: FEATURE_TYPES[k].emoji })))
            );

            // ROW 3: Contextual Target/Data (Kit selector or Get Position button)
            let row3Target;
            if (session.actionType === 'kit') {
                const kits = await ServerKit.findAll({ where: { guildId } });
                let kitOpts = kits.map(k => ({ label: k.kitName, value: k.kitName, emoji: '🎁' }));
                if (kitOpts.length === 0) kitOpts.push({ label: 'No kits found in DB', value: 'none' });

                row3Target = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('bind_kit_select').setPlaceholder(session.targetValue ? `Kit: ${session.targetValue}` : '🎁 Select Kit from In-Game Database...').addOptions(kitOpts.slice(0, 25))
                );
            } else if (session.actionType === 'teleport' || session.actionType === 'recycler') {
                row3Target = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_bind_getpos').setLabel(session.posX ? '📍 Position Captured (Update)' : '📍 Get Admin Pos (In-Game)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_bind_manual_target').setLabel('Manual Coordinates').setStyle(ButtonStyle.Secondary).setEmoji('⌨️')
                );
            } else {
                row3Target = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_bind_manual_target').setLabel('Set Custom RCON Command').setStyle(ButtonStyle.Primary).setEmoji('✏️')
                );
            }

            // ROW 4: Settings Buttons (Name, Role, Cooldown, Cost)
            const row4Settings = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_name').setLabel('Name').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_bind_role').setLabel('Role').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
                new ButtonBuilder().setCustomId('btn_bind_cooldown').setLabel('Cooldown').setStyle(ButtonStyle.Secondary).setEmoji('⏱️'),
                new ButtonBuilder().setCustomId('btn_bind_cost').setLabel('Cost').setStyle(ButtonStyle.Secondary).setEmoji('🪙')
            );

            // ROW 5: Save & Cancel
            const row5Action = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_save').setLabel(session.bindId ? 'Update Bind' : 'Save Bind').setStyle(ButtonStyle.Success).setEmoji('💾'),
                new ButtonBuilder().setCustomId('btn_bind_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('✖️')
            );

            const components = [row1Emote, row2Feature, row3Target, row4Settings, row5Action];
            const payload = { embeds: [embed], components, flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        if (customId === 'admin_menu_select' && (selectedValue === 'setup_binds' || selectedValue.includes('bind'))) {
            return await renderDashboard(interaction);
        }

        // --- SELECT MENUS ---
        if (interaction.isStringSelectMenu()) {
            if (customId === 'bind_select_existing') {
                if (selectedValue === 'none') return await interaction.deferUpdate();
                const bind = await CustomBind.findByPk(selectedValue.replace('edit_bind_', ''));
                if (!bind) return await interaction.reply({ content: '❌ Bind not found.', flags: 64 });

                session.bindId = bind.id;
                session.emote = bind.emote;
                session.actionType = bind.actionType;
                session.targetValue = bind.targetValue;
                session.name = bind.name;
                session.cooldown = bind.cooldown;
                session.cost = bind.cost;
                session.roleId = bind.roleId;
                if (bind.targetValue && bind.targetValue.includes(',')) {
                    const parts = bind.targetValue.split(',').map(p => p.trim());
                    session.posX = parts[0]; session.posY = parts[1]; session.posZ = parts[2];
                }
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `📂 Loaded bind: **${bind.name}**`);
            }

            if (customId === 'bind_emote_select') {
                session.emote = selectedValue;
                const found = RUST_EMOTES.find(e => e.value === selectedValue);
                session.name = session.name || (found ? found.label.replace(/^[^\w\s]+\s*/, '') : 'Emote Bind');
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `🎭 Trigger set to **${found?.label || selectedValue}**!`);
            }

            if (customId === 'bind_feature_select') {
                session.actionType = selectedValue;
                session.targetValue = ''; 
                session.posX = ''; session.posY = ''; session.posZ = '';
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `✅ Feature selected: **${FEATURE_TYPES[selectedValue].name}**.`);
            }

            if (customId === 'bind_kit_select') {
                if (selectedValue === 'none') return await interaction.deferUpdate();
                session.targetValue = selectedValue;
                session.name = session.name || `Kit: ${selectedValue}`;
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `🎁 Kit selected: **${selectedValue}**!`);
            }
        }

        if (interaction.isRoleSelectMenu() && customId === 'select_bind_role') {
            session.roleId = interaction.values[0] || null;
            bindSessions.set(guildId, session);
            return await renderWizard(interaction, `🛡️ Role restriction saved!`);
        }

        // --- BUTTONS ---
        if (interaction.isButton()) {
            if (customId === 'btn_bind_start_create') {
                bindSessions.set(guildId, { bindId: null, emote: 'gesture wave', actionType: 'kit', targetValue: '', posX: '', posY: '', posZ: '', name: 'New Bind', cooldown: 0, cost: 0, roleId: null });
                return await renderWizard(interaction);
            }

            if (customId === 'btn_bind_cancel') {
                bindSessions.set(guildId, { step: 'menu' });
                return await renderDashboard(interaction);
            }

            if (customId === 'btn_bind_name') {
                const modal = new ModalBuilder().setCustomId('modal_bind_name').setTitle('Set Bind Name');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_name').setLabel("Bind Name").setStyle(TextInputStyle.Short).setValue(session.name).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_role') {
                const roleMenuRow = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder().setCustomId('select_bind_role').setPlaceholder('Select required role...').setMinValues(0).setMaxValues(1)
                );
                return await interaction.reply({ content: '🛡️ Choose the required Discord role for this bind:', components: [roleMenuRow], flags: 64 });
            }

            if (customId === 'btn_bind_cooldown') {
                const modal = new ModalBuilder().setCustomId('modal_bind_cd').setTitle('Set Cooldown');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cd').setLabel("Cooldown in Seconds").setStyle(TextInputStyle.Short).setValue(session.cooldown.toString()).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_cost') {
                const modal = new ModalBuilder().setCustomId('modal_bind_cost').setTitle('Set Scrap Cost');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cost').setLabel("Cost in Scrap").setStyle(TextInputStyle.Short).setValue(session.cost.toString()).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_getpos') {
                const member = interaction.member;
                const isOwner = interaction.guild.ownerId === interaction.user.id;
                const isAdmin = member.permissions.has('Administrator') || member.permissions.has('ManageGuild');

                if (!isOwner && !isAdmin) {
                    return await interaction.reply({ content: '❌ You must be an Administrator or Server Owner to capture positions.', flags: 64 });
                }

                const userEco = await UserEconomy.findOne({ where: { guildId, userId: interaction.user.id } });
                const inGameName = userEco?.inGameName || interaction.user.username;

                await interaction.reply({ content: `📍 Requesting your position via RCON...`, flags: 64 });
                queueAdminPos(inGameName, guildId, interaction.user.id, interaction.channel.id, 'custom_bind', client);
                return;
            }

            if (customId === 'btn_bind_manual_target') {
                const modal = new ModalBuilder().setCustomId('modal_bind_manual').setTitle('Manual Coordinates / Command');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_target').setLabel("Enter X,Y,Z or Command").setStyle(TextInputStyle.Short).setValue(session.targetValue).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_save') {
                if (!session.name) return await interaction.reply({ content: '❌ Please give your bind a name.', flags: 64 });

                let finalCommand = '';
                if (session.actionType === 'kit') finalCommand = `kit.give {player} ${session.targetValue}`;
                else if (session.actionType === 'teleport') finalCommand = `teleport.pos {player} ${session.targetValue}`;
                else if (session.actionType === 'recycler') finalCommand = `spawn recycler "${session.targetValue}"`;
                else finalCommand = session.targetValue;

                const dbData = {
                    guildId,
                    name: session.name,
                    actionType: session.actionType,
                    targetValue: session.targetValue,
                    command: finalCommand,
                    cooldown: session.cooldown,
                    cost: session.cost,
                    emote: session.emote,
                    roleId: session.roleId
                };

                if (session.bindId) {
                    await CustomBind.update(dbData, { where: { id: session.bindId } });
                } else {
                    await CustomBind.create(dbData);
                }

                bindSessions.set(guildId, { step: 'menu' });
                return await renderDashboard(interaction, `✅ Custom bind **${session.name}** successfully saved!`);
            }
        }

        if (interaction.isModalSubmit()) {
            if (customId === 'modal_bind_name') {
                session.name = interaction.fields.getTextInputValue('b_name').trim();
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `✅ Name set to **${session.name}**!`);
            }
            if (customId === 'modal_bind_cd') {
                session.cooldown = parseInt(interaction.fields.getTextInputValue('b_cd')) || 0;
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `⏱️ Cooldown set to **${session.cooldown}s**!`);
            }
            if (customId === 'modal_bind_cost') {
                session.cost = parseInt(interaction.fields.getTextInputValue('b_cost')) || 0;
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `🪙 Cost set to **${session.cost} Scrap**!`);
            }
            if (customId === 'modal_bind_manual') {
                const val = interaction.fields.getTextInputValue('b_target').trim();
                session.targetValue = val;
                const parts = val.split(',').map(p => p.trim());
                if (parts.length >= 3) {
                    session.posX = parts[0]; session.posY = parts[1]; session.posZ = parts[2];
                }
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `✅ Target/Coordinates saved!`);
            }
        }

    } catch (error) {
        console.error('[BIND HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing custom binds.', flags: 64 }).catch(() => {});
        }
    }
};

bindHandler.autoSavePosition = async (guildId, x, y, z, rot = '') => {
    const session = bindSessions.get(guildId);
    if (!session) return;
    session.posX = x;
    session.posY = y;
    session.posZ = z;
    session.rotation = rot;
    session.targetValue = `${x}, ${y}, ${z}`;
};

bindHandler.bindSessions = bindSessions;
module.exports = bindHandler;