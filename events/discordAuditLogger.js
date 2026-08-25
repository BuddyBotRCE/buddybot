const { EmbedBuilder } = require('discord.js');
const { GuildConfig } = require('../database/db');

module.exports = (client) => {
    // 1. MEMBER JOIN
    client.on('guildMemberAdd', async (member) => {
        const config = await GuildConfig.findOne({ where: { guildId: member.guild.id } });
        if (!config || !config.logMemberChannelId) return;
        const channel = member.guild.channels.cache.get(config.logMemberChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('📥 Member Joined')
            .setDescription(`**${member.user.tag}** (<@${member.id}>) joined the server.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setColor('#2ecc71')
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();

        channel.send({ embeds: [embed] }).catch(() => {});
    });

    // 2. MEMBER LEAVE
    client.on('guildMemberRemove', async (member) => {
        const config = await GuildConfig.findOne({ where: { guildId: member.guild.id } });
        if (!config || !config.logMemberChannelId) return;
        const channel = member.guild.channels.cache.get(config.logMemberChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('📤 Member Left')
            .setDescription(`**${member.user.tag}** (<@${member.id}>) left the server.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setColor('#e74c3c')
            .setFooter({ text: `ID: ${member.id}` })
            .setTimestamp();

        channel.send({ embeds: [embed] }).catch(() => {});
    });

    // 3. MEMBER BANNED
    client.on('guildBanAdd', async (ban) => {
        const config = await GuildConfig.findOne({ where: { guildId: ban.guild.id } });
        if (!config || !config.logMemberChannelId) return;
        const channel = ban.guild.channels.cache.get(config.logMemberChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('🔨 Member Banned')
            .setDescription(`**${ban.user.tag}** (<@${ban.user.id}>) was banned from the server.`)
            .setThumbnail(ban.user.displayAvatarURL())
            .setColor('#c0392b')
            .setFooter({ text: `ID: ${ban.user.id}` })
            .setTimestamp();

        channel.send({ embeds: [embed] }).catch(() => {});
    });

    // 4. MESSAGE DELETE
    client.on('messageDelete', async (message) => {
        if (!message.guild || message.author?.bot) return;
        const config = await GuildConfig.findOne({ where: { guildId: message.guild.id } });
        if (!config || !config.logMessageChannelId) return;
        const channel = message.guild.channels.cache.get(config.logMessageChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .setDescription(`**Author:** <@${message.author?.id}>\n**Channel:** <#${message.channel.id}>\n**Content:**\n\`\`\`${message.content || '[Media / Embed Only]'}\`\`\``)
            .setColor('#e67e22')
            .setTimestamp();

        channel.send({ embeds: [embed] }).catch(() => {});
    });

    // 5. MESSAGE EDIT
    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
        const config = await GuildConfig.findOne({ where: { guildId: newMessage.guild.id } });
        if (!config || !config.logMessageChannelId) return;
        const channel = newMessage.guild.channels.cache.get(config.logMessageChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('✏️ Message Edited')
            .setDescription(`**Author:** <@${newMessage.author?.id}>\n**Channel:** <#${newMessage.channel.id}>\n\n**Before:**\n\`\`\`${oldMessage.content || '[None]'}\`\`\`\n**After:**\n\`\`\`${newMessage.content || '[None]'}\`\`\``)
            .setColor('#f1c40f')
            .setTimestamp();

        channel.send({ embeds: [embed] }).catch(() => {});
    });

    // 6. VOICE CHANNEL ACTIVITY (Join, Leave, Move)
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const guild = newState.guild || oldState.guild;
        const config = await GuildConfig.findOne({ where: { guildId: guild.id } });
        if (!config || !config.logVoiceChannelId) return;
        const channel = guild.channels.cache.get(config.logVoiceChannelId);
        if (!channel) return;

        const member = newState.member;
        if (member.user.bot) return;

        let action = '';
        let color = '#3498db';

        if (!oldState.channelId && newState.channelId) {
            action = `📥 **${member.user.tag}** joined voice channel **${newState.channel.name}**`;
            color = '#2ecc71';
        } else if (oldState.channelId && !newState.channelId) {
            action = `📤 **${member.user.tag}** left voice channel **${oldState.channel.name}**`;
            color = '#e74c3c';
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            action = `🔀 **${member.user.tag}** moved from **${oldState.channel.name}** to **${newState.channel.name}**`;
            color = '#f1c40f';
        }

        if (action) {
            const embed = new EmbedBuilder()
                .setDescription(action)
                .setColor(color)
                .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => {});
        }
    });
};