const { processHomeTpChat } = require('./chatHomeTp');
const { processCustomBindChat } = require('./chatCustomBinds');
const { processSkipNightChat } = require('./chatSkipNight');
const { processTeleportAction } = require('./teleportHandler');

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
    if (!rawContent) return false;

    const isQuickChat = rawContent.includes('d11_quick_chat_');

    const isSkipNight = (isQuickChat && rawContent.includes('d11_quick_chat_orders_slot_3')) || rawContent === '!skipnight' || rawContent === '/skipnight';
    if (isSkipNight) {
        return await processSkipNightChat(guildId, rawUsername, client, sendRconCommand);
    }

    const isSetHome = (isQuickChat && rawContent.includes('d11_quick_chat_building_slot_4')) || rawContent === '!sethome' || rawContent === '/sethome';
    const isRetreat = (isQuickChat && rawContent.includes('d11_quick_chat_combat_slot_1')) || rawContent === '!home' || rawContent === '/home';

    if (isSetHome || isRetreat) {
        return await processHomeTpChat(guildId, rawUsername, isSetHome, isRetreat, client, homeTpPosQueue, sendRconCommand);
    }

    // Explicitly check the dedicated teleport handler first for custom quick-chats
    const handledTeleport = await processTeleportAction(guildId, rawUsername, rawContent, msgLower, client, sendRconCommand);
    if (handledTeleport) return true;

    // Fall back to general custom bind chat (kits, recyclers, etc.)
    return await processCustomBindChat(guildId, rawUsername, rawContent, msgLower, client, sendRconCommand);
}

module.exports = { CHAT_CATEGORIES, CHAT_OPTIONS_MAP, processD11Router };