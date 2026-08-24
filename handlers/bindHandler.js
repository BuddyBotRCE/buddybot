const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder } = require('discord.js');
const { CustomBind, ServerKit, UserEconomy } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

const bindSessions = new Map();

const FEATURE_TYPES = {
    kit: { name: '🎁 Kit Bind', desc: 'Give an in-game kit', emoji: '🎁' },
    teleport: { name: '📍 Teleport Bind', desc: 'Teleport to saved coordinates', emoji: '📍' },
    recycler: { name: '♻️ Recycler Bind', desc: 'Spawn portable recycler facing player', emoji: '♻️' },
    emote: { name: '🎭 Rust Emotes & Wheel', desc: 'Trigger in-game gestures or voice wheel callouts', emoji: '🎭' },
    custom: { name: '⚡ Custom Bind', desc: 'Run custom RCON command', emoji: '⚡' }
};

const RUST_EMOTES = [
    { label: '👋 Wave', value: 'gesture wave', emoji: '👋' },
    { label: '👍 Thumbs Up', value: 'gesture thumbsup', emoji: '👍' },
    { label: '👎 Thumbs Down', value: 'gesture thumbsdown', emoji: '👎' },
    { label: '👉 Point', value: 'gesture point', emoji: '👉' },
    { label: '🤷 Shrug', value: 'gesture shrug', emoji: '🤷' },
    { label: '👌 OK', value: 'gesture ok', emoji: '👌' },
    { label: '👏 Clap', value: 'gesture clap', emoji: '👏' },
    { label: '🏃 Hurry', value: 'gesture hurry', emoji: '🏃' },
    { label: '🎉 Victory / Cheer', value: 'gesture victory', emoji: '🎉' },
    { label: '🕺 Dance', value: 'gesture dance', emoji: '🕺' },
    { label: '🙌 Raise the Roof', value: 'gesture raiseroof', emoji: '🙌' },
    { label: '💃 Cabbage Patch', value: 'gesture cabbagepatch', emoji: '💃' },
    { label: '🎶 The Twist', value: 'gesture twist', emoji: '🎶' },
    { label: '😢 Crying / Sad', value: 'gesture cry', emoji: '😢' },
    { label: '🤕 Hurt', value: 'gesture hurt', emoji: '🤕' },
    { label: '😡 Pissed / Angry', value: 'gesture pissed', emoji: '😡' },
    { label: '🤫 Shush', value: 'gesture shush', emoji: '🤫' },
    { label: '👀 Watching You', value: 'gesture watchingyou', emoji: '👀' },
    { label: '🤡 Loser', value: 'gesture loser', emoji: '🤡' },
    { label: '❌ No-No!', value: 'gesture nono', emoji: '❌' },
    { label: '🔪 Cut Throat', value: 'gesture throatcut', emoji: '🔪' },
    { label: '🖐️ Finger Gun', value: 'gesture fingergun', emoji: '🖐️' },
    { label: '🪵 Callout: I Need Wood', value: 'chat.say "I need wood!"', emoji: '🪵' },
    { label: '🪨 Callout: I Need Stone', value: 'chat.say "I need stone!"', emoji: '🪨' },
    { label: '⚙️ Callout: I Need Metal', value: 'chat.say "I need metal!"', emoji: '⚙️' },
    { label: '🆘 Callout: Help!', value: 'chat.say "Help!"', emoji: '🆘' },
    { label: '🤝 Callout: Friendly!', value: 'chat.say "Friendly!"', emoji: '🤝' },
    { label: '⬆️ Callout: Danger North', value: 'chat.say "Danger to the North!"', emoji: '⬆️' },
    { label: '⬇️ Callout: Danger South', value: 'chat.say "Danger to the South!"', emoji: '⬇️' },
    { label: '➡️ Callout: Danger East', value: 'chat.say "Danger to the East!"', emoji: '➡️' },
    { label: '⬅️ Callout: Danger West', value: 'chat.say "Danger to the West!"', emoji: '⬅️' },
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
                posX: '', 
                posY: '', 
                posZ: '', 
                rotation: '',
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
                const info = FEATURE_TYPES[b.actionType] || FEATURE_TYPES.custom;
                listText += `${info.emoji} **${b.name}** [Type: \`${b.actionType}\`] | CD: ${b.cooldown}s\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🔗 Custom Binds Manager')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Select an existing bind to edit, or create a new one below.\n\n**Active Binds:**\n${listText}`)
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

        const renderWizard = async (inter, messageOverride = '') => {
            const feat = FEATURE_TYPES[session.actionType] || FEATURE_TYPES.custom;
            
            let targetStatus = session.targetValue || 'Not Selected';
            if (session.actionType === 'teleport' || session.actionType === 'recycler') {
                targetStatus = session.posX ? `X: ${session.posX}, Y: ${session.posY}, Z: ${session.posZ}` : '❌ Position Not Set';
            }

            const embed = new EmbedBuilder()
                .setTitle(`🛠️ Builder: ${session.name || 'New Bind'}`)
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Configure your bind elements in order below.`)
                .addFields(
                    { name: '1️⃣ Selected Feature', value: `${feat.emoji} **${feat.name}**`, inline: true },
                    { name: '2️⃣ Target / Position / Emote', value: `\`${targetStatus}\``, inline: true },
                    { name: '3️⃣ Rules & Restrictions', value: `• **Cooldown:** ${session.cooldown}s\n• **Required Role:** ${session.roleId ? `<@&${session.roleId}>` : 'None (Everyone)'}\n• **Scrap Cost:** ${session.cost}`, inline: false }
                )
                .setColor('#3498db');

            const row1Feature = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_feature_select').setPlaceholder(`Feature: ${feat.name}`)
                    .addOptions(Object.keys(FEATURE_TYPES).map(k => ({ label: FEATURE_TYPES[k].name, description: FEATURE_TYPES[k].desc, value: k, emoji: FEATURE_TYPES[k].emoji })))
            );

            let row2Target;
            if (session.actionType === 'kit') {
                const kits = await ServerKit.findAll({ where: { guildId } });
                let kitOpts = kits.map(k => ({ label: k.kitName, value: k.kitName, emoji: '🎁' }));
                if (kitOpts.length === 0) kitOpts.push({ label: 'No kits found in DB', value: 'none' });

                row2Target = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('bind_kit_select').setPlaceholder(session.targetValue ? `Kit: ${session.targetValue}` : '🎁 Select Kit from In-Game Database...').addOptions(kitOpts.slice(0, 25))
                );
            } else if (session.actionType === 'emote') {
                row2Target = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('bind_emote_select').setPlaceholder(session.targetValue ? `Emote: ${session.targetValue}` : '🎭 Select Rust Emote or Voice Wheel Option...').addOptions(RUST_EMOTES.slice(0, 25))
                );
            } else if (session.actionType === 'teleport' || session.actionType === 'recycler') {
                row2Target = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_bind_getpos').setLabel(session.posX ? '📍 Position Set (Update)' : '📍 Set Position (Get Admin Pos)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_bind_manual_target').setLabel('Manual Coordinates').setStyle(ButtonStyle.Secondary).setEmoji('⌨️')
                );
            } else {
                row2Target = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_bind_manual_target').setLabel('Set Custom RCON Command').setStyle(ButtonStyle.Primary).setEmoji('✏️')
                );
            }

            const row3Settings = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_name').setLabel('1. Name Bind').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_bind_role').setLabel('2. Select Role').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
                new ButtonBuilder().setCustomId('btn_bind_cooldown').setLabel('3. Set Cooldown').setStyle(ButtonStyle.Secondary).setEmoji('⏱️'),
                new ButtonBuilder().setCustomId('btn_bind_cost').setLabel('Scrap Cost').setStyle(ButtonStyle.Secondary).setEmoji('🪙')
            );

            const row4Action = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_save').setLabel(session.bindId ? 'Update Bind' : 'Save Bind').setStyle(ButtonStyle.Success).setEmoji('💾'),
                new ButtonBuilder().setCustomId('btn_bind_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('✖️')
            );

            const components = [row1Feature, row2Target, row3Settings, row4Action];
            const payload = { embeds: [embed], components, flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        if (customId === 'admin_menu_select' && (selectedValue === 'setup_binds' || selectedValue.includes('bind'))) {
            return await renderDashboard(interaction);
        }

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
                session.roleId = bind.roleId;
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `📂 Loaded bind: **${bind.name}**`);
            }

            if (customId === 'bind_feature_select') {
                session.actionType = selectedValue;
                session.targetValue = ''; 
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

            if (customId === 'bind_emote_select') {
                const found = RUST_EMOTES.find(e => e.value === selectedValue);
                session.targetValue = selectedValue;
                session.name = session.name || (found ? found.label.replace(/^[^\w\s]+\s*/, '') : 'Emote Bind');
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `🎭 Emote / Voice Wheel option selected!`);
            }
        }

        if (interaction.isRoleSelectMenu() && customId === 'select_bind_role') {
            session.roleId = interaction.values[0] || null;
            bindSessions.set(guildId, session);
            return await renderWizard(interaction, `🛡️ Role restriction saved!`);
        }

        if (interaction.isButton()) {
            if (customId === 'btn_bind_start_create') {
                bindSessions.set(guildId, { bindId: null, actionType: 'kit', targetValue: '', rotation: '', posX: '', posY: '', posZ: '', name: 'New Bind', cooldown: 0, cost: 0, roleId: null });
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
                const userEco = await UserEconomy.findOne({ where: { guildId, userId: interaction.user.id } });
                const inGameName = userEco?.inGameName || interaction.user.username;

                await interaction.reply({ content: `📍 Grabbing coordinates for **${inGameName}** from server RCON...`, flags: 64 });
                queueAdminPos(inGameName, guildId, interaction.user.id, interaction.channel.id, 'custom_bind', client);
                return;
            }

            if (customId === 'btn_bind_manual_target') {
                const modal = new ModalBuilder().setCustomId('modal_bind_manual').setTitle('Manual Coordinates');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_target').setLabel("Enter X,Y,Z").setStyle(TextInputStyle.Short).setValue(session.targetValue).setRequired(true)));
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

                const dbData = {
                    guildId,
                    name: session.name,
                    actionType: session.actionType,
                    targetValue: session.targetValue,
                    rotation: session.rotation,
                    command: finalCommand,
                    cooldown: session.cooldown,
                    cost: session.cost,
                    emote: FEATURE_TYPES[session.actionType]?.emoji || '⭐',
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
                return await renderWizard(interaction, `✅ Bind name set to **${session.name}**!`);
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
                return await renderWizard(interaction, `✅ Coordinates saved!`);
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