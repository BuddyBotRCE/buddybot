const { GuildConfig } = require('../database/db');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Check if the channel is a support ticket channel
        const channelName = message.channel.name.toLowerCase();
        const isTicketChannel = channelName.startsWith('ticket-') || channelName.startsWith('support-') || channelName.startsWith('pri-');
        
        if (!isTicketChannel) return;

        try {
            const config = await GuildConfig.findOne({ where: { guildId: message.guild.id } });
            
            // Verify AI is globally active and ticket assistant is enabled
            if (!config || config.aiEnabled === false || config.ticketAiEnabled === false) return;

            // Do not reply if staff/moderators are talking in the ticket
            if (message.member && message.member.permissions.has('ManageMessages')) return;

            if (!config.aiApiKey) return;

            await message.channel.sendTyping();

            // Fetch recent conversation history inside the ticket (last 5 messages)
            const fetchedMessages = await message.channel.messages.fetch({ limit: 6 });
            const conversationHistory = Array.from(fetchedMessages.values())
                .reverse()
                .map(m => ({
                    role: m.author.bot ? 'assistant' : 'user',
                    content: `${m.author.username}: ${m.content}`
                }));

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
                        { 
                            role: 'system', 
                            content: 'You are BuddyBot, an automated support assistant for a Rust Console Edition community game server. Help players troubleshoot common questions (kits, rules, wipe info, connection errors) while they wait for staff. Keep answers polite, helpful, and concise.' 
                        },
                        ...conversationHistory
                    ],
                    temperature: 0.7
                })
            });

            const data = await response.json();
            if (!response.ok || data.error) return;

            const aiReply = data.choices?.[0]?.message?.content;
            if (aiReply) {
                await message.reply(`🤖 **[AI Support Assistant]:**\n${aiReply}`);
            }

        } catch (err) {
            console.error('[TICKET AI ERROR]', err);
        }
    });
};