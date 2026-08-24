const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { GuildConfig } = require('../database/db');

// Memory cache to track spam (messages per user)
const spamTracker = new Map();

module.exports = async (message, client) => {
    // Ignore bots and empty messages
    if (message.author.bot || !message.guild) return;

    // Ignore server admins and moderators so they don't get auto-modded
    if (message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    try {
        // Fetch the guild's auto-mod config
        const config = await GuildConfig.findOne({ where: { guildId: message.guild.id } });
        if (!config) return;

        let triggered = false;
        let actionToTake = 'delete';
        let reason = '';

        // --- HELPER FUNCTION TO EXECUTE PUNISHMENTS ---
        const executePunishment = async (action, logReason) => {
            triggered = true;
            try {
                if (message.deletable) await message.delete().catch(() => {});

                if (action === 'warn') {
                    const warnMsg = await message.channel.send(`⚠️ <@${message.author.id}>, your message was removed! Reason: **${logReason}**`);
                    setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                } 
                else if (action === 'timeout_5m') {
                    await message.member.timeout(5 * 60 * 1000, `Auto-Mod: ${logReason}`);
                    const warnMsg = await message.channel.send(`⏳ <@${message.author.id}> has been timed out for 5 minutes. (**${logReason}**)`);
                    setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                } 
                else if (action === 'timeout_1h') {
                    await message.member.timeout(60 * 60 * 1000, `Auto-Mod: ${logReason}`);
                    const warnMsg = await message.channel.send(`⏳ <@${message.author.id}> has been timed out for 1 hour. (**${logReason}**)`);
                    setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                } 
                else if (action === 'timeout_24h') {
                    await message.member.timeout(24 * 60 * 60 * 1000, `Auto-Mod: ${logReason}`);
                    const warnMsg = await message.channel.send(`⏳ <@${message.author.id}> has been timed out for 24 hours. (**${logReason}**)`);
                    setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                } 
                else if (action === 'ban') {
                    await message.member.ban({ reason: `Auto-Mod: ${logReason}` });
                    await message.channel.send(`🔨 **${message.author.tag}** was banned by Auto-Mod. (**${logReason}**)`);
                }
            } catch (err) {
                console.error(`[AUTO MOD EXECUTION ERROR] Could not execute ${action}:`, err);
            }
        };

        // --- 1. ANTI-INVITE SCANNER ---
        if (!triggered && config.amInviteEnabled) {
            const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/gi;
            if (inviteRegex.test(message.content)) {
                await executePunishment(config.amInviteAction, 'Sending Discord Invites');
            }
        }

        // --- 2. ANTI-LINK SCANNER ---
        if (!triggered && config.amLinkEnabled) {
            const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
            // Only trigger if they aren't sending tenor/giphy gifs
            if (linkRegex.test(message.content) && !message.content.includes('tenor.com') && !message.content.includes('giphy.com')) {
                await executePunishment(config.amLinkAction, 'Sending Unauthorized Links');
            }
        }

        // --- 3. BANNED WORDS SCANNER ---
        if (!triggered && config.amWordsEnabled && config.amWordsList) {
            const wordsList = config.amWordsList.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
            const lowerContent = message.content.toLowerCase();
            
            const foundWord = wordsList.find(word => lowerContent.includes(word));
            if (foundWord) {
                await executePunishment(config.amWordsAction, 'Using Banned Words');
            }
        }

        // --- 4. MASS MENTIONS SCANNER ---
        if (!triggered && config.amMentionsEnabled) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount > (config.amMentionsLimit || 4)) {
                await executePunishment(config.amMentionsAction, 'Mass Mentions (Spam Pinging)');
            }
        }

        // --- 5. ANTI-CAPS SCANNER ---
        if (!triggered && config.amCapsEnabled && message.content.length > 10) { // Ignore short messages like "LOL"
            const capsCount = message.content.replace(/[^A-Z]/g, '').length;
            const lettersCount = message.content.replace(/[^a-zA-Z]/g, '').length;
            
            if (lettersCount > 0) {
                const capsPercentage = (capsCount / lettersCount) * 100;
                if (capsPercentage >= (config.amCapsLimit || 70)) {
                    await executePunishment(config.amCapsAction, 'Excessive Caps Lock');
                }
            }
        }

        // --- 6. ANTI-SPAM SCANNER ---
        if (!triggered && config.amSpamEnabled) {
            const authorId = message.author.id;
            const limit = config.amSpamLimit || 5; // e.g., 5 messages
            const now = Date.now();

            if (!spamTracker.has(authorId)) {
                spamTracker.set(authorId, []);
            }

            const timestamps = spamTracker.get(authorId);
            timestamps.push(now);

            // Filter out timestamps older than 5 seconds (5000ms)
            const recentMessages = timestamps.filter(t => now - t < 5000);
            spamTracker.set(authorId, recentMessages);

            if (recentMessages.length > limit) {
                // Clear their cache so it doesn't trigger multiple times instantly
                spamTracker.set(authorId, []); 
                await executePunishment(config.amSpamAction, 'Message Spamming');
            }
        }

    } catch (error) {
        console.error('[MESSAGE CREATE EVENT ERROR]', error);
    }
};