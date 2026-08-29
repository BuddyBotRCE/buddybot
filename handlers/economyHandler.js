const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
const { GuildConfig, UserEconomy } = require('../database/db');
const adminHandler = require('./adminHandler');

module.exports = async (interaction, client) => {
    const customId = interaction.customId;
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

        const embed = new EmbedBuilder()
            .setTitle('💰 Economy Manager')
            .setDescription(`Manage currency names, interest rates, kill rewards, and individual player balances.\n\n` +
                `• **Current Currency Name:** \`${currencyName}\`\n` +
                `• **Bank Interest Rate:** \`${config?.bankInterestRate || 0}%\` every \`${config?.bankInterestHours || 24}\` hours\n` +
                `• **Scientist Kill Reward:** \`${config?.scientistKillReward ?? 10}\` ${currencyName}\n` +
                `• **Player Kill Reward:** \`${config?.playerKillReward ?? 50}\` ${currencyName}`)
            .setColor('#f1c40f');
            
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_econ_name').setLabel('Set Currency Name').setStyle(ButtonStyle.Secondary).setEmoji('🏷️'),
            new ButtonBuilder().setCustomId('btn_econ_interest').setLabel('Set Bank Interest').setStyle(ButtonStyle.Primary).setEmoji('📈'),
            new ButtonBuilder().setCustomId('btn_admin_give').setLabel('Give Currency').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('btn_admin_take').setLabel('Take Currency').setStyle(ButtonStyle.Danger).setEmoji('➖')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_econ_scientist_reward').setLabel('Scientist Reward').setStyle(ButtonStyle.Primary).setEmoji('🧪'),
            new ButtonBuilder().setCustomId('btn_econ_player_reward').setLabel('Player Kill Reward').setStyle(ButtonStyle.Danger).setEmoji('⚔️')
        );

        const row3 = new ActionRowBuilder().addComponents(
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

        if (customId === 'btn_econ_scientist_reward') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_econ_scientist_reward').setTitle('Scientist Kill Reward');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('reward_amount').setLabel("Reward per Scientist Kill").setStyle(TextInputStyle.Short).setValue(`${config?.scientistKillReward ?? 10}`).setRequired(true)
            ));
            return interaction.showModal(modal);
        }

        if (customId === 'btn_econ_player_reward') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_econ_player_reward').setTitle('Player Kill Reward');
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('reward_amount').setLabel("Reward per Player Kill").setStyle(TextInputStyle.Short).setValue(`${config?.playerKillReward ?? 50}`).setRequired(true)
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
            const currency = config?.economyCurrency || 'Scrap';

            const embed = new EmbedBuilder()
                .setTitle('🏦 Economy & Bank Hub')
                .setDescription(`Manage your wallet, check your bank balance, claim your 24-hour daily reward, or deposit and withdraw ${currency}.`)
                .setColor('#2ecc71');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('hub_balance').setLabel('Balance').setStyle(ButtonStyle.Secondary).setEmoji('💰'),
                new ButtonBuilder().setCustomId('hub_daily').setLabel('Daily').setStyle(ButtonStyle.Success).setEmoji('🎁'),
                new ButtonBuilder().setCustomId('hub_deposit').setLabel('Deposit').setStyle(ButtonStyle.Primary).setEmoji('📥'),
                new ButtonBuilder().setCustomId('hub_withdraw').setLabel('Withdraw').setStyle(ButtonStyle.Secondary).setEmoji('📤')
            );
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
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
            if (user.lastDaily && (now - new Date(user.lastDaily)) < 86400000) return interaction.reply({ content: `⏳ You have already claimed your daily reward today! Try again later.`, flags: 64 });
            await user.update({ wallet: user.wallet + 100, lastDaily: now });
            return interaction.reply({ content: `🎁 Successfully claimed **100 ${currency}** for your daily reward!`, flags: 64 });
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
    // 3. USER SELECT MENUS
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

    // ==========================================
    // 4. MODAL SUBMISSIONS
    // ==========================================
    if (interaction.isModalSubmit()) {
        if (customId === 'modal_setup_economy') {
            const newName = interaction.fields.getTextInputValue('currency_name').trim();
            await GuildConfig.upsert({ guildId: interaction.guild.id, economyCurrency: newName });
            return interaction.reply({ content: `✅ Currency name successfully updated to **${newName}**!`, flags: 64 });
        }

        if (customId === 'modal_econ_scientist_reward') {
            const amount = parseInt(interaction.fields.getTextInputValue('reward_amount'));
            const finalAmount = isNaN(amount) || amount < 0 ? 0 : amount;
            await GuildConfig.upsert({ guildId: interaction.guild.id, scientistKillReward: finalAmount });
            return interaction.reply({ content: `✅ Scientist Kill Reward updated to **${finalAmount}** currency!`, flags: 64 });
        }

        if (customId === 'modal_econ_player_reward') {
            const amount = parseInt(interaction.fields.getTextInputValue('reward_amount'));
            const finalAmount = isNaN(amount) || amount < 0 ? 0 : amount;
            await GuildConfig.upsert({ guildId: interaction.guild.id, playerKillReward: finalAmount });
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