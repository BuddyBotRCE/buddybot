const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and post a custom styled embed message.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => option.setName('channel').setDescription('Channel to post the embed in').setRequired(true))
        .addStringOption(option => option.setName('title').setDescription('Embed Title').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('Embed Description (supports Markdown)').setRequired(true))
        .addStringOption(option => option.setName('color').setDescription('Hex color code (e.g. #3498db)').setRequired(false))
        .addStringOption(option => option.setName('image').setDescription('Banner Image URL').setRequired(false)),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const color = interaction.options.getString('color') || '#2b2d31';
        const image = interaction.options.getString('image');

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description.replace(/\\n/g, '\n'))
            .setColor(color)
            .setTimestamp();

        if (image) embed.setImage(image);

        await channel.send({ embeds: [embed] });
        return interaction.reply({ content: `✅ Custom embed successfully posted in <#${channel.id}>!`, flags: 64 });
    }
};