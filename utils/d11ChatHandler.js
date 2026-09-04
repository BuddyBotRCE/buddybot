const { processHomeTpChat } = require('./chatHomeTp');
const { processCustomBindChat } = require('./chatCustomBinds');
const { processSkipNightChat } = require('./chatSkipNight');
const { UserEconomy, CustomBind, BindCooldown } = require('../database/db'); // Required for dynamic checks

// Anti-Spam / Double-Trigger Cache
const debounceCache = new Map();
// Dynamic Recycler Position Queue
const pendingRecyclers = new Map();

const CHAT_CATEGORIES = [
    { label: 'Combat', value: 'cat_combat', emoji: '⚔️', description: 'Under attack, move out, etc.' },
    { label: 'Building', value: 'cat_building', emoji: '🧱', description: 'Walls, beds, door codes, upkeep' },
    { label: 'Activities', value: 'cat_activities', emoji: '⛏️', description: 'Going for wood, stone, scrap, etc.' },
    { label: 'Questions', value: 'cat_questions', emoji: '❓', description: 'Are you friendly, team up, trade' },
    { label: 'Responses', value: 'cat_responses', emoji: '✅', description: 'Yes, no, ok, thank you' },
    { label: 'Orders', value: 'cat_orders', emoji: '👉', description: 'Follow me, repair, come in' },
    { label: 'Location', value: 'cat_location', emoji: '🧭', description: 'North, south, east, west' },
    { label: 'I Need', value: 'cat_need', emoji: '💎', description: 'I need scrap, fuel, food, wood' },
    { label: 'I Have', value: 'cat_have', emoji: '🎒', description: 'I have scrap, bow, pickaxe' }
];

const CHAT_OPTIONS_MAP = {
    cat_combat: [
        { label: 'We\'re Under Attack', value: 'd11_quick_chat_combat_slot_0', emoji: '⚔️' }, 
        { label: 'Move Out', value: 'd11_quick_chat_combat_slot_2', emoji: '🚀' }, 
        { label: 'Don\'t Shoot', value: 'd11_quick_chat_combat_slot_3', emoji: '🛑' }, 
        { label: 'Be Careful - Better Armed', value: 'd11_quick_chat_combat_slot_4', emoji: '⚠️' }, 
        { label: 'I\'m Out of Ammo', value: 'd11_quick_chat_combat_slot_5', emoji: '🔴' }, 
        { label: 'I\'m Hurt', value: 'd11_quick_chat_combat_slot_6', emoji: '🩸' }
    ],
    cat_building: [
        { label: 'Upgrade Walls', value: 'd11_quick_chat_building_slot_0', emoji: '🧱' }, 
        { label: 'We Need Beds', value: 'd11_quick_chat_building_slot_1', emoji: '🛏️' }, 
        { label: 'I Need Building Auth', value: 'd11_quick_chat_building_slot_2', emoji: '🔑' }, 
        { label: 'What\'s the Door Code?', value: 'd11_quick_chat_building_slot_3', emoji: '🔢' }, 
        { label: 'We Need a Better Door', value: 'd11_quick_chat_building_slot_5', emoji: '🚪' }, 
        { label: 'Upkeep Running Low', value: 'd11_quick_chat_building_slot_6', emoji: '⏳' }, 
        { label: 'Which Chest is Free Game?', value: 'd11_quick_chat_building_slot_7', emoji: '📦' }
    ],
    cat_activities: [
        { label: 'Going for Stone', value: 'd11_quick_chat_activities_slot_0', emoji: '🪨' }, 
        { label: 'Going for Wood', value: 'd11_quick_chat_activities_slot_1', emoji: '🪵' }, 
        { label: 'Going for Metal', value: 'd11_quick_chat_activities_slot_2', emoji: '⛏️' }, 
        { label: 'Going for Food', value: 'd11_quick_chat_activities_slot_3', emoji: '🍖' }, 
        { label: 'Going for Water', value: 'd11_quick_chat_activities_slot_4', emoji: '💧' }, 
        { label: 'Going for Scrap', value: 'd11_quick_chat_activities_slot_5', emoji: '⚙️' }, 
        { label: 'Going for Metal Frags', value: 'd11_quick_chat_activities_slot_6', emoji: '🔩' }, 
        { label: 'Going for Medicine', value: 'd11_quick_chat_activities_slot_7', emoji: '💉' }
    ],
    cat_questions: [
        { label: 'Are You Friendly?', value: 'd11_quick_chat_questions_slot_0', emoji: '🤝' }, 
        { label: 'Can I Build Around Here?', value: 'd11_quick_chat_questions_slot_1', emoji: '🏗️' }, 
        { label: 'Do You Want to Team Up?', value: 'd11_quick_chat_questions_slot_2', emoji: '👥' }, 
        { label: 'Do You Need Anything?', value: 'd11_quick_chat_questions_slot_3', emoji: '❓' }, 
        { label: 'Could You Help Me?', value: 'd11_quick_chat_questions_slot_4', emoji: '🆘' }, 
        { label: 'Want to Trade?', value: 'd11_quick_chat_questions_slot_5', emoji: '🤝' }, 
        { label: 'Who\'s There?', value: 'd11_quick_chat_questions_slot_6', emoji: '👀' }, 
        { label: 'Can I Enter?', value: 'd11_quick_chat_questions_slot_7', emoji: '🚪' }
    ],
    cat_responses: [
        { label: 'Yes', value: 'd11_quick_chat_responses_slot_0', emoji: '✅' }, 
        { label: 'No', value: 'd11_quick_chat_responses_slot_1', emoji: '❌' }, 
        { label: 'OK', value: 'd11_quick_chat_responses_slot_2', emoji: '👌' }, 
        { label: 'Thank You', value: 'd11_quick_chat_responses_slot_3', emoji: '🙏' }, 
        { label: 'No Problem', value: 'd11_quick_chat_responses_slot_4', emoji: '😎' }, 
        { label: 'Hello', value: 'd11_quick_chat_responses_slot_5', emoji: '👋' }, 
        { label: 'Goodbye', value: 'd11_quick_chat_responses_slot_6', emoji: '🚶' }, 
        { label: 'I\'m Sorry', value: 'd11_quick_chat_responses_slot_7', emoji: '🙇' }
    ],
    cat_orders: [
        { label: 'Follow Me', value: 'd11_quick_chat_orders_slot_0', emoji: '👉' }, 
        { label: 'Go Away', value: 'd11_quick_chat_orders_slot_1', emoji: '🚷' }, 
        { label: 'Repair This', value: 'd11_quick_chat_orders_slot_2', emoji: '🔨' }, 
        { label: 'Come In', value: 'd11_quick_chat_orders_slot_4', emoji: '📥' }, 
        { label: 'Let\'s Go', value: 'd11_quick_chat_orders_slot_5', emoji: '🏃‍♂️' }, 
        { label: 'Here, Take This', value: 'd11_quick_chat_orders_slot_6', emoji: '🎁' }, 
        { label: 'Hurry Up', value: 'd11_quick_chat_orders_slot_7', emoji: '⚡' }
    ],
    cat_location: [
        { label: 'North', value: 'd11_quick_chat_location_slot_0', emoji: '⬆️' }, 
        { label: 'North East', value: 'd11_quick_chat_location_slot_1', emoji: '↗️' }, 
        { label: 'East', value: 'd11_quick_chat_location_slot_2', emoji: '➡️' }, 
        { label: 'South East', value: 'd11_quick_chat_location_slot_3', emoji: '↘️' }, 
        { label: 'South', value: 'd11_quick_chat_location_slot_4', emoji: '⬇️' }, 
        { label: 'South West', value: 'd11_quick_chat_location_slot_5', emoji: '↙️' }, 
        { label: 'West', value: 'd11_quick_chat_location_slot_6', emoji: '⬅️' }, 
        { label: 'North West', value: 'd11_quick_chat_location_slot_7', emoji: '↖️' }
    ],
    cat_need: [
        { label: 'I Need Scrap', value: 'd11_quick_chat_need_slot_0', emoji: '⚙️' }, 
        { label: 'I Need Low Grade Fuel', value: 'd11_quick_chat_need_slot_1', emoji: '⛽' }, 
        { label: 'I Need Food', value: 'd11_quick_chat_need_slot_2', emoji: '🍖' }, 
        { label: 'I Need Water', value: 'd11_quick_chat_need_slot_3', emoji: '💧' }, 
        { label: 'I Need Wood', value: 'd11_quick_chat_need_slot_4', emoji: '🪵' }, 
        { label: 'I Need Stones', value: 'd11_quick_chat_need_slot_5', emoji: '🪨' }, 
        { label: 'I Need Metal Fragments', value: 'd11_quick_chat_need_slot_6', emoji: '🔩' }, 
        { label: 'I Need High Quality Metal', value: 'd11_quick_chat_need_slot_7', emoji: '🛡️' }
    ],
    cat_have: [
        { label: 'I Have Scrap', value: 'd11_quick_chat_have_slot_0', emoji: '⚙️' }, 
        { label: 'I Have Low Grade Fuel', value: 'd11_quick_chat_have_slot_1', emoji: '⛽' }, 
        { label: 'I Have Food', value: 'd11_quick_chat_have_slot_2', emoji: '🍖' }, 
        { label: 'I Have Water', value: 'd11_quick_chat_have_slot_3', emoji: '💧' }, 
        { label: 'I Have Hunting Bow', value: 'd11_quick_chat_have_slot_4', emoji: '🏹' }, 
        { label: 'I Have Pickaxe', value: 'd11_quick_chat_have_slot_5', emoji: '⛏️' }, 
        { label: 'I Have Hatchet', value: 'd11_quick_chat_have_slot_6', emoji: '🪓' }, 
        { label: 'I Have High Quality Metal', value: 'd11_quick_chat_have_slot_7', emoji: '🛡️' }
    ]
};

async function processD11Router(guildId, rawUsername, rawContent, msgLower, client, homeTpPosQueue, sendRconCommand) {
    if (!rawUsername && !rawContent.includes('(')) return false;

    // --- 1. DOUBLE-TRIGGER BLOCKER (DEBOUNCE) ---
    // If GPortal sends a duplicate message within 1.5 seconds, ignore it to prevent double economy charging.
    const debounceKey = `${guildId}_${rawUsername}_${rawContent}`;
    const now = Date.now();
    if (rawUsername) {
        if (debounceCache.has(debounceKey) && now - debounceCache.get(debounceKey) < 1500) {
            return true; // Completely ignore duplicate
        }
        debounceCache.set(debounceKey, now);
        setTimeout(() => debounceCache.delete(debounceKey), 2000); // Clean memory after 2s
    }

    // --- 2. DYNAMIC RECYCLER POSITION INTERCEPTOR ---
    // This catches the invisible coordinates returned by the game when we send `printpos`
    const nakedCoordMatch = rawContent.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
    if (nakedCoordMatch) {
        for (const [key, data] of pendingRecyclers.entries()) {
            if (data.guildId === guildId && now - data.timestamp < 10000) {
                // Lower Y-axis by 0.5 to place exactly on the ground
                const posX = parseFloat(nakedCoordMatch[1]).toFixed(2);
                const posY = (parseFloat(nakedCoordMatch[2]) - 0.5).toFixed(2);
                const posZ = parseFloat(nakedCoordMatch[3]).toFixed(2);

                await sendRconCommand(guildId, `spawn recycler_static (${posX},${posY},${posZ})`);
                await sendRconCommand(guildId, `say "♻️ ${data.username}'s Personal Recycler has been deployed!"`);
                
                pendingRecyclers.delete(key);
                return true; 
            }
        }
    }

    const isQuickChat = rawContent.includes('d11_quick_chat_');

    // --- 3. DYNAMIC "REPAIR THIS" RECYCLER ROUTER ---
    // If the player uses "Repair This", we handle it right here instead of processing it statically.
    if (isQuickChat && rawContent.includes('d11_quick_chat_orders_slot_2')) {
        const bind = await CustomBind.findOne({ where: { guildId, targetValue: 'd11_quick_chat_orders_slot_2' } });
        
        if (bind) {
            const user = await UserEconomy.findOne({ where: { guildId, inGameName: rawUsername } });
            if (!user) {
                await sendRconCommand(guildId, `say "❌ ${rawUsername}, link your Discord using /playerpanel to spawn a recycler!"`);
                return true;
            }

            // A. Role Check
            if (bind.roleId && client) {
                try {
                    const guild = client.guilds.cache.get(guildId);
                    const member = await guild.members.fetch(user.userId);
                    if (!member.roles.cache.has(bind.roleId)) {
                        await sendRconCommand(guildId, `say "❌ ${rawUsername}, you lack the required VIP role to spawn a recycler!"`);
                        return true;
                    }
                } catch (e) {
                    return true;
                }
            }

            // B. Cooldown Check
            const cd = await BindCooldown.findOne({ where: { bindId: bind.id, userId: user.userId } });
            if (cd && cd.expiresAt > new Date()) {
                const diff = Math.ceil((cd.expiresAt - new Date()) / 1000);
                await sendRconCommand(guildId, `say "⏳ ${rawUsername}, you must wait ${diff}s to spawn another recycler."`);
                return true;
            }

            // C. Economy Check
            if (bind.cost > 0) {
                if ((user.wallet || 0) < bind.cost) {
                    await sendRconCommand(guildId, `say "💸 ${rawUsername}, you need ${bind.cost} Scrap for a recycler (You have ${user.wallet || 0})."`);
                    return true;
                }
                await user.update({ wallet: user.wallet - bind.cost });
            }

            // D. Apply New Cooldown
            if (bind.cooldown > 0) {
                const expiresAt = new Date(Date.now() + bind.cooldown * 1000);
                await BindCooldown.upsert({ bindId: bind.id, userId: user.userId, expiresAt });
            }

            // E. Queue Scanner & Trigger Location Capture
            pendingRecyclers.set(`${guildId}_${rawUsername}`, { guildId, username: rawUsername, timestamp: Date.now() });
            await sendRconCommand(guildId, `printpos "${rawUsername}"`);
            
            return true; // Stop routing! We fully handled the dynamic spawn.
        }
    }

    const isSkipNight = (isQuickChat && rawContent.includes('d11_quick_chat_orders_slot_3')) || rawContent === '!skipnight' || rawContent === '/skipnight';
    if (isSkipNight) {
        return await processSkipNightChat(guildId, rawUsername, client, sendRconCommand);
    }

    const isSetHome = (isQuickChat && rawContent.includes('d11_quick_chat_building_slot_4')) || rawContent === '!sethome' || rawContent === '/sethome';
    const isRetreat = (isQuickChat && rawContent.includes('d11_quick_chat_combat_slot_1')) || rawContent === '!home' || rawContent === '/home';

    if (isSetHome || isRetreat) {
        return await processHomeTpChat(guildId, rawUsername, isSetHome, isRetreat, client, homeTpPosQueue, sendRconCommand);
    }

    return await processCustomBindChat(guildId, rawUsername, rawContent, msgLower, client, sendRconCommand);
}

module.exports = { CHAT_CATEGORIES, CHAT_OPTIONS_MAP, processD11Router };