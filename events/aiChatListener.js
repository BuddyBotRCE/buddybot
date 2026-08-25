const { EmbedBuilder } = require('discord.js');
const { GuildConfig } = require('../database/db');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const config = await GuildConfig.findOne({ where: { guildId: message.guild.id } });
        if (!config || config.aiEnabled === false) return;

        // Check if bot is mentioned
        const isMentioned = message.mentions.has(client.user);
        if (!isMentioned) return;

        // Clean user text by removing the bot mention tag
        const cleanContent = message.content.replace(`<@${client.user.id}>`, '').replace(`<@!${client.user.id}>`, '').trim();
        const lowerContent = cleanContent.toLowerCase();

        // 1. Check for Admin Premade / Canned Responses first
        try {
            const premadeList = JSON.parse(config.aiPremadeResponses || '[]');
            const matchedPreset = premadeList.find(p => lowerContent.includes(p.trigger.toLowerCase()));
            if (matchedPreset) {
                return await message.reply(matchedPreset.response);
            }
        } catch (e) {}

        // 2. If no API key is configured, fallback politely
        if (!config.aiApiKey) {
            return await message.reply('⚠️ The server administrator has not configured an AI API key yet!');
        }

        // 3. Query the configured LLM API with full diagnostic error catching
        try {
            await message.channel.sendTyping();

            const baseUrl = config.aiBaseUrl || 'https://api.openai.com/v1';
            const modelName = config.aiModel || 'gpt-4o-mini';
            
            const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
            
            console.log(`[AI DEBUG] Querying Provider endpoint: ${endpoint} with model: ${modelName}`);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.aiApiKey}`
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: 'system', content: 'You are a helpful community assistant for a Rust Console Edition community game server.' },
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
                console.error('[AI PARSE ERROR] Raw Response:', responseText);
                return await message.reply(`❌ AI Error: Received non-JSON response from endpoint (Status ${response.status}). Check server console.`);
            }
            
            if (!response.ok || data.error) {
                const errMsg = data.error?.message || responseText || 'Unknown API error';
                console.error('[AI API ERROR RESPONSE]', errMsg);
                return await message.reply(`❌ AI Error (${response.status}): \`${errMsg}\``);
            }

            const aiReply = data.choices?.[0]?.message?.content || 'I received your message, but could not generate a response.';
            return await message.reply(aiReply);

        } catch (err) {
            console.error('[AI FETCH EXCEPTION]', err);
            return await message.reply('❌ Network failure or invalid Base URL reached when contacting AI provider.');
        }
    });
};