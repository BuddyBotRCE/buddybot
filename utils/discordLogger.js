const { EmbedBuilder } = require('discord.js');
const { GuildConfig } = require('../database/db');

module.exports = (client) => {
    async function sendLog(guild, type, embed) {
        try {
            if (!guild) return;
            const config = await GuildConfig.findOne({ where: { guildId: guild.id } });
            if (!config) return;
            
            let targetId = null;
            if (type === 'discord') targetId = config.logDiscordChannelId;
            if (type === 'admin') targetId = config.logAdminChannelId;
            if (type === 'game') targetId = config.logGameChannelId;

            if (!targetId) return;
            const channel = guild.channels.cache.get(targetId) || await guild.channels.fetch(targetId).catch(() => null);
            if (channel) await channel.send({ embeds: [embed] }).catch(()=>{});
        } catch (error) {
            console.error('[LOGGER ERROR]', error);
        }
    }

    client.on('messageDelete', async (message) => {
        if (!message.guild || message.author?.bot) return;
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Message Deleted')
            .setColor('#e74c3c')
            .setDescription(`**Author:** ${message.author} (${message.author.id})\n**Channel:** ${message.channel}\n\n**Content:**\n${message.content ? (message.content.length > 2000 ? message.content.slice(0, 2000) + '...' : message.content) : '*No text content (Image/Embed)*'}`)
            .setTimestamp();
        await sendLog(message.guild, 'discord', embed);
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; 

        const embed = new EmbedBuilder()
            .setTitle('✏️ Message Edited')
            .setColor('#f1c40f')
            .setDescription(`**Author:** ${oldMessage.author} (${oldMessage.author.id})\n**Channel:** ${oldMessage.channel} [Jump to Message](${newMessage.url})`)
            .addFields(
                { name: 'Old', value: oldMessage.content ? (oldMessage.content.length > 1000 ? oldMessage.content.slice(0, 1000) + '...' : oldMessage.content) : '*None*' },
                { name: 'New', value: newMessage.content ? (newMessage.content.length > 1000 ? newMessage.content.slice(0, 1000) + '...' : newMessage.content) : '*None*' }
            )
            .setTimestamp();
        await sendLog(oldMessage.guild, 'discord', embed);
    });

    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (!oldState.guild) return;
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        let embed = new EmbedBuilder().setTimestamp();

        if (!oldState.channelId && newState.channelId) {
            embed.setTitle('🎙️ Voice Joined').setColor('#2ecc71').setDescription(`**User:** ${member}\n**Channel:** <#${newState.channelId}>`);
            await sendLog(newState.guild, 'discord', embed);
        } else if (oldState.channelId && !newState.channelId) {
            embed.setTitle('🎙️ Voice Left').setColor('#e74c3c').setDescription(`**User:** ${member}\n**Channel:** <#${oldState.channelId}>`);
            await sendLog(oldState.guild, 'discord', embed);
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            embed.setTitle('🎙️ Voice Moved').setColor('#3498db').setDescription(`**User:** ${member}\n**From:** <#${oldState.channelId}>\n**To:** <#${newState.channelId}>`);
            await sendLog(newState.guild, 'discord', embed);
        }
    });

    client.on('guildMemberAdd', async (member) => {
        const accountAge = Math.floor(member.user.createdTimestamp / 1000);
        const embed = new EmbedBuilder()
            .setTitle('👋 Member Joined')
            .setColor('#2ecc71')
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(`**User:** ${member} (${member.id})\n**Account Created:** <t:${accountAge}:R>`)
            .setTimestamp();
        await sendLog(member.guild, 'discord', embed);
    });

    client.on('guildMemberRemove', async (member) => {
        const embed = new EmbedBuilder()
            .setTitle('🚪 Member Left')
            .setColor('#e74c3c')
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(`**User:** ${member.user.tag} (${member.id})`)
            .setTimestamp();
        await sendLog(member.guild, 'discord', embed);
    });
    
    client.on('guildBanAdd', async (ban) => {
        const embed = new EmbedBuilder()
            .setTitle('🔨 User Banned (Discord)')
            .setColor('#992d22')
            .setDescription(`**User:** ${ban.user.tag} (${ban.user.id})\n**Reason:** ${ban.reason || 'No reason provided'}`)
            .setTimestamp();
        await sendLog(ban.guild, 'admin', embed);
    });
};