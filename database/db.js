const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

let sequelize;

if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
    });
    console.log('[DATABASE] Connected to production PostgreSQL database.');
} else {
    const storagePath = process.env.DATABASE_STORAGE || path.join(__dirname, '../database.sqlite');
    sequelize = new Sequelize({ dialect: 'sqlite', storage: storagePath, logging: false });
    console.log('[DATABASE] Connected to local SQLite database.');
}

const GuildConfig = sequelize.define('GuildConfig', {
    guildId: { type: DataTypes.STRING, primaryKey: true },
    rconIp: { type: DataTypes.STRING, allowNull: true },
    rconPort: { type: DataTypes.STRING, allowNull: true },
    rconPassword: { type: DataTypes.STRING, allowNull: true },
    crossChatChannelId: { type: DataTypes.STRING, allowNull: true },
    killfeedChannelId: { type: DataTypes.STRING, allowNull: true },
    giveawayChannelId: { type: DataTypes.STRING, allowNull: true },
    giveawayBannerUrl: { type: DataTypes.STRING, allowNull: true },
    ticketCategoryId: { type: DataTypes.STRING, allowNull: true },
    ticketTranscriptChannelId: { type: DataTypes.STRING, allowNull: true },
    ticketAdminRoleId: { type: DataTypes.STRING, allowNull: true },
    ticketVipRoleId: { type: DataTypes.STRING, allowNull: true },
    ticketSendUserTranscript: { type: DataTypes.BOOLEAN, defaultValue: true },
    economyCurrency: { type: DataTypes.STRING, defaultValue: 'Scrap' },
    shopMultiplier: { type: DataTypes.INTEGER, defaultValue: 100 },
    bankInterestRate: { type: DataTypes.FLOAT, defaultValue: 0 },
    bankInterestHours: { type: DataTypes.INTEGER, defaultValue: 24 },
    lastBankInterest: { type: DataTypes.DATE, allowNull: true },
    casinoMaxBet: { type: DataTypes.INTEGER, defaultValue: 1000 },
    casinoCooldownSeconds: { type: DataTypes.INTEGER, defaultValue: 5 },
    buddyPassXpRate: { type: DataTypes.INTEGER, defaultValue: 10 },
    autoEventsEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    cargoInterval: { type: DataTypes.INTEGER, defaultValue: 60 },
    supplyInterval: { type: DataTypes.INTEGER, defaultValue: 60 },
    eliteInterval: { type: DataTypes.INTEGER, defaultValue: 60 },
    timedInterval: { type: DataTypes.INTEGER, defaultValue: 60 },
    cargoCrateCount: { type: DataTypes.INTEGER, defaultValue: 3 },
    cargoDockX: { type: DataTypes.FLOAT, allowNull: true },
    cargoDockY: { type: DataTypes.FLOAT, allowNull: true },
    cargoDockZ: { type: DataTypes.FLOAT, allowNull: true },
    voteUrl: { type: DataTypes.STRING, allowNull: true },
    voteRewardAmount: { type: DataTypes.INTEGER, defaultValue: 250 },
    isPremiumServer: { type: DataTypes.BOOLEAN, defaultValue: false },
    stripeCustomerId: { type: DataTypes.STRING, allowNull: true },
    subscriptionStatus: { type: DataTypes.STRING, defaultValue: 'inactive' },
    subscriptionExpiresAt: { type: DataTypes.DATE, allowNull: true },
    statusChannelId: { type: DataTypes.STRING, allowNull: true },
    statusMessageId: { type: DataTypes.STRING, allowNull: true },
    aiProvider: { type: DataTypes.STRING, defaultValue: 'openai' },
    aiModel: { type: DataTypes.STRING, defaultValue: 'gpt-4o-mini' },
    aiApiKey: { type: DataTypes.STRING, allowNull: true },
    aiBaseUrl: { type: DataTypes.STRING, defaultValue: 'https://api.openai.com/v1' },
    logAdminChannelId: { type: DataTypes.STRING, allowNull: true },
    logGameChannelId: { type: DataTypes.STRING, allowNull: true },
    logDiscordChannelId: { type: DataTypes.STRING, allowNull: true },
    suggestionChannelId: { type: DataTypes.STRING, allowNull: true },
    suggestionPingRoleId: { type: DataTypes.STRING, allowNull: true },
    bountyKillsToActivate: { type: DataTypes.INTEGER, defaultValue: 5 },
    bountyRewardAmount: { type: DataTypes.INTEGER, defaultValue: 500 },
    bountyCooldownMinutes: { type: DataTypes.INTEGER, defaultValue: 60 },
    // --- NEW CLAN CONFIG ---
    clanCreationCost: { type: DataTypes.INTEGER, defaultValue: 1000 },
    clanDefaultMaxMembers: { type: DataTypes.INTEGER, defaultValue: 4 },
    clanDiscordSyncEnabled: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const UserEconomy = sequelize.define('UserEconomy', { guildId: { type: DataTypes.STRING, primaryKey: true }, userId: { type: DataTypes.STRING, primaryKey: true }, wallet: { type: DataTypes.INTEGER, defaultValue: 0 }, bank: { type: DataTypes.INTEGER, defaultValue: 0 }, inGameName: { type: DataTypes.STRING, allowNull: true }, lastDaily: { type: DataTypes.DATE, allowNull: true }, lastVoteTime: { type: DataTypes.DATE, allowNull: true }, xp: { type: DataTypes.INTEGER, defaultValue: 0 }, level: { type: DataTypes.INTEGER, defaultValue: 1 }, pvpKills: { type: DataTypes.INTEGER, defaultValue: 0 }, pveKills: { type: DataTypes.INTEGER, defaultValue: 0 }, deaths: { type: DataTypes.INTEGER, defaultValue: 0 }, currentKillstreak: { type: DataTypes.INTEGER, defaultValue: 0 } });
const Giveaway = sequelize.define('Giveaway', { messageId: { type: DataTypes.STRING, primaryKey: true }, guildId: { type: DataTypes.STRING }, channelId: { type: DataTypes.STRING }, prize: { type: DataTypes.STRING }, endTime: { type: DataTypes.DATE }, winnersCount: { type: DataTypes.INTEGER, defaultValue: 1 }, entries: { type: DataTypes.TEXT, defaultValue: '[]' }, isActive: { type: DataTypes.BOOLEAN, defaultValue: true } });
const CustomBind = sequelize.define('CustomBind', { guildId: { type: DataTypes.STRING }, emote: { type: DataTypes.STRING }, command: { type: DataTypes.TEXT }, cooldown: { type: DataTypes.INTEGER, defaultValue: 0 }, cost: { type: DataTypes.INTEGER, defaultValue: 0 }, roleId: { type: DataTypes.STRING, allowNull: true } });
const BindCooldown = sequelize.define('BindCooldown', { guildId: { type: DataTypes.STRING, primaryKey: true }, userId: { type: DataTypes.STRING, primaryKey: true }, bindId: { type: DataTypes.INTEGER, primaryKey: true }, expiresAt: { type: DataTypes.DATE } });
const ServerKit = sequelize.define('ServerKit', { guildId: { type: DataTypes.STRING }, kitName: { type: DataTypes.STRING }, items: { type: DataTypes.TEXT } });
const ShopItem = sequelize.define('ShopItem', { guildId: { type: DataTypes.STRING }, name: { type: DataTypes.STRING }, command: { type: DataTypes.STRING }, price: { type: DataTypes.INTEGER }, category: { type: DataTypes.STRING, defaultValue: 'custom' }, cooldownSeconds: { type: DataTypes.INTEGER, defaultValue: 0 }, requiredRoleId: { type: DataTypes.STRING, allowNull: true } });
const ShopCooldown = sequelize.define('ShopCooldown', { guildId: { type: DataTypes.STRING, primaryKey: true }, userId: { type: DataTypes.STRING, primaryKey: true }, itemId: { type: DataTypes.INTEGER, primaryKey: true }, expiresAt: { type: DataTypes.DATE } });
const CasinoCooldown = sequelize.define('CasinoCooldown', { guildId: { type: DataTypes.STRING, primaryKey: true }, userId: { type: DataTypes.STRING, primaryKey: true }, expiresAt: { type: DataTypes.DATE } });
const OrpConfig = sequelize.define('OrpConfig', { guildId: { type: DataTypes.STRING, primaryKey: true }, zoneSize: { type: DataTypes.INTEGER, defaultValue: 25 }, onlineColor: { type: DataTypes.STRING, defaultValue: 'green' }, offlineColor: { type: DataTypes.STRING, defaultValue: 'blue' }, activeDurationHours: { type: DataTypes.INTEGER, defaultValue: 24 } });
const PlayerOrpBase = sequelize.define('PlayerOrpBase', { guildId: { type: DataTypes.STRING }, inGameName: { type: DataTypes.STRING }, x: { type: DataTypes.FLOAT }, y: { type: DataTypes.FLOAT }, z: { type: DataTypes.FLOAT } });
const BuddyPassChallenge = sequelize.define('BuddyPassChallenge', { guildId: { type: DataTypes.STRING }, title: { type: DataTypes.STRING }, targetType: { type: DataTypes.STRING }, targetAmount: { type: DataTypes.INTEGER }, rewardXp: { type: DataTypes.INTEGER }, isPreloaded: { type: DataTypes.BOOLEAN, defaultValue: false } });
const BuddyPassReward = sequelize.define('BuddyPassReward', { guildId: { type: DataTypes.STRING, primaryKey: true }, level: { type: DataTypes.INTEGER, primaryKey: true }, rewardType: { type: DataTypes.STRING }, rewardValue: { type: DataTypes.STRING } });
const TicketCategory = sequelize.define('TicketCategory', { guildId: { type: DataTypes.STRING }, name: { type: DataTypes.STRING }, description: { type: DataTypes.STRING } });
const PveZone = sequelize.define('PveZone', { guildId: { type: DataTypes.STRING }, zoneName: { type: DataTypes.STRING }, shape: { type: DataTypes.STRING, defaultValue: 'sphere' }, x: { type: DataTypes.FLOAT }, y: { type: DataTypes.FLOAT }, z: { type: DataTypes.FLOAT }, size: { type: DataTypes.STRING }, color: { type: DataTypes.STRING, defaultValue: 'green' }, enterMessage: { type: DataTypes.STRING }, exitMessage: { type: DataTypes.STRING } });
const ActiveBounty = sequelize.define('ActiveBounty', { guildId: { type: DataTypes.STRING }, userId: { type: DataTypes.STRING }, inGameName: { type: DataTypes.STRING }, reward: { type: DataTypes.INTEGER } });
const BountyCooldown = sequelize.define('BountyCooldown', { guildId: { type: DataTypes.STRING, primaryKey: true }, userId: { type: DataTypes.STRING, primaryKey: true }, expiresAt: { type: DataTypes.DATE } });

// --- NEW CLAN TABLES ---
const Clan = sequelize.define('Clan', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    guildId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    tag: { type: DataTypes.STRING, allowNull: false },
    leaderId: { type: DataTypes.STRING, allowNull: false },
    bankBalance: { type: DataTypes.INTEGER, defaultValue: 0 },
    taxRate: { type: DataTypes.INTEGER, defaultValue: 0 },
    maxMembers: { type: DataTypes.INTEGER, defaultValue: 4 },
    baseCodes: { type: DataTypes.STRING, allowNull: true },
    discordRoleId: { type: DataTypes.STRING, allowNull: true },
    discordTextChannelId: { type: DataTypes.STRING, allowNull: true },
    discordVoiceChannelId: { type: DataTypes.STRING, allowNull: true }
});

const ClanMember = sequelize.define('ClanMember', {
    guildId: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, primaryKey: true },
    clanId: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'Member' } // 'Leader', 'Officer', 'Member'
});

const ClanInvite = sequelize.define('ClanInvite', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    guildId: { type: DataTypes.STRING, allowNull: false },
    clanId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false }
});

const ClanWar = sequelize.define('ClanWar', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    guildId: { type: DataTypes.STRING, allowNull: false },
    challengerClanId: { type: DataTypes.INTEGER, allowNull: false },
    targetClanId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'active' }
});

async function initDb() { await sequelize.authenticate(); await sequelize.sync(); console.log('[DATABASE] Tables synchronized successfully.'); }
initDb();

module.exports = { sequelize, GuildConfig, UserEconomy, Giveaway, CustomBind, BindCooldown, ServerKit, ShopItem, ShopCooldown, CasinoCooldown, OrpConfig, PlayerOrpBase, BuddyPassChallenge, BuddyPassReward, TicketCategory, PveZone, ActiveBounty, BountyCooldown, Clan, ClanMember, ClanInvite, ClanWar };