const RUST_CATEGORIES = {
    rce_firearms_t3_t2: {
        label: 'Tier 2 & 3 Firearms',
        emoji: '💥',
        items: [
            { name: 'Assault Rifle (AK)', shortname: 'rifle.ak', basePrice: 500 },
            { name: 'LR-300 Assault Rifle', shortname: 'rifle.lr300', basePrice: 500 },
            { name: 'Bolt Action Rifle', shortname: 'rifle.bolt', basePrice: 300 },
            { name: 'L96 Rifle', shortname: 'rifle.l96', basePrice: 600 },
            { name: 'M39 Rifle', shortname: 'rifle.m39', basePrice: 400 },
            { name: 'M249 LMG', shortname: 'lmg.m249', basePrice: 1000 },
            { name: 'MP5A4 SMG', shortname: 'smg.mp5', basePrice: 300 },
            { name: 'Thompson', shortname: 'smg.thompson', basePrice: 250 },
            { name: 'Custom SMG', shortname: 'smg.2', basePrice: 150 },
            { name: 'Semi-Automatic Rifle (SAR)', shortname: 'rifle.semiauto', basePrice: 250 },
            { name: 'Pump Shotgun', shortname: 'shotgun.pump', basePrice: 200 },
            { name: 'Spas-12 Shotgun', shortname: 'shotgun.spas12', basePrice: 300 },
            { name: 'Python Revolver', shortname: 'pistol.python', basePrice: 150 },
            { name: 'Semi-Automatic Pistol', shortname: 'pistol.semiauto', basePrice: 100 },
            { name: 'M92 Pistol', shortname: 'pistol.m92', basePrice: 250 },
            { name: 'Flame Thrower', shortname: 'flamethrower', basePrice: 200 },
            { name: 'Multiple Grenade Launcher', shortname: 'multiplegrenadelauncher', basePrice: 1500 }
        ]
    },
    rce_firearms_t1: {
        label: 'Tier 1 Guns & Bows',
        emoji: '🏹',
        items: [
            { name: 'Hunting Bow', shortname: 'bow.hunting', basePrice: 25 },
            { name: 'Crossbow', shortname: 'crossbow', basePrice: 75 },
            { name: 'Compound Bow', shortname: 'bow.compound', basePrice: 50 },
            { name: 'Eoka Pistol', shortname: 'pistol.eoka', basePrice: 20 },
            { name: 'Nailgun', shortname: 'pistol.nailgun', basePrice: 30 },
            { name: 'Waterpipe Shotgun', shortname: 'shotgun.waterpipe', basePrice: 50 },
            { name: 'Double Barrel Shotgun', shortname: 'shotgun.double', basePrice: 150 },
            { name: 'Revolver', shortname: 'pistol.revolver', basePrice: 50 }
        ]
    },
    rce_melee: {
        label: 'Melee Weapons',
        emoji: '🔪',
        items: [
            { name: 'Salvaged Sword', shortname: 'salvaged.sword', basePrice: 50 },
            { name: 'Machete', shortname: 'machete', basePrice: 40 },
            { name: 'Combat Knife', shortname: 'knife.combat', basePrice: 50 },
            { name: 'Bone Knife', shortname: 'knife.bone', basePrice: 20 },
            { name: 'Longsword', shortname: 'longsword', basePrice: 60 },
            { name: 'Mace', shortname: 'mace', basePrice: 50 },
            { name: 'Salvaged Cleaver', shortname: 'salvaged.cleaver', basePrice: 40 },
            { name: 'Bone Club', shortname: 'bone.club', basePrice: 10 },
            { name: 'Stone Spear', shortname: 'spear.stone', basePrice: 20 },
            { name: 'Wooden Spear', shortname: 'spear.wooden', basePrice: 10 },
            { name: 'Paddle', shortname: 'paddle', basePrice: 25 }
        ]
    },
    rce_tools: {
        label: 'Tools & Utilities',
        emoji: '⛏️',
        items: [
            { name: 'Jackhammer', shortname: 'jackhammer', basePrice: 150 },
            { name: 'Chainsaw', shortname: 'chainsaw', basePrice: 125 },
            { name: 'Salvaged Icepick', shortname: 'icepick.salvaged', basePrice: 75 },
            { name: 'Salvaged Axe', shortname: 'axe.salvaged', basePrice: 75 },
            { name: 'Pickaxe', shortname: 'pickaxe', basePrice: 50 },
            { name: 'Hatchet', shortname: 'hatchet', basePrice: 50 },
            { name: 'Stone Pickaxe', shortname: 'stone.pickaxe', basePrice: 20 },
            { name: 'Stone Hatchet', shortname: 'stonehatchet', basePrice: 20 },
            { name: 'Hammer', shortname: 'hammer', basePrice: 10 },
            { name: 'Building Plan', shortname: 'building.planner', basePrice: 10 },
            { name: 'Wire Tool', shortname: 'wiretool', basePrice: 20 },
            { name: 'Pipe Tool', shortname: 'pipetool', basePrice: 20 },
            { name: 'Flashlight', shortname: 'flashlight.held', basePrice: 20 },
            { name: 'Binoculars', shortname: 'binoculars', basePrice: 50 }
        ]
    },
    rce_attachments: {
        label: 'Weapon Attachments',
        emoji: '🔭',
        items: [
            { name: 'Weapon Lasersight', shortname: 'weapon.mod.lasersight', basePrice: 100 },
            { name: 'Weapon Flashlight', shortname: 'weapon.mod.flashlight', basePrice: 50 },
            { name: 'Holosight', shortname: 'weapon.mod.holosight', basePrice: 150 },
            { name: 'Simple Handmade Sight', shortname: 'weapon.mod.simplesight', basePrice: 50 },
            { name: 'Silencer', shortname: 'weapon.mod.silencer', basePrice: 100 },
            { name: '4x Zoom Scope', shortname: 'weapon.mod.small.scope', basePrice: 200 },
            { name: 'Muzzle Boost', shortname: 'weapon.mod.muzzleboost', basePrice: 75 },
            { name: 'Muzzle Brake', shortname: 'weapon.mod.muzzlebrake', basePrice: 75 }
        ]
    },
    rce_ammo: {
        label: 'Ammunition & Shells',
        emoji: '🎯',
        items: [
            { name: '5.56 Rifle Ammo', shortname: 'ammo.rifle', basePrice: 5 },
            { name: 'HV 5.56 Rifle Ammo', shortname: 'ammo.rifle.hv', basePrice: 10 },
            { name: 'Incendiary 5.56 Rifle', shortname: 'ammo.rifle.incendiary', basePrice: 10 },
            { name: 'Explosive 5.56 Rifle', shortname: 'ammo.rifle.explosive', basePrice: 25 },
            { name: 'Pistol Bullet', shortname: 'ammo.pistol', basePrice: 3 },
            { name: 'HV Pistol Bullet', shortname: 'ammo.pistol.hv', basePrice: 5 },
            { name: 'Incendiary Pistol Bullet', shortname: 'ammo.pistol.fire', basePrice: 5 },
            { name: 'Nailgun Nails', shortname: 'ammo.nailgun.nails', basePrice: 2 },
            { name: '12 Gauge Buckshot', shortname: 'ammo.shotgun', basePrice: 5 },
            { name: '12 Gauge Slug', shortname: 'ammo.shotgun.slug', basePrice: 10 },
            { name: 'Incendiary Shell', shortname: 'ammo.shotgun.fire', basePrice: 10 },
            { name: 'Handmade Shell', shortname: 'ammo.handmade.shell', basePrice: 2 },
            { name: 'Wooden Arrow', shortname: 'arrow.wooden', basePrice: 2 },
            { name: 'HV Arrow', shortname: 'arrow.hv', basePrice: 5 },
            { name: 'Bone Arrow', shortname: 'arrow.bone', basePrice: 5 },
            { name: 'Fire Arrow', shortname: 'arrow.fire', basePrice: 10 }
        ]
    },
    rce_explosives: {
        label: 'Explosives & Raiding',
        emoji: '🧨',
        items: [
            { name: 'Timed Explosive (C4)', shortname: 'explosive.timed', basePrice: 500 },
            { name: 'Satchel Charge', shortname: 'explosive.satchel', basePrice: 150 },
            { name: 'Basic Rocket', shortname: 'ammo.rocket.basic', basePrice: 150 },
            { name: 'High Velocity Rocket', shortname: 'ammo.rocket.hv', basePrice: 100 },
            { name: 'Incendiary Rocket', shortname: 'ammo.rocket.fire', basePrice: 150 },
            { name: 'Torpedo', shortname: 'ammo.torpedo', basePrice: 50 },
            { name: 'Beancan Grenade', shortname: 'grenade.beancan', basePrice: 50 },
            { name: 'F1 Grenade', shortname: 'grenade.f1', basePrice: 50 },
            { name: 'Flashbang', shortname: 'grenade.flashbang', basePrice: 25 },
            { name: 'Smoke Grenade', shortname: 'grenade.smoke', basePrice: 25 },
            { name: 'Explosives', shortname: 'explosives', basePrice: 50 },
            { name: 'Gun Powder', shortname: 'gunpowder', basePrice: 2 },
            { name: 'RF Detonator', shortname: 'rf.detonator', basePrice: 50 },
            { name: 'Mlrs module', shortname: 'aiming.module.mlrs', basePrice: 50 },
            { name: 'Mlrs Rockets', shortname: 'ammo.rocket.mlrs', basePrice: 100 }
        ]
    },
    rce_armor_high: {
        label: 'High-Tier Armor & Suits',
        emoji: '🛡️',
        items: [
            { name: 'Metal Facemask', shortname: 'metal.facemask', basePrice: 300 },
            { name: 'Metal Chest Plate', shortname: 'metal.plate.torso', basePrice: 300 },
            { name: 'Road Sign Jacket', shortname: 'roadsign.jacket', basePrice: 150 },
            { name: 'Road Sign Kilt', shortname: 'roadsign.kilt', basePrice: 150 },
            { name: 'Road Sign Gloves', shortname: 'roadsign.gloves', basePrice: 100 },
            { name: 'Coffee Can Helmet', shortname: 'coffeecan.helmet', basePrice: 150 },
            { name: 'Heavy Plate Helmet', shortname: 'heavy.plate.helmet', basePrice: 300 },
            { name: 'Heavy Plate Jacket', shortname: 'heavy.plate.jacket', basePrice: 400 },
            { name: 'Heavy Plate Pants', shortname: 'heavy.plate.pants', basePrice: 300 },
            { name: 'Riot Helmet', shortname: 'riot.helmet', basePrice: 100 },
            { name: 'Night Vision Goggles', shortname: 'nightvisiongoggles', basePrice: 250 },
            { name: 'Hazmat Suit', shortname: 'hazmatsuit', basePrice: 200 },
            { name: 'Arctic Suit', shortname: 'hazmatsuit.arcticsuit', basePrice: 250 },
            { name: 'Wetsuit', shortname: 'wetsuit', basePrice: 50 }
        ]
    },
    rce_armor_low: {
        label: 'Low-Tier & Specialty Gear',
        emoji: '🤿',
        items: [
            { name: 'Bone Helmet', shortname: 'deer.skull.mask', basePrice: 50 },
            { name: 'Bone Armor', shortname: 'bone.armor.suit', basePrice: 75 },
            { name: 'Wolf Headdress', shortname: 'hat.wolf', basePrice: 50 },
            { name: 'Wood Armor Helmet', shortname: 'wood.armor.helmet', basePrice: 50 },
            { name: 'Wood Armor Jacket', shortname: 'wood.armor.jacket', basePrice: 50 },
            { name: 'Wood Armor Pants', shortname: 'wood.armor.pants', basePrice: 50 },
            { name: 'Bucket Helmet', shortname: 'bucket.helmet', basePrice: 50 },
            { name: 'Miners Hat', shortname: 'hat.miner', basePrice: 30 },
            { name: 'Diving Mask', shortname: 'diving.mask', basePrice: 30 },
            { name: 'Diving Fins', shortname: 'diving.fins', basePrice: 30 },
            { name: 'Diving Tank', shortname: 'diving.cylinder', basePrice: 50 },
            { name: 'Hide Poncho', shortname: 'attire.hide.poncho', basePrice: 30 },
            { name: 'Hide Pants', shortname: 'attire.hide.pants', basePrice: 25 },
            { name: 'Hide Vest', shortname: 'attire.hide.vest', basePrice: 25 },
            { name: 'Hide Boots', shortname: 'attire.hide.boots', basePrice: 20 }
        ]
    },
    rce_clothing: {
        label: 'Clothing & Gloves',
        emoji: '👕',
        items: [
            { name: 'Hoodie', shortname: 'hoodie', basePrice: 50 },
            { name: 'Pants', shortname: 'pants', basePrice: 50 },
            { name: 'Shorts', shortname: 'pants.shorts', basePrice: 20 },
            { name: 'T-Shirt', shortname: 'tshirt', basePrice: 20 },
            { name: 'Boots', shortname: 'shoes.boots', basePrice: 40 },
            { name: 'Leather Gloves', shortname: 'burlap.gloves', basePrice: 30 },
            { name: 'Tactical Gloves', shortname: 'tactical.gloves', basePrice: 100 },
            { name: 'Burlap Shirt', shortname: 'burlap.shirt', basePrice: 10 },
            { name: 'Burlap Trousers', shortname: 'burlap.trousers', basePrice: 10 },
            { name: 'Burlap Shoes', shortname: 'burlap.shoes', basePrice: 10 },
            { name: 'Burlap Headwrap', shortname: 'burlap.headwrap', basePrice: 10 },
            { name: 'Bandana Mask', shortname: 'mask.bandana', basePrice: 10 },
            { name: 'Boonie Hat', shortname: 'hat.boonie', basePrice: 10 },
            { name: 'Beanie Hat', shortname: 'hat.beanie', basePrice: 10 },
            { name: 'Baseball Cap', shortname: 'hat.cap', basePrice: 10 },
            { name: 'Snow Jacket', shortname: 'jacket.snow', basePrice: 100 }
        ]
    },
    rce_resources: {
        label: 'Raw Resources',
        emoji: '🪨',
        items: [
            { name: 'Scrap', shortname: 'scrap', basePrice: 1 },
            { name: 'High Quality Metal', shortname: 'metal.refined', basePrice: 10 },
            { name: 'HQM Ore', shortname: 'hq.metal', basePrice: 5 },
            { name: 'Metal Fragments', shortname: 'metal.fragments', basePrice: 2 },
            { name: 'Metal Ore', shortname: 'metal.ore', basePrice: 1 },
            { name: 'Sulfur', shortname: 'sulfur', basePrice: 2 },
            { name: 'Sulfur Ore', shortname: 'sulfur.ore', basePrice: 1 },
            { name: 'Stone', shortname: 'stones', basePrice: 1 },
            { name: 'Wood', shortname: 'wood', basePrice: 1 },
            { name: 'Low Grade Fuel', shortname: 'lowgradefuel', basePrice: 2 },
            { name: 'Crude Oil', shortname: 'crude.oil', basePrice: 5 },
            { name: 'Cloth', shortname: 'cloth', basePrice: 1 },
            { name: 'Leather', shortname: 'leather', basePrice: 1 },
            { name: 'Animal Fat', shortname: 'fat.animal', basePrice: 2 },
            { name: 'Bone Fragments', shortname: 'bone.fragments', basePrice: 1 },
            { name: 'Charcoal', shortname: 'charcoal', basePrice: 1 }
        ]
    },
    rce_components: {
        label: 'Components',
        emoji: '⚙️',
        items: [
            { name: 'Tech Trash', shortname: 'techparts', basePrice: 100 },
            { name: 'Rifle Body', shortname: 'riflebody', basePrice: 250 },
            { name: 'Semi-Automatic Body', shortname: 'semibody', basePrice: 100 },
            { name: 'SMG Body', shortname: 'smgbody', basePrice: 100 },
            { name: 'Sheet Metal', shortname: 'sheetmetal', basePrice: 50 },
            { name: 'Road Signs', shortname: 'roadsigns', basePrice: 25 },
            { name: 'Metal Spring', shortname: 'metalspring', basePrice: 50 },
            { name: 'Metal Pipe', shortname: 'metalpipe', basePrice: 25 },
            { name: 'Gears', shortname: 'gears', basePrice: 25 },
            { name: 'Sewing Kit', shortname: 'sewingkit', basePrice: 15 },
            { name: 'Rope', shortname: 'rope', basePrice: 10 },
            { name: 'Metal Blade', shortname: 'metalblade', basePrice: 15 },
            { name: 'Empty Propane Tank', shortname: 'propanetank', basePrice: 15 },
            { name: 'Tarp', shortname: 'tarp', basePrice: 10 },
            { name: 'CCTV Camera', shortname: 'cctv.camera', basePrice: 100 },
            { name: 'Targeting Computer', shortname: 'targeting.computer', basePrice: 100 }
        ]
    },
    rce_doors_windows: {
        label: 'Doors, Windows & Locks',
        emoji: '🚪',
        items: [
            { name: 'Key Lock', shortname: 'lock.key', basePrice: 25 },
            { name: 'Code Lock', shortname: 'lock.code', basePrice: 50 },
            { name: 'Wooden Door', shortname: 'door.hinged.wood', basePrice: 30 },
            { name: 'Sheet Metal Door', shortname: 'door.hinged.metal', basePrice: 100 },
            { name: 'Armored Door', shortname: 'door.hinged.toptier', basePrice: 300 },
            { name: 'Garage Door', shortname: 'wall.frame.garagedoor', basePrice: 250 },
            { name: 'Wooden Double Door', shortname: 'door.double.hinged.wood', basePrice: 50 },
            { name: 'Sheet Metal Double Door', shortname: 'door.double.hinged.metal', basePrice: 150 },
            { name: 'Armored Double Door', shortname: 'door.double.hinged.toptier', basePrice: 400 },
            { name: 'Chainlink Fence Gate', shortname: 'wall.frame.fence.gate', basePrice: 50 },
            { name: 'Prison Cell Gate', shortname: 'gates.panel.cell', basePrice: 100 },
            { name: 'Shop Front', shortname: 'wall.frame.shopfront.metal', basePrice: 150 },
            { name: 'Metal Window Bars', shortname: 'wall.window.bars.metal', basePrice: 50 },
            { name: 'Reinforced Glass Window', shortname: 'wall.window.glass.reinforced', basePrice: 100 },
            { name: 'Wooden Window Bars', shortname: 'wall.window.bars.wood', basePrice: 20 },
            { name: 'Metal Embrasure A', shortname: 'wall.window.embrasure.a', basePrice: 75 },
            { name: 'Metal Embrasure B', shortname: 'wall.window.embrasure.b', basePrice: 75 }
        ]
    },
    rce_walls_barricades: {
        label: 'Walls, Grills & Barricades',
        emoji: '🚧',
        items: [
            { name: 'High External Wood Wall', shortname: 'wall.external.high.wood', basePrice: 150 },
            { name: 'High External Stone Wall', shortname: 'wall.external.high.stone', basePrice: 300 },
            { name: 'High External Wood Gate', shortname: 'gates.external.high.wood', basePrice: 200 },
            { name: 'High External Stone Gate', shortname: 'gates.external.high.stone', basePrice: 400 },
            { name: 'Chainlink Fence', shortname: 'wall.frame.fence', basePrice: 50 },
            { name: 'Prison Cell Wall', shortname: 'wall.frame.cell', basePrice: 100 },
            { name: 'Floor Grill', shortname: 'floor.grill', basePrice: 50 },
            { name: 'Ladder Hatch', shortname: 'floor.ladder.hatch', basePrice: 150 },
            { name: 'Wooden Spikes', shortname: 'spikes.floor', basePrice: 20 },
            { name: 'Wooden Barricade', shortname: 'barricade.wood', basePrice: 30 },
            { name: 'Barbed Wooden Barricade', shortname: 'barricade.woodwire', basePrice: 50 },
            { name: 'Metal Barricade', shortname: 'barricade.metal', basePrice: 100 },
            { name: 'Sandbag Barricade', shortname: 'barricade.sandbags', basePrice: 30 },
            { name: 'Concrete Barricade', shortname: 'barricade.concrete', basePrice: 50 },
            { name: 'Stone Barricade', shortname: 'barricade.stone', basePrice: 50 }
        ]
    },
    rce_deployables_storage: {
        label: 'Storage, Traps & Furniture',
        emoji: '📦',
        items: [
            { name: 'Auto Turret', shortname: 'autoturret', basePrice: 500 },
            { name: 'Flame Turret', shortname: 'flameturret', basePrice: 250 },
            { name: 'Shotgun Trap', shortname: 'guntrap', basePrice: 150 },
            { name: 'SAM Site', shortname: 'samsite', basePrice: 750 },
            { name: 'Tesla Coil', shortname: 'tesla.coil', basePrice: 250 },
            { name: 'Sleeping Bag', shortname: 'sleepingbag', basePrice: 30 },
            { name: 'Bed', shortname: 'bed', basePrice: 100 },
            { name: 'Wooden Box', shortname: 'box.wooden', basePrice: 20 },
            { name: 'Large Wooden Box', shortname: 'box.wooden.large', basePrice: 50 },
            { name: 'Small Stash', shortname: 'stash.small', basePrice: 20 },
            { name: 'Locker', shortname: 'locker', basePrice: 150 },
            { name: 'Mailbox', shortname: 'mailbox', basePrice: 30 },
            { name: 'Drop Box', shortname: 'dropbox', basePrice: 50 },
            { name: 'Vending Machine', shortname: 'vending.machine', basePrice: 250 },
            { name: 'Chair', shortname: 'chair', basePrice: 20 },
            { name: 'Table', shortname: 'table', basePrice: 30 },
            { name: 'Rug', shortname: 'rug', basePrice: 20 },
            { name: 'Bear Skin Rug', shortname: 'rug.bear', basePrice: 50 },
            { name: 'Reactive Target', shortname: 'target.reactive', basePrice: 50 }
        ]
    },
    rce_deployables_utility: {
        label: 'Workbenches & Utility',
        emoji: '🔥',
        items: [
            { name: 'Workbench Level 1', shortname: 'workbench1', basePrice: 100 },
            { name: 'Workbench Level 2', shortname: 'workbench2', basePrice: 300 },
            { name: 'Workbench Level 3', shortname: 'workbench3', basePrice: 1000 },
            { name: 'Research Table', shortname: 'research.table', basePrice: 150 },
            { name: 'Repair Bench', shortname: 'box.repair.bench', basePrice: 100 },
            { name: 'Mixing Table', shortname: 'mixingtable', basePrice: 150 },
            { name: 'Campfire', shortname: 'campfire', basePrice: 10 },
            { name: 'Barbeque', shortname: 'bbq', basePrice: 50 },
            { name: 'Furnace', shortname: 'furnace', basePrice: 50 },
            { name: 'Large Furnace', shortname: 'furnace.large', basePrice: 300 },
            { name: 'Small Oil Refinery', shortname: 'small.oil.refinery', basePrice: 250 },
            { name: 'Fridge', shortname: 'fridge', basePrice: 100 },
            { name: 'Electric Heater', shortname: 'heater', basePrice: 50 },
            { name: 'Elevator', shortname: 'elevator', basePrice: 250 }
        ]
    },
    rce_electrical_power: {
        label: 'Electricity: Power & Lights',
        emoji: '⚡',
        items: [
            { name: 'Wind Turbine', shortname: 'generator.wind.scrap', basePrice: 500 },
            { name: 'Large Solar Panel', shortname: 'solarpanel.large', basePrice: 150 },
            { name: 'Small Generator', shortname: 'generator.small', basePrice: 200 },
            { name: 'Test Generator', shortname: 'electric.generator.small', basePrice: 100 },
            { name: 'Large Battery', shortname: 'battery.rechargeable.large', basePrice: 400 },
            { name: 'Medium Battery', shortname: 'battery.rechargeable.medium', basePrice: 200 },
            { name: 'Small Battery', shortname: 'battery.rechargeable.small', basePrice: 50 },
            { name: 'Lantern', shortname: 'lantern', basePrice: 20 },
            { name: 'Ceiling Light', shortname: 'ceilinglight', basePrice: 20 },
            { name: 'Search Light', shortname: 'searchlight', basePrice: 100 },
            { name: 'Flasher Light', shortname: 'flasherlight', basePrice: 50 },
            { name: 'Siren Light', shortname: 'sirenlight', basePrice: 50 }
        ]
    },
    rce_electrical_logic: {
        label: 'Electricity: Logic & Sensors',
        emoji: '🔌',
        items: [
            { name: 'Root Combiner', shortname: 'electrical.combiner', basePrice: 30 },
            { name: 'Electrical Branch', shortname: 'electrical.branch', basePrice: 30 },
            { name: 'Splitter', shortname: 'electrical.splitter', basePrice: 30 },
            { name: 'Switch', shortname: 'electrical.switch', basePrice: 20 },
            { name: 'Blocker', shortname: 'electrical.blocker', basePrice: 30 },
            { name: 'Timer', shortname: 'electrical.timer', basePrice: 30 },
            { name: 'Memory Cell', shortname: 'electrical.memorycell', basePrice: 50 },
            { name: 'AND Switch', shortname: 'electrical.andswitch', basePrice: 30 },
            { name: 'OR Switch', shortname: 'electrical.orswitch', basePrice: 30 },
            { name: 'XOR Switch', shortname: 'electrical.xorswitch', basePrice: 30 },
            { name: 'Rand Switch', shortname: 'electrical.random.switch', basePrice: 30 },
            { name: 'Electrical Counter', shortname: 'electrical.counter', basePrice: 50 },
            { name: 'Igniter', shortname: 'igniter', basePrice: 50 },
            { name: 'Laser Detector', shortname: 'electrical.laser.detector', basePrice: 50 },
            { name: 'HBHF Sensor', shortname: 'hbhfsensor', basePrice: 75 },
            { name: 'Pressure Pad', shortname: 'pressurepad', basePrice: 50 },
            { name: 'Audio Alarm', shortname: 'electrical.audioalarm', basePrice: 50 },
            { name: 'RF Broadcaster', shortname: 'rf.broadcaster', basePrice: 75 },
            { name: 'RF Receiver', shortname: 'rf.receiver', basePrice: 75 },
            { name: 'RF Pager', shortname: 'rf.pager', basePrice: 30 },
            { name: 'Door Controller', shortname: 'door.controller', basePrice: 50 },
            { name: 'Seismic Sensor', shortname: 'seismic.sensor', basePrice: 50 }
        ]
    },
    rce_industrial_water: {
        label: 'Industrial & Water',
        emoji: '🏭',
        items: [
            { name: 'Storage Adaptor', shortname: 'industrial.adaptor', basePrice: 50 },
            { name: 'Storage Monitor', shortname: 'storage.monitor', basePrice: 100 },
            { name: 'Industrial Conveyor', shortname: 'industrial.conveyor', basePrice: 100 },
            { name: 'Industrial Crafter', shortname: 'industrial.crafter', basePrice: 200 },
            { name: 'Industrial Splitter', shortname: 'industrial.splitter', basePrice: 50 },
            { name: 'Industrial Combiner', shortname: 'industrial.combiner', basePrice: 50 },
            { name: 'Fluid Switch & Pump', shortname: 'fluid.switch', basePrice: 50 },
            { name: 'Fluid Splitter', shortname: 'fluid.splitter', basePrice: 50 },
            { name: 'Fluid Combiner', shortname: 'fluid.combiner', basePrice: 50 },
            { name: 'Powered Water Purifier', shortname: 'water.purifier.powered', basePrice: 100 },
            { name: 'Water Catcher Small', shortname: 'water.catcher.small', basePrice: 100 },
            { name: 'Water Catcher Large', shortname: 'water.catcher.large', basePrice: 250 },
            { name: 'Water Barrel', shortname: 'water.barrel', basePrice: 50 },
            { name: 'Water Pump', shortname: 'water.pump', basePrice: 75 },
            { name: 'Sprinkler', shortname: 'sprinkler', basePrice: 30 }
        ]
    },
    rce_farming: {
        label: 'Farming & Seeds',
        emoji: '🌱',
        items: [
            { name: 'Large Planter Box', shortname: 'planter.large', basePrice: 50 },
            { name: 'Small Planter Box', shortname: 'planter.small', basePrice: 25 },
            { name: 'Composter', shortname: 'composter', basePrice: 100 },
            { name: 'Fertilizer', shortname: 'fertilizer', basePrice: 10 },
            { name: 'Hemp Seed', shortname: 'seed.hemp', basePrice: 5 },
            { name: 'Pumpkin Seed', shortname: 'seed.pumpkin', basePrice: 5 },
            { name: 'Corn Seed', shortname: 'seed.corn', basePrice: 5 },
            { name: 'Potato Seed', shortname: 'seed.potato', basePrice: 5 },
            { name: 'Red Berry Clone', shortname: 'clone.berry.red', basePrice: 5 },
            { name: 'Blue Berry Clone', shortname: 'clone.berry.blue', basePrice: 5 },
            { name: 'Yellow Berry Clone', shortname: 'clone.berry.yellow', basePrice: 5 },
            { name: 'White Berry Clone', shortname: 'clone.berry.white', basePrice: 5 },
            { name: 'Green Berry Clone', shortname: 'clone.berry.green', basePrice: 5 },
            { name: 'Black Berry Clone', shortname: 'clone.berry.black', basePrice: 5 }
        ]
    },
    rce_food: {
        label: 'Food & Drinks',
        emoji: '🍎',
        items: [
            { name: 'Pumpkin', shortname: 'pumpkin', basePrice: 5 },
            { name: 'Corn', shortname: 'corn', basePrice: 5 },
            { name: 'Potato', shortname: 'potato', basePrice: 5 },
            { name: 'Apple', shortname: 'apple', basePrice: 5 },
            { name: 'Black Raspberries', shortname: 'black.raspberries', basePrice: 5 },
            { name: 'Blueberries', shortname: 'blueberries', basePrice: 10 },
            { name: 'Mushrooms', shortname: 'mushroom', basePrice: 2 },
            { name: 'Can of Beans', shortname: 'can.beans', basePrice: 10 },
            { name: 'Can of Tuna', shortname: 'can.tuna', basePrice: 10 },
            { name: 'Granola Bar', shortname: 'granolabar', basePrice: 10 },
            { name: 'Chocolate Bar', shortname: 'chocholate', basePrice: 15 },
            { name: 'Cooked Wolf Meat', shortname: 'meat.wolf.cooked', basePrice: 5 },
            { name: 'Cooked Pork', shortname: 'meat.pork.cooked', basePrice: 5 },
            { name: 'Cooked Bear Meat', shortname: 'meat.bear.cooked', basePrice: 5 },
            { name: 'Cooked Chicken', shortname: 'meat.boar.cooked', basePrice: 5 },
            { name: 'Cooked Deer Meat', shortname: 'meat.deer.cooked', basePrice: 5 },
            { name: 'Water Jug', shortname: 'waterjug', basePrice: 20 }
        ]
    },
    rce_medical_teas: {
        label: 'Medical & Teas',
        emoji: '⚕️',
        items: [
            { name: 'Bandage', shortname: 'bandage', basePrice: 5 },
            { name: 'Medical Syringe', shortname: 'syringe.medical', basePrice: 25 },
            { name: 'Large Medkit', shortname: 'largemedkit', basePrice: 50 },
            { name: 'Anti-Radiation Pills', shortname: 'antiradpills', basePrice: 20 },
            { name: 'Pure Ore Tea', shortname: 'tea.ore.pure', basePrice: 150 },
            { name: 'Pure Wood Tea', shortname: 'tea.wood.pure', basePrice: 150 },
            { name: 'Pure Scrap Tea', shortname: 'tea.scrap.pure', basePrice: 200 },
            { name: 'Pure Max Health Tea', shortname: 'tea.maxhealth.pure', basePrice: 100 },
            { name: 'Pure Healing Tea', shortname: 'tea.healing.pure', basePrice: 100 },
            { name: 'Advanced Ore Tea', shortname: 'tea.ore.advanced', basePrice: 75 },
            { name: 'Advanced Wood Tea', shortname: 'tea.wood.advanced', basePrice: 75 },
            { name: 'Advanced Scrap Tea', shortname: 'tea.scrap.advanced', basePrice: 100 },
            { name: 'Basic Ore Tea', shortname: 'tea.ore', basePrice: 25 },
            { name: 'Basic Wood Tea', shortname: 'tea.wood', basePrice: 25 },
            { name: 'Basic Scrap Tea', shortname: 'tea.scrap', basePrice: 50 },
            { name: 'Basic Max Health Tea', shortname: 'tea.maxhealth', basePrice: 25 },
            { name: 'Basic Healing Tea', shortname: 'tea.healing', basePrice: 25 }
        ]
    },
    rce_vehicles_horses: {
        label: 'Vehicles, Parts & Horses',
        emoji: '🚗',
        items: [
            { name: 'Modular Car Lift', shortname: 'modularcarlift', basePrice: 250 },
            { name: 'Car Key', shortname: 'car.key', basePrice: 50 },
            { name: 'Low Quality Carburetor', shortname: 'low.quality.carburetor', basePrice: 30 },
            { name: 'Low Quality Crankshaft', shortname: 'low.quality.crankshaft', basePrice: 30 },
            { name: 'Low Quality Pistons', shortname: 'low.quality.pistons', basePrice: 30 },
            { name: 'Low Quality Spark Plug', shortname: 'low.quality.sparkplug', basePrice: 30 },
            { name: 'Low Quality Valves', shortname: 'low.quality.valves', basePrice: 30 },
            { name: 'Medium Quality Carburetor', shortname: 'medium.quality.carburetor', basePrice: 60 },
            { name: 'Medium Quality Crankshaft', shortname: 'medium.quality.crankshaft', basePrice: 60 },
            { name: 'Medium Quality Pistons', shortname: 'medium.quality.pistons', basePrice: 60 },
            { name: 'Medium Quality Spark Plug', shortname: 'medium.quality.sparkplug', basePrice: 60 },
            { name: 'Medium Quality Valves', shortname: 'medium.quality.valves', basePrice: 60 },
            { name: 'High Quality Carburetor', shortname: 'high.quality.carburetor', basePrice: 150 },
            { name: 'High Quality Crankshaft', shortname: 'high.quality.crankshaft', basePrice: 150 },
            { name: 'High Quality Pistons', shortname: 'high.quality.pistons', basePrice: 150 },
            { name: 'High Quality Spark Plug', shortname: 'high.quality.sparkplug', basePrice: 150 },
            { name: 'High Quality Valves', shortname: 'high.quality.valves', basePrice: 150 },
            { name: 'Horse Saddle', shortname: 'horse.saddle', basePrice: 100 },
            { name: 'Roadsign Horse Armor', shortname: 'horse.armor.roadsign', basePrice: 150 },
            { name: 'Wooden Horse Armor', shortname: 'horse.armor.wood', basePrice: 50 },
            { name: 'HQ Horse Shoes', shortname: 'horse.shoes.advanced', basePrice: 100 },
            { name: 'Basic Horse Shoes', shortname: 'horse.shoes.basic', basePrice: 30 },
            { name: 'Hitch & Trough', shortname: 'hitchtrough', basePrice: 50 },
            { name: 'Kayak', shortname: 'kayak', basePrice: 100 }
        ]
    },
    rce_misc: {
        label: 'Keycards & Misc',
        emoji: '🏷️',
        items: [
            { name: 'Green Keycard', shortname: 'keycard_green', basePrice: 50 },
            { name: 'Blue Keycard', shortname: 'keycard_blue', basePrice: 150 },
            { name: 'Red Keycard', shortname: 'keycard_red', basePrice: 300 },
            { name: 'Supply Signal', shortname: 'supply.signal', basePrice: 500 },
            { name: 'Fuses', shortname: 'fuse', basePrice: 20 },
            { name: 'Blueprints (Paper)', shortname: 'blueprintbase', basePrice: 10 },
            { name: 'Camera', shortname: 'camera', basePrice: 50 },
            { name: 'Note', shortname: 'note', basePrice: 1 },
            { name: 'Photograph', shortname: 'photo', basePrice: 1 }
        ]
    }
};

exports.RUST_CATEGORIES = RUST_CATEGORIES;