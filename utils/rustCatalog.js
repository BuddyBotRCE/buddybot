const RUST_CATEGORIES = {
    weapons: {
        label: 'Weapons & Firearms',
        emoji: '⚔️',
        items: [
            { name: 'Assault Rifle (AK)', shortname: 'rifle.ak', basePrice: 500 },
            { name: 'LR-300 Assault Rifle', shortname: 'rifle.lr300', basePrice: 500 },
            { name: 'Bolt Action Rifle', shortname: 'rifle.bolt', basePrice: 300 },
            { name: 'L96 Rifle', shortname: 'rifle.l96', basePrice: 600 },
            { name: 'Semi-Automatic Rifle (SAR)', shortname: 'rifle.semiauto', basePrice: 250 },
            { name: 'M39 Rifle', shortname: 'rifle.m39', basePrice: 400 },
            { name: 'M249 LMG', shortname: 'lmg.m249', basePrice: 1000 },
            { name: 'MP5A4 SMG', shortname: 'smg.mp5', basePrice: 300 },
            { name: 'Thompson', shortname: 'smg.thompson', basePrice: 250 },
            { name: 'Custom SMG', shortname: 'smg.2', basePrice: 150 },
            { name: 'Python Revolver', shortname: 'pistol.python', basePrice: 150 },
            { name: 'Semi-Automatic Pistol', shortname: 'pistol.semiauto', basePrice: 100 },
            { name: 'M92 Pistol', shortname: 'pistol.m92', basePrice: 250 },
            { name: 'Revolver', shortname: 'pistol.revolver', basePrice: 50 },
            { name: 'Pump Shotgun', shortname: 'shotgun.pump', basePrice: 200 },
            { name: 'Spas-12 Shotgun', shortname: 'shotgun.spas12', basePrice: 300 },
            { name: 'Double Barrel Shotgun', shortname: 'shotgun.double', basePrice: 150 },
            { name: 'Waterpipe Shotgun', shortname: 'shotgun.waterpipe', basePrice: 50 },
            { name: 'Compound Bow', shortname: 'bow.compound', basePrice: 50 },
            { name: 'Hunting Bow', shortname: 'bow.hunting', basePrice: 25 },
            { name: 'Rocket Launcher', shortname: 'rocket.launcher', basePrice: 750 }
        ]
    },
    ammo: {
        label: 'Ammunition & Explosives',
        emoji: '💣',
        items: [
            { name: '5.56 Rifle Ammo', shortname: 'ammo.rifle', basePrice: 5 },
            { name: 'HV 5.56 Rifle Ammo', shortname: 'ammo.rifle.hv', basePrice: 10 },
            { name: 'Incendiary Rifle Ammo', shortname: 'ammo.rifle.incendiary', basePrice: 10 },
            { name: 'Explosive 5.56 Rifle Ammo', shortname: 'ammo.rifle.explosive', basePrice: 25 },
            { name: 'Pistol Bullet', shortname: 'ammo.pistol', basePrice: 3 },
            { name: 'HV Pistol Bullet', shortname: 'ammo.pistol.hv', basePrice: 5 },
            { name: 'Incendiary Pistol Bullet', shortname: 'ammo.pistol.fire', basePrice: 5 },
            { name: '12 Gauge Buckshot', shortname: 'ammo.shotgun', basePrice: 5 },
            { name: '12 Gauge Slug', shortname: 'ammo.shotgun.slug', basePrice: 10 },
            { name: 'Incendiary Shell', shortname: 'ammo.shotgun.fire', basePrice: 10 },
            { name: 'Rocket', shortname: 'ammo.rocket.basic', basePrice: 150 },
            { name: 'High Velocity Rocket', shortname: 'ammo.rocket.hv', basePrice: 100 },
            { name: 'Satchel Charge', shortname: 'explosive.satchel', basePrice: 150 },
            { name: 'Timed Explosive Charge (C4)', shortname: 'explosive.timed', basePrice: 500 },
            { name: 'Beancan Grenade', shortname: 'grenade.beancan', basePrice: 50 },
            { name: 'F1 Grenade', shortname: 'grenade.f1', basePrice: 50 },
            { name: 'Gun Powder', shortname: 'gunpowder', basePrice: 2 },
            { name: 'Explosives', shortname: 'explosives', basePrice: 50 }
        ]
    },
    attire: {
        label: 'Armor & Clothing',
        emoji: '👕',
        items: [
            { name: 'Metal Facemask', shortname: 'metal.facemask', basePrice: 300 },
            { name: 'Metal Chest Plate', shortname: 'metal.plate.torso', basePrice: 300 },
            { name: 'Road Sign Jacket', shortname: 'roadsign.jacket', basePrice: 150 },
            { name: 'Road Sign Kilt', shortname: 'roadsign.kilt', basePrice: 150 },
            { name: 'Coffee Can Helmet', shortname: 'coffeecan.helmet', basePrice: 150 },
            { name: 'Bucket Helmet', shortname: 'bucket.helmet', basePrice: 50 },
            { name: 'Hazmat Suit', shortname: 'hazmatsuit', basePrice: 200 },
            { name: 'Arctic Suit', shortname: 'hazmatsuit.arcticsuit', basePrice: 250 },
            { name: 'Heavy Plate Helmet', shortname: 'heavy.plate.helmet', basePrice: 300 },
            { name: 'Heavy Plate Jacket', shortname: 'heavy.plate.jacket', basePrice: 400 },
            { name: 'Heavy Plate Pants', shortname: 'heavy.plate.pants', basePrice: 300 },
            { name: 'Hide Pants', shortname: 'attire.hide.pants', basePrice: 25 },
            { name: 'Hide Vest', shortname: 'attire.hide.vest', basePrice: 25 }
        ]
    },
    resources: {
        label: 'Resources & Components',
        emoji: '🪨',
        items: [
            { name: 'Scrap', shortname: 'scrap', basePrice: 1 },
            { name: 'High Quality Metal', shortname: 'hq.metal', basePrice: 5 },
            { name: 'Metal Fragments', shortname: 'metal.fragments', basePrice: 2 },
            { name: 'Sulfur', shortname: 'sulfur', basePrice: 2 },
            { name: 'Sulfur Ore', shortname: 'sulfur.ore', basePrice: 1 },
            { name: 'Metal Ore', shortname: 'metal.ore', basePrice: 1 },
            { name: 'Stone', shortname: 'stones', basePrice: 1 },
            { name: 'Wood', shortname: 'wood', basePrice: 1 },
            { name: 'Low Grade Fuel', shortname: 'lowgradefuel', basePrice: 2 },
            { name: 'Cloth', shortname: 'cloth', basePrice: 1 },
            { name: 'Leather', shortname: 'leather', basePrice: 1 },
            { name: 'Rope', shortname: 'rope', basePrice: 10 },
            { name: 'Sewing Kit', shortname: 'sewingkit', basePrice: 15 },
            { name: 'Gears', shortname: 'gears', basePrice: 25 },
            { name: 'Metal Pipe', shortname: 'metalpipe', basePrice: 25 },
            { name: 'Metal Spring', shortname: 'metalspring', basePrice: 50 },
            { name: 'Sheet Metal', shortname: 'sheetmetal', basePrice: 50 },
            { name: 'Rifle Body', shortname: 'riflebody', basePrice: 250 },
            { name: 'Semi-Automatic Body', shortname: 'semibody', basePrice: 100 },
            { name: 'SMG Body', shortname: 'smgbody', basePrice: 100 },
            { name: 'Tech Trash', shortname: 'techparts', basePrice: 100 }
        ]
    }
};

exports.RUST_CATEGORIES = RUST_CATEGORIES;