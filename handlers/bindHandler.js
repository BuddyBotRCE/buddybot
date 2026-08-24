const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { CustomBind, ServerKit } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

const bindSessions = new Map();

const ACTION_TYPES = {
    kit: { name: '🎁 Kit Bind', desc: 'Gives a player a server kit', emoji: '🎁' },
    teleport: { name: '📍 Teleport Bind', desc: 'Teleports player to saved coordinates', emoji: '📍' },
    recycler: { name: '♻️ Portable Recycler', desc: 'Spawns a recycler facing player view', emoji: '♻️' },
    emote: { name: '🎭 Rust Emote / Voice Wheel', desc: 'Triggers an in-game emote or wheel option', emoji: '🎭' },
    custom: { name: '⚡ Custom RCON', desc: 'Fires a raw custom server command', emoji: '⚡' }
};

// Official Rust Emote Wheel Options & Voice/Gesture commands
const RUST_EMOTES = [
    { label: 'Wave', value: 'gesture wave', emoji: '👋', desc: 'Wave hello' },
    { label: 'Thumbs Up', value: 'gesture thumbsup', emoji: '👍', desc: 'Approve or agree' },
    { label: 'Thumbs Down', value: 'gesture thumbsdown', emoji: '👎', desc: 'Disapprove' },
    { label: 'Point', value: 'gesture point', emoji: '👉', desc: 'Point forward' },
    { label: 'Shrug', value: 'gesture shrug', emoji: '🤷', desc: 'Shrug shoulders' },
    { label: 'Victory / Cheer', value: 'gesture victory', emoji: '🎉', desc: 'Celebrate' },
    { label: 'Crying / Sad', value: 'gesture cry', emoji: '😢', desc: 'Cry' },
    { label: 'Hurt', value: 'gesture hurt', emoji: '🤕', desc: 'Act injured' },
    { label: 'Suicide (Respawn)', value: 'kill', emoji: '💀', desc: 'Instantly respawn' },
    { label: 'Voice: I Need Wood', value: 'chat.say "I need wood!"', emoji: '🪵', desc: 'Quick voice callout' },
    { label: 'Voice: I Need Stone', value: 'chat.say "I need stone!"', emoji: '🪨', desc: 'Quick voice callout' },
    { label: 'Voice: I Need Metal', value: 'chat.say "I need metal!"', emoji: '⚙️', desc: 'Quick voice callout' },
    { label: 'Voice: Help!', value: 'chat.say "Help!"', emoji: '🆘', desc: 'Call for backup' },
    { label: 'Voice: Friendly!', value: 'chat.say "Friendly!"', emoji: '🤝', desc: 'Declare friendly' },
    { label: 'Voice: Danger / North!', value: 'chat.say "Danger to the North!"', emoji: '⬆️', desc: 'Directional callout' },
    { label: 'Voice: Danger / South!', value: 'chat.say "Danger to the South!"', emoji: '⬇️', desc: 'Directional callout' },
    { label: 'Voice: Danger / East!', value: 'chat.say "Danger to the East!"', emoji: '➡️', desc: 'Directional callout' },
    { label: 'Voice: Danger / West!', value: 'chat.say "Danger to the West!"', emoji: '⬅️', desc: 'Directional callout' }
];

const bindHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- INITIALIZE SESSION ---
        if (!bindSessions.has(guildId)) {
            bindSessions.set(guildId, { step: 'menu', bindId: null, actionType: 'kit', targetValue: '', rotation: '', posX: '', posY: '', posZ: '', name: '', cooldown: 0, cost: 0, emote: '⭐' });
        }
        const session = bindSessions.get(guildId);

        // --- RENDER MAIN DASHBOARD ---
        const renderDashboard = async (inter, messageOverride = '') => {
            const allBinds = await CustomBind.findAll({ where: { guildId } });
            
            let listText = allBinds.length === 0 ? '*No custom binds created yet.*' : '';
            for (const b of allBinds) {
                const info = ACTION_TYPES[b.actionType] || ACTION_TYPES.custom;
                listText += `${info.emoji} **${b.name}** [Type: \`${b.actionType}\`] | Cooldown: ${b.cooldown}s | Cost: ${b.cost}\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🔗 Custom Binds Manager')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Create and manage interactive binds for Kits, Teleports, Recyclers, Emote/Voice Wheels, and Custom RCON commands.\n\n**Active Binds:**\n${listText}`)
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

        // --- RENDER CREATION / EDIT WIZARD ---
        const renderWizard = async (inter, messageOverride = '') => {
            const embed = new EmbedBuilder()
                .setTitle('🛠️ Custom Bind Builder Wizard')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Configure your bind parameters below before saving.`)
                .addFields(
                    { name: '1️⃣ Action Type', value: `${ACTION_TYPES[session.actionType]?.emoji || '⭐'} **${session.actionType.toUpperCase()}**`, inline: true },
                    { name: '2️⃣ Target / Data', value: `\`${session.targetValue || 'Not Set'}\``, inline: true },
                    { name: '3️⃣ Emote & Settings', value: `• Name: **${session.name || 'Unnamed'}**\n• Emote Icon: ${session.emote}\n• Cooldown: ${session.cooldown}s | Cost: ${session.cost} Scrap`, inline: false }
                )
                .setColor('#3498db');

            // ROW 1: Choose Action Type Dropdown
            const row1Type = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_type_select').setPlaceholder(`Action: ${ACTION_TYPES[session.actionType].name}`)
                    .addOptions(Object.keys(ACTION_TYPES).map(k => ({ label: ACTION_TYPES[k].name, description: ACTION_TYPES[k].desc, value: k, emoji: ACTION_TYPES[k].emoji })))
            );

            // ROW 2: Dynamic Target Config (Kit Dropdown, Emote Wheel Dropdown, or Position Buttons)
            let row2Target;
            if (session.actionType === 'kit') {
                const kits = await ServerKit.findAll({ where: { guildId } });
                let kitOpts = kits.map(k => ({ label: k.kitName, value: k.kitName, emoji: '🎁' }));
                if (kitOpts.length === 0) kitOpts.push({ label: 'No kits found in DB', value: 'none' });

                row2Target = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('bind_kit_select').setPlaceholder(session.targetValue ? `Selected Kit: ${session.targetValue}` : '🎁 Select Server Kit...').addOptions(kitOpts.slice(0, 25))
                );
            } else if (session.actionType === 'emote') {
                row2Target = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('bind_emote_select').setPlaceholder(session.targetValue ? `Selected Emote/Voice: ${session.targetValue}` : '🎭 Select Rust Emote or Voice option...').addOptions(RUST_EMOTES.slice(0, 25))
                );
            } else if (session.actionType === 'teleport' || session.actionType === 'recycler') {
                row2Target = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_bind_getpos').setLabel(session.posX ? '📍 Position Captured (Update)' : '📍 Get Admin Pos & View Angle').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_bind_manual_target').setLabel('Manual RCON Command').setStyle(ButtonStyle.Secondary).setEmoji('⌨️')
                );
            } else {
                row2Target = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_bind_manual_target').setLabel('Set Custom Command / Value').setStyle(ButtonStyle.Primary).setEmoji('✏️')
                );
            }

            // ROW 3: General Settings (Name, Cooldown, Cost, Emote Icon)
            const row3Settings = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_settings').setLabel('Set Name, CD & Cost').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
            );

            // ROW 4: Save / Cancel
            const row4Action = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_bind_save').setLabel(session.bindId ? 'Update Bind' : 'Save & Create Bind').setStyle(ButtonStyle.Success).setEmoji('💾'),
                new ButtonBuilder().setCustomId('btn_bind_cancel').setLabel('Cancel / Back').setStyle(ButtonStyle.Danger).setEmoji('✖️')
            );

            const components = [row1Type, row2Target, row3Settings, row4Action];
            const payload = { embeds: [embed], components, flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        // --- ENTRY FROM ADMIN PANEL ---
        if (customId === 'admin_menu_select' && (selectedValue === 'setup_binds' || selectedValue.includes('bind'))) {
            return await renderDashboard(interaction);
        }

        // --- DROPDOWN HANDLERS ---
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
                session.emote = bind.emote;
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
                session.name = session.name || (found ? found.label : 'Emote Bind');
                session.emote = found ? found.emoji : '🎭';
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `🎭 Emote / Voice bind set to **${found?.label || selectedValue}**!`);
            }
        }

        // --- BUTTON HANDLERS ---
        if (interaction.isButton()) {
            if (customId === 'btn_bind_start_create') {
                bindSessions.set(guildId, { step: 'wizard', bindId: null, actionType: 'kit', targetValue: '', rotation: '', posX: '', posY: '', posZ: '', name: 'New Bind', cooldown: 0, cost: 0, emote: '⭐' });
                return await renderWizard(interaction);
            }

            if (customId === 'btn_bind_cancel') {
                bindSessions.set(guildId, { step: 'menu' });
                return await renderDashboard(interaction);
            }

            if (customId === 'btn_bind_settings') {
                const modal = new ModalBuilder().setCustomId('modal_bind_settings').setTitle('Bind Configuration');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_name').setLabel("Bind Name").setStyle(TextInputStyle.Short).setValue(session.name).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cd').setLabel("Cooldown (Seconds)").setStyle(TextInputStyle.Short).setValue(session.cooldown.toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_cost').setLabel("Cost in Scrap").setStyle(TextInputStyle.Short).setValue(session.cost.toString()).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_emote').setLabel("Emote Icon / Emoji").setStyle(TextInputStyle.Short).setValue(session.emote).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_getpos') {
                if (typeof queueAdminPos === 'function') {
                    await queueAdminPos(interaction);
                    return;
                } else return await interaction.reply({ content: '❌ `queueAdminPos` missing.', flags: 64 });
            }

            if (customId === 'btn_bind_manual_target') {
                const modal = new ModalBuilder().setCustomId('modal_bind_manual').setTitle('Manual Command / Target');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_target').setLabel("Target Value or Command").setStyle(TextInputStyle.Paragraph).setValue(session.targetValue).setRequired(true)));
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_bind_save') {
                if (!session.name) return await interaction.reply({ content: '❌ Please give your bind a name.', flags: 64 });

                let finalCommand = '';
                if (session.actionType === 'kit') finalCommand = `kit.give ${session.targetValue}`;
                else if (session.actionType === 'teleport') finalCommand = `teleport.pos ${session.posX} ${session.posY} ${session.posZ}`;
                else if (session.actionType === 'recycler') finalCommand = `spawn recycler "${session.posX},${session.posY},${session.posZ}"`;
                else if (session.actionType === 'emote') finalCommand = session.targetValue; // Executes gesture or chat callout natively
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
                    emote: session.emote
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
            if (customId === 'modal_bind_settings') {
                session.name = interaction.fields.getTextInputValue('b_name').trim();
                session.cooldown = parseInt(interaction.fields.getTextInputValue('b_cd')) || 0;
                session.cost = parseInt(interaction.fields.getTextInputValue('b_cost')) || 0;
                session.emote = interaction.fields.getTextInputValue('b_emote').trim() || '⭐';
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `✅ Settings updated!`);
            }
            if (customId === 'modal_bind_manual') {
                session.targetValue = interaction.fields.getTextInputValue('b_target').trim();
                bindSessions.set(guildId, session);
                return await renderWizard(interaction, `✅ Target value saved!`);
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