const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, UserEconomy, CasinoCooldown } = require('../database/db');
const adminHandler = require('./adminHandler');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (customId === 'admin_menu_back') {
        if (adminHandler && adminHandler.renderMainPanel) {
            return await adminHandler.renderMainPanel(interaction);
        }
        return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
    }

    // 👇 ADMIN PANEL SETUP ROUTE 👇
    if (customId === 'admin_menu_select' && selectedValue === 'setup_minigames') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config?.economyCurrency || 'Scrap';

        const embed = new EmbedBuilder()
            .setTitle('🎰 Casino & Minigames Manager')
            .setDescription(`Configure casino settings, maximum bets, and game cooldowns.\n\n• **Max Bet Limit:** ${config?.casinoMaxBet || 1000} ${currency}\n• **Game Cooldown:** ${config?.casinoCooldownSeconds || 5} seconds`)
            .setColor('#9b59b6');

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_casino_settings').setLabel('Configure Limits').setStyle(ButtonStyle.Primary).setEmoji('⚙️')
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );

        return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }

    // --- BUTTON CLICKS ---
    if (interaction.isButton()) {
        if (customId === 'btn_casino_settings') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const modal = new ModalBuilder().setCustomId('modal_casino_config').setTitle('Configure Casino Limits');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('max_bet').setLabel("Max Bet Amount (e.g. 1000)").setStyle(TextInputStyle.Short).setValue(`${config?.casinoMaxBet || 1000}`).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cooldown_sec').setLabel("Cooldown in Seconds (e.g. 5)").setStyle(TextInputStyle.Short).setValue(`${config?.casinoCooldownSeconds || 5}`).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        if (customId === 'hub_casino') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const isPremium = config?.isPremiumServer || false;

            // Free Tier (5 Games)
            let games = [
                { label: 'Coinflip', val: 'coinflip', emoji: '🪙' },
                { label: 'Slots', val: 'slots', emoji: '🎰' },
                { label: 'Dice Roll', val: 'dice', emoji: '🎲' },
                { label: 'Scratchcard', val: 'scratchcard', emoji: '🎟️' },
                { label: 'Rock Paper Scissors', val: 'rps', emoji: '✂️' }
            ];

            // Premium Tier (20 Games)
            if (isPremium) {
                games.push(
                    { label: 'Roulette', val: 'roulette', emoji: '🎡' }, { label: 'Blackjack', val: 'blackjack', emoji: '🃏' },
                    { label: 'Higher / Lower', val: 'hilow', emoji: '🔼' }, { label: 'Poker Hands', val: 'poker', emoji: '♠️' },
                    { label: 'Wheel of Fortune', val: 'wheel', emoji: '☸️' }, { label: 'Crash multiplier', val: 'crash', emoji: '📈' },
                    { label: 'Baccarat', val: 'baccarat', emoji: '🎴' }, { label: 'Red or Black', val: 'redblack', emoji: '🔴' },
                    { label: 'Three Card Brag', val: 'brag', emoji: '🎴' }, { label: 'Keno', val: 'keno', emoji: '🎯' },
                    { label: 'Lucky Numbers', val: 'luckynum', emoji: '🔢' }, { label: 'Craps', val: 'craps', emoji: '🎲' },
                    { label: 'Sic Bo', val: 'sicbo', emoji: '🏮' }, { label: 'Video Poker', val: 'videopoker', emoji: '💻' },
                    { label: 'Pai Gow', val: 'paigow', emoji: '🀄' }, { label: 'Rai Raid Gamble', val: 'raidgamble', emoji: '💣' },
                    { label: 'Scrap Scavenger', val: 'scavenger', emoji: '⚙️' }, { label: 'Horse Racing', val: 'horseracing', emoji: '🐎' },
                    { label: 'Mines', val: 'mines', emoji: '💣' }, { label: 'Plinko', val: 'plinko', emoji: '🔴' }
                );
            }

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('casino_game_select')
                    .setPlaceholder(isPremium ? 'Select a Minigame (All 25 Unlocked)...' : 'Select a Minigame (Free Tier: 5 Games)...')
                    .addOptions(games.map(g => ({ label: g.label, value: g.val, emoji: g.emoji })))
            );

            const footerText = isPremium ? '⭐ **Premium Tier Active:** All 25 minigames are unlocked!' : '💡 **Free Tier:** Upgrade to Premium in the Admin Panel to unlock all 25 minigames!';
            return interaction.reply({ content: `🎰 **Server Casino Hub:**\n${footerText}`, components: [row], flags: 64 });
        }
    }

    // 👇 CATCHES THE DROPDOWN AND OPENS THE BETTING MODAL 👇
    if (interaction.isStringSelectMenu() && customId === 'casino_game_select') {
        const gameType = interaction.values[0];
        
        const modal = new ModalBuilder()
            .setCustomId(`modal_play_${gameType}`)
            .setTitle(`Place Your Bet`);

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('bet')
                    .setLabel('Bet Amount')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g. 100')
                    .setRequired(true)
            )
        );
        
        return interaction.showModal(modal);
    }

    // --- MODAL SUBMISSIONS ---
    if (interaction.isModalSubmit()) {
        if (customId === 'modal_casino_config') {
            const maxBet = parseInt(interaction.fields.getTextInputValue('max_bet')) || 1000;
            const cooldown = parseInt(interaction.fields.getTextInputValue('cooldown_sec')) || 5;

            await GuildConfig.upsert({ guildId: interaction.guild.id, casinoMaxBet: maxBet, casinoCooldownSeconds: cooldown });
            return interaction.reply({ content: `✅ Casino limits updated! Max Bet: **${maxBet} Scrap** | Cooldown: **${cooldown} seconds**`, flags: 64 });
        }

        if (customId.startsWith('modal_play_')) {
            const gameType = customId.replace('modal_play_', '');
            const bet = parseInt(interaction.fields.getTextInputValue('bet'));
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';
            const maxBet = config?.casinoMaxBet || 1000;

            if (isNaN(bet) || bet <= 0) return interaction.reply({ content: '❌ Please enter a valid bet amount.', flags: 64 });
            if (bet > maxBet) return interaction.reply({ content: `❌ Bet exceeds the server max bet limit of **${maxBet} ${currency}**!`, flags: 64 });

            const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            if (!user || user.wallet < bet) return interaction.reply({ content: '❌ You do not have enough funds in your wallet!', flags: 64 });

            const now = new Date();
            const [cd] = await CasinoCooldown.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id }, defaults: { expiresAt: now } });
            if (new Date(cd.expiresAt) > now) {
                const secondsLeft = Math.ceil((new Date(cd.expiresAt) - now) / 1000);
                return interaction.reply({ content: `⏳ Please wait **${secondsLeft}s** before playing again!`, flags: 64 });
            }

            const cooldownSec = config?.casinoCooldownSeconds || 5;
            await cd.update({ expiresAt: new Date(now.getTime() + cooldownSec * 1000) });

            let resultMsg = '';
            let payout = 0;

            switch (gameType) {
                case 'coinflip':
                    const winCF = Math.random() < 0.5;
                    payout = winCF ? bet * 2 : 0;
                    resultMsg = winCF ? `🪙 **COINFLIP WON!** You won **+${bet} ${currency}**!` : `🪙 **COINFLIP LOST!** You lost **-${bet} ${currency}**.`;
                    break;
                case 'slots':
                    const icons = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
                    const r1 = icons[Math.floor(Math.random() * icons.length)]; const r2 = icons[Math.floor(Math.random() * icons.length)]; const r3 = icons[Math.floor(Math.random() * icons.length)];
                    if (r1 === r2 && r2 === r3) { payout = bet * 5; resultMsg = `🎰 | ${r1}|${r2}|${r3} | **JACKPOT!** Won **+${bet * 4} ${currency}**!`; }
                    else if (r1 === r2 || r2 === r3 || r1 === r3) { payout = Math.round(bet * 1.5); resultMsg = `🎰 | ${r1}|${r2}|${r3} | **Partial Match!** Won **+${Math.round(bet * 0.5)} ${currency}**!`; }
                    else { payout = 0; resultMsg = `🎰 | ${r1}|${r2}|${r3} | **Loss!** Lost **-${bet} ${currency}**.`; }
                    break;
                case 'dice':
                    const roll = Math.floor(Math.random() * 6) + 1;
                    const winDice = roll > 3;
                    payout = winDice ? Math.round(bet * 1.8) : 0;
                    resultMsg = winDice ? `🎲 Rolled **${roll}** (High)! Won **+${payout - bet} ${currency}**!` : `🎲 Rolled **${roll}** (Low). Lost **-${bet} ${currency}**.`;
                    break;
                default:
                    // Generic fallback for Scratchcard, RPS, and all 20 premium games!
                    const genericWin = Math.random() < 0.45;
                    payout = genericWin ? Math.round(bet * 2) : 0;
                    
                    // Format the gameType string to look nice (e.g. 'rockpaperscissors' -> 'ROCKPAPERSCISSORS')
                    const displayName = gameType.toUpperCase();
                    resultMsg = genericWin ? `🎮 **${displayName} WON!** You won **+${bet} ${currency}**!` : `🎮 **${displayName} LOST!** You lost **-${bet} ${currency}**.`;
                    break;
            }

            await user.update({ wallet: (user.wallet - bet) + payout });
            return interaction.reply({ content: resultMsg, flags: 64 });
        }
    }
};