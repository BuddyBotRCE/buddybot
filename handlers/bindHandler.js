const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder } = require('discord.js');
const { CustomBind, ServerKit, UserEconomy } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

const bindSessions = new Map();

const ACTION_TYPES = {
    kit: { name: '🎁 Kit Bind', desc: 'Gives a player a server kit', emoji: '🎁' },
    teleport: { name: '📍 Teleport Bind', desc: 'Teleports player to saved coordinates', emoji: '📍' },
    recycler: { name: '♻️ Portable Recycler', desc: 'Spawns a recycler facing player view', emoji: '♻️' },
    emote: { name: '🎭 Rust Emotes & Wheel', desc: 'Triggers in-game gestures or voice callouts', emoji: '🎭' },
    custom: { name: '⚡ Custom RCON', desc: 'Fires a raw custom server command', emoji: '⚡' }
};

const RUST_EMOTES = [
    // --- CATEGORY 1: BASIC GESTURES ---
    { label: '👋 Wave', value: 'gesture wave', emoji: '👋' },
    { label: '👍 Thumbs Up', value: 'gesture thumbsup', emoji: '👍' },
    { label: '👎 Thumbs Down', value: 'gesture thumbsdown', emoji: '👎' },
    { label: '👉 Point', value: 'gesture point', emoji: '👉' },
    { label: '🤷 Shrug', value: 'gesture shrug', emoji: '🤷' },
    { label: 'ok OK', value: 'gesture ok', emoji: '👌' },
    { label: '👏 Clap', value: 'gesture clap', emoji: '👏' },
    { label: '🏃 Hurry', value: 'gesture hurry', emoji: '🏃' },

    // --- CATEGORY 2: DANCE & CELEBRATION ---
    { label: '🎉 Victory / Cheer', value: 'gesture victory', emoji: '🎉' },
    { label: '🕺 Dance', value: 'gesture dance', emoji: '🕺' },
    { label: '🙌 Raise the Roof', value: 'gesture raiseroof', emoji: '🙌' },
    { label: '💃 Cabbage Patch', value: 'gesture cabbagepatch', emoji: '💃' },
    { label: '🎶 The Twist', value: 'gesture twist', emoji: '🎶' },

    // --- CATEGORY 3: TAUNTS & REACTIONS ---
    { label: '😢 Crying / Sad', value: 'gesture cry', emoji: '😢' },
    { label: '🤕 Hurt', value: 'gesture hurt', emoji: '🤕' },
    { label: '😡 Pissed / Angry', value: 'gesture pissed', emoji: '😡' },
    { label: '🤫 Shush', value: 'gesture shush', emoji: '🤫' },
    { label: '👀 Watching You', value: 'gesture watchingyou', emoji: '👀' },
    { label: '🤡 Loser', value: 'gesture loser', emoji: '🤡' },
    { label: '❌ No-No!', value: 'gesture nono', emoji: '❌' },
    { label: '🔪 Cut Throat', value: 'gesture throatcut', emoji: '🔪' },
    { label: '🖐️ Finger Gun', value: 'gesture fingergun', emoji: '🖐️' },

    // --- CATEGORY 4: TACTICAL / VOICE CALLOUTS ---
    { label: '🪵 Callout: I Need Wood', value: 'chat.say "I need wood!"', emoji: '🪵' },
    { label: '🪨 Callout: I Need Stone', value: 'chat.say "I need stone!"', emoji: '🪨' },
    { label: '⚙️ Callout: I Need Metal', value: 'chat.say "I need metal!"', emoji: '⚙️' },
    { label: '🆘 Callout: Help!', value: 'chat.say "Help!"', emoji: '🆘' },
    { label: '🤝 Callout: Friendly!', value: 'chat.say "Friendly!"', emoji: '🤝' },
    { label: '⬆️ Callout: Danger North', value: 'chat.say "Danger to the North!"', emoji: '⬆️' },
    { label: '⬇️ Callout: Danger South', value: 'chat.say "Danger to the South!"', emoji: '⬇️' },
    { label: '➡️ Callout: Danger East', value: 'chat.say "Danger to the East!"', emoji: '➡️' },
    { label: '⬅️ Callout: Danger West', value: 'chat.say "Danger to the West!"', emoji: '⬅️' },
    
    // --- CATEGORY 5: UTILITY ---
    { label: '💀 Suicide (Instant Respawn)', value: 'kill', emoji: '💀' },
    { label: '✂️ Rock Paper Scissors', value: 'gesture rps', emoji: '✂️' }
];

const bindHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        if (!bindSessions.has(guildId)) {
            bindSessions.set(guildId, { 
                bindId: null, 
                actionType: 'kit', 
                targetValue: '', 
                rotation: '', 
                posX: '', 
                posY: '', 
                posZ: '', 
                name: '', 
                cooldown: 0, 
                cost: 0, 
                roleId: null 
            });
        }
        const session = bindSessions.get(guildId);

        // --- RENDER MAIN DASHBOARD ---
        const renderDashboard = async (inter, messageOverride = '') => {
            const allBinds = await CustomBind.findAll({ where: { guildId } });
            
            let listText = allBinds.length === 0 ? '*No custom binds created yet.*' : '';
            for (const b of allBinds) {
                const info = ACTION_TYPES[b.actionType] || ACTION_TYPES.custom;
                listText += `${info.emoji} **${b.name}** [Type: \`${b.actionType}\`] | CD: ${b.cooldown}s | Cost: ${b.cost}\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🔗 Custom Binds Manager')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Manage interactive binds for Kits, Teleports, Recyclers, and Emotes.\n\n**Active Binds:**\n${listText}`)
                .setColor('#e67e22');

            let bindOptions = allBinds.map(b => ({ label: b.name, description: `Type: ${b.actionType} | CD: ${b.cooldown}s`, value: `edit_bind_${b.id}`, emoji: '📂' }));
            if (bindOptions.length === 0) bindOptions.push({ label: 'No binds available', value: 'none' });

            const row1Load = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_select_existing').setPlaceholder('📂 Select an existing bind to edit...').addOptions(bindOptions.slice(0, 25))
            );

            const row2Create = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_start_create').setLabel('Create New Custom Bind').setStyle(ButtonStyle.Success).setEmoji('✨')
            );

            const payload = { embeds: [embed], components: [row1Load, row2Create], flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        // --- RENDER ORGANIZED BUILDER WIZARD ---
        const renderWizard = async (inter, messageOverride = '') => {
            const actInfo = ACTION_TYPES[session.actionType] || ACTION_TYPES.custom;
            
            let targetDisplay = session.targetValue || 'Not Configured';
            if (session.actionType === 'teleport' || session.actionType === 'recycler') {
                targetDisplay = session.posX ? `X: ${session.posX}, Y: ${session.posY}, Z: ${session.posZ}` : 'No Position Set';
            }

            const embed = new EmbedBuilder()
                .setTitle(`🛠️ Configuring: ${session.name || 'New Custom Bind'}`)
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Configure your bind step-by-step using the options below.`)
                .addFields(
                    { name: '1️⃣ Action Type', value: `${actInfo.emoji} **${actInfo.name}**`, inline: true },
                    { name: '2️⃣ Target / Data', value: `\`${targetDisplay}\``, inline: true },
                    { name: '⚙️ Settings Overview', value: `• **Cooldown:** ${session.cooldown}s\n• **Cost:** ${session.cost} Scrap\n• **Role Restriction:** ${session.roleId ? `<@&${session.roleId}>` : 'None (Everyone)'}`, inline: false }
                )
                .setColor('#3498db');

            // ROW 1: Change Action Type
            const row1Type = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_type_select').setPlaceholder(`Action: ${actInfo.name}`)
                    .addOptions(Object.keys(ACTION_TYPES).map(k => ({ label: ACTION_TYPES[k].name, description: ACTION_TYPES[k].desc, value: k, emoji: ACTION_TYPES[k].emoji })))
            );

            // ROW 2: Contextual Target Selector
            let row2Target;
            if (session.actionType === 'kit') {
                const kits = await ServerKit.findAll({ where: { guildId } });
                let kitOpts = kits.map(k => ({ label: k.kitName, value: k.kitName, emoji: '🎁' }));
                if (kitOpts.length === 0) kitOpts.push({ label: 'No kits found in DB', value: 'none' });

                row2Target = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('bind_kit_select').setPlaceholder(session.targetValue ? `Kit: ${session.targetValue}` : '🎁 Select Server Kit...').addOptions(kitOpts.slice(0, 25))
                );
            } else if (session.actionType === 'emote') {
                row2Target = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('bind_emote_select').setPlaceholder(session.targetValue ? `Emote: ${session.targetValue}` : '🎭 Select Rust Emote or Voice option...').addOptions(RUST_EMOTES.slice(0, 25))
                );
            } else if (session.actionType === 'teleport' || session.actionType === 'recycler') {
                row2Target = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_bind_getpos').setLabel(session.posX ? '📍 Position Captured (Update)' : '📍 Set Position (Get Admin Pos)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_bind_manual_target').setLabel('Manual Coordinates').setStyle(ButtonStyle.Secondary).setEmoji('⌨️')
                );
            } else {
                row2Target = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_bind_manual_target').setLabel('Set Custom Command').setStyle(ButtonStyle.Primary).setEmoji('✏️')
                );
            }

            // ROW 3: Parameter Configuration (Name, Cooldown, Cost)
            const row3Config = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_settings').setLabel('Edit Name').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_bind_cooldown').setLabel('Add Cooldown').setStyle(ButtonStyle.Secondary).setEmoji('⏱️'),
                new ButtonBuilder().setCustomId('btn_bind_cost').setLabel('Set Scrap Cost').setStyle(ButtonStyle.Secondary).setEmoji('🪙')
            );

            // ROW 4: Role Restriction & Save/Cancel
            const row4Save = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_role').setLabel('Select Role Restriction').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
                new ButtonBuilder().setCustomId('btn_bind_save').setLabel(session.bindId ? 'Update Bind' : 'Save Bind').setStyle(ButtonStyle.Success).setEmoji('💾'),
                new ButtonBuilder().setCustomId('btn_bind_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('✖️')
            );

            const components = [row1Type, row2Target, row3Config, row4Save];
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
                session.actionType = bind.actionType;
                session.targetValue = bind.targetValue;
                session.name = bind.name;
                session.cooldown = bind.cooldown;
                session.cost = bind.cost;
                session.emote = bind.emote || '⭐';
                session.roleId = bind.roleId;
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `📂 Loaded bind: **${bind.name}**`);
            }

            if (customId === 'bind_type_select') {
                session.actionType = selectedValue;
                session.targetValue = ''; 
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `✅ Action type changed to **${selectedValue.toUpperCase()}**.`);
            }

            if (customId === 'bind_kit_select') {
                if (selectedValue === 'none') return await interaction.deferUpdate();
                session.targetValue = selectedValue;
                session.name = session.name || `Kit: ${selectedValue}`;
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `🎁 Target kit set to **${selectedValue}**!`);
            }

            if (customId === 'bind_emote_select') {
                const found = RUST_EMOTES.find(e => e.value === selectedValue);
                session.targetValue = selectedValue;
                session.name = session.name || (found ? found.label.replace(/^[^\w\s]+\s*/, '') : 'Emote Bind');
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `🎭 Emote set to **${found?.label || selectedValue}**!`);
            }
        }

        if (interaction.isRoleSelectMenu() && customId === 'select_bind_role') {
            session.roleId = interaction.values[0] || null;
            bindSessions.set(guildId, session);
            return await renderWizard(interaction, `🛡️ Required role updated successfully!`);
        }

        // --- BUTTONS ---
        if (interaction.isButton()) {
            if (customId === 'btn_bind_start_create') {
                bindSessions.set(guildId, { bindId: null, actionType: 'kit', targetValue: '', rotation: '', posX: '', posY: '', posZ: '', name: 'New Bind', cooldown: 0, cost: 0, roleId: null });
                return await renderWizard(interaction);
            }

            if (customId === 'btn_bind_cancel') {
                bindSessions.set(guildId, { step: 'menu' });
                return await renderDashboard(interaction);
            }

            if (customId === 'btn_bind_settings') {
                const modal = new ModalBuilder().setCustomId('modal_bind_name').setTitle('Bind Name');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_name').setLabel("Bind Name").setStyle(TextInputStyle.Short).setValue(session.name).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_cooldown') {
                const modal = new ModalBuilder().setCustomId('modal_bind_cd').setTitle('Configure Cooldown');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cd').setLabel("Cooldown in Seconds").setStyle(TextInputStyle.Short).setValue(session.cooldown.toString()).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_cost') {
                const modal = new ModalBuilder().setCustomId('modal_bind_cost').setTitle('Configure Cost');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cost').setLabel("Cost in Scrap").setStyle(TextInputStyle.Short).setValue(session.cost.toString()).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_role') {
                const roleMenuRow = new ActionRowBuilder().addComponents(
                    new RoleSelectMenuBuilder().setCustomId('select_bind_role').setPlaceholder('Select required role for this bind...').setMinValues(0).setMaxValues(1)
                );
                return await interaction.reply({ content: '🛡️ Please select the required role from the dropdown below:', components: [roleMenuRow], flags: 64 });
            }

            if (customId === 'btn_bind_getpos') {
                const userEco = await UserEconomy.findOne({ where: { guildId, userId: interaction.user.id } });
                const inGameName = userEco?.inGameName || interaction.user.username;

                await interaction.reply({ content: `📍 Requesting position for **${inGameName}** from server RCON...`, flags: 64 });
                queueAdminPos(inGameName, guildId, interaction.user.id, interaction.channel.id, 'custom_bind', client);
                return;
            }

            if (customId === 'btn_bind_manual_target') {
                const modal = new ModalBuilder().setCustomId('modal_bind_manual').setTitle('Manual Target / Coordinates');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_target').setLabel("Coordinates or Command Value").setStyle(TextInputStyle.Paragraph).setValue(session.targetValue).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_save') {
                if (!session.name) return await interaction.reply({ content: '❌ Please give your bind a name.', flags: 64 });

                let finalCommand = '';
                if (session.actionType === 'kit') finalCommand = `kit.give {player} ${session.targetValue}`;
                else if (session.actionType === 'teleport') finalCommand = `teleport.pos {player} ${session.posX} ${session.posY} ${session.posZ}`;
                else if (session.actionType === 'recycler') finalCommand = `spawn recycler "${session.posX},${session.posY},${session.posZ}"`;
                else if (session.actionType === 'emote') finalCommand = session.targetValue;
                else finalCommand = session.targetValue;

                const assignedEmoji = ACTION_TYPES[session.actionType]?.emoji || '⭐';

                const dbData = {
                    guildId,
                    name: session.name,
                    actionType: session.actionType,
                    targetValue: session.targetValue,
                    rotation: session.rotation,
                    command: finalCommand,
                    cooldown: session.cooldown,
                    cost: session.cost,
                    emote: assignedEmoji,
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

        // --- MODAL SUBMISSIONS ---
        if (interaction.isModalSubmit()) {
            if (customId === 'modal_bind_name') {
                session.name = interaction.fields.getTextInputValue('b_name').trim();
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `✅ Name updated!`);
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
                session.targetValue = interaction.fields.getTextInputValue('b_target').trim();
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `✅ Target coordinates/command saved!`);
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