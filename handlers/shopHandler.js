const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, ShopItem, UserEconomy } = require('../database/db');
const { sendRconCommand } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    // --- ADMIN SETUP HUB ---
    if (customId === 'admin_menu_select' && selectedValue === 'setup_shop') {
        const embed = new EmbedBuilder().setTitle('🛒 Server Shop Manager').setDescription('Add prebuilt catalog items, custom gear, or adjust pricing multipliers.').setColor('#e67e22');
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('shop_action_select').setPlaceholder('Select shop action...')
            .addOptions([
                { label: 'Add Prebuilt Catalog Items (Multi-Select)', value: 'shop_add_catalog', emoji: '📦' },
                { label: 'Add Custom Shop Item', value: 'shop_add_custom', emoji: '✨' },
                { label: 'Set Price Multiplier (e.g. 500%)', value: 'shop_multiplier', emoji: '📈' },
                { label: 'View / Manage Live Store', value: 'shop_manage', emoji: '📋' }
            ])
        );
        return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }

    if (customId === 'shop_action_select') {
        if (selectedValue === 'shop_add_catalog') {
            const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => ({ label: RUST_CATEGORIES[catKey].label, value: `shop_cat_${catKey}`, emoji: RUST_CATEGORIES[catKey].emoji }));
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('shop_catalog_category').setPlaceholder('Choose a Rust category...').addOptions(catOptions));
            return interaction.reply({ content: '📦 Select a category to open the item checklist:', components: [row], flags: 64 });
        }
        if (selectedValue === 'shop_add_custom') {
            const modal = new ModalBuilder().setCustomId('modal_shop_custom').setTitle('Add Custom Shop Item');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_name').setLabel("Display Name").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_cmd').setLabel("RCON Command (use {player})").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_price').setLabel("Price").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_cooldown').setLabel("Cooldown in Seconds (0 = None)").setStyle(TextInputStyle.Short).setValue('0').setRequired(false))
            );
            return interaction.showModal(modal);
        }
        if (selectedValue === 'shop_multiplier') {
            const modal = new ModalBuilder().setCustomId('modal_shop_multiplier').setTitle('Set Price Multiplier');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('multiplier').setLabel("Multiplier % (e.g. 100 = Base, 500 = 500%)").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'shop_manage') {
            const items = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
            if (items.length === 0) return interaction.reply({ content: '❌ No items in the shop yet.', flags: 64 });
            const list = items.slice(0, 25).map(i => `• **${i.name}** - 💰 ${i.price} | CD: ${i.cooldownSeconds}s`).join('\n');
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('📋 Active Shop Items').setDescription(list).setColor('#2ecc71')], flags: 64 });
        }
    }

    if (customId === 'shop_catalog_category') {
        const catKey = selectedValue.replace('shop_cat_', '');
        const categoryData = RUST_CATEGORIES[catKey];
        const itemOptions = categoryData.items.slice(0, 25).map(item => ({ label: item.name, description: `Shortname: ${item.shortname} | Base: ${item.basePrice}`, value: `${catKey}__${item.shortname}` }));
        
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('shop_catalog_multi_select').setPlaceholder('Check multiple items to add...').setMinValues(1).setMaxValues(itemOptions.length).addOptions(itemOptions)
        );
        return interaction.update({ content: `📦 **${categoryData.label}**: Check one or more items below, then submit to batch add them!`, components: [row] });
    }

    if (customId === 'shop_catalog_multi_select') {
        const checkedItems = interaction.values;
        let addedCount = 0;
        for (const val of checkedItems) {
            const [catKey, shortname] = val.split('__');
            const catalogItem = RUST_CATEGORIES[catKey]?.items.find(i => i.shortname === shortname);
            if (catalogItem) {
                await ShopItem.create({
                    guildId: interaction.guild.id, name: catalogItem.name, command: `inventory.giveto "{player}" ${catalogItem.shortname} 1`, price: catalogItem.basePrice, category: catKey, cooldownSeconds: 0
                });
                addedCount++;
            }
        }
        return interaction.update({ content: `✅ Successfully batch-added **${addedCount} items** to your server shop!`, components: [] });
    }

    if (customId.startsWith('shop_role_')) {
        const itemId = customId.replace('shop_role_', '');
        await ShopItem.update({ requiredRoleId: interaction.values[0] }, { where: { id: itemId } });
        return interaction.update({ content: `✅ Item role restriction updated successfully!`, components: [] });
    }

    // --- PLAYER SHOP ---
    if (customId === 'hub_shop_menu') {
        const embed = new EmbedBuilder()
            .setTitle('🛒 Server Shop')
            .setDescription('Choose an option below to browse items by category or check the real-time categorized price list.')
            .setColor('#e67e22');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hub_shop_browse').setLabel('Browse Store (Categories)').setStyle(ButtonStyle.Primary).setEmoji('🛍️'),
            new ButtonBuilder().setCustomId('hub_shop_pricelist').setLabel('Live Price List').setStyle(ButtonStyle.Secondary).setEmoji('📋')
        );
        return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }

    if (customId === 'hub_shop_browse') {
        const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
        const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => {
            const count = dbItems.filter(i => i.category === catKey).length;
            return { label: `${RUST_CATEGORIES[catKey].label} (${count} items)`, value: catKey, emoji: RUST_CATEGORIES[catKey].emoji };
        });
        const customCount = dbItems.filter(i => i.category === 'custom').length;
        catOptions.push({ label: `Custom / Server Items (${customCount} items)`, value: 'custom', emoji: '✨' });

        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('player_shop_cat_select').setPlaceholder('Choose a shop category...').addOptions(catOptions));
        return interaction.reply({ content: '🛒 **Server Shop Categories:** Select a category below to view items and make purchases:', components: [row], flags: 64 });
    }

    if (customId === 'player_shop_cat_select') {
        const catKey = selectedValue;
        const categoryData = RUST_CATEGORIES[catKey];
        const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const multiplier = (config?.shopMultiplier || 100) / 100;
        const availableItems = dbItems.filter(i => i.category === catKey || (catKey === 'custom' && i.category === 'custom'));

        if (availableItems.length === 0) return interaction.update({ content: `❌ No items currently available in **${categoryData?.label || 'Custom'}**.`, components: [] });

        const options = availableItems.map(i => ({ label: i.name, description: `Price: ${Math.round(i.price * multiplier)} | CD: ${i.cooldownSeconds}s`, value: `buy_item_${i.id}` }));
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('player_shop_buy_select').setPlaceholder('Select item to buy...').addOptions(options));
        return interaction.update({ content: `🛒 **${categoryData?.label || 'Shop'}**: Select an item to purchase:`, components: [row] });
    }

    if (customId === 'player_shop_buy_select') {
        const itemId = selectedValue.replace('buy_item_', '');
        const shopItem = await ShopItem.findByPk(itemId);
        if (!shopItem) return interaction.reply({ content: '❌ Item not found.', flags: 64 });
        
        const modal = new ModalBuilder().setCustomId(`modal_buy_qty_${itemId}`).setTitle(`Buy: ${shopItem.name}`);
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantity').setLabel("How many would you like to buy?").setStyle(TextInputStyle.Short).setValue('1').setRequired(true)));
        return interaction.showModal(modal);
    }

    if (customId === 'hub_shop_pricelist') {
        const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config?.economyCurrency || 'Scrap';
        const multiplier = (config?.shopMultiplier || 100) / 100;

        if (dbItems.length === 0) {
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('hub_shop_menu').setLabel('Go Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙'));
            return interaction.update({ content: '❌ There are currently no items for sale in the shop.', embeds: [], components: [row] });
        }

        const embed = new EmbedBuilder().setTitle('📋 Categorized Store Price List').setDescription('Here are all items currently available for purchase across all categories:').setColor('#3498db').setFooter({ text: 'Prices reflect real-time global multipliers.' });

        for (const catKey in RUST_CATEGORIES) {
            const catData = RUST_CATEGORIES[catKey];
            const itemsInCat = dbItems.filter(i => i.category === catKey);
            if (itemsInCat.length > 0) {
                let itemListText = itemsInCat.map(i => {
                    const finalPrice = Math.round(i.price * multiplier);
                    return `• **${i.name}** — 💰 **${finalPrice} ${currency}** *(CD: ${i.cooldownSeconds}s)*`;
                }).join('\n');
                if (itemListText.length > 1024) itemListText = itemListText.substring(0, 1021) + '...';
                embed.addFields({ name: `${catData.emoji} ${catData.label}`, value: itemListText, inline: false });
            }
        }

        const customItems = dbItems.filter(i => i.category === 'custom');
        if (customItems.length > 0) {
            let customListText = customItems.map(i => {
                const finalPrice = Math.round(i.price * multiplier);
                return `• **${i.name}** — 💰 **${finalPrice} ${currency}** *(CD: ${i.cooldownSeconds}s)*`;
            }).join('\n');
            if (customListText.length > 1024) customListText = customListText.substring(0, 1021) + '...';
            embed.addFields({ name: '✨ Custom / Server Items', value: customListText, inline: false });
        }

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('hub_shop_menu').setLabel('Go Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙'));
        return interaction.update({ embeds: [embed], components: [row] });
    }

    // --- MODAL SUBMISSIONS ---
    if (interaction.isModalSubmit()) {
        if (customId === 'modal_shop_custom') {
            const name = interaction.fields.getTextInputValue('item_name');
            const cmd = interaction.fields.getTextInputValue('item_cmd');
            const price = parseInt(interaction.fields.getTextInputValue('item_price')) || 100;
            const cd = parseInt(interaction.fields.getTextInputValue('item_cooldown')) || 0;
            const newItem = await ShopItem.create({ guildId: interaction.guild.id, name, command: cmd, price, category: 'custom', cooldownSeconds: cd });
            const roleMenu = new RoleSelectMenuBuilder().setCustomId(`shop_role_${newItem.id}`).setPlaceholder('Select required Discord role (Optional)...');
            return interaction.reply({ content: `✅ Custom item **${name}** added! Optional role restriction:`, components: [new ActionRowBuilder().addComponents(roleMenu)], flags: 64 });
        }

        if (customId === 'modal_shop_multiplier') {
            const mult = parseInt(interaction.fields.getTextInputValue('multiplier'));
            await GuildConfig.upsert({ guildId: interaction.guild.id, shopMultiplier: mult });
            return interaction.reply({ content: `✅ Global price multiplier set to **${mult}%**!`, flags: 64 });
        }

        if (customId.startsWith('modal_buy_qty_')) {
            const itemId = customId.replace('modal_buy_qty_', '');
            const qty = parseInt(interaction.fields.getTextInputValue('quantity'));
            if (isNaN(qty) || qty <= 0) return interaction.reply({ content: '❌ Please enter a valid quantity greater than 0.', flags: 64 });

            const shopItem = await ShopItem.findByPk(itemId);
            if (!shopItem) return interaction.reply({ content: '❌ Item no longer exists.', flags: 64 });

            const userEconomy = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            if (!userEconomy || !userEconomy.inGameName) return interaction.reply({ content: '❌ Link your Rust account first using `/playerpanel`!', flags: 64 });

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const unitPrice = Math.round(shopItem.price * ((config?.shopMultiplier || 100) / 100));
            const totalPrice = unitPrice * qty;

            if (userEconomy.wallet < totalPrice) {
                return interaction.reply({ content: `❌ You need **${totalPrice} ${config?.economyCurrency || 'Scrap'}** for ${qty}x ${shopItem.name}, but you only have **${userEconomy.wallet}**.`, flags: 64 });
            }

            try {
                await userEconomy.update({ wallet: userEconomy.wallet - totalPrice });
                
                let scaledCommand = shopItem.command;
                const parts = scaledCommand.split(' ');
                if (parts.length >= 4 && !isNaN(parts[parts.length - 1])) {
                    const baseAmount = parseInt(parts[parts.length - 1]);
                    parts[parts.length - 1] = (baseAmount * qty).toString();
                    scaledCommand = parts.join(' ');
                }

                const finalCommand = scaledCommand.replace(/{player}/gi, `"${userEconomy.inGameName}"`);
                for (const c of finalCommand.split('\n')) {
                    if (c.trim()) await sendRconCommand(interaction.guild.id, c.trim());
                }

                return interaction.reply({ content: `✅ **Purchase Successful!** You bought **${qty}x ${shopItem.name}** for **${totalPrice} ${config?.economyCurrency || 'Scrap'}**. Delivered to your in-game inventory!`, flags: 64 });
            } catch (e) {
                return interaction.reply({ content: `❌ RCON Error: ${e.message}`, flags: 64 });
            }
        }
    }
};