require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration
    ]
});

global.discordClient = client;
client.commands = new Collection();

// --- LIGHTWEIGHT EXPRESS SERVER FOR STRIPE WEBHOOKS ---
const app = express();
app.use(express.json());

app.post('/webhook/stripe', async (req, res) => {
    const event = req.body;

    try {
        const { GuildConfig } = require('./database/db');

        switch (event.type) {
            case 'checkout.session.completed':
            case 'invoice.paid': {
                const sessionOrInvoice = event.data.object;
                const guildId = sessionOrInvoice.metadata?.guildId || sessionOrInvoice.client_reference_id;

                if (guildId) {
                    await GuildConfig.upsert({
                        guildId: guildId,
                        isPremiumServer: true,
                        subscriptionStatus: 'active',
                        subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    });
                    console.log(`[STRIPE] Premium automatically activated for Guild ID: ${guildId}`);
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const config = await GuildConfig.findOne({ where: { stripeCustomerId: subscription.customer } });
                if (config) {
                    await config.update({
                        isPremiumServer: false,
                        subscriptionStatus: 'canceled'
                    });
                    console.log(`[STRIPE] Premium automatically revoked for Guild ID: ${config.guildId} (Subscription ended)`);
                }
                break;
            }
        }
        res.json({ received: true });
    } catch (err) {
        console.error('[STRIPE WEBHOOK ERROR]', err);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[SYSTEM] Webhook listener running on port ${PORT}`));

// --- START DISCORD LOGGERS ---
require('./utils/discordLogger')(client);
require('./events/discordAuditLogger')(client);
require('./events/aiChatListener')(client);

client.on('messageCreate', async message => require('./events/messageCreate')(message, client));

// Load Slash Commands Recursively
const commandsPath = path.join(__dirname, 'commands');
function loadCommandsRecursively(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            loadCommandsRecursively(fullPath);
        } else if (entry.name.endsWith('.js')) {
            const command = require(fullPath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`[SYSTEM] Loaded command: /${command.data.name}`);
            }
        }
    }
}
loadCommandsRecursively(commandsPath);

// Load Events Explicitly
const interactionCreateEvent = path.join(__dirname, 'events', 'interactionCreate.js');
if (fs.existsSync(interactionCreateEvent)) {
    const event = require(interactionCreateEvent);
    client.on('interactionCreate', async interaction => {
        try {
            await event(interaction, client);
        } catch (err) {
            console.error('[INTERACTION EVENT ERROR]', err);
        }
    });
    console.log('[SYSTEM] Loaded event: interactionCreate');
}

// --- INITIALIZE BACKGROUND AUTO-EVENT MANAGER ---
try {
    const { initAutoEventLoop } = require('./utils/autoEventManager');
    if (typeof initAutoEventLoop === 'function') {
        initAutoEventLoop(client);
    }
} catch (e) {
    console.log('[SYSTEM] Auto event loop file skipped or not found.');
}

client.once('ready', async () => {
    require('./events/ready')(client); // Hook into our ready event file
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const commandData = client.commands.map(cmd => cmd.data.toJSON());
    
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandData });
        console.log('[SYSTEM] Global commands registered successfully.');
    } catch (error) {
        console.error('[COMMAND SYNC ERROR]', error);
    }

    // --- LIVE RCON STATUS MONITOR LOOP ---
    setInterval(async () => {
        try {
            const { GuildConfig } = require('./database/db');
            const { sendRconCommand } = require('./utils/rconManager');
            const { Op } = require('sequelize');
            
            const configs = await GuildConfig.findAll({ where: { statusChannelId: { [Op.ne]: null } } });
            
            for (const config of configs) {
                const guild = client.guilds.cache.get(config.guildId);
                if (!guild) continue;
                const channel = guild.channels.cache.get(config.statusChannelId);
                if (!channel) continue;

                let isOnline = false;
                try {
                    await sendRconCommand(config.guildId, 'server.population');
                    isOnline = true;
                } catch (e) {
                    isOnline = false;
                }

                const statusEmbed = new EmbedBuilder()
                    .setTitle(`🌐 GPortal Server Status — ${guild.name}`)
                    .setDescription(`• **Connection Status:** ${isOnline ? '🟢 ONLINE & HEALTHY' : '🔴 OFFLINE / RESTARTING'}\n• **RCON IP:** \`${config.rconIp || 'Not Set'}:${config.rconPort || 'N/A'}\``)
                    .setColor(isOnline ? '#2ecc71' : '#e74c3c')
                    .setTimestamp();

                if (config.statusMessageId) {
                    const msg = await channel.messages.fetch(config.statusMessageId).catch(() => null);
                    if (msg) {
                        await msg.edit({ embeds: [statusEmbed] });
                    } else {
                        const newMsg = await channel.send({ embeds: [statusEmbed] });
                        await config.update({ statusMessageId: newMsg.id });
                    }
                } else {
                    const newMsg = await channel.send({ embeds: [statusEmbed] });
                    await config.update({ statusMessageId: newMsg.id });
                }
            }
        } catch (loopErr) {
            console.error('[STATUS LOOP ERROR]', loopErr);
        }
    }, 60000);
});

client.login(process.env.DISCORD_TOKEN);