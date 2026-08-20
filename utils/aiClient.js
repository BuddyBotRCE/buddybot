async function askAI(prompt, config) {
    if (!config || !config.aiApiKey) {
        return "My AI brain isn't hooked up yet! An Admin needs to set the API key in the `/adminpanel` Setup module.";
    }

    const url = config.aiProviderUrl;
    const key = config.aiApiKey;
    const model = config.aiModel;

    try {
        // --- 1. GOOGLE GEMINI FORMAT ---
        if (url.includes('generativelanguage')) {
            const endpoint = `${url}models/${model}:generateContent?key=${key}`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ 
                        parts: [{ text: `You are BuddyBot, a helpful expert on Rust Console Edition. Keep answers concise, accurate, and under 1500 characters. The user asks: ${prompt}` }] 
                    }]
                })
            });
            
            const data = await res.json();
            return data.candidates[0].content.parts[0].text;
        } 
        
        // --- 2. OPENAI / DEEPSEEK / GROQ FORMAT ---
        else {
            // Ensure the URL ends with the correct endpoint
            const endpoint = url.endsWith('/') ? `${url}chat/completions` : `${url}/chat/completions`;
            
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "You are BuddyBot, a helpful expert on Rust Console Edition. Keep answers concise, accurate, and under 1500 characters." },
                        { role: "user", content: prompt }
                    ]
                })
            });
            
            const data = await res.json();
            return data.choices[0].message.content;
        }
    } catch (error) {
        console.error("[AI ERROR]", error);
        return "My circuits are fried! I couldn't reach the AI provider. Try again later.";
    }
}

module.exports = { askAI };