const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const { GuildConfig } = require('../database/db');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (customId === 'admin_menu_select' && selectedValue === 'setup_suggestions') {
        const embed = new EmbedBuilder().setTitle('💡 Suggestions System Manager').setDescription('Configure where player suggestions are sent and which admin role is pinged.').setColor('#f1c40f');
        const row1 = new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_suggestion_channel').setPlaceholder('Select Suggestions Channel...').addChannelTypes(ChannelType.GuildText));
        const row2 = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_suggestion_role').setPlaceholder('Select Admin Role to Ping (Optional)...'));
        return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }
    if (customId === 'select_suggestion_channel') {
        await GuildConfig.upsert({ guildId: interaction.guild.id, suggestionChannelId: interaction.values[0] });
        return interaction.update({ content: `✅ Suggestions channel successfully linked!`, components: [] });
    }
    if (customId === 'select_suggestion_role') {
        await GuildConfig.upsert({ guildId: interaction.guild.id, suggestionPingRoleId: interaction.values[0] });
        return interaction.update({ content: `✅ Suggestion ping role successfully linked!`, components: [] });
    }
    if (customId === 'hub_suggestion') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        if (!config?.suggestionChannelId) return interaction.reply({ content: '❌ The suggestion system has not been configured by an admin yet.', flags: 64 });
        const modal = new ModalBuilder().setCustomId('modal_hub_suggestion').setTitle('Submit a Suggestion');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('suggestion_title').setLabel("Brief Title").setStyle(TextInputStyle.Short).setRequired(true)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('suggestion_desc').setLabel("Describe your suggestion").setStyle(TextInputStyle.Paragraph).setRequired(true)));
        return interaction.showModal(modal);
    }
    if (interaction.isModalSubmit() && customId === 'modal_hub_suggestion') {
        const title = interaction.fields.getTextInputValue('suggestion_title');
        const desc = interaction.fields.getTextInputValue('suggestion_desc');
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const channel = interaction.guild.channels.cache.get(config.suggestionChannelId);
        if (!channel) return interaction.reply({ content: '❌ Suggestion channel could not be found.', flags: 64 });
        const embed = new EmbedBuilder().setTitle(`💡 Suggestion: ${title}`).setDescription(desc).setColor('#f1c40f').setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
        const pingText = config.suggestionPingRoleId ? `<@&${config.suggestionPingRoleId}>` : '';
        try {
            const msg = await channel.send({ content: pingText, embeds: [embed] });
            await msg.react('👍'); await msg.react('👎');
            return interaction.reply({ content: '✅ Your suggestion has been successfully submitted!', flags: 64 });
        } catch (e) { return interaction.reply({ content: '❌ Failed to send suggestion. Check bot permissions.', flags: 64 }); }
    }
};