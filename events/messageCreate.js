const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { GuildConfig } = require('../database/db');

// Memory cache to track spam (messages per user within a time frame)
const spamTracker = new Map();

module.exports = async (message, client) => {
    // Ignore bots and empty messages
    if (message.author.bot || !message.guild) return;

    // ==========================================
    // 🤖 BUDDYBOT AI & PREMADE MENTION LISTENER
    // ==========================================
    if (message.mentions.everyone) return;

    const isMentioned = message.mentions.has(client.user);
    if (isMentioned) {
        try {
            const config = await GuildConfig.findOne({ where: { guildId: message.guild.id } });
            
            if (config && config.aiEnabled !== false) {
                const cleanContent = message.content
                    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
                    .trim();
                const lowerContent = cleanContent.toLowerCase();

                // Check for premade responses first
                try {
                    const premadeList = JSON.parse(config.aiPremadeResponses || '[]');
                    const matchedPreset = premadeList.find(p => lowerContent.includes(p.trigger.toLowerCase()));
                    if (matchedPreset) {
                        await message.reply(matchedPreset.response);
                        return;
                    }
                } catch (e) {}

                if (!config.aiApiKey) {
                    await message.reply('⚠️ The server administrator has not configured an AI API key yet!');
                    return;
                }

                await message.channel.sendTyping();

                const baseUrl = config.aiBaseUrl || config.aiProviderUrl || 'https://api.openai.com/v1';
                const modelName = config.aiModel || 'gpt-4o-mini';
                const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.aiApiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            { role: 'system', content: 'You are BuddyBot, a helpful community assistant and expert for a Rust Console Edition community game server.' },
                            { role: 'user', content: cleanContent }
                        ],
                        temperature: 0.7
                    })
                });

                const responseText = await response.text();
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (e) {
                    await message.reply(`❌ AI Error: Received non-JSON response from endpoint (Status ${response.status}).`);
                    return;
                }
                
                if (!response.ok || data.error) {
                    const errMsg = data.error?.message || responseText || 'Unknown API error';
                    await message.reply(`❌ AI Error (${response.status}): \`${errMsg}\``);
                    return;
                }

                const aiReply = data.choices?.[0]?.message?.content || 'I received your message, but could not generate a response.';
                await message.reply(aiReply);
                return;
            }
        } catch (aiErr) {
            console.error('[AI CHAT ERROR]', aiErr);
        }
    }

    // ==========================================
    // 🛡️ AUTO-MODERATION SYSTEM
    // ==========================================
    if (message.member && message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    try {
        const config = await GuildConfig.findOne({ where: { guildId: message.guild.id } });
        if (!config) return;

        let triggered = false;

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

        // --- 1. ANTI-INVITE ---
        if (!triggered && config.amInviteEnabled) {
            const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)/gi;
            if (inviteRegex.test(message.content)) {
                await executePunishment(config.amInviteAction, 'Sending Discord Invites');
            }
        }

        // --- 2. ANTI-LINK ---
        if (!triggered && config.amLinkEnabled) {
            const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
            if (linkRegex.test(message.content) && !message.content.includes('tenor.com') && !message.content.includes('giphy.com')) {
                await executePunishment(config.amLinkAction, 'Sending Unauthorized Links');
            }
        }

        // --- 3. BANNED WORDS ---
        if (!triggered && config.amWordsEnabled && config.amWordsList) {
            const wordsList = config.amWordsList.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
            const lowerContent = message.content.toLowerCase();
            
            const foundWord = wordsList.find(word => lowerContent.includes(word));
            if (foundWord) {
                await executePunishment(config.amWordsAction, 'Using Banned Words');
            }
        }

        // --- 4. MASS MENTIONS ---
        if (!triggered && config.amMentionsEnabled) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount > (config.amMentionsLimit || 4)) {
                await executePunishment(config.amMentionsAction, 'Mass Mentions (Spam Pinging)');
            }
        }

        // --- 5. ANTI-CAPS ---
        if (!triggered && config.amCapsEnabled && message.content.length > 10) {
            const capsCount = message.content.replace(/[^A-Z]/g, '').length;
            const lettersCount = message.content.replace(/[^a-zA-Z]/g, '').length;
            
            if (lettersCount > 0) {
                const capsPercentage = (capsCount / lettersCount) * 100;
                if (capsPercentage >= (config.amCapsLimit || 70)) {
                    await executePunishment(config.amCapsAction, 'Excessive Caps Lock');
                }
            }
        }

        // --- 6. ANTI-SPAM ---
        if (!triggered && config.amSpamEnabled) {
            const authorId = message.author.id;
            const limit = config.amSpamLimit || 5;
            const now = Date.now();

            if (!spamTracker.has(authorId)) {
                spamTracker.set(authorId, []);
            }

            const timestamps = spamTracker.get(authorId);
            timestamps.push(now);

            const recentMessages = timestamps.filter(t => now - t < 5000);
            spamTracker.set(authorId, timestamps);

            if (recentMessages.length > limit) {
                spamTracker.set(authorId, []); 
                await executePunishment(config.amSpamAction, 'Message Spamming');
            }
        }

    } catch (error) {
        console.error('[MESSAGE CREATE EVENT ERROR]', error);
    }
};