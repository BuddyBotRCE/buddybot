const { UserEconomy, GuildConfig } = require('../database/db');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = async (message, client) => {
    if (message.author.bot || !message.guild) return;

    // =========================================================================
    // 0. AUTO-MODERATION ENGINE
    // =========================================================================
    try {
        const config = await GuildConfig.findOne({ where: { guildId: message.guild.id } });
        if (config && config.autoModEnabled) {
            // Bypass Auto-Mod for Admins
            if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
                let violationReason = null;
                const content = message.content;

                // A. Check Caps Lock Percentage
                if (content.length > 5) {
                    const letters = content.replace(/[^a-zA-Z]/g, '');
                    if (letters.length > 5) {
                        const uppercaseCount = letters.replace(/[^A-Z]/g, '').length;
                        const capsPercentage = (uppercaseCount / letters.length) * 100;
                        if (capsPercentage >= (config.autoModCapsLimit || 70)) {
                            violationReason = 'Excessive Caps Lock';
                        }
                    }
                }

                // B. Check Bad Words / Muted Words Filter
                if (!violationReason && config.autoModMutedWords) {
                    try {
                        const mutedWords = JSON.parse(config.autoModMutedWords);
                        const lowerContent = content.toLowerCase();
                        for (const word of mutedWords) {
                            if (lowerContent.includes(word.toLowerCase())) {
                                violationReason = `Prohibited Word/Phrase (${word})`;
                                break;
                            }
                        }
                    } catch (e) {}
                }

                // If a violation was triggered, execute punishment
                if (violationReason) {
                    await message.delete().catch(() => {});

                    const action = config.autoModAction || 'timeout';
                    const member = message.member;

                    if (action === 'ban' && member?.bannable) {
                        await member.ban({ reason: `[Auto-Mod] ${violationReason}` }).catch(() => {});
                        await message.channel.send(`🛡️ **Auto-Mod:** <@${message.author.id}> was banned for: **${violationReason}**.`);
                    } else if (action === 'timeout' && member?.moderatable) {
                        await member.timeout(10 * 60 * 1000, `[Auto-Mod] ${violationReason}`).catch(() => {}); // 10 min timeout
                        await message.channel.send(`🛡️ **Auto-Mod:** <@${message.author.id}> received a 10-minute timeout for: **${violationReason}**.`);
                    } else {
                        // Warn action
                        await message.channel.send(`⚠️ **Auto-Mod Warning:** <@${message.author.id}>, please watch your language/caps. Reason: *${violationReason}*.`);
                    }

                    // Route to Admin Log Channel if configured
                    if (config.logAdminChannelId) {
                        const logChan = message.guild.channels.cache.get(config.logAdminChannelId);
                        if (logChan) {
                            const modEmbed = new EmbedBuilder()
                                .setTitle('🛡️ Auto-Mod Action Triggered')
                                .setDescription(`**User:** <@${message.author.id}> (${message.author.id})\n**Action Taken:** ${action.toUpperCase()}\n**Reason:** ${violationReason}\n**Channel:** <#${message.channel.id}>\n\n**Original Message:**\n\`\`\`${content}\`\`\``)
                                .setColor('#e74c3c')
                                .setTimestamp();
                            logChan.send({ embeds: [modEmbed] }).catch(() => {});
                        }
                    }
                    return; // Stop processing XP/AI if message was deleted for breaking rules
                }
            }
        }
    } catch (amErr) {
        console.error('[AUTO-MOD ERROR]', amErr);
    }

    // =========================================================================
    // 1. CHAT XP & LEVELING SYSTEM
    // =========================================================================
    try {
        const [user] = await UserEconomy.findOrCreate({
            where: { guildId: message.guild.id, userId: message.author.id },
            defaults: { wallet: 0, bank: 0, xp: 0, level: 1 }
        });

        const xpGained = Math.floor(Math.random() * 11) + 15; // 15-25 XP
        const newXp = (user.xp || 0) + xpGained;
        const currentLevel = user.level || 1;
        const requiredXp = currentLevel * 100;

        if (newXp >= requiredXp) {
            await user.update({
                xp: newXp - requiredXp,
                level: currentLevel + 1,
                wallet: (user.wallet || 0) + 100 // Bonus currency for leveling up
            });
            await message.channel.send(`🎉 Congratulations <@${message.author.id}>! You leveled up to **Level ${currentLevel + 1}** and earned **100 Scrap**!`);
        } else {
            await user.update({ xp: newXp });
        }
    } catch (err) {
        console.error('[ECONOMY XP ERROR]', err);
    }

    // =========================================================================
    // 2. AI ASSISTANT (@BuddyBot Chat)
    // =========================================================================
    const mentionRegex = new RegExp(`^<@!?${client.user.id}>`);
    if (!mentionRegex.test(message.content)) return;

    try {
        const config = await GuildConfig.findOne({ where: { guildId: message.guild.id } });
        if (!config || !config.aiApiKey) {
            return message.reply('⚠️ The AI Assistant is not configured on this server yet. An admin can set it up in `/adminpanel` under **AI Integration Setup**.');
        }

        const prompt = message.content.replace(mentionRegex, '').trim();
        if (!prompt) {
            return message.reply(`👋 Hey <@${message.author.id}>! How can I help you with the server or Rust Console Edition today?`);
        }

        await message.channel.sendTyping();

        const baseUrl = config.aiBaseUrl ? config.aiBaseUrl.replace(/\/+$/, '') : 'https://api.openai.com/v1';
        const endpoint = `${baseUrl}/chat/completions`;

        const systemPrompt = `You are BuddyBot RCE, the dedicated AI assistant for this Rust Console Edition (PlayStation & Xbox) community server on Discord.

KNOWLEDGE BASE & GUIDELINES:
- Game Focus: Rust Console Edition (RCE) on PSN and Xbox. DO NOT mention Steam, PC console keys (F1), or PC-specific mods.
- Account Linking: Tell players to run the '/playerpanel' slash command in Discord and click the "Link Account" button to enter their exact in-game PlayStation or Xbox gamertag.
- Server Economy & Shop: Players can check balances, claim daily rewards, browse the item shop, and play casino games directly inside '/playerpanel'.
- Server Wipes: Rust Console Official wipes happen on the last Thursday of every month. For this specific community server's wipe schedule, map wipes, and event times, politely instruct the player to check the server's announcements or wipe info channels.
- Tone: Concise, knowledgeable, friendly, and helpful. Keep responses under 3-4 sentences whenever possible for easy reading on Discord.`;

        const requestBody = {
            model: config.aiModel || 'gemini-3.7-flash',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: 400
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.aiApiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return message.reply(`❌ **AI Error:** Received status code \`${response.status}\`. Please verify your API key and model settings in \`/adminpanel\`.`);
        }

        const data = await response.json();
        const replyText = data?.choices?.[0]?.message?.content;

        if (!replyText) {
            return message.reply('❌ No response was generated by the AI.');
        }

        if (replyText.length > 2000) {
            for (let i = 0; i < replyText.length; i += 1900) {
                await message.reply(replyText.slice(i, i + 1900));
            }
        } else {
            await message.reply(replyText);
        }

    } catch (err) {
        if (err.name === 'AbortError') {
            return message.reply('⏱️ **AI Error:** The request timed out. Please try asking again in a moment.');
        }
        console.error('[AI CHAT ERROR]', err);
        return message.reply('❌ An error occurred while processing your message. Please try again later.');
    }
};