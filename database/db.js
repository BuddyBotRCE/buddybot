const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');

// Automatically use the permanent Railway volume if hosted, or local folder if on PC
const dbPath = fs.existsSync('/app') ? '/app/data/database.sqlite' : './database.sqlite';

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false
});

const GuildConfig = sequelize.define('GuildConfig', {
    guildId: { type: DataTypes.STRING, primaryKey: true },
    rconIp: { type: DataTypes.STRING, allowNull: true },
    rconPort: { type: DataTypes.STRING, allowNull: true },
    rconPassword: { type: DataTypes.STRING, allowNull: true },
    
    // --- AI CONFIGURATION COLUMNS ---
    aiApiKey: { type: DataTypes.STRING, allowNull: true },
    aiProvider: { type: DataTypes.STRING, defaultValue: 'openai' },
    aiBaseUrl: { type: DataTypes.STRING, defaultValue: 'https://api.openai.com/v1' },
    aiModel: { type: DataTypes.STRING, defaultValue: 'gpt-4o-mini' },
    
    autoEventsEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    autoEventsInterval: { type: DataTypes.INTEGER, defaultValue: 60 },
    autoEventType: { type: DataTypes.STRING, defaultValue: 'supply.drop' },
    lastAutoEvent: { type: DataTypes.DATE, allowNull: true },
    
    cargoDockX: { type: DataTypes.FLOAT, allowNull: true },
    cargoDockY: { type: DataTypes.FLOAT, allowNull: true },
    cargoDockZ: { type: DataTypes.FLOAT, allowNull: true },
    cargoCrateCount: { type: DataTypes.INTEGER, defaultValue: 3 },

    isPremiumServer: { type: DataTypes.BOOLEAN, defaultValue: false },
    logChannelId: { type: DataTypes.STRING, allowNull: true },
    crossChatChannelId: { type: DataTypes.STRING, allowNull: true },
    giveawayChannelId: { type: DataTypes.STRING, allowNull: true },
    giveawayBannerUrl: { type: DataTypes.STRING, allowNull: true },
    ticketCategoryId: { type: DataTypes.STRING, allowNull: true },
    ticketTranscriptChannelId: { type: DataTypes.STRING, allowNull: true },
    ticketAdminRoleId: { type: DataTypes.STRING, allowNull: true },
    ticketVipRoleId: { type: DataTypes.STRING, allowNull: true },
    ticketSendUserTranscript: { type: DataTypes.BOOLEAN, defaultValue: true },
    
    economyCurrency: { type: DataTypes.STRING, defaultValue: 'Scrap' },
    shopMultiplier: { type: DataTypes.INTEGER, defaultValue: 100 },
    bankInterestRate: { type: DataTypes.FLOAT, defaultValue: 0.0 },
    bankInterestHours: { type: DataTypes.INTEGER, defaultValue: 24 },
    lastBankInterest: { type: DataTypes.DATE, allowNull: true },
    casinoMaxBet: { type: DataTypes.INTEGER, defaultValue: 1000 },
    casinoCooldownSeconds: { type: DataTypes.INTEGER, defaultValue: 5 },
    buddyPassXpRate: { type: DataTypes.INTEGER, defaultValue: 10 }
});

const UserEconomy = sequelize.define('UserEconomy', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    wallet: { type: DataTypes.INTEGER, defaultValue: 0 },
    bank: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastDaily: { type: DataTypes.DATE, allowNull: true },
    inGameName: { type: DataTypes.STRING, allowNull: true },
    xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    buddyPassLevel: { type: DataTypes.INTEGER, defaultValue: 1 },
    buddyPassXp: { type: DataTypes.INTEGER, defaultValue: 0 },
    isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
    homeX: { type: DataTypes.FLOAT, allowNull: true },
    homeY: { type: DataTypes.FLOAT, allowNull: true },
    homeZ: { type: DataTypes.FLOAT, allowNull: true },
    lastTp: { type: DataTypes.DATE, allowNull: true }
});

const ShopItem = sequelize.define('ShopItem', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    command: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.INTEGER, allowNull: false },
    category: { type: DataTypes.STRING, defaultValue: 'custom' },
    requiredRoleId: { type: DataTypes.STRING, allowNull: true },
    cooldownSeconds: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const ShopCooldown = sequelize.define('ShopCooldown', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    itemId: { type: DataTypes.INTEGER, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false }
});

const CasinoCooldown = sequelize.define('CasinoCooldown', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false }
});

const Giveaway = sequelize.define('Giveaway', {
    messageId: { type: DataTypes.STRING, primaryKey: true },
    guildId: { type: DataTypes.STRING, allowNull: false },
    channelId: { type: DataTypes.STRING, allowNull: false },
    prize: { type: DataTypes.STRING, allowNull: false },
    endTime: { type: DataTypes.DATE, allowNull: false },
    winnersCount: { type: DataTypes.INTEGER, defaultValue: 1 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    entries: { type: DataTypes.TEXT, defaultValue: '[]' }
});

const CustomBind = sequelize.define('CustomBind', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    emote: { type: DataTypes.STRING, allowNull: false },
    command: { type: DataTypes.STRING, allowNull: false },
    cooldown: { type: DataTypes.INTEGER, defaultValue: 0 }, 
    cost: { type: DataTypes.INTEGER, defaultValue: 0 },     
    roleId: { type: DataTypes.STRING, allowNull: true }     
});

const BindCooldown = sequelize.define('BindCooldown', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    inGameName: { type: DataTypes.STRING, allowNull: false },
    emote: { type: DataTypes.STRING, allowNull: false },
    lastUsed: { type: DataTypes.DATE, allowNull: false }
});

const ServerKit = sequelize.define('ServerKit', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    kitName: { type: DataTypes.STRING, allowNull: false },
    items: { type: DataTypes.TEXT, allowNull: false } 
});

const OrpConfig = sequelize.define('OrpConfig', {
    guildId: { type: DataTypes.STRING, primaryKey: true },
    zoneSize: { type: DataTypes.INTEGER, defaultValue: 25 },
    onlineColor: { type: DataTypes.STRING, defaultValue: 'green' },
    offlineColor: { type: DataTypes.STRING, defaultValue: 'blue' },
    activeDurationHours: { type: DataTypes.INTEGER, defaultValue: 24 }
});

const PlayerOrpBase = sequelize.define('PlayerOrpBase', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    inGameName: { type: DataTypes.STRING, allowNull: false },
    x: { type: DataTypes.FLOAT, allowNull: false },
    y: { type: DataTypes.FLOAT, allowNull: false },
    z: { type: DataTypes.FLOAT, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const BuddyPassChallenge = sequelize.define('BuddyPassChallenge', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    targetType: { type: DataTypes.STRING, allowNull: false },
    targetAmount: { type: DataTypes.INTEGER, defaultValue: 10 },
    rewardXp: { type: DataTypes.INTEGER, defaultValue: 100 },
    isPreloaded: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const BuddyPassReward = sequelize.define('BuddyPassReward', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, allowNull: false },
    rewardType: { type: DataTypes.STRING, allowNull: false },
    rewardValue: { type: DataTypes.STRING, allowNull: false }
});

const TicketCategory = sequelize.define('TicketCategory', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, defaultValue: 'Support ticket category' }
});

const PveZone = sequelize.define('PveZone', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    zoneName: { type: DataTypes.STRING, allowNull: false },
    shape: { type: DataTypes.STRING, defaultValue: 'sphere' },
    x: { type: DataTypes.FLOAT, allowNull: false },
    y: { type: DataTypes.FLOAT, allowNull: false },
    z: { type: DataTypes.FLOAT, allowNull: false },
    size: { type: DataTypes.STRING, defaultValue: '50' },
    color: { type: DataTypes.STRING, defaultValue: 'green' },
    enterMessage: { type: DataTypes.STRING, defaultValue: 'You have entered a PVE Safe Zone.' },
    exitMessage: { type: DataTypes.STRING, defaultValue: 'You have left the PVE Safe Zone. PvP is now enabled.' }
});

sequelize.query('DROP TABLE IF EXISTS `GuildConfigs_backup`;')
    .then(() => { return sequelize.sync({ alter: true }); })
    .then(() => { console.log('[DATABASE] Synced securely.'); })
    .catch(err => { console.error('[DATABASE SYNC ERROR]', err); });

module.exports = { 
    sequelize, GuildConfig, UserEconomy, Giveaway, CustomBind, 
    BindCooldown, ServerKit, ShopItem, ShopCooldown, CasinoCooldown, 
    OrpConfig, PlayerOrpBase, BuddyPassChallenge, BuddyPassReward, TicketCategory, PveZone 
};