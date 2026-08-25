const RUST_CATEGORIES = {
    weapons: {
        label: 'Weapons & Firearms',
        emoji: '🔫',
        items: [
            { name: 'Assault Rifle (AK)', shortname: 'rifle.ak' },
            { name: 'LR-300 Assault Rifle', shortname: 'rifle.lr300' },
            { name: 'Bolt Action Rifle', shortname: 'rifle.bolt' },
            { name: 'L96 Rifle', shortname: 'rifle.l96' },
            { name: 'Semi-Automatic Rifle (SAR)', shortname: 'rifle.semiauto' },
            { name: 'M39 Rifle', shortname: 'rifle.m39' },
            { name: 'M249 LMG', shortname: 'lmg.m249' },
            { name: 'MP5A4 SMG', shortname: 'smg.mp5' },
            { name: 'Thompson', shortname: 'smg.thompson' },
            { name: 'Custom SMG', shortname: 'smg.2' },
            { name: 'Python Revolver', shortname: 'pistol.python' },
            { name: 'Semi-Automatic Pistol', shortname: 'pistol.semiauto' },
            { name: 'M92 Pistol', shortname: 'pistol.m92' },
            { name: 'Revolver', shortname: 'pistol.revolver' },
            { name: 'Pump Shotgun', shortname: 'shotgun.pump' },
            { name: 'Spas-12 Shotgun', shortname: 'shotgun.spas12' },
            { name: 'Double Barrel Shotgun', shortname: 'shotgun.double' },
            { name: 'Waterpipe Shotgun', shortname: 'shotgun.waterpipe' },
            { name: 'Compound Bow', shortname: 'bow.compound' },
            { name: 'Hunting Bow', shortname: 'bow.hunting' },
            { name: 'Rocket Launcher', shortname: 'rocket.launcher' }
        ]
    },
    ammo: {
        label: 'Ammunition & Explosives',
        emoji: '💣',
        items: [
            { name: '5.56 Rifle Ammo', shortname: 'ammo.rifle' },
            { name: 'HV 5.56 Rifle Ammo', shortname: 'ammo.rifle.hv' },
            { name: 'Incendiary Rifle Ammo', shortname: 'ammo.rifle.incendiary' },
            { name: 'Explosive 5.56 Rifle Ammo', shortname: 'ammo.rifle.explosive' },
            { name: 'Pistol Bullet', shortname: 'ammo.pistol' },
            { name: 'HV Pistol Bullet', shortname: 'ammo.pistol.hv' },
            { name: 'Incendiary Pistol Bullet', shortname: 'ammo.pistol.fire' },
            { name: '12 Gauge Buckshot', shortname: 'ammo.shotgun' },
            { name: '12 Gauge Slug', shortname: 'ammo.shotgun.slug' },
            { name: 'Incendiary Shell', shortname: 'ammo.shotgun.fire' },
            { name: 'Rocket (Timed Explosive / High Velocity / Smoke)', shortname: 'ammo.rocket.basic' },
            { name: 'High Velocity Rocket', shortname: 'ammo.rocket.fire' },
            { name: 'Satchel Charge', shortname: 'explosive.satchel' },
            { name: 'Timed Explosive Charge (C4)', shortname: 'explosive.timed' },
            { name: 'Beancan Grenade', shortname: 'grenade.beancan' },
            { name: 'F1 Grenade', shortname: 'grenade.f1' },
            { name: 'Gun Powder', shortname: 'gunpowder' },
            { name: 'Explosives', shortname: 'explosives' }
        ]
    },
    attire: {
        label: 'Armor & Clothing',
        emoji: '🪖',
        items: [
            { name: 'Metal Facemask', shortname: 'metal.facemask' },
            { name: 'Metal Chest Plate', shortname: 'metal.plate.torso' },
            { name: 'Road Sign Jacket', shortname: 'roadsign.jacket' },
            { name: 'Road Sign Kilt', shortname: 'roadsign.kilt' },
            { name: 'Coffee Can Helmet', shortname: 'coffeecan.helmet' },
            { name: 'Bucket Helmet', shortname: 'bucket.helmet' },
            { name: 'Hazmat Suit', shortname: 'hazmatsuit' },
            { name: 'Arctic Suit', shortname: 'hazmatsuit.arcticsuit' },
            { name: 'Heavy Plate Helmet', shortname: 'heavy.plate.helmet' },
            { name: 'Heavy Plate Jacket', shortname: 'heavy.plate.jacket' },
            { name: 'Heavy Plate Pants', shortname: 'heavy.plate.pants' },
            { name: 'Hide Pants', shortname: 'attire.hide.pants' },
            { name: 'Hide Vest', shortname: 'attire.hide.vest' }
        ]
    },
    resources: {
        label: 'Resources & Components',
        emoji: '🪵',
        items: [
            { name: 'Scrap', shortname: 'scrap' },
            { name: 'High Quality Metal', shortname: 'hq.metal' },
            { name: 'Metal Fragments', shortname: 'metal.fragments' },
            { name: 'Sulfur', shortname: 'sulfur' },
            { name: 'Sulfur Ore', shortname: 'sulfur.ore' },
            { name: 'Metal Ore', shortname: 'metal.ore' },
            { name: 'Stone', shortname: 'stone' },
            { name: 'Wood', shortname: 'wood' },
            { name: 'Low Grade Fuel', shortname: 'lowgradefuel' },
            { name: 'Cloth', shortname: 'cloth' },
            { name: 'Leather', shortname: 'leather' },
            { name: 'Rope', shortname: 'rope' },
            { name: 'Sewing Kit', shortname: 'sewingkit' },
            { name: 'Gears', shortname: 'gears' },
            { name: 'Metal Pipe', shortname: 'metalpipe' },
            { name: 'Metal Spring', shortname: 'metalspring' },
            { name: 'Sheet Metal', shortname: 'sheetmetal' },
            { name: 'Rifle Body', shortname: 'riflebody' },
            { name: 'Semi-Automatic Body', shortname: 'semibody' },
            { name: 'SMG Body', shortname: 'smgbody' },
            { name: 'Tech Trash', shortname: 'techparts' }
        ]
    }
};

exports.RUST_CATEGORIES = RUST_CATEGORIES;