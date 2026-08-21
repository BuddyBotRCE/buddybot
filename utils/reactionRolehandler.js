const { ReactionRole } = require('../database/db');

module.exports = (client) => {
    // 1. Reaction Added
    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(()=>{});

        const guildId = reaction.message.guild?.id;
        const messageId = reaction.message.id;
        const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
        const rawEmojiName = reaction.emoji.name;

        const rr = await ReactionRole.findOne({ 
            where: { 
                guildId, 
                messageId, 
                [require('sequelize').Op.or]: [{ emoji: emoji }, { emoji: rawEmojiName }] 
            } 
        });

        if (!rr) return;

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        const role = guild.roles.cache.get(rr.roleId);
        if (role) {
            await member.roles.add(role).catch(() => {});
        }
    });

    // 2. Reaction Removed
    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(()=>{});

        const guildId = reaction.message.guild?.id;
        const messageId = reaction.message.id;
        const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
        const rawEmojiName = reaction.emoji.name;

        const rr = await ReactionRole.findOne({ 
            where: { 
                guildId, 
                messageId, 
                [require('sequelize').Op.or]: [{ emoji: emoji }, { emoji: rawEmojiName }] 
            } 
        });

        if (!rr) return;

        // If it's a Verify-Only role, DO NOT allow them to remove it by un-reacting!
        if (rr.isVerifyOnly) {
            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id).catch(() => null);
            const role = guild.roles.cache.get(rr.roleId);
            if (member && role && !member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch(()=>{}); // Re-add it immediately
            }
            return;
        }

        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;

        const role = guild.roles.cache.get(rr.roleId);
        if (role) {
            await member.roles.remove(role).catch(() => {});
        }
    });
};