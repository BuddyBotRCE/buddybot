const OpenAI = require('openai');
const { GuildConfig } = require('../database/db');

async function askDynamicAI(guildId, prompt) {
    try {
        const config = await GuildConfig.findOne({ where: { guildId: guildId } });

        if (!config || !config.aiApiKey) {
            return "⚠️ **AI Not Configured:** The admin of this server has not set up an AI provider yet.";
        }

        const client = new OpenAI({
            apiKey: config.aiApiKey,
            baseURL: config.aiProviderUrl
        });

        const response = await client.chat.completions.create({
            model: config.aiModel,
            messages: [{ role: 'user', content: prompt }]
        });

        return response.choices[0].message.content;

    } catch (error) {
        console.error("[AI ERROR] Dynamic AI failed:", error.message);
        return "❌ **AI Error:** Failed to connect to the configured AI. Admins, please check your API settings.";
    }
}

module.exports = { askDynamicAI };