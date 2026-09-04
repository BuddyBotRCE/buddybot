const { processHomeTpChat } = require('./chatHomeTp');
const { processCustomBindChat } = require('./chatCustomBinds');
const { processSkipNightChat } = require('./chatSkipNight');
const { UserEconomy, CustomBind, BindCooldown } = require('../database/db'); 

const debounceCache = new Map();
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
    try {
        if (!rawUsername && !rawContent.includes('(')) return false;

        // --- 1. DYNAMIC RECYCLER POSITION CATCHER ---
        const nakedCoordMatch = rawContent.match(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
        if (nakedCoordMatch) {
            for (const [key, data] of pendingRecyclers.entries()) {
                if (data.guildId === guildId && Date.now() - data.timestamp < 10000) {
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
        if (!isQuickChat) return false;

        // --- 2. EXTRACT EXACT PHRASE ---
        const quickChatMatch = rawContent.match(/(d11_quick_chat_[a-z_]+_slot_\d)/);
        const phrase = quickChatMatch ? quickChatMatch[1] : null;

        // --- 3. BULLETPROOF PLAYER MATCHING ---
        // Completely ignores GPortal's broken username field and scans for the real DB name.
        const registeredPlayers = await UserEconomy.findAll({ where: { guildId: guildId } });
        let matchedPlayer = null;
        for (const player of registeredPlayers) {
            if (player.inGameName && (rawUsername.toLowerCase() === player.inGameName.toLowerCase() || msgLower.includes(player.inGameName.toLowerCase()))) {
                matchedPlayer = player;
                break;
            }
        }

        if (!matchedPlayer || !phrase) return false;

        // --- 4. ANTI-SPAM DEBOUNCE ---
        const debounceKey = `${guildId}_${matchedPlayer.inGameName}_${phrase}`;
        const now = Date.now();
        if (debounceCache.has(debounceKey) && now - debounceCache.get(debounceKey) < 1500) {
            return true; // Successfully blocks the duplicate!
        }
        debounceCache.set(debounceKey, now);
        setTimeout(() => debounceCache.delete(debounceKey), 2000); 

        // --- 5. DYNAMIC "REPAIR THIS" RECYCLER ---
        if (phrase === 'd11_quick_chat_orders_slot_2') {
            const bind = await CustomBind.findOne({ where: { guildId, targetValue: 'd11_quick_chat_orders_slot_2' } });
            
            if (bind) {
                if (bind.roleId && client) {
                    try {
                        const guild = client.guilds.cache.get(guildId);
                        const member = await guild.members.fetch(matchedPlayer.userId);
                        if (!member.roles.cache.has(bind.roleId)) {
                            await sendRconCommand(guildId, `say "❌ ${matchedPlayer.inGameName}, you lack the required VIP role to spawn a recycler!"`);
                            return true;
                        }
                    } catch (e) { return true; }
                }

                const cd = await BindCooldown.findOne({ where: { bindId: bind.id, userId: matchedPlayer.userId } });
                if (cd && cd.expiresAt > new Date()) {
                    const diff = Math.ceil((cd.expiresAt - new Date()) / 1000);
                    await sendRconCommand(guildId, `say "⏳ ${matchedPlayer.inGameName}, you must wait ${diff}s to spawn another recycler."`);
                    return true;
                }

                if (bind.cost > 0) {
                    if ((matchedPlayer.wallet || 0) < bind.cost) {
                        await sendRconCommand(guildId, `say "💸 ${matchedPlayer.inGameName}, you need ${bind.cost} Scrap for a recycler."`);
                        return true;
                    }
                    await matchedPlayer.update({ wallet: matchedPlayer.wallet - bind.cost });
                }

                if (bind.cooldown > 0) {
                    const expiresAt = new Date(Date.now() + bind.cooldown * 1000);
                    await BindCooldown.upsert({ bindId: bind.id, userId: matchedPlayer.userId, expiresAt });
                }

                pendingRecyclers.set(`${guildId}_${matchedPlayer.inGameName}`, { guildId, username: matchedPlayer.inGameName, timestamp: Date.now() });
                await sendRconCommand(guildId, `printpos "${matchedPlayer.inGameName}"`);
                
                return true; 
            }
        }

        // --- 6. ROUTE TO OTHER HANDLERS ---
        if (phrase === 'd11_quick_chat_orders_slot_3') return await processSkipNightChat(guildId, matchedPlayer.inGameName, client, sendRconCommand);
        
        const isSetHome = phrase === 'd11_quick_chat_building_slot_4';
        const isRetreat = phrase === 'd11_quick_chat_combat_slot_1';
        
        if (isSetHome || isRetreat) {
            if (isSetHome) await sendRconCommand(guildId, `kill "${matchedPlayer.inGameName}"`);
            return await processHomeTpChat(guildId, matchedPlayer.inGameName, isSetHome, isRetreat, client, homeTpPosQueue, sendRconCommand);
        }

        // --- 7. GENERAL CUSTOM BINDS ---
        return await processCustomBindChat(guildId, matchedPlayer.inGameName, rawContent, msgLower, client, sendRconCommand);

    } catch (err) {
        console.error('[D11 ROUTER ERROR]', err);
        return false;
    }
}

module.exports = { CHAT_CATEGORIES, CHAT_OPTIONS_MAP, processD11Router };