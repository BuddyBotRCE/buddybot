const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { CustomBind, UserEconomy, ServerKit } = require('../database/db');
const { sendRconCommand, queueAdminPos } = require('../utils/rconManager');

const RUST_EMOTES = [
    { label: 'I need wood', value: 'i need wood', emoji: '🪵' }, { label: 'I need stone', value: 'i need stone', emoji: '🪨' },
    { label: 'I need metal', value: 'i need metal', emoji: '⚙️' }, { label: 'I need cloth', value: 'i need cloth', emoji: '🧵' },
    { label: 'I need ammo', value: 'i need ammo', emoji: '🔫' }, { label: 'I need a weapon', value: 'i need a weapon', emoji: '⚔️' },
    { label: 'I need meds', value: 'i need meds', emoji: '💉' }, { label: 'I need food', value: 'i need food', emoji: '🍖' },
    { label: 'I need water', value: 'i need water', emoji: '💧' }, { label: 'Can I have a key', value: 'can i have a key', emoji: '🔑' },
    { label: 'Follow me', value: 'follow me', emoji: '🏃' }, { label: 'Enemies spotted', value: 'enemies spotted', emoji: '🎯' },
    { label: 'Friendly', value: 'friendly', emoji: '🏳️' }, { label: 'Run!', value: 'run', emoji: '💨' },
    { label: 'Retreat', value: 'retreat', emoji: '🔙' }, { label: 'I am looting', value: 'i am looting', emoji: '🎒' },
    { label: 'I am building', value: 'i am building', emoji: '🔨' }, { label: 'I am farming', value: 'i am farming', emoji: '⛏️' },
    { label: 'Hello', value: 'hello', emoji: '👋' }, { label: 'Thanks', value: 'thanks', emoji: '🤝' },
    { label: 'Sorry', value: 'sorry', emoji: '🥺' }, { label: 'Help', value: 'help', emoji: '🆘' },
    { label: 'Yes', value: 'yes', emoji: '✅' }, { label: 'No', value: 'no', emoji: '❌' }
];

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (customId === 'admin_menu_select' && selectedValue === 'setup_binds') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_bind_add').setLabel('Add Bind').setStyle(ButtonStyle.Success), 
            new ButtonBuilder().setCustomId('btn_bind_remove').setLabel('Remove Bind').setStyle(ButtonStyle.Danger), 
            new ButtonBuilder().setCustomId('btn_bind_list').setLabel('List Binds').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ content: '🗣️ Custom Binds Manager', components: [row], flags: 64 });
    }

    if (interaction.isRoleSelectMenu() && customId.startsWith('bind_role_menu_')) {
        const bindId = customId.split('_')[3];
        await CustomBind.update({ roleId: interaction.values[0] }, { where: { id: bindId } });
        return interaction.update({ content: `✅ Bind finalized!`, components: [] });
    }

    if (interaction.isButton()) {
        if (customId === 'btn_bind_add') {
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('bind_template_select').setPlaceholder('Select Bind Type...').addOptions([{ label: '🎁 Give Kit', value: 'tpl_kit' }, { label: '🛡️ Setup ORP Base', value: 'tpl_orp' }, { label: '📍 Teleport Hub', value: 'tpl_tp' }, { label: '♻️ Spawn Recycler', value: 'tpl_recycler' }, { label: '⚡ Custom Command', value: 'tpl_custom' }]));
            return interaction.reply({ content: 'What kind of bind?', components: [row], flags: 64 });
        }
        if (customId === 'btn_bind_remove') {
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('remove_bind_select').setPlaceholder('Select Quick-Chat phrase...').addOptions(RUST_EMOTES));
            return interaction.reply({ content: '🗣️ Which bind do you want to remove?', components: [row], flags: 64 });
        }
        if (customId === 'btn_bind_list') {
            const binds = await CustomBind.findAll({ where: { guildId: interaction.guild.id } });
            if (binds.length === 0) return interaction.reply({ content: 'No custom binds set.', flags: 64 });
            let list = ''; binds.forEach(b => list += `🗣️ **"${b.emote}"**\n🛠️ \`${b.command.replace(/\n/g, ', ')}\`\n⏱️ CD: ${b.cooldown}s | 💰 Cost: ${b.cost}\n\n`);
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔗 Active Binds').setDescription(list).setColor('#00ff00')], flags: 64 });
        }
        if (customId.startsWith('btn_finalize_tpl_') && !customId.includes('pvezone') && !customId.includes('aeslot')) {
            await interaction.message.delete().catch(() => {});
            const parts = customId.split('_'); const type = parts[3]; 
            if (type === 'orp') {
                await sendRconCommand(interaction.guild.id, `say "Offline Raid Protection has been setup at ${parts[4]},${parts[5]},${parts[6]}!"`);
                return interaction.reply({ content: `✅ ORP setup completed.`, flags: 64 });
            }
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`bind_emote_${type}_${parts[4]}_${parts[5]}_${parts[6]}`).setPlaceholder('Select Quick-Chat...').addOptions(RUST_EMOTES));
            return interaction.reply({ content: `🗣️ **Step 2:** Which Quick-Chat triggers this ${type}?`, components: [row], flags: 64 });
        }
        if (customId === 'btn_dismiss_coord') {
            await interaction.message.delete().catch(() => {});
            return interaction.reply({ content: '❌ Coordinate prompt dismissed.', flags: 64 });
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (customId === 'bind_template_select') {
            if (selectedValue === 'tpl_kit') {
                const kits = await ServerKit.findAll({ where: { guildId: interaction.guild.id } });
                if (kits.length === 0) return interaction.reply({ content: '❌ Create a Kit first!', flags: 64 });
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('bind_kit_select').setPlaceholder('Select Kit...').addOptions(kits.map(k => ({ label: k.kitName, value: k.id.toString() }))));
                return interaction.reply({ content: '🎁 **Step 1:** Which kit?', components: [row], flags: 64 });
            } else if (selectedValue === 'tpl_orp') {
                const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                if (!userProfile) return interaction.reply({ content: '❌ Link Rust account first!', flags: 64 });
                queueAdminPos(userProfile.inGameName, interaction.guild.id, interaction.user.id, interaction.channel.id, 'orp', client);
                return interaction.reply({ content: `⏳ Stand in the middle of your base and grab coordinates for ORP setup...`, flags: 64 });
            } else if (selectedValue === 'tpl_custom') {
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`bind_emote_custom`).setPlaceholder('Select Quick-Chat...').addOptions(RUST_EMOTES));
                return interaction.reply({ content: '🗣️ **Step 1:** Which phrase triggers this command?', components: [row], flags: 64 });
            } else {
                const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                if (!userProfile) return interaction.reply({ content: '❌ Link Rust account first!', flags: 64 });
                queueAdminPos(userProfile.inGameName, interaction.guild.id, interaction.user.id, interaction.channel.id, selectedValue, client);
                return interaction.reply({ content: `⏳ Grabbing coordinates...`, flags: 64 });
            }
        }

        if (customId === 'bind_kit_select') {
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`bind_emote_kit_${selectedValue}`).setPlaceholder('Select Quick-Chat...').addOptions(RUST_EMOTES));
            return interaction.update({ content: '🗣️ **Step 2:** Which phrase triggers this kit?', components: [row] });
        }

        if (customId.startsWith('bind_emote_')) {
            const parts = customId.split('_'); const type = parts[2]; const emoteSelection = selectedValue;
            const modalId = type === 'kit' ? `modal_final_kit_${parts[3]}_${emoteSelection}` : (type === 'custom' ? `modal_final_custom_${emoteSelection}` : `modal_final_${type}_${parts[3]}_${parts[4]}_${parts[5]}_${emoteSelection}`);
            const modal = new ModalBuilder().setCustomId(modalId).setTitle('Final Options');
            if (type === 'custom') modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('command_data').setLabel("Command").setStyle(TextInputStyle.Short).setRequired(true)));
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cost').setLabel("Cost (0 = Free)").setStyle(TextInputStyle.Short).setValue('0').setRequired(false)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cooldown').setLabel("Cooldown (seconds)").setStyle(TextInputStyle.Short).setValue('0').setRequired(false)));
            return interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && customId.startsWith('modal_final_')) {
        let emote = ''; let command = '';
        const parts = customId.split('_'); const type = parts[2]; 
        if (type === 'custom') { emote = parts[3]; command = interaction.fields.getTextInputValue('command_data'); } 
        else if (type === 'kit') {
            emote = parts[4]; const kit = await ServerKit.findByPk(parts[3]);
            let cmdList = []; for (let i of kit.items.split(',')) { if (i.trim()) cmdList.push(`inventory.giveto "{player}" ${i.trim()}`); }
            command = cmdList.join('\n');
        } else if (type === 'orp') {
            emote = parts[6]; command = `say "{player} has activated Offline Raid Protection for this base at ${parts[3]},${parts[4]},${parts[5]}!"`;
        } else { 
            emote = parts[6];
            if (type === 'tp') command = `teleportpos "{player}" ${parts[3]},${parts[4]},${parts[5]}`;
            if (type === 'recycler') command = `spawn recycler "${parts[3]},${parts[4]},${parts[5]}"`;
        }
        const bind = await CustomBind.create({ guildId: interaction.guild.id, emote, command, cooldown: parseInt(interaction.fields.getTextInputValue('cooldown'))||0, cost: parseInt(interaction.fields.getTextInputValue('cost'))||0, roleId: null });
        const roleMenu = new RoleSelectMenuBuilder().setCustomId(`bind_role_menu_${bind.id}`).setPlaceholder('Select Role Requirement (Optional)...');
        return interaction.reply({ content: `✅ Bind for **${emote}** created!`, components: [new ActionRowBuilder().addComponents(roleMenu)], flags: 64 });
    }
};const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { CustomBind, ServerKit } = require('../database/db');
const { queueAdminPos } = require('../utils/rconManager'); 

const bindSessions = new Map();

const ACTION_TYPES = {
    kit: { name: '🎁 Kit Bind', desc: 'Gives a player a server kit', emoji: '🎁' },
    teleport: { name: '📍 Teleport Bind', desc: 'Teleports player to saved coordinates', emoji: '📍' },
    recycler: { name: '♻️ Portable Recycler', desc: 'Spawns a recycler facing player view', emoji: '♻️' },
    custom: { name: '⚡ Custom RCON', desc: 'Fires a raw custom server command', emoji: '⚡' }
};

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
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Create and manage interactive binds for Kits, Teleports, Portable Recyclers, and Custom RCON commands.\n\n**Active Binds:**\n${listText}`)
                .setColor('#e67e22');

            // ROW 1: Existing Binds Dropdown
            let bindOptions = allBinds.map(b => ({ label: b.name, description: `Type: ${b.actionType} | CD: ${b.cooldown}s`, value: `edit_bind_${b.id}`, emoji: '📂' }));
            if (bindOptions.length === 0) bindOptions.push({ label: 'No binds available', value: 'none' });

            const row1Load = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_select_existing').setPlaceholder('📂 Select an existing bind to edit...').addOptions(bindOptions.slice(0, 25))
            );

            // ROW 2: Create New Bind Button
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
                    { name: '3️⃣ Emote & Settings', value: `• Name: **${session.name || 'Unnamed'}**\n• Emote: ${session.emote}\n• Cooldown: ${session.cooldown}s | Cost: ${session.cost} Scrap`, inline: false }
                )
                .setColor('#3498db');

            // ROW 1: Choose Action Type Dropdown
            const row1Type = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bind_type_select').setPlaceholder(`Action: ${ACTION_TYPES[session.actionType].name}`)
                    .addOptions(Object.keys(ACTION_TYPES).map(k => ({ label: ACTION_TYPES[k].name, description: ACTION_TYPES[k].desc, value: k, emoji: ACTION_TYPES[k].emoji })))
            );

            // ROW 2: Dynamic Target Config (Kit Dropdown OR Get Pos Button)
            let row2Target;
            if (session.actionType === 'kit') {
                const kits = await ServerKit.findAll({ where: { guildId } });
                let kitOpts = kits.map(k => ({ label: k.kitName, value: k.kitName, emoji: '🎁' }));
                if (kitOpts.length === 0) kitOpts.push({ label: 'No kits found in DB', value: 'none' });

                row2Target = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('bind_kit_select').setPlaceholder(session.targetValue ? `Selected Kit: ${session.targetValue}` : '🎁 Select Server Kit...').addOptions(kitOpts.slice(0, 25))
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

            // ROW 3: General Settings (Name, Cooldown, Cost, Emote)
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
                session.targetValue = ''; // Reset target when switching types
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
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('b_emote').setLabel("Emote Icon").setStyle(TextInputStyle.Short).setValue(session.emote).setRequired(true))
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
                else if (session.actionType === 'recycler') finalCommand = `spawn recycler "${session.posX},${session.posY},${session.posZ}"`; // Incorporates orientation/rotation when webhook injects it
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

// Auto-save position helper for webhook integration
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