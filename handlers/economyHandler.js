const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const { GuildConfig, UserEconomy, GameServer } = require('../database/db');
const { sendRconCommand } = require('../utils/rconManager');
const adminHandler = require('./adminHandler');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const value = interaction.isStringSelectMenu() ? interaction.values[0] : null;

    if (customId === 'admin_menu_back') {
        if (adminHandler && adminHandler.renderMainPanel) {
            return await adminHandler.renderMainPanel(interaction);
        }
        return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
    }

    // ==========================================
    // 1. ADMIN ECONOMY SETUP PANEL
    // ==========================================
    if (customId === 'admin_menu_select' && value === 'setup_economy') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currencyName = config?.economyCurrency || 'Scrap';
        
        const dailyMin = config?.dailyMin ?? 50;
        const dailyMax = config?.dailyMax ?? 250;
        
        let buddyConfigCount = 0;
        try { buddyConfigCount = Object.keys(JSON.parse(config?.buddyDaysConfig || '{}')).length; } catch(e){}

        const embed = new EmbedBuilder()
            .setTitle('💰 Economy & Rewards Manager')
            .setDescription(`Manage currency names, daily random limits, custom 30-day Buddy Days milestones, and kill rewards.\n\n` +
                `• **Currency Name:** \`${currencyName}\`\n` +
                `• **Daily Reward:** \`${dailyMin}\` to \`${dailyMax}\` ${currencyName}\n` +
                `• **Buddy Days (Loyalty):** \`${buddyConfigCount}\` custom day rewards configured\n` +
                `• **Bank Interest Rate:** \`${config?.bankInterestRate || 0}%\` every \`${config?.bankInterestHours || 24}\` hours\n` +
                `• **Scientist Kill Reward:** \`${config?.scientistKillReward ?? 10}\` ${currencyName}\n` +
                `• **Player Kill Reward:** \`${config?.playerKillReward ?? 50}\` ${currencyName}`)
            .setColor('#f1c40f');
            
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_econ_name').setLabel('Set Currency Name').setStyle(ButtonStyle.Secondary).setEmoji('🏷️'),
            new ButtonBuilder().setCustomId('btn_econ_daily').setLabel('Set Daily Reward').setStyle(ButtonStyle.Success).setEmoji('🎁'),
            new ButtonBuilder().setCustomId('btn_econ_buddydays').setLabel('Buddy Days Setup').setStyle(ButtonStyle.Success).setEmoji('🗓️')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_econ_interest').setLabel('Set Bank Interest').setStyle(ButtonStyle.Primary).setEmoji('📈'),
            new ButtonBuilder().setCustomId('btn_econ_scientist_reward').setLabel('Scientist Reward').setStyle(ButtonStyle.Secondary).setEmoji('🧪'),
            new ButtonBuilder().setCustomId('btn_econ_player_reward').setLabel('Player Kill Reward').setStyle(ButtonStyle.Danger).setEmoji('⚔️')
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_admin_give').setLabel('Give Currency').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('btn_admin_take').setLabel('Take Currency').setStyle(ButtonStyle.Danger).setEmoji('➖'),
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );

        return interaction.reply({ embeds: [embed], components: [row1, row2, row3], flags: 64 });
    }

    // ==========================================
    // 2. BUTTON HANDLERS
    // ==========================================
    if (interaction.isButton()) {
        if (customId === 'btn_econ_name') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_setup_economy').setTitle('Configure Currency');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('currency_name').setLabel("Currency Name (e.g. Scrap)").setStyle(TextInputStyle.Short).setValue(config?.economyCurrency || 'Scrap').setRequired(true)));
            return interaction.showModal(modal);
        }

        if (customId === 'btn_econ_daily') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_econ_daily').setTitle('Configure Daily Reward Limits');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('daily_min').setLabel("Minimum Reward (e.g. 50)").setStyle(TextInputStyle.Short).setValue(`${config?.dailyMin ?? 50}`).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('daily_max').setLabel("Maximum Reward (e.g. 250)").setStyle(TextInputStyle.Short).setValue(`${config?.dailyMax ?? 250}`).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        // 👇 NEW: OPENS A DROPDOWN INSTEAD OF A CLUNKY MODAL!
        if (customId === 'btn_econ_buddydays') {
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('select_buddydays_type')
                    .setPlaceholder('Step 1: Select Reward Type...')
                    .addOptions([
                        { label: 'Currency Reward', value: 'type_currency', description: 'Give wallet currency', emoji: '💰' },
                        { label: 'BuddyPass XP', value: 'type_xp', description: 'Give battlepass XP', emoji: '⭐' },
                        { label: 'In-Game Resource/Item', value: 'type_item', description: 'Give Rust items', emoji: '🪵' },
                        { label: 'Server Kit', value: 'type_kit', description: 'Give a configured kit', emoji: '📦' }
                    ])
            );
            return interaction.reply({ content: '🗓️ **Buddy Days Setup:** What kind of reward do you want to give players?', components: [row], flags: 64 });
        }

        if (customId === 'btn_econ_scientist_reward') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_econ_scientist_reward').setTitle('Scientist Kill Reward');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('scientist_reward_amount').setLabel("Reward per Scientist Kill").setStyle(TextInputStyle.Short).setValue(`${config?.scientistKillReward ?? 10}`).setRequired(true)
            ));
            return interaction.showModal(modal);
        }

        if (customId === 'btn_econ_player_reward') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_econ_player_reward').setTitle('Player Kill Reward');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('player_reward_amount').setLabel("Reward per Player Kill").setStyle(TextInputStyle.Short).setValue(`${config?.playerKillReward ?? 50}`).setRequired(true)
            ));
            return interaction.showModal(modal);
        }

        if (customId === 'btn_admin_give') {
            const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('select_admin_give_target').setPlaceholder('Select player to GIVE currency to...'));
            return interaction.reply({ content: '➕ **Give Currency:** Select the player from the list below:', components: [row], flags: 64 });
        }

        if (customId === 'btn_admin_take') {
            const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('select_admin_take_target').setPlaceholder('Select player to TAKE currency from...'));
            return interaction.reply({ content: '➖ **Take Currency:** Select the player from the list below:', components: [row], flags: 64 });
        }

        if (customId === 'btn_econ_interest') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_econ_interest').setTitle('Configure Bank Interest');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interest_rate').setLabel("Interest Rate % (e.g. 2.5)").setStyle(TextInputStyle.Short).setValue(`${config?.bankInterestRate || 0}`).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('interest_hours').setLabel("Interval in Hours").setStyle(TextInputStyle.Short).setValue(`${config?.bankInterestHours || 24}`).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        if (customId === 'hub_economy_menu') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            const currency = config?.economyCurrency || 'Scrap';
            const streak = user?.buddyDaysStreak || 0;

            const embed = new EmbedBuilder()
                .setTitle('🏦 Economy & Bank Hub')
                .setDescription(`Manage your wallet, check your bank balance, claim your daily reward, or deposit/withdraw ${currency}.\n\n🗓️ **Current Buddy Days Streak:** \`${streak} / 30 Days\``)
                .setColor('#2ecc71');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hub_balance').setLabel('Balance').setStyle(ButtonStyle.Secondary).setEmoji('💰'),
                new ButtonBuilder().setCustomId('hub_daily').setLabel('Daily Reward').setStyle(ButtonStyle.Success).setEmoji('🎁'),
                new ButtonBuilder().setCustomId('hub_buddydays').setLabel('Buddy Days').setStyle(ButtonStyle.Primary).setEmoji('🗓️')
            );
            
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hub_deposit').setLabel('Deposit to Bank').setStyle(ButtonStyle.Secondary).setEmoji('📥'),
                new ButtonBuilder().setCustomId('hub_withdraw').setLabel('Withdraw to Wallet').setStyle(ButtonStyle.Secondary).setEmoji('📤')
            );
            return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
        }

        if (customId === 'hub_balance') {
            const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';
            return interaction.reply({ content: `💰 **Wallet:** ${user ? user.wallet : 0} ${currency}\n🏦 **Bank:** ${user ? user.bank : 0} ${currency}`, flags: 64 });
        }

        if (customId === 'hub_daily') {
            const [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';
            const now = new Date();
            
            if (user.lastDaily && (now - new Date(user.lastDaily)) < 86400000) {
                const hoursLeft = Math.ceil((86400000 - (now - new Date(user.lastDaily))) / 3600000);
                return interaction.reply({ content: `⏳ You have already claimed your daily reward! Try again in **${hoursLeft} hours**.`, flags: 64 });
            }

            const min = config?.dailyMin ?? 50;
            const max = config?.dailyMax ?? 250;
            const rewardAmount = Math.floor(Math.random() * (max - min + 1)) + min;

            await user.update({ wallet: user.wallet + rewardAmount, lastDaily: now });
            return interaction.reply({ content: `🎁 Successfully claimed **${rewardAmount} ${currency}** for your daily reward!`, flags: 64 });
        }

        if (customId === 'hub_buddydays') {
            const [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';
            const now = new Date();
            
            let streak = user.buddyDaysStreak || 0;
            let missedDay = false;

            if (user.lastBuddyDaysClaim) {
                const msSinceLast = now.getTime() - new Date(user.lastBuddyDaysClaim).getTime();
                const hoursSinceLast = msSinceLast / (1000 * 60 * 60);

                if (hoursSinceLast < 24) {
                    const hoursLeft = Math.ceil(24 - hoursSinceLast);
                    return interaction.reply({ content: `⏳ You already claimed your Buddy Day today! Come back in **${hoursLeft} hours** to continue your streak!`, flags: 64 });
                } else if (hoursSinceLast > 48) {
                    streak = 1;
                    missedDay = true;
                } else {
                    streak += 1;
                }
            } else {
                streak = 1;
            }

            if (streak > 30) streak = 1;

            let customRewards = {};
            try { customRewards = JSON.parse(config?.buddyDaysConfig || '{}'); } catch(e){}
            
            const dayReward = customRewards[streak.toString()] || { type: 'currency', amount: 50 };
            const rType = (dayReward.type || 'currency').toLowerCase();
            const rAmount = parseInt(dayReward.amount) || 1;
            const targetItem = dayReward.itemOrKit || '';

            let rewardDescription = '';

            if (rType === 'xp') {
                const newXp = (user.xp || 0) + rAmount;
                const newLevel = Math.floor(newXp / 100) + 1;
                await user.update({ xp: newXp, level: newLevel, buddyDaysStreak: streak, lastBuddyDaysClaim: now });
                rewardDescription = `⭐ **+${rAmount} BuddyPass XP** (Now Level ${newLevel})!`;
            } else if (rType === 'kit') {
                if (!user.inGameName) {
                    return interaction.reply({ content: `❌ You must link your Rust account first using the Player Hub to receive in-game kit rewards!`, flags: 64 });
                }
                try {
                    await sendRconCommand(interaction.guild.id, `kit givetoplayer "${targetItem}" "${user.inGameName}"`);
                    await user.update({ buddyDaysStreak: streak, lastBuddyDaysClaim: now });
                    rewardDescription = `📦 Kit **${targetItem}** sent directly to your in-game player (**${user.inGameName}**)!`;
                } catch(err) {
                    return interaction.reply({ content: `❌ RCON Error sending kit: \`${err.message}\`. Make sure the server is online.`, flags: 64 });
                }
            } else if (rType === 'item' || rType === 'resource') {
                if (!user.inGameName) {
                    return interaction.reply({ content: `❌ You must link your Rust account first using the Player Hub to receive in-game resource rewards!`, flags: 64 });
                }
                try {
                    await sendRconCommand(interaction.guild.id, `inventory.giveto "${user.inGameName}" ${targetItem} ${rAmount}`);
                    await user.update({ buddyDaysStreak: streak, lastBuddyDaysClaim: now });
                    rewardDescription = `🪵 **${rAmount}x ${targetItem}** sent directly to your inventory in-game (**${user.inGameName}**)!`;
                } catch(err) {
                    return interaction.reply({ content: `❌ RCON Error sending items: \`${err.message}\`. Make sure the server is online.`, flags: 64 });
                }
            } else {
                await user.update({ wallet: user.wallet + rAmount, buddyDaysStreak: streak, lastBuddyDaysClaim: now });
                rewardDescription = `💰 **+${rAmount} ${currency}** added to your wallet!`;
            }

            if (missedDay) {
                return interaction.reply({ content: `💔 You missed a day and your streak reset to **Day 1**!\n🎁 Reward: ${rewardDescription}\nClaim again in 24 hours to hit Day 2!`, flags: 64 });
            } else {
                return interaction.reply({ content: `🗓️ **Buddy Days Loyalty: Day ${streak} / 30 Reached!**\n🎉 Reward: ${rewardDescription}\nCome back tomorrow to keep the streak going!`, flags: 64 });
            }
        }

        if (customId === 'hub_deposit') {
            const modal = new ModalBuilder().setCustomId('modal_hub_deposit').setTitle('Deposit Currency to Bank');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Amount to Deposit (or 'all')").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }

        if (customId === 'hub_withdraw') {
            const modal = new ModalBuilder().setCustomId('modal_hub_withdraw').setTitle('Withdraw Currency to Wallet');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Amount to Withdraw (or 'all')").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
    }

    // ==========================================
    // 3. SELECT MENUS
    // ==========================================
    if (interaction.isUserSelectMenu()) {
        if (customId === 'select_admin_give_target') {
            const targetUserId = interaction.values[0];
            const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: targetUserId } });
            const displayName = targetUser?.inGameName || `<@${targetUserId}>`;
            const modal = new ModalBuilder().setCustomId(`modal_admin_give_exec_${targetUserId}`).setTitle(`Give Currency to ${displayName}`);
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Amount to GIVE").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (customId === 'select_admin_take_target') {
            const targetUserId = interaction.values[0];
            const targetUser = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: targetUserId } });
            const displayName = targetUser?.inGameName || `<@${targetUserId}>`;
            const modal = new ModalBuilder().setCustomId(`modal_admin_take_exec_${targetUserId}`).setTitle(`Take Currency from ${displayName}`);
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Amount to TAKE").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
    }

    // 👇 FIXED: PROPERLY GRAB THE VALUE FROM interaction.values[0] 👇
    if (interaction.isStringSelectMenu()) {
        if (customId === 'select_buddydays_type') {
            const selectedVal = interaction.values[0]; // e.g., 'type_currency'
            const type = selectedVal.replace('type_', ''); // becomes 'currency', 'xp', 'item', or 'kit'
            
            let title = '';
            let showItemField = false;

            if (type === 'currency') title = '💰 Configure Currency Reward';
            if (type === 'xp') title = '⭐ Configure XP Reward';
            if (type === 'item') { title = '🪵 Configure Item Reward'; showItemField = true; }
            if (type === 'kit') { title = '📦 Configure Kit Reward'; showItemField = true; }

            const modal = new ModalBuilder().setCustomId(`modal_econ_bd_${type}`).setTitle(title);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('day_number').setLabel("Day Number (1 to 30)").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reward_amount').setLabel(type === 'kit' ? "Amount (Usually 1)" : "Amount / Quantity").setStyle(TextInputStyle.Short).setRequired(true))
            );

            if (showItemField) {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target_item_name').setLabel(type === 'kit' ? "Exact Kit Name (e.g. VIPKit)" : "Item Shortname (e.g. wood)").setStyle(TextInputStyle.Short).setRequired(true))
                );
            }
            
            return await interaction.showModal(modal);
        }
    }
    

    // ==========================================
    // 4. MODAL SUBMISSIONS
    // ==========================================
    if (interaction.isModalSubmit()) {
        if (customId === 'modal_setup_economy') {
            const newName = interaction.fields.getTextInputValue('currency_name').trim();
            await GuildConfig.upsert({ guildId: interaction.guild.id, economyCurrency: newName });
            return interaction.reply({ content: `✅ Currency name successfully updated to **${newName}**!`, flags: 64 });
        }

        if (customId === 'modal_econ_daily') {
            let min = parseInt(interaction.fields.getTextInputValue('daily_min')) || 50;
            let max = parseInt(interaction.fields.getTextInputValue('daily_max')) || 250;
            if (min > max) { let temp = min; min = max; max = temp; }
            await GuildConfig.upsert({ guildId: interaction.guild.id, dailyMin: min, dailyMax: max });
            return interaction.reply({ content: `✅ Daily Reward updated! Players will now get a randomized amount between **${min}** and **${max}** currency!`, flags: 64 });
        }

        // 👇 NEW: CATCHES ALL 4 BUDDY DAYS MODALS
        if (customId.startsWith('modal_econ_bd_')) {
            const type = customId.replace('modal_econ_bd_', '');
            const dayNum = parseInt(interaction.fields.getTextInputValue('day_number'));
            const amount = parseInt(interaction.fields.getTextInputValue('reward_amount')) || 1;
            
            let itemOrKit = '';
            if (type === 'item' || type === 'kit') {
                itemOrKit = interaction.fields.getTextInputValue('target_item_name').trim();
                if (!itemOrKit) return interaction.reply({ content: `❌ You must specify an Item Shortname or Kit Name!`, flags: 64 });
            }

            if (isNaN(dayNum) || dayNum < 1 || dayNum > 30) return interaction.reply({ content: `❌ Invalid Day! Please enter a day between 1 and 30.`, flags: 64 });

            const [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            let currentConfig = {};
            try { currentConfig = JSON.parse(config.buddyDaysConfig || '{}'); } catch(e){}

            currentConfig[dayNum.toString()] = { type, amount, itemOrKit };
            await config.update({ buddyDaysConfig: JSON.stringify(currentConfig) });
            
            const itemLabel = itemOrKit ? ` (${itemOrKit})` : '';
            return interaction.reply({ content: `✅ **Buddy Day ${dayNum} Configured!**\n• Type: \`${type.toUpperCase()}\`\n• Amount / Target: \`${amount}\`${itemLabel}`, flags: 64 });
        }

        if (customId === 'modal_econ_scientist_reward') {
            const amount = parseInt(interaction.fields.getTextInputValue('scientist_reward_amount'));
            const finalAmount = isNaN(amount) || amount < 0 ? 0 : amount;
            
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            await config.update({ scientistKillReward: finalAmount });
            
            return interaction.reply({ content: `✅ Scientist Kill Reward updated to **${finalAmount}** currency!`, flags: 64 });
        }

        if (customId === 'modal_econ_player_reward') {
            const amount = parseInt(interaction.fields.getTextInputValue('player_reward_amount'));
            const finalAmount = isNaN(amount) || amount < 0 ? 0 : amount;
            
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            await config.update({ playerKillReward: finalAmount });
            
            return interaction.reply({ content: `✅ Player Kill Reward updated to **${finalAmount}** currency!`, flags: 64 });
        }

        if (customId === 'modal_econ_interest') {
            const rate = parseFloat(interaction.fields.getTextInputValue('interest_rate'));
            const hours = parseInt(interaction.fields.getTextInputValue('interest_hours')) || 24;
            await GuildConfig.upsert({ guildId: interaction.guild.id, bankInterestRate: rate, bankInterestHours: hours, lastBankInterest: new Date() });
            return interaction.reply({ content: `✅ Bank Interest configured! Players will earn **${rate}%** interest every **${hours} hours**.`, flags: 64 });
        }

        if (customId.startsWith('modal_admin_give_exec_')) {
            const targetUserId = customId.replace('modal_admin_give_exec_', '');
            const amount = parseInt(interaction.fields.getTextInputValue('amount'));
            if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Please enter a valid amount.', flags: 64 });

            let [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: targetUserId }, defaults: { wallet: 0 } });
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';

            await user.update({ wallet: user.wallet + amount });
            const nameLabel = user.inGameName ? `${user.inGameName} (<@${targetUserId}>)` : `<@${targetUserId}>`;
            return interaction.reply({ content: `✅ Successfully gave **${amount} ${currency}** to **${nameLabel}**!`, flags: 64 });
        }

        if (customId.startsWith('modal_admin_take_exec_')) {
            const targetUserId = customId.replace('modal_admin_take_exec_', '');
            const amount = parseInt(interaction.fields.getTextInputValue('amount'));
            if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Please enter a valid amount.', flags: 64 });

            let [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: targetUserId }, defaults: { wallet: 0 } });
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';

            const newWallet = Math.max(0, user.wallet - amount);
            await user.update({ wallet: newWallet });
            const nameLabel = user.inGameName ? `${user.inGameName} (<@${targetUserId}>)` : `<@${targetUserId}>`;
            return interaction.reply({ content: `✅ Successfully took **${amount} ${currency}** from **${nameLabel}**!`, flags: 64 });
        }

        if (customId === 'modal_hub_deposit') {
            const input = interaction.fields.getTextInputValue('amount').trim().toLowerCase();
            const [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id }, defaults: { wallet: 0, bank: 0 } });
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';

            let amount = input === 'all' ? user.wallet : parseInt(input);
            if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Invalid number.', flags: 64 });
            if (user.wallet < amount) return interaction.reply({ content: `❌ You only have **${user.wallet} ${currency}** in your wallet!`, flags: 64 });

            await user.update({ wallet: user.wallet - amount, bank: user.bank + amount });
            return interaction.reply({ content: `🏦 Successfully deposited **${amount} ${currency}** into your bank!`, flags: 64 });
        }

        if (customId === 'modal_hub_withdraw') {
            const input = interaction.fields.getTextInputValue('amount').trim().toLowerCase();
            const [user] = await UserEconomy.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id }, defaults: { wallet: 0, bank: 0 } });
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';

            let amount = input === 'all' ? user.bank : parseInt(input);
            if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Invalid number.', flags: 64 });
            if (user.bank < amount) return interaction.reply({ content: `❌ You only have **${user.bank} ${currency}** in your bank!`, flags: 64 });

            await user.update({ bank: user.bank - amount, wallet: user.wallet + amount });
            return interaction.reply({ content: `🏧 Successfully withdrew **${amount} ${currency}** to your wallet!`, flags: 64 });
        }
    }
};