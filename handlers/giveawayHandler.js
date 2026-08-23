const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, Giveaway } = require('../database/db');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (customId === 'admin_menu_select' && selectedValue === 'setup_giveaways') {
        const embed = new EmbedBuilder().setTitle('🎉 Giveaway Manager').setDescription('Manage your server giveaways.').setColor('#9b59b6');
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('giveaway_action_select').setPlaceholder('Select a giveaway action...')
            .addOptions([{ label: 'Start Giveaway', value: 'ga_start', emoji: '🚀' }, { label: 'Set Default Channel', value: 'ga_channel', emoji: '📺' }, { label: 'Set Default Banner', value: 'ga_banner', emoji: '🖼️' }, { label: 'Reroll Winner', value: 'ga_reroll', emoji: '🎲' }, { label: 'View Participants', value: 'ga_players', emoji: '👥' }, { label: 'Cancel Giveaway', value: 'ga_cancel', emoji: '❌' }])
        );
        return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }
    if (customId === 'select_giveaway_channel') {
        await GuildConfig.upsert({ guildId: interaction.guild.id, giveawayChannelId: interaction.values[0] });
        return interaction.update({ content: `✅ Default Giveaway channel linked!`, components: [] });
    }
    if (customId.startsWith('select_ga_reroll_')) {
        const ga = await Giveaway.findByPk(customId.replace('select_ga_reroll_', ''));
        if (!ga) return interaction.reply({ content: '❌ Giveaway not found.', flags: 64 });
        let entries = JSON.parse(ga.entries).filter(id => id !== interaction.values[0]);
        await ga.update({ entries: JSON.stringify(entries) });
        if (entries.length === 0) return interaction.reply({ content: '❌ No valid entries left.', flags: 64 });
        const newWinner = entries[Math.floor(Math.random() * entries.length)];
        const channel = client.channels.cache.get(ga.channelId);
        if (channel) channel.send(`🎲 Giveaway Rerolled! <@${interaction.values[0]}> was replaced by our new winner: <@${newWinner}>!`);
        return interaction.update({ content: `✅ Rerolled successfully!`, components: [] });
    }
    if (customId === 'giveaway_action_select') {
        if (selectedValue === 'ga_start') {
            const modal = new ModalBuilder().setCustomId('modal_giveaway_start').setTitle('Start Giveaway');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('prize').setLabel("Prize").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('minutes').setLabel("Duration in Minutes").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('winners').setLabel("Number of Winners").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'ga_channel') return interaction.reply({ content: '📺 Select default giveaway channel:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_giveaway_channel').setPlaceholder('Select Channel...'))], flags: 64 });
        if (selectedValue === 'ga_banner') {
            const modal = new ModalBuilder().setCustomId('modal_ga_banner').setTitle('Set Banner URL');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('banner_url').setLabel("Image URL").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'ga_reroll') {
            const modal = new ModalBuilder().setCustomId('modal_ga_reroll').setTitle('Reroll Giveaway');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_id').setLabel("Message ID").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'ga_cancel') {
            const modal = new ModalBuilder().setCustomId('modal_ga_cancel').setTitle('Cancel Giveaway');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_id').setLabel("Message ID").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'ga_players') {
            const modal = new ModalBuilder().setCustomId('modal_ga_players').setTitle('View Participants');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('msg_id').setLabel("Message ID").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
    }
    if (customId === 'enter_giveaway') {
        const giveaway = await Giveaway.findByPk(interaction.message.id);
        if (!giveaway || !giveaway.isActive) return interaction.reply({ content: '❌ Ended!', flags: 64 });
        let entries = JSON.parse(giveaway.entries);
        if (!entries.includes(interaction.user.id)) { entries.push(interaction.user.id); await giveaway.update({ entries: JSON.stringify(entries) }); }
        return interaction.reply({ content: '🎉 Entered!', flags: 64 });
    }
    if (interaction.isModalSubmit()) {
        if (customId === 'modal_giveaway_start') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const targetChannel = client.channels.cache.get(config?.giveawayChannelId || interaction.channel.id);
            const endTime = new Date(Date.now() + parseInt(interaction.fields.getTextInputValue('minutes')) * 60000);
            const embed = new EmbedBuilder().setTitle('🎉 GIVEAWAY 🎉').setDescription(`**Prize:** ${interaction.fields.getTextInputValue('prize')}\n**Ends:** <t:${Math.floor(endTime.getTime()/1000)}:R>`).setColor('#9b59b6');
            if (config?.giveawayBannerUrl) embed.setImage(config.giveawayBannerUrl);
            const msg = await targetChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('enter_giveaway').setLabel('Enter Giveaway').setStyle(ButtonStyle.Success))] });
            await Giveaway.create({ messageId: msg.id, guildId: interaction.guild.id, channelId: targetChannel.id, prize: interaction.fields.getTextInputValue('prize'), endTime: endTime, winnersCount: parseInt(interaction.fields.getTextInputValue('winners')) });
            return interaction.reply({ content: `✅ Started!`, flags: 64 });
        }
        if (customId === 'modal_ga_banner') {
            await GuildConfig.upsert({ guildId: interaction.guild.id, giveawayBannerUrl: interaction.fields.getTextInputValue('banner_url') });
            return interaction.reply({ content: `✅ Banner updated!`, flags: 64 });
        }
        if (customId === 'modal_ga_reroll') {
            const ga = await Giveaway.findByPk(interaction.fields.getTextInputValue('msg_id'));
            if (!ga) return interaction.reply({ content: '❌ Not found.', flags: 64 });
            return interaction.reply({ content: `🎲 Select winner to replace:`, components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`select_ga_reroll_${ga.messageId}`).setPlaceholder('Select winner to replace...'))], flags: 64 });
        }
        if (customId === 'modal_ga_cancel') {
            const ga = await Giveaway.findByPk(interaction.fields.getTextInputValue('msg_id'));
            if (!ga) return interaction.reply({ content: '❌ Not found.', flags: 64 });
            await ga.update({ isActive: false });
            return interaction.reply({ content: `✅ Cancelled.`, flags: 64 });
        }
        if (customId === 'modal_ga_players') {
            const ga = await Giveaway.findByPk(interaction.fields.getTextInputValue('msg_id'));
            if (!ga) return interaction.reply({ content: '❌ Not found.', flags: 64 });
            return interaction.reply({ content: `👥 **Participants (${JSON.parse(ga.entries).length}):**\n${JSON.parse(ga.entries).map(id => `<@${id}>`).join(', ')}`, flags: 64 });
        }
    }
};