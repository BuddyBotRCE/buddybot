require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Attach client globally for RCON manager accessibility
global.discordClient = client;
client.commands = new Collection();

// Load Slash Commands with Console Debugging
const commandsPath = path.join(__dirname, 'commands');
console.log(`[SYSTEM] Looking for commands in: ${commandsPath}`);
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    console.log(`[SYSTEM] Found command files:`, commandFiles);
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`[SYSTEM] Successfully loaded command: /${command.data.name}`);
        }
    }
} else {
    console.log(`[SYSTEM ERROR] Commands directory not found!`);
}

// Load Events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        const eventName = file.split('.')[0];
        
        if (eventName === 'interactionCreate') {
            client.on('interactionCreate', async interaction => {
                await event(interaction, client);
            });
        }
    }
}

client.once('clientReady', async () => {
    console.log(`[SYSTEM] BuddyBotRCE is online as ${client.user.tag}`);

    // Standard Global Command Registration
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const commandData = client.commands.map(cmd => cmd.data.toJSON());
    
    try {
        console.log(`[SYSTEM] Registering ${commandData.length} global commands to Discord...`);
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandData },
        );
        console.log('[SYSTEM] Global commands successfully registered!');
    } catch (error) {
        console.error('[COMMAND SYNC ERROR]', error);
    }

    // --- LIVE RCON STATUS MONITOR LOOP (Runs every 60 seconds) ---
    setInterval(async () => {
        try {
            const { GuildConfig } = require('./database/db');
            const { sendRconCommand } = require('./utils/rconManager');
            
            const configs = await GuildConfig.findAll({ where: { statusChannelId: { [require('sequelize').Op.ne]: null } } });
            
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