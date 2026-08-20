require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { GuildConfig } = require('./database/db');
const { sendRconCommand } = require('./utils/rconManager');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

global.discordClient = client;

client.commands = new Collection();

// ==========================================
// LOAD ONLY AUTHORIZED CORE SLASH COMMANDS
// ==========================================
const allowedCommands = ['adminpanel.js', 'playerpanel.js'];

const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));
for (const folder of commandFolders) {
    const folderPath = path.join(__dirname, 'commands', folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        if (!allowedCommands.includes(file)) continue;

        const command = require(path.join(folderPath, file));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// ==========================================
// EVENT HANDLERS (FORCE CACHE OVERWRITE)
// ==========================================
client.once('clientReady', async () => {
    console.log(`[SYSTEM] BuddyBotRCE is online as ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        const commandsData = client.commands.map(cmd => cmd.data.toJSON());
        
        // This completely overwrites Discord's cache, deleting all old phantom commands
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsData },
        );
        console.log('[SYSTEM] Discord command cache wiped and cleanly synced.');
    } catch (error) {
        console.error('[COMMAND REGISTRATION ERROR]', error);
    }
});

// LISTENS FOR BUTTONS, MENUS, AND SLASH COMMANDS
client.on('interactionCreate', async interaction => {
    const handleInteraction = require('./events/interactionCreate');
    await handleInteraction(interaction, client);
});

// LISTENS FOR @BUDDYBOT CHAT MESSAGES (FOR AI)
client.on('messageCreate', async message => {
    const handleMessage = require('./events/messageCreate');
    await handleMessage(message, client);
});

// ==========================================
// BACKGROUND PREMIUM AUTO-EVENT LOOP
// ==========================================
setInterval(async () => {
    try {
        const servers = await GuildConfig.findAll({ where: { autoEventsEnabled: true, isPremiumServer: true } });
        const now = new Date();

        for (const server of servers) {
            if (!server.rconIp || !server.rconPassword) continue;

            const lastEvent = server.lastAutoEvent ? new Date(server.lastAutoEvent) : new Date(0);
            const intervalMs = (server.autoEventsInterval || 60) * 60000;

            if (now - lastEvent >= intervalMs) {
                const commandToRun = server.autoEventType || 'supply.drop';
                await sendRconCommand(server.guildId, commandToRun);
                await server.update({ lastAutoEvent: now });
                console.log(`[AUTO-EVENT] Triggered "${commandToRun}" for guild ID: ${server.guildId}`);
            }
        }
    } catch (err) {
        console.error('[AUTO-EVENT LOOP ERROR]', err);
    }
}, 60000);


client.login(process.env.DISCORD_TOKEN);