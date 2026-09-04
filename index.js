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

client.once('ready', async () => {
    require('./events/ready')(client); 
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const commandData = client.commands.map(cmd => cmd.data.toJSON());
    
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandData });
        console.log('[SYSTEM] Global commands registered successfully.');
    } catch (error) {
        console.error('[COMMAND SYNC ERROR]', error);
    }

    // --- LIVE AUTO-EVENTS BACKGROUND SCHEDULER LOOP ---
    setInterval(async () => {
        try {
            const { AutoEvent, AutoEventLocation, GameServer } = require('./database/db');
            const { sendRconCommand } = require('./utils/rconManager');
            
            const TYPE_INFO = { 
                hackable: { prefab: 'codelockedhackablecrate' }, 
                supply: { prefab: 'supply_drop' }, 
                elite: { prefab: 'crate_elite' }, 
                node: { prefab: 'stone-ore' },
                cargo: { prefab: 'cargoshipdynamic1' }
            };

            const now = Date.now();
            const enabledEvents = await AutoEvent.findAll({ where: { isEnabled: true } });

            if (!global.autoEventExecMap) global.autoEventExecMap = new Map();

            for (const ev of enabledEvents) {
                const intervalMs = (ev.interval || 60) * 60 * 1000;
                const lastRun = global.autoEventExecMap.get(ev.id) || 0;

                if (now - lastRun >= intervalMs) {
                    global.autoEventExecMap.set(ev.id, now);

                    const locations = await AutoEventLocation.findAll({ where: { eventId: ev.id } });
                    if (locations.length === 0) continue;

                    const prefabInfo = TYPE_INFO[ev.eventType];
                    if (!prefabInfo) continue;

                    const servers = await GameServer.findAll({ where: { guildId: ev.guildId } });
                    if (servers.length === 0) continue;
                    const targetServer = servers[0]; // Uses first configured server for guild events

                    let firedCount = 0;
                    for (let i = 0; i < (ev.amount || 1); i++) {
                        for (const loc of locations) {
                            try {
                                await sendRconCommand(
                                    ev.guildId, 
                                    `spawn ${prefabInfo.prefab} "${loc.posX},${loc.posY},${loc.posZ}"`, 
                                    client, 
                                    targetServer.id
                                );
                                firedCount++;
                            } catch (rconErr) {
                                console.error(`[AUTO EVENT ERROR] Failed to fire event ${ev.name}:`, rconErr.message);
                            }
                        }
                    }
                    console.log(`[AUTO EVENTS] Triggered scheduled event "${ev.name}" (${firedCount} items spawned).`);
                }
            }
        } catch (err) {
            console.error('[AUTO EVENT LOOP ERROR]', err);
        }
    }, 30000);

    // --- LIVE GIVEAWAY TIMER & AUTOMATIC WINNER DRAW LOOP ---
    setInterval(async () => {
        try {
            const { Giveaway } = require('./database/db');
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const now = new Date();

            const activeGiveaways = await Giveaway.findAll({ where: { isActive: true } });

            for (const giveaway of activeGiveaways) {
                const guild = client.guilds.cache.get(giveaway.guildId);
                if (!guild) continue;
                const channel = guild.channels.cache.get(giveaway.channelId);
                if (!channel) continue;

                const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
                if (!message) continue;

                let entries = [];
                try { entries = JSON.parse(giveaway.entries || '[]'); } catch (e) {}
                const endTimeUnix = Math.floor(new Date(giveaway.endTime).getTime() / 1000);

                if (new Date(giveaway.endTime) <= now) {
                    await giveaway.update({ isActive: false });

                    let winnerMentions = 'No valid entries / No winner';
                    if (entries.length > 0) {
                        const winnersCount = giveaway.winnersCount || 1;
                        const shuffled = [...entries].sort(() => 0.5 - Math.random());
                        const selectedWinners = shuffled.slice(0, winnersCount);
                        winnerMentions = selectedWinners.map(id => `<@${id}>`).join(', ');
                    }

                    const endedEmbed = EmbedBuilder.from(message.embeds[0])
                        .setTitle('🎉 GIVEAWAY ENDED 🎉')
                        .setDescription(
                            `**Prize:** ${giveaway.prize}\n` +
                            `**Participants:** ${entries.length}\n` +
                            `**Winner(s):** ${winnerMentions}\n` +
                            `Status: **Ended**`
                        )
                        .setColor('#e74c3c');

                    const disabledButtonRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('ended_giveaway')
                            .setLabel('Giveaway Ended')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                            .setEmoji('🏁')
                    );

                    await message.edit({ embeds: [endedEmbed], components: [disabledButtonRow] }).catch(() => {});

                    if (entries.length > 0) {
                        await channel.send(`🎉 **Giveaway Ended!** Congratulations ${winnerMentions}! You won the **${giveaway.prize}**! 🎁`).catch(() => {});
                    } else {
                        await channel.send(`❌ **Giveaway Ended!** Unfortunately, there were no participants for the **${giveaway.prize}** giveaway.`).catch(() => {});
                    }
                } else {
                    if (message.embeds && message.embeds.length > 0) {
                        const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                            .setDescription(
                                `**Prize:** ${giveaway.prize}\n` +
                                `**Winners:** ${giveaway.winnersCount}\n` +
                                `**Participants:** ${entries.length}\n` +
                                `**Ends:** <t:${endTimeUnix}:R>`
                            );

                        await message.edit({ embeds: [updatedEmbed] }).catch(() => {});
                    }
                }
            }
        } catch (err) {
            console.error('[GIVEAWAY TIMER ERROR]', err);
        }
    }, 30000);

    // --- LIVE RCON STATUS MONITOR LOOP ---
    setInterval(async () => {
        try {
            const { GuildConfig, GameServer } = require('./database/db');
            const { sendRconCommand } = require('./utils/rconManager');
            const { Op } = require('sequelize');
            
            const configs = await GuildConfig.findAll({ where: { statusChannelId: { [Op.ne]: null } } });
            
            for (const config of configs) {
                const guild = client.guilds.cache.get(config.guildId);
                if (!guild) continue;
                const channel = guild.channels.cache.get(config.statusChannelId);
                if (!channel) continue;

                // Find server associated with guild
                const servers = await GameServer.findAll({ where: { guildId: config.guildId } });
                if (servers.length === 0) continue;
                const targetServer = servers[0];

                let isOnline = false;
                try {
                    await sendRconCommand(config.guildId, 'server.population', client, targetServer.id);
                    isOnline = true;
                } catch (e) {
                    isOnline = false;
                }

                const statusEmbed = new EmbedBuilder()
                    .setTitle(`🌐 GPortal Server Status — ${guild.name}`)
                    .setDescription(`• **Connection Status:** ${isOnline ? '🟢 ONLINE & HEALTHY' : '🔴 OFFLINE / RESTARTING'}\n• **Server Name:** \`${targetServer.serverName}\``)
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