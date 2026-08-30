const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

let sequelize;

if (process.env.DATABASE_URL) {
    // 👇 ADDED: POOLING SETTINGS FOR MASSIVE SCALE 👇
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: { 
            ssl: { 
                require: true, 
                rejectUnauthorized: false 
            } 
        },
        pool: {
            max: 15,       // Max open connections
            min: 2,        // Keep 2 open for instant speed
            acquire: 60000, // Max time to wait for a connection
            idle: 10000    // Release connection if unused for 10s
        }
    });
    console.log('[DATABASE] Connected to production PostgreSQL database.');
} else {
    // 👇 ADDED: SAFETY NET IF URL IS MISSING ON RAILWAY 👇
    if (process.env.NODE_ENV === 'production') {
        console.error("❌ CRITICAL ERROR: DATABASE_URL is missing from your Railway environment variables! The bot cannot start.");
        process.exit(1); 
    }
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
    aiEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    aiPremadeResponses: { type: DataTypes.TEXT, defaultValue: '[]' },
    logAdminChannelId: { type: DataTypes.STRING, allowNull: true },
    logGameChannelId: { type: DataTypes.STRING, allowNull: true },
    logDiscordChannelId: { type: DataTypes.STRING, allowNull: true },
    logMemberChannelId: { type: DataTypes.STRING, allowNull: true },
    logMessageChannelId: { type: DataTypes.STRING, allowNull: true },
    logVoiceChannelId: { type: DataTypes.STRING, allowNull: true },
    suggestionChannelId: { type: DataTypes.STRING, allowNull: true },
    suggestionPingRoleId: { type: DataTypes.STRING, allowNull: true },
    bountyKillsToActivate: { type: DataTypes.INTEGER, defaultValue: 5 },
    bountyRewardAmount: { type: DataTypes.INTEGER, defaultValue: 500 },
    bountyCooldownMinutes: { type: DataTypes.INTEGER, defaultValue: 60 },
    clanCreationCost: { type: DataTypes.INTEGER, defaultValue: 1000 },
    clanDefaultMaxMembers: { type: DataTypes.INTEGER, defaultValue: 4 },
    clanDiscordSyncEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    autoModEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    autoModCapsLimit: { type: DataTypes.INTEGER, defaultValue: 70 },
    autoModAction: { type: DataTypes.STRING, defaultValue: 'timeout' },
    autoModMutedWords: { type: DataTypes.TEXT, defaultValue: '[]' },
    amCapsEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    amCapsLimit: { type: DataTypes.INTEGER, defaultValue: 70 },
    amCapsAction: { type: DataTypes.STRING, defaultValue: 'delete' },
    amSpamEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    amSpamLimit: { type: DataTypes.INTEGER, defaultValue: 5 },
    amSpamAction: { type: DataTypes.STRING, defaultValue: 'delete' },
    amMentionsEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    amMentionsLimit: { type: DataTypes.INTEGER, defaultValue: 4 },
    amMentionsAction: { type: DataTypes.STRING, defaultValue: 'delete' },
    amLinkEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    amLinkAction: { type: DataTypes.STRING, defaultValue: 'delete' },
    amInviteEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    amInviteAction: { type: DataTypes.STRING, defaultValue: 'delete' },
    amWordsEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    amWordsList: { type: DataTypes.TEXT, defaultValue: '' },
    amWordsAction: { type: DataTypes.STRING, defaultValue: 'delete' },
    adminRoleId: { type: DataTypes.STRING, allowNull: true },
    modRoleId: { type: DataTypes.STRING, allowNull: true },
    scientistKillReward: { type: DataTypes.INTEGER, defaultValue: 10 },
    playerKillReward: { type: DataTypes.INTEGER, defaultValue: 50 },
    skipNightEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    skipNightPercentage: { type: DataTypes.INTEGER, defaultValue: 50 },
    skipNightEmote: { type: DataTypes.STRING, defaultValue: 'Wait Here' },
    ticketTranscriptChannel: { type: DataTypes.STRING, allowNull: true },
    ticketSupportRole: { type: DataTypes.STRING, allowNull: true }, 
});

const GameServer = sequelize.define('GameServer', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, guildId: { type: DataTypes.STRING, allowNull: false }, serverName: { type: DataTypes.STRING, allowNull: false }, rconIp: { type: DataTypes.STRING, allowNull: false }, rconPort: { type: DataTypes.STRING, allowNull: false }, rconPassword: { type: DataTypes.STRING, allowNull: false }});
const UserEconomy = sequelize.define('UserEconomy', { guildId: { type: DataTypes.STRING, primaryKey: true }, userId: { type: DataTypes.STRING, primaryKey: true }, wallet: { type: DataTypes.INTEGER, defaultValue: 0 }, bank: { type: DataTypes.INTEGER, defaultValue: 0 }, inGameName: { type: DataTypes.STRING, allowNull: true }, lastDaily: { type: DataTypes.DATE, allowNull: true }, lastVoteTime: { type: DataTypes.DATE, allowNull: true }, xp: { type: DataTypes.INTEGER, defaultValue: 0 }, level: { type: DataTypes.INTEGER, defaultValue: 1 }, pvpKills: { type: DataTypes.INTEGER, defaultValue: 0 }, pveKills: { type: DataTypes.INTEGER, defaultValue: 0 }, deaths: { type: DataTypes.INTEGER, defaultValue: 0 }, currentKillstreak: { type: DataTypes.INTEGER, defaultValue: 0 } });
const Giveaway = sequelize.define('Giveaway', { messageId: { type: DataTypes.STRING, primaryKey: true }, guildId: { type: DataTypes.STRING }, channelId: { type: DataTypes.STRING }, prize: { type: DataTypes.STRING }, endTime: { type: DataTypes.DATE }, winnersCount: { type: DataTypes.INTEGER, defaultValue: 1 }, entries: { type: DataTypes.TEXT, defaultValue: '[]' }, isActive: { type: DataTypes.BOOLEAN, defaultValue: true } });
const CustomBind = sequelize.define('CustomBind', { guildId: { type: DataTypes.STRING, allowNull: false }, name: { type: DataTypes.STRING, defaultValue: 'Custom Bind' }, actionType: { type: DataTypes.STRING, defaultValue: 'custom' }, targetValue: { type: DataTypes.TEXT, allowNull: true }, rotation: { type: DataTypes.STRING, allowNull: true }, emote: { type: DataTypes.STRING, defaultValue: '⭐' }, command: { type: DataTypes.TEXT, allowNull: true }, cooldown: { type: DataTypes.INTEGER, defaultValue: 0 }, cost: { type: DataTypes.INTEGER, defaultValue: 0 }, roleId: { type: DataTypes.STRING, allowNull: true } });
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

const PveZone = sequelize.define('PveZone', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING },
    radius: { type: DataTypes.STRING, defaultValue: '50' }, 
    shape: { type: DataTypes.STRING, defaultValue: 'sphere' },
    posX: { type: DataTypes.STRING },
    posY: { type: DataTypes.STRING },
    posZ: { type: DataTypes.STRING },
    color: { type: DataTypes.STRING, defaultValue: '#FF0000' },
    pvp: { type: DataTypes.BOOLEAN, defaultValue: false },
    pve: { type: DataTypes.BOOLEAN, defaultValue: true },
    build: { type: DataTypes.BOOLEAN, defaultValue: false },
    visible: { type: DataTypes.BOOLEAN, defaultValue: true },
    isEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    enterMessage: { type: DataTypes.STRING, allowNull: true },
    exitMessage: { type: DataTypes.STRING, allowNull: true },
    rotation: { type: DataTypes.STRING, defaultValue: '0' },
});

const ActiveBounty = sequelize.define('ActiveBounty', { guildId: { type: DataTypes.STRING }, userId: { type: DataTypes.STRING }, inGameName: { type: DataTypes.STRING }, reward: { type: DataTypes.INTEGER } });
const BountyCooldown = sequelize.define('BountyCooldown', { guildId: { type: DataTypes.STRING, primaryKey: true }, userId: { type: DataTypes.STRING, primaryKey: true }, expiresAt: { type: DataTypes.DATE } });
const Clan = sequelize.define('Clan', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, guildId: { type: DataTypes.STRING, allowNull: false }, name: { type: DataTypes.STRING, allowNull: false }, tag: { type: DataTypes.STRING, allowNull: false }, leaderId: { type: DataTypes.STRING, allowNull: false }, bankBalance: { type: DataTypes.INTEGER, defaultValue: 0 }, taxRate: { type: DataTypes.INTEGER, defaultValue: 0 }, maxMembers: { type: DataTypes.INTEGER, defaultValue: 4 }, baseCodes: { type: DataTypes.STRING, allowNull: true }, discordRoleId: { type: DataTypes.STRING, allowNull: true }, discordTextChannelId: { type: DataTypes.STRING, allowNull: true }, discordVoiceChannelId: { type: DataTypes.STRING, allowNull: true } });
const ClanMember = sequelize.define('ClanMember', { guildId: { type: DataTypes.STRING, primaryKey: true }, userId: { type: DataTypes.STRING, primaryKey: true }, clanId: { type: DataTypes.INTEGER, allowNull: false }, role: { type: DataTypes.STRING, defaultValue: 'Member' } });
const ClanInvite = sequelize.define('ClanInvite', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, guildId: { type: DataTypes.STRING, allowNull: false }, clanId: { type: DataTypes.INTEGER, allowNull: false }, userId: { type: DataTypes.STRING, allowNull: false } });
const ClanWar = sequelize.define('ClanWar', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, guildId: { type: DataTypes.STRING, allowNull: false }, challengerClanId: { type: DataTypes.INTEGER, allowNull: false }, targetClanId: { type: DataTypes.INTEGER, allowNull: false }, status: { type: DataTypes.STRING, defaultValue: 'active' } });
const ReactionRole = sequelize.define('ReactionRole', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, guildId: { type: DataTypes.STRING, allowNull: false }, messageId: { type: DataTypes.STRING, allowNull: false }, emoji: { type: DataTypes.STRING, allowNull: false }, roleId: { type: DataTypes.STRING, allowNull: false }, buttonLabel: { type: DataTypes.STRING, allowNull: true }, buttonStyle: { type: DataTypes.STRING, defaultValue: 'Primary' } });

const AutoEvent = sequelize.define('AutoEvent', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, guildId: { type: DataTypes.STRING, allowNull: false }, name: { type: DataTypes.STRING, allowNull: false }, eventType: { type: DataTypes.STRING, defaultValue: 'hackable' }, interval: { type: DataTypes.INTEGER, defaultValue: 60 }, amount: { type: DataTypes.INTEGER, defaultValue: 1 }, isEnabled: { type: DataTypes.BOOLEAN, defaultValue: false } });
const AutoEventLocation = sequelize.define('AutoEventLocation', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, guildId: { type: DataTypes.STRING, allowNull: false }, eventId: { type: DataTypes.INTEGER, allowNull: false }, slot: { type: DataTypes.INTEGER, allowNull: false }, posX: { type: DataTypes.STRING, allowNull: false }, posY: { type: DataTypes.STRING, allowNull: false }, posZ: { type: DataTypes.STRING, allowNull: false } });

const CustomEmbed = sequelize.define('CustomEmbed', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, guildId: { type: DataTypes.STRING, allowNull: false }, templateName: { type: DataTypes.STRING, defaultValue: 'Custom Announcement' }, title: { type: DataTypes.STRING, defaultValue: '📢 Server Announcement' }, description: { type: DataTypes.TEXT, allowNull: true }, color: { type: DataTypes.STRING, defaultValue: '#3498db' }, thumbnailUrl: { type: DataTypes.STRING, allowNull: true }, imageUrl: { type: DataTypes.STRING, allowNull: true }, footerText: { type: DataTypes.STRING, allowNull: true } });

const HomeTeleportConfig = sequelize.define('HomeTeleportConfig', {
    guildId: { type: DataTypes.STRING, allowNull: false, unique: true },
    requiredRoleId: { type: DataTypes.STRING, allowNull: true },
    cooldownMinutes: { type: DataTypes.INTEGER, defaultValue: 30 }
});

const HomeTeleportCooldown = sequelize.define('HomeTeleportCooldown', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false }
});

const HomeTeleportLocation = sequelize.define('HomeTeleportLocation', {
    guildId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false, unique: true },
    posX: { type: DataTypes.STRING, allowNull: false },
    posY: { type: DataTypes.STRING, allowNull: false },
    posZ: { type: DataTypes.STRING, allowNull: false }
});

async function initDb() { 
    await sequelize.authenticate(); 
    await sequelize.sync({ alter: true }); 
    console.log('[DATABASE] Tables synchronized successfully.'); 
}
initDb();

module.exports = { 
    sequelize, GuildConfig, GameServer, UserEconomy, Giveaway, CustomBind, BindCooldown, ServerKit, ShopItem, ShopCooldown, CasinoCooldown, OrpConfig, PlayerOrpBase, BuddyPassChallenge, BuddyPassReward, TicketCategory, PveZone, AutoEvent, AutoEventLocation, ActiveBounty, BountyCooldown, Clan, ClanMember, ClanInvite, ClanWar, ReactionRole, CustomEmbed,
    HomeTeleportConfig, HomeTeleportCooldown, HomeTeleportLocation 
};