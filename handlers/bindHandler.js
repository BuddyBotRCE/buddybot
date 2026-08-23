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
};