// Categorized Rust Console Edition Catalog (Expandable to thousands of items via shortnames)
const RUST_CATEGORIES = {
    weapons: {
        label: 'Weapons & Firearms',
        emoji: '🔫',
        items: [
            { name: 'Assault Rifle (AK47)', shortname: 'rifle.ak', basePrice: 500 },
            { name: 'LR-300', shortname: 'rifle.lr300', basePrice: 600 },
            { name: 'L96 Sniper', shortname: 'rifle.l96', basePrice: 1000 },
            { name: 'M249', shortname: 'lmg.m249', basePrice: 1500 },
            { name: 'Bolt Action Rifle', shortname: 'rifle.bolt', basePrice: 400 },
            { name: 'Semi-Automatic Rifle', shortname: 'rifle.semiauto', basePrice: 250 },
            { name: 'Thompson', shortname: 'smg.thompson', basePrice: 200 },
            { name: 'MP5A4', shortname: 'smg.mp5', basePrice: 300 },
            { name: 'Custom SMG', shortname: 'smg.2', basePrice: 150 },
            { name: 'Python Revolver', shortname: 'pistol.python', basePrice: 100 },
            { name: 'Semi-Automatic Pistol', shortname: 'pistol.semiauto', basePrice: 80 },
            { name: 'Pump Shotgun', shortname: 'shotgun.pump', basePrice: 200 },
            { name: 'Spas-12 Shotgun', shortname: 'shotgun.spas12', basePrice: 350 },
            { name: 'Double Barrel Shotgun', shortname: 'shotgun.double', basePrice: 75 },
            { name: 'Rocket Launcher', shortname: 'rocket.launcher', basePrice: 800 }
        ]
    },
    ammo: {
        label: 'Ammunition',
        emoji: '🎯',
        items: [
            { name: '5.56 Rifle Ammo (128)', shortname: 'ammo.rifle', basePrice: 100 },
            { name: 'Explosive 5.56 Ammo (64)', shortname: 'ammo.rifle.explosive', basePrice: 400 },
            { name: 'Incendiary 5.56 Ammo (64)', shortname: 'ammo.rifle.incendiary', basePrice: 250 },
            { name: 'Pistol Ammo (128)', shortname: 'ammo.pistol', basePrice: 75 },
            { name: '12 Gauge Buckshot (64)', shortname: 'ammo.shotgun', basePrice: 60 },
            { name: '12 Gauge Slug (32)', shortname: 'ammo.shotgun.slug', basePrice: 80 },
            { name: 'Basic Rocket (1)', shortname: 'ammo.rocket.basic', basePrice: 300 },
            { name: 'High Velocity Rocket (1)', shortname: 'ammo.rocket.hv', basePrice: 250 },
            { name: 'Incendiary Rocket (1)', shortname: 'ammo.rocket.fire', basePrice: 350 }
        ]
    },
    explosives: {
        label: 'Explosives & Raiding',
        emoji: '💣',
        items: [
            { name: 'Timed Explosive Charge (C4)', shortname: 'explosive.timed', basePrice: 500 },
            { name: 'Satchel Charge', shortname: 'explosive.satchel', basePrice: 200 },
            { name: 'Beancan Grenade', shortname: 'grenade.beancan', basePrice: 50 },
            { name: 'F1 Grenade', shortname: 'grenade.f1', basePrice: 40 },
            { name: 'Explosives (Crafting Comp)', shortname: 'explosives', basePrice: 150 },
            { name: 'Gun Powder', shortname: 'gunpowder', basePrice: 20 },
            { name: 'Low Grade Fuel (100)', shortname: 'lowgradefuel', basePrice: 50 }
        ]
    },
    resources: {
        label: 'Raw Resources',
        emoji: '🪵',
        items: [
            { name: 'Wood (1000)', shortname: 'wood', basePrice: 50 },
            { name: 'Stone (1000)', shortname: 'stones', basePrice: 60 },
            { name: 'Metal Fragments (1000)', shortname: 'metal.fragments', basePrice: 100 },
            { name: 'High Quality Metal (100)', shortname: 'metal.refined', basePrice: 200 },
            { name: 'Scrap (100)', shortname: 'scrap', basePrice: 100 },
            { name: 'Cloth (500)', shortname: 'cloth', basePrice: 60 },
            { name: 'Sulfur (1000)', shortname: 'sulfur', basePrice: 150 }
        ]
    },
    attire: {
        label: 'Armor & Attire',
        emoji: '🛡️',
        items: [
            { name: 'Metal Facemask', shortname: 'metal.facemask', basePrice: 250 },
            { name: 'Metal Chest Plate', shortname: 'metal.plate.torso', basePrice: 300 },
            { name: 'Hazmat Suit', shortname: 'hazmat.suit', basePrice: 150 },
            { name: 'Coffee Can Helmet', shortname: 'coffeecan.helmet', basePrice: 100 },
            { name: 'Road Sign Jacket', shortname: 'roadsign.jacket', basePrice: 120 },
            { name: 'Road Sign Kilt', shortname: 'roadsign.kilt', basePrice: 120 },
            { name: 'Heavy Plate Helmet', shortname: 'heavy.plate.helmet', basePrice: 180 }
        ]
    },
    tools: {
        label: 'Tools & Gear',
        emoji: '⛏️',
        items: [
            { name: 'Salvaged Axe', shortname: 'axe.salvaged', basePrice: 50 },
            { name: 'Salvaged Icepick', shortname: 'icepick.salvaged', basePrice: 50 },
            { name: 'Jackhammer', shortname: 'jackhammer', basePrice: 200 },
            { name: 'Chainsaw', shortname: 'chainsaw', basePrice: 200 },
            { name: 'Medical Syringe (5)', shortname: 'syringe.medical', basePrice: 75 },
            { name: 'Large Medkit', shortname: 'largemedkit', basePrice: 100 }
        ]
    }
};

module.exports = { RUST_CATEGORIES };