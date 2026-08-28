const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, ShopItem, UserEconomy, ShopCooldown } = require('../database/db');
const { sendRconCommand } = require('../utils/rconManager');
const { RUST_CATEGORIES } = require('../utils/rustCatalog');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    async function renderShopManagePanel(interaction, messageText = '') {
        const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
        const totalCount = dbItems.length;

        let categoryBreakdown = '';
        for (const catKey in RUST_CATEGORIES) {
            const count = dbItems.filter(i => i.category === catKey).length;
            categoryBreakdown += `• ${RUST_CATEGORIES[catKey].emoji} **${RUST_CATEGORIES[catKey].label}:** \`${count}\` item(s)\n`;
        }
        const customCount = dbItems.filter(i => i.category === 'custom').length;
        categoryBreakdown += `• ✨ **Custom / Server Items:** \`${customCount}\` item(s)\n`;

        const embed = new EmbedBuilder()
            .setTitle('🛒 Server Shop Manager')
            .setDescription(messageText ? `**${messageText}**\n\n` : '' + 
                `Manage your store categories, add prebuilt catalog items, custom gear, or adjust pricing multipliers.\n\n` +
                `📊 **Active Store Summary:**\n` +
                `• **Total Items in Store:** \`${totalCount}\`\n\n` +
                `📂 **Category Breakdown:**\n${categoryBreakdown}`)
            .setColor('#2ecc71');

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('shop_action_select').setPlaceholder('Select shop action...')
            .addOptions([
                { label: 'Add Prebuilt Catalog Items (Multi-Select)', value: 'shop_add_catalog', emoji: '📦' },
                { label: 'Add Custom Shop Item', value: 'shop_add_custom', emoji: '✨' },
                { label: 'Set Price Multiplier (e.g. 500%)', value: 'shop_multiplier', emoji: '📈' },
                { label: 'View / Manage Live Store', value: 'shop_manage', emoji: '📋' },
                { label: 'Clear Entire Shop', value: 'shop_clear_all', emoji: '🗑️' }
            ])
        );

        if (interaction.replied || interaction.deferred) {
            return await interaction.editReply({ embeds: [embed], components: [row], content: null });
        } else if (interaction.isStringSelectMenu() || interaction.isButton()) {
            return await interaction.update({ embeds: [embed], components: [row], content: null });
        } else {
            return await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }
    }

    if (customId === 'admin_menu_select' && selectedValue === 'setup_shop') return await renderShopManagePanel(interaction);

    if (customId === 'shop_action_select') {
        if (selectedValue === 'shop_add_catalog') {
            const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });
            const catOptions = Object.keys(RUST_CATEGORIES).map(catKey => {
                const count = dbItems.filter(i => i.category === catKey).length;
                return { label: `${RUST_CATEGORIES[catKey].label} (${count} active)`, value: `shop_cat_${catKey}`, emoji: RUST_CATEGORIES[catKey].emoji };
            });
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('shop_catalog_category').setPlaceholder('Choose a Rust category...').addOptions(catOptions));
            return interaction.update({ content: '📦 Select a category to open the multi-select item checklist:', components: [row], embeds: [] });
        }
        if (selectedValue === 'shop_add_custom') {
            const cleanModal = new ModalBuilder().setCustomId('modal_shop_custom').setTitle('Add Custom Shop Item');
            cleanModal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_name').setLabel("Display Name").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_cmd').setLabel("RCON Command (use {player})").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_price').setLabel("Price").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_cooldown').setLabel("Cooldown in Seconds (0 = None)").setStyle(TextInputStyle.Short).setValue('0').setRequired(false))
            );
            return interaction.showModal(cleanModal);
        }
        if (selectedValue === 'shop_multiplier') {
            const modal = new ModalBuilder().setCustomId('modal_shop_multiplier').setTitle('Set Price Multiplier');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('multiplier').setLabel("Multiplier % (e.g. 100 = Base, 500 = 500%)").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'shop_manage') return await renderShopManagePanel(interaction);
        if (selectedValue === 'shop_clear_all') {
            await ShopItem.destroy({ where: { guildId: interaction.guild.id } });
            return await renderShopManagePanel(interaction, '🗑️ Successfully wiped and cleared the entire shop!');
        }
    }

    if (customId === 'shop_catalog_category') {
        const catKey = selectedValue.replace('shop_cat_', '');
        const categoryData = RUST_CATEGORIES[catKey];
        const dbItems = await ShopItem.findAll({ where: { guildId: interaction.guild.id } });

        const itemOptions = categoryData.items.slice(0, 25).map(item => {
            const isAlreadyAdded = dbItems.some(i => i.command.includes(item.shortname));
            return {
                label: item.name,
                description: isAlreadyAdded ? `✅ [In Store] Base: ${item.basePrice}` : `Base Price: ${item.basePrice} Scrap`,
                value: `${catKey}__${item.shortname}`
            };
        });
        
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('shop_catalog_multi_select')
                .setPlaceholder('Check multiple items (uncheck to skip)...')
                .setMinValues(1)
                .setMaxValues(itemOptions.length)
                .addOptions(itemOptions)
        );
        return interaction.update({ content: `📦 **${categoryData.label}**: Check multiple items below. Items already in store are safely ignored to prevent duplicates:`, components: [row] });
    }

    if (customId === 'shop_catalog_multi_select') {
        const checkedItems = interaction.values;
        let addedCount = 0;
        let duplicateCount = 0;

        for (const val of checkedItems) {
            const [catKey, shortname] = val.split('__');
            const catalogItem = RUST_CATEGORIES[catKey]?.items.find(i => i.shortname === shortname);
            
            if (catalogItem) {
                const cmdString = `inventory.giveto "{player}" ${catalogItem.shortname} 1`;
                const existing = await ShopItem.findOne({ where: { guildId: interaction.guild.id, command: cmdString } });

                if (!existing) {
                    await ShopItem.create({ guildId: interaction.guild.id, name: catalogItem.name, command: cmdString, price: catalogItem.basePrice, category: catKey, cooldownSeconds: 0 });
                    addedCount++;
                } else { duplicateCount++; }
            }
        }

        const feedback = `✅ Added **${addedCount} new items**! (${duplicateCount} duplicates were safely skipped).`;
        return await renderShopManagePanel(interaction, feedback);
    }

    if (customId.startsWith('shop_role_')) {
        const itemId = customId.replace('shop_role_', '');
        await ShopItem.update({ requiredRoleId: interaction.values[0] }, { where: { id: itemId } });
        return interaction.update({ content: `✅ Item role restriction updated successfully!`, components: [] });
    }

    if (customId === 'hub_shop_menu') {
        const embed = new EmbedBuilder().setTitle('🛒 Server Shop').setDescription('Choose an option below to browse items by category or check the real-time categorized price list.').setColor('#e67e22');
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

        const options = availableItems.map(i => {
            const finalPrice = Math.round(i.price * multiplier);
            return { label: i.name, description: `Price: ${finalPrice} Scrap`, value: `buy_item_${i.id}` };
        });
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

        if (dbItems.length === 0) return interaction.update({ content: '❌ There are currently no items for sale in the shop.', embeds: [], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('hub_shop_menu').setLabel('Go Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙'))] });

        const embed = new EmbedBuilder().setTitle('📋 Categorized Store Price List').setDescription('Here are all items currently available for purchase:').setColor('#3498db').setFooter({ text: 'Prices reflect real-time multipliers.' });

        for (const catKey in RUST_CATEGORIES) {
            const catData = RUST_CATEGORIES[catKey];
            const itemsInCat = dbItems.filter(i => i.category === catKey);
            if (itemsInCat.length > 0) {
                let itemListText = itemsInCat.map(i => {
                    const finalPrice = Math.round(i.price * multiplier);
                    const cdText = i.cooldownSeconds > 0 ? ` *(CD: ${i.cooldownSeconds}s)*` : '';
                    return `• **${i.name}** — 💰 **${finalPrice} ${currency}**${cdText}`;
                }).join('\n');
                if (itemListText.length > 1024) itemListText = itemListText.substring(0, 1021) + '...';
                embed.addFields({ name: `${catData.emoji} ${catData.label}`, value: itemListText, inline: false });
            }
        }

        const customItems = dbItems.filter(i => i.category === 'custom');
        if (customItems.length > 0) {
            let customListText = customItems.map(i => {
                const finalPrice = Math.round(i.price * multiplier);
                const cdText = i.cooldownSeconds > 0 ? ` *(CD: ${i.cooldownSeconds}s)*` : '';
                return `• **${i.name}** — 💰 **${finalPrice} ${currency}**${cdText}`;
            }).join('\n');
            if (customListText.length > 1024) customListText = customListText.substring(0, 1021) + '...';
            embed.addFields({ name: '✨ Custom / Server Items', value: customListText, inline: false });
        }

        return interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('hub_shop_menu').setLabel('Go Back').setStyle(ButtonStyle.Secondary).setEmoji('🔙'))] });
    }

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

            if (shopItem.cooldownSeconds > 0) {
                const now = new Date();
                const [cooldownRecord] = await ShopCooldown.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id, itemId: shopItem.id }, defaults: { expiresAt: now } });

                if (new Date(cooldownRecord.expiresAt) > now) {
                    const secondsLeft = Math.ceil((new Date(cooldownRecord.expiresAt) - now) / 1000);
                    const minutesLeft = Math.floor(secondsLeft / 60);
                    const timeString = minutesLeft > 0 ? `${minutesLeft}m ${secondsLeft % 60}s` : `${secondsLeft}s`;
                    return interaction.reply({ content: `⏳ You are on cooldown for **${shopItem.name}**! Please wait **${timeString}** before purchasing it again.`, flags: 64 });
                }
                await cooldownRecord.update({ expiresAt: new Date(now.getTime() + shopItem.cooldownSeconds * 1000) });
            }

            const userEconomy = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            if (!userEconomy || !userEconomy.inGameName) return interaction.reply({ content: '❌ Link your Rust account first using `/playerpanel`!', flags: 64 });

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';
            const unitPrice = Math.round(shopItem.price * ((config?.shopMultiplier || 100) / 100));
            const totalPrice = unitPrice * qty;

            if (userEconomy.wallet < totalPrice) return interaction.reply({ content: `❌ You need **${totalPrice} ${currency}** for ${qty}x ${shopItem.name}, but you only have **${userEconomy.wallet}**.`, flags: 64 });

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
                return interaction.reply({ content: `✅ **Purchase Successful!** You bought **${qty}x ${shopItem.name}** for **${totalPrice} ${currency}**. Delivered to your in-game inventory!`, flags: 64 });
            } catch (e) {
                return interaction.reply({ content: `❌ RCON Error: ${e.message}`, flags: 64 });
            }
        }
    }
};