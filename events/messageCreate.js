const { UserEconomy, GuildConfig } = require('../database/db');
const cooldowns = new Set();

module.exports = async (message, client) => {
    try {
        // 1. Ignore messages from bots or DMs
        if (message.author.bot || !message.guild) return;

        // Fetch server config once for all features
        const config = await GuildConfig.findOne({ where: { guildId: message.guild.id } });

        // ==========================================
        // 2. AI ASSISTANT (@BuddyBot mentions)
        // ==========================================
        if (message.mentions.has(client.user)) {
            const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            if (!prompt) {
                return message.reply('👋 Hello! How can I assist you with your Rust server today?');
            }

            if (!config || !config.aiApiKey) {
                return message.reply('⚠️ The AI Assistant is not configured on this server yet. An admin can set it up in `/adminpanel` -> **AI Setup**.');
            }

            // Show "typing..." indicator
            await message.channel.sendTyping();

            // Build payload
            const baseUrl = config.aiBaseUrl ? config.aiBaseUrl.replace(/\/+$/, '') : 'https://api.openai.com/v1';
            const endpoint = `${baseUrl}/chat/completions`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.aiApiKey}`
                },
                body: JSON.stringify({
                    model: config.aiModel || 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are BuddyBot, a helpful and knowledgeable Rust game and server assistant. Keep your responses concise, friendly, and formatted nicely with Discord markdown.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                const errData = await response.text();
                console.error('[AI API ERROR]', errData);
                return message.reply(`❌ AI Error: Received status code ${response.status}. Please check your API key and model settings.`);
            }

            const data = await response.json();
            const replyText = data.choices?.[0]?.message?.content || 'I could not generate a response.';

            if (replyText.length > 2000) {
                return message.reply({ content: replyText.substring(0, 1990) + '...' });
            }
            return message.reply({ content: replyText });
        }

        // ==========================================
        // 3. CROSS-CHAT DISCORD -> RUST
        // ==========================================
        if (config && config.crossChatChannelId === message.channel.id) {
            const { activeConnections, sendRconCommand } = require('../utils/rconManager');
            if (activeConnections.has(message.guild.id)) {
                const safeMessage = message.content.replace(/"/g, "'").replace(/\n/g, " ");
                const authorName = message.member?.nickname || message.author.username;
                await sendRconCommand(message.guild.id, `say "[Discord] ${authorName}: ${safeMessage}"`);
                message.react('✅').catch(() => {});
            } else {
                message.react('❌').catch(() => {});
            }
            return; // Stop here so cross-chat messages don't generate XP
        }

        // ==========================================
        // 4. CHAT XP (BuddyPass)
        // ==========================================
        if (cooldowns.has(message.author.id)) return;
        
        const [userWallet] = await UserEconomy.findOrCreate({
            where: { guildId: message.guild.id, userId: message.author.id },
            defaults: { wallet: 0, xp: 0, level: 1 }
        });

        let newXp = userWallet.xp + 25;
        let newLevel = userWallet.level;
        
        if (newXp >= (newLevel * 100)) {
            newLevel++;
            newXp -= ((newLevel - 1) * 100); 
            await userWallet.update({ xp: newXp, level: newLevel, wallet: userWallet.wallet + 50 });
            message.channel.send(`⭐ <@${message.author.id}> leveled up to **Level ${newLevel}**!`);
        } else {
            await userWallet.update({ xp: newXp });
        }

        cooldowns.add(message.author.id);
        setTimeout(() => cooldowns.delete(message.author.id), 60000); 

    } catch (err) {
        console.error('[MESSAGE HANDLER ERROR]', err);
        // Only reply with error if it was an AI request to prevent spamming normal chat
        if (message.mentions.has(client.user)) {
            return message.reply('❌ An error occurred while processing your message. Please try again later.').catch(()=>{});
        }
    }
};