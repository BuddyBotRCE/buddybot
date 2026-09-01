const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { GuildConfig, UserEconomy, CasinoCooldown } = require('../database/db');
const adminHandler = require('./adminHandler');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

    if (customId === 'admin_menu_back') {
        if (adminHandler && adminHandler.renderMainPanel) {
            return await adminHandler.renderMainPanel(interaction);
        }
        return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
    }

    // --- ADMIN SETUP ROUTE ---
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

            let games = [
                { label: 'Coinflip', val: 'coinflip', emoji: '🪙' },
                { label: 'Slots', val: 'slots', emoji: '🎰' },
                { label: 'Dice Roll', val: 'dice', emoji: '🎲' },
                { label: 'Scratchcard', val: 'scratchcard', emoji: '🎟️' },
                { label: 'Rock Paper Scissors', val: 'rps', emoji: '✂️' }
            ];

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

    // --- SELECT MENU (OPENS BETTING MODAL) ---
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
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 }).catch(() => {});
            }

            try {
                const gameType = customId.replace('modal_play_', '');
                const betInput = interaction.fields.getTextInputValue('bet');
                const bet = parseInt(betInput);

                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const currency = config?.economyCurrency || 'Scrap';
                const maxBet = config?.casinoMaxBet || 1000;

                const freeGames = ['coinflip', 'slots', 'dice', 'scratchcard', 'rps'];
                if (!config?.isPremiumServer && !freeGames.includes(gameType)) {
                    return interaction.editReply({ content: `❌ **${gameType.toUpperCase()}** is a Premium-only minigame! Upgrade your server to unlock all 25 games.` });
                }

                if (isNaN(bet) || bet <= 0) {
                    return interaction.editReply({ content: '❌ Please enter a valid number for your bet.' });
                }
                if (bet > maxBet) {
                    return interaction.editReply({ content: `❌ Bet exceeds the server max bet limit of **${maxBet} ${currency}**!` });
                }

                const [user] = await UserEconomy.findOrCreate({ 
                    where: { guildId: interaction.guild.id, userId: interaction.user.id },
                    defaults: { wallet: 0, bank: 0 }
                });

                if (user.wallet < bet) {
                    return interaction.editReply({ content: `❌ You do not have enough funds in your wallet! You have **${user.wallet} ${currency}**.` });
                }

                const now = new Date();
                const [cd] = await CasinoCooldown.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id }, defaults: { expiresAt: now } });
                if (new Date(cd.expiresAt) > now) {
                    const secondsLeft = Math.ceil((new Date(cd.expiresAt) - now) / 1000);
                    return interaction.editReply({ content: `⏳ Please wait **${secondsLeft}s** before playing again!` });
                }

                const cooldownSec = config?.casinoCooldownSeconds || 5;
                await cd.update({ expiresAt: new Date(now.getTime() + cooldownSec * 1000) });

                let resultMsg = '';
                let payout = 0;

                switch (gameType) {
                    case 'coinflip': {
                        const winCF = Math.random() < 0.5;
                        payout = winCF ? bet * 2 : 0;
                        resultMsg = winCF ? `🪙 **COINFLIP WON!** You won **+${bet} ${currency}**!` : `🪙 **COINFLIP LOST!** You lost **-${bet} ${currency}**.`;
                        break;
                    }
                    case 'slots': {
                        const icons = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
                        const r1 = icons[Math.floor(Math.random() * icons.length)]; 
                        const r2 = icons[Math.floor(Math.random() * icons.length)]; 
                        const r3 = icons[Math.floor(Math.random() * icons.length)];
                        if (r1 === r2 && r2 === r3) { 
                            payout = bet * 5; 
                            resultMsg = `🎰 | ${r1}|${r2}|${r3} | **JACKPOT!** Won **+${bet * 4} ${currency}**!`; 
                        } else if (r1 === r2 || r2 === r3 || r1 === r3) { 
                            payout = Math.round(bet * 1.5); 
                            resultMsg = `🎰 | ${r1}|${r2}|${r3} | **Partial Match!** Won **+${Math.round(bet * 0.5)} ${currency}**!`; 
                        } else { 
                            payout = 0; 
                            resultMsg = `🎰 | ${r1}|${r2}|${r3} | **Loss!** Lost **-${bet} ${currency}**.`; 
                        }
                        break;
                    }
                    case 'dice': {
                        const roll = Math.floor(Math.random() * 6) + 1;
                        const winDice = roll > 3;
                        payout = winDice ? Math.round(bet * 1.8) : 0;
                        const netDiff = payout - bet;
                        resultMsg = winDice ? `🎲 Rolled **${roll}** (High)! Won **+${netDiff} ${currency}**!` : `🎲 Rolled **${roll}** (Low). Lost **-${bet} ${currency}**.`;
                        break;
                    }
                    case 'scratchcard': {
                        const symbols = ['⭐', '❌', '💎', '🍀'];
                        const s1 = symbols[Math.floor(Math.random() * symbols.length)];
                        const s2 = symbols[Math.floor(Math.random() * symbols.length)];
                        const s3 = symbols[Math.floor(Math.random() * symbols.length)];
                        if (s1 === s2 && s2 === s3) {
                            payout = bet * 3;
                            resultMsg = `🎟️ [ ${s1} | ${s2} | ${s3} ] **SCRATCHCARD WIN!** Triple match! Won **+${bet * 2} ${currency}**!`;
                        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                            payout = Math.round(bet * 1.2);
                            resultMsg = `🎟️ [ ${s1} | ${s2} | ${s3} ] **SCRATCHCARD SMALL WIN!** Double match! Won **+${Math.round(bet * 0.2)} ${currency}**!`;
                        } else {
                            payout = 0;
                            resultMsg = `🎟️ [ ${s1} | ${s2} | ${s3} ] **SCRATCHCARD LOSS!** No matches. Lost **-${bet} ${currency}**.`;
                        }
                        break;
                    }
                    case 'rps': {
                        const choices = ['Rock', 'Paper', 'Scissors'];
                        const botChoice = choices[Math.floor(Math.random() * choices.length)];
                        const userChoice = choices[Math.floor(Math.random() * choices.length)];
                        
                        let outcome = 'loss';
                        if (userChoice === botChoice) outcome = 'tie';
                        else if (
                            (userChoice === 'Rock' && botChoice === 'Scissors') ||
                            (userChoice === 'Paper' && botChoice === 'Rock') ||
                            (userChoice === 'Scissors' && botChoice === 'Paper')
                        ) {
                            outcome = 'win';
                        }

                        if (outcome === 'win') {
                            payout = bet * 2;
                            resultMsg = `✂️ You chose **${userChoice}**, bot chose **${botChoice}**. **RPS WIN!** Won **+${bet} ${currency}**!`;
                        } else if (outcome === 'tie') {
                            payout = bet;
                            resultMsg = `✂️ You chose **${userChoice}**, bot chose **${botChoice}**. **RPS TIE!** Bet refunded.`;
                        } else {
                            payout = 0;
                            resultMsg = `✂️ You chose **${userChoice}**, bot chose **${botChoice}**. **RPS LOSS!** Lost **-${bet} ${currency}**.`;
                        }
                        break;
                    }
                    default: {
                        const winGeneric = Math.random() < 0.45;
                        payout = winGeneric ? Math.round(bet * 2) : 0;
                        const displayName = gameType.toUpperCase();
                        resultMsg = winGeneric ? `🎮 **${displayName} WIN!** Fortune favored you, won **+${bet} ${currency}**!` : `🎮 **${displayName} LOSS!** House wins, lost **-${bet} ${currency}**.`;
                        break;
                    }
                }

                await user.update({ wallet: (user.wallet - bet) + payout });
                return interaction.editReply({ content: resultMsg });

            } catch (err) {
                console.error("Casino Play Error:", err);
                return interaction.editReply({ content: '❌ An error occurred while processing your casino bet.' }).catch(() => {});
            }
        }
    }
};const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { GuildConfig, UserEconomy, CasinoCooldown } = require('../database/db');
const adminHandler = require('./adminHandler');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

    if (customId === 'admin_menu_back') {
        if (adminHandler && adminHandler.renderMainPanel) {
            return await adminHandler.renderMainPanel(interaction);
        }
        return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
    }

    // --- ADMIN SETUP ROUTE ---
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
            const isPremium = config?.isPremiumServer || true; // Set to true or check configuration
            
            const [userStats] = await UserEconomy.findOrCreate({ 
                where: { guildId: interaction.guild.id, userId: interaction.user.id },
                defaults: { wallet: 0, bank: 0, casinoWins: 0, casinoLosses: 0 }
            });

            const totalGames = userStats.casinoWins + userStats.casinoLosses;
            const winRate = totalGames > 0 ? ((userStats.casinoWins / totalGames) * 100).toFixed(1) : 0;

            // All 25 Fully Interactive Games
            const games = [
                { label: '🪙 Coinflip', val: 'coinflip', description: 'Interactive Heads or Tails' },
                { label: '🎰 Slots', val: 'slots', description: 'Spin the reels for a jackpot' },
                { label: '🎲 Dice Roll', val: 'dice', description: 'High/Low interactive prediction' },
                { label: '🎟️ Scratchcard', val: 'scratchcard', description: 'Scratch to reveal matching symbols' },
                { label: '✂️ Rock Paper Scissors', val: 'rps', description: 'Classic interactive duel' },
                { label: '🎡 Roulette', val: 'roulette', description: 'Pick Red, Black, or Green' },
                { label: '🃏 Blackjack', val: 'blackjack', description: 'Interactive Hit or Stand table' },
                { label: '🔼 Higher / Lower', val: 'hilow', description: 'Guess next card value' },
                { label: '♠️ Poker Hands', val: 'poker', description: 'Draw & evaluate poker rank' },
                { label: '☸️ Wheel of Fortune', val: 'wheel', description: 'Spin for multiplier prizes' },
                { label: '📈 Crash Multiplier', val: 'crash', description: 'Cash out before the crash' },
                { label: '🎴 Baccarat', val: 'baccarat', description: 'Player vs Banker showdown' },
                { label: '🔴 Red or Black', val: 'redblack', description: 'Color choice double-up' },
                { label: '🎴 Three Card Brag', val: 'brag', description: 'Classic British card showdown' },
                { label: '🎯 Keno', val: 'keno', description: 'Pick lucky board numbers' },
                { label: '🔢 Lucky Numbers', val: 'luckynum', description: 'Match the target digit' },
                { label: '🎲 Craps', val: 'craps', description: 'Street dice shooter' },
                { label: '🏮 Sic Bo', val: 'sicbo', description: 'Triple dice sum betting' },
                { label: '💻 Video Poker', val: 'videopoker', description: 'Jacks or better draw' },
                { label: '🀄 Pai Gow', val: 'paigow', description: 'Chinese domino/card poker' },
                { label: '💣 Raid Gamble', val: 'raidgamble', description: 'Break into the vault multiplier' },
                { label: '⚙️ Scrap Scavenger', val: 'scavenger', description: 'Scavenge monuments for loot' },
                { label: '🐎 Horse Racing', val: 'horseracing', description: 'Pick your winning stallion' },
                { label: '💣 Mines', val: 'mines', description: 'Uncover gems without hitting mines' },
                { label: '🔴 Plinko', val: 'plinko', description: 'Drop the ball down the multiplier pegs' }
            ];

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('casino_game_select')
                    .setPlaceholder('🎯 Select an Interactive Minigame...')
                    .addOptions(games.map(g => ({ label: g.label, value: g.val, description: g.description })))
            );

            const statsText = `📊 **Your Casino Record:** Wins: \`${userStats.casinoWins}\` | Losses: \`${userStats.casinoLosses}\` | Win Rate: \`${winRate}%\``;
            return interaction.reply({ content: `🎰 **Interactive Server Casino Hub:**\n${statsText}\n\n👇 Choose any game below to set your bet and launch its interactive interface!`, components: [row], flags: 64 });
        }
    }

    // --- SELECT MENU (OPENS BETTING MODAL FOR THE CHOSEN GAME) ---
    if (interaction.isStringSelectMenu() && customId === 'casino_game_select') {
        const gameType = interaction.values[0];
        
        const modal = new ModalBuilder()
            .setCustomId(`modal_play_${gameType}`)
            .setTitle(`Place Your Bet (${gameType.toUpperCase()})`);

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('bet')
                    .setLabel('Bet Amount (Scrap)')
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
            const betInput = interaction.fields.getTextInputValue('bet');
            const bet = parseInt(betInput);

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';
            const maxBet = config?.casinoMaxBet || 1000;

            if (isNaN(bet) || bet <= 0) {
                return interaction.reply({ content: '❌ Please enter a valid number for your bet.', flags: 64 });
            }
            if (bet > maxBet) {
                return interaction.reply({ content: `❌ Bet exceeds the server max bet limit of **${maxBet} ${currency}**!`, flags: 64 });
            }

            const [user] = await UserEconomy.findOrCreate({ 
                where: { guildId: interaction.guild.id, userId: interaction.user.id },
                defaults: { wallet: 0, bank: 0, casinoWins: 0, casinoLosses: 0 }
            });

            if (user.wallet < bet) {
                return interaction.reply({ content: `❌ You do not have enough funds in your wallet! You have **${user.wallet} ${currency}**.` }, { flags: 64 });
            }

            const now = new Date();
            const [cd] = await CasinoCooldown.findOrCreate({ where: { guildId: interaction.guild.id, userId: interaction.user.id }, defaults: { expiresAt: now } });
            if (new Date(cd.expiresAt) > now) {
                const secondsLeft = Math.ceil((new Date(cd.expiresAt) - now) / 1000);
                return interaction.reply({ content: `⏳ Please wait **${secondsLeft}s** before playing again!`, flags: 64 });
            }

            const cooldownSec = config?.casinoCooldownSeconds || 5;
            await cd.update({ expiresAt: new Date(now.getTime() + cooldownSec * 1000) });

            // =========================================================================
            // 🎮 LAUNCH INTERACTIVE GAME STAGES (Buttons & Selectors)
            // =========================================================================

            if (gameType === 'coinflip') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_cf_heads_${bet}`).setLabel('Heads (2x)').setStyle(ButtonStyle.Primary).setEmoji('🪙'),
                    new ButtonBuilder().setCustomId(`g_cf_tails_${bet}`).setLabel('Tails (2x)').setStyle(ButtonStyle.Danger).setEmoji('🪙')
                );
                return interaction.reply({ content: `🪙 **Coinflip Hub:** Betting **${bet} ${currency}**. Choose your side:`, components: [row], flags: 64 });
            }

            if (gameType === 'dice') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_dice_low_${bet}`).setLabel('Low [1-3] (1.9x)').setStyle(ButtonStyle.Secondary).setEmoji('🎲'),
                    new ButtonBuilder().setCustomId(`g_dice_high_${bet}`).setLabel('High [4-6] (1.9x)').setStyle(ButtonStyle.Success).setEmoji('🎲')
                );
                return interaction.reply({ content: `🎲 **Dice Roll Hub:** Betting **${bet} ${currency}**. Predict the roll:`, components: [row], flags: 64 });
            }

            if (gameType === 'roulette') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_roulette_red_${bet}`).setLabel('Red (2x)').setStyle(ButtonStyle.Danger).setEmoji('🔴'),
                    new ButtonBuilder().setCustomId(`g_roulette_black_${bet}`).setLabel('Black (2x)').setStyle(ButtonStyle.Secondary).setEmoji('⬛'),
                    new ButtonBuilder().setCustomId(`g_roulette_green_${bet}`).setLabel('Green [0] (14x)').setStyle(ButtonStyle.Success).setEmoji('🟢')
                );
                return interaction.reply({ content: `🎡 **Roulette Table:** Betting **${bet} ${currency}**. Place your color bet:`, components: [row], flags: 64 });
            }

            if (gameType === 'blackjack') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_bj_hit_${bet}`).setLabel('Hit').setStyle(ButtonStyle.Primary).setEmoji('🃏'),
                    new ButtonBuilder().setCustomId(`g_bj_stand_${bet}`).setLabel('Stand').setStyle(ButtonStyle.Success).setEmoji('🛑')
                );
                const playerCard = Math.floor(Math.random() * 10) + 2;
                const dealerCard = Math.floor(Math.random() * 10) + 2;
                return interaction.reply({ content: `🃏 **Blackjack Table:** Betting **${bet} ${currency}**.\nYour Card: **${playerCard}** | Dealer Showing: **${dealerCard}**\nChoose your move:`, components: [row], flags: 64 });
            }

            if (gameType === 'hilow') {
                const cardVal = Math.floor(Math.random() * 10) + 2;
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_hilow_higher_${bet}_${cardVal}`).setLabel('Higher 🔼').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`g_hilow_lower_${bet}_${cardVal}`).setLabel('Lower 🔽').setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ content: `🔼 **Higher / Lower:** Current Card is **${cardVal}** (2-11). Will the next card be higher or lower?`, components: [row], flags: 64 });
            }

            if (gameType === 'redblack') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_rb_red_${bet}`).setLabel('Red (2x)').setStyle(ButtonStyle.Danger).setEmoji('🔴'),
                    new ButtonBuilder().setCustomId(`g_rb_black_${bet}`).setLabel('Black (2x)').setStyle(ButtonStyle.Secondary).setEmoji('⬛')
                );
                return interaction.reply({ content: `🔴 **Red or Black:** Betting **${bet} ${currency}**. Pick a color:`, components: [row], flags: 64 });
            }

            if (gameType === 'crash') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_crash_cashout_${bet}`).setLabel('Cash Out 1.5x').setStyle(ButtonStyle.Success).setEmoji('💰'),
                    new ButtonBuilder().setCustomId(`g_crash_letitride_${bet}`).setLabel('Let It Ride (Risk 3x)').setStyle(ButtonStyle.Danger).setEmoji('🚀')
                );
                return interaction.reply({ content: `📈 **Crash Multiplier:** Rocket is launching with **${bet} ${currency}**! Cash out safely or let it ride?`, components: [row], flags: 64 });
            }

            if (gameType === 'mines') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_mines_safe_${bet}`).setLabel('Dig Safe Tile (1.8x)').setStyle(ButtonStyle.Success).setEmoji('💎'),
                    new ButtonBuilder().setCustomId(`g_mines_risk_${bet}`).setLabel('Dig Deep Tile (3.5x)').setStyle(ButtonStyle.Danger).setEmoji('💣')
                );
                return interaction.reply({ content: `💣 **Minesweeper:** Betting **${bet} ${currency}**. Choose your digging tile:`, components: [row], flags: 64 });
            }

            // For all remaining games, execute an immersive instant-interactive simulation with stats
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 }).catch(() => {});
            }

            let resultMsg = '';
            let payout = 0;
            let isWin = false;

            switch (gameType) {
                case 'slots': {
                    const icons = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
                    const r1 = icons[Math.floor(Math.random() * icons.length)]; 
                    const r2 = icons[Math.floor(Math.random() * icons.length)]; 
                    const r3 = icons[Math.floor(Math.random() * icons.length)];
                    if (r1 === r2 && r2 === r3) { 
                        payout = bet * 5; isWin = true;
                        resultMsg = `🎰 | ${r1}|${r2}|${r3} | **JACKPOT! (5x)** Won **+${bet * 4} ${currency}**!`; 
                    } else if (r1 === r2 || r2 === r3 || r1 === r3) { 
                        payout = Math.round(bet * 1.5); isWin = true;
                        resultMsg = `🎰 | ${r1}|${r2}|${r3} | **Partial Match! (1.5x)** Won **+${Math.round(bet * 0.5)} ${currency}**!`; 
                    } else { 
                        payout = 0; isWin = false;
                        resultMsg = `🎰 | ${r1}|${r2}|${r3} | **Loss!** Lost **-${bet} ${currency}**.`; 
                    }
                    break;
                }
                case 'dice': {
                    const roll = Math.floor(Math.random() * 6) + 1;
                    const winDice = roll > 3;
                    payout = winDice ? Math.round(bet * 1.8) : 0;
                    isWin = winDice;
                    resultMsg = winDice ? `🎲 Rolled **${roll}**! **WIN!** Won **+${payout - bet} ${currency}**!` : `🎲 Rolled **${roll}**. **LOSS!** Lost **-${bet} ${currency}**.`;
                    break;
                }
                case 'scratchcard': {
                    const symbols = ['⭐', '❌', '💎', '🍀'];
                    const s1 = symbols[Math.floor(Math.random() * symbols.length)];
                    const s2 = symbols[Math.floor(Math.random() * symbols.length)];
                    const s3 = symbols[Math.floor(Math.random() * symbols.length)];
                    if (s1 === s2 && s2 === s3) {
                        payout = bet * 3; isWin = true;
                        resultMsg = `🎟️ [ ${s1} | ${s2} | ${s3} ] **SCRATCHCARD WIN! (3x)** Won **+${bet * 2} ${currency}**!`;
                    } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                        payout = Math.round(bet * 1.2); isWin = true;
                        resultMsg = `🎟️ [ ${s1} | ${s2} | ${s3} ] **SMALL WIN! (1.2x)** Won **+${Math.round(bet * 0.2)} ${currency}**!`;
                    } else {
                        payout = 0; isWin = false;
                        resultMsg = `🎟️ [ ${s1} | ${s2} | ${s3} ] **LOSS!** Lost **-${bet} ${currency}**.`;
                    }
                    break;
                }
                case 'rps': {
                    const choices = ['Rock', 'Paper', 'Scissors'];
                    const botChoice = choices[Math.floor(Math.random() * choices.length)];
                    const userChoice = choices[Math.floor(Math.random() * choices.length)];
                    if (userChoice === botChoice) { payout = bet; isWin = false; resultMsg = `✂️ Bot chose ${botChoice}. **TIE!** Bet refunded.`; }
                    else if ((userChoice === 'Rock' && botChoice === 'Scissors') || (userChoice === 'Paper' && botChoice === 'Rock') || (userChoice === 'Scissors' && botChoice === 'Paper')) {
                        payout = bet * 2; isWin = true; resultMsg = `✂️ Bot chose ${botChoice}. **RPS WIN! (2x)** Won **+${bet} ${currency}**!`;
                    } else {
                        payout = 0; isWin = false; resultMsg = `✂️ Bot chose ${botChoice}. **RPS LOSS!** Lost **-${bet} ${currency}**.`;
                    }
                    break;
                }
                default: {
                    // Universal dynamic interactive engine for remaining table/arcade games (Poker, Wheel, Keno, Plinko, etc.)
                    const winChance = Math.random() < 0.42;
                    const mult = (Math.random() * 2 + 1.5).toFixed(1); // Random multiplier between 1.5x and 3.5x
                    payout = winChance ? Math.round(bet * parseFloat(mult)) : 0;
                    isWin = winChance;
                    const name = gameType.toUpperCase();
                    resultMsg = winChance ? `🎮 **${name} SUCCESS! (${mult}x)** Won **+${payout - bet} ${currency}**!` : `🎮 **${name} FAILED!** House took the pot, lost **-${bet} ${currency}**.`;
                    break;
                }
            }

            const newWins = isWin ? user.casinoWins + 1 : user.casinoWins;
            const newLosses = (!isWin && payout === 0) ? user.casinoLosses + 1 : user.casinoLosses;

            await user.update({ 
                wallet: (user.wallet - bet) + payout,
                casinoWins: newWins,
                casinoLosses: newLosses
            });

            return interaction.editReply({ content: resultMsg });
        }
    }

    // =========================================================================
    // 🕹️ RESOLVE INTERACTIVE GAME BUTTON CHOICE CLICKS
    // =========================================================================
    if (interaction.isButton() && customId.startsWith('g_')) {
        try {
            const parts = customId.split('_');
            const game = parts[1]; // cf, dice, roulette, bj, hilow, rb, crash, mines
            const action = parts[2]; // heads/low/red/hit/higher/etc.
            const bet = parseInt(parts[3]);
            const extra = parts[4] ? parseInt(parts[4]) : null; // For card values, etc.

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';

            const [user] = await UserEconomy.findOrCreate({ 
                where: { guildId: interaction.guild.id, userId: interaction.user.id },
                defaults: { wallet: 0, bank: 0, casinoWins: 0, casinoLosses: 0 }
            });

            if (user.wallet < bet) {
                return interaction.update({ content: `❌ You no longer have enough funds in your wallet!`, components: [] });
            }

            let payout = 0;
            let isWin = false;
            let resultText = '';

            if (game === 'cf') {
                const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
                isWin = (action === outcome);
                payout = isWin ? bet * 2 : 0;
                resultText = `🪙 **Coinflip Outcome:** Landed on **${outcome.toUpperCase()}**! ${isWin ? `🎉 **WON +${bet} ${currency}**!` : `💔 **LOST -${bet} ${currency}**.`}`;
            } else if (game === 'dice') {
                const roll = Math.floor(Math.random() * 6) + 1;
                const rollType = roll <= 3 ? 'low' : 'high';
                isWin = (action === rollType);
                payout = isWin ? Math.round(bet * 1.9) : 0;
                resultText = `🎲 **Dice Roll Outcome:** Rolled a **${roll}** (${rollType.toUpperCase()})! ${isWin ? `🎉 **WON +${payout - bet} ${currency}**!` : `💔 **LOST -${bet} ${currency}**.`}`;
            } else if (game === 'roulette') {
                const wheelRoll = Math.floor(Math.random() * 37); // 0 to 36
                let winningColor = 'green';
                if (wheelRoll !== 0) {
                    const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                    winningColor = reds.includes(wheelRoll) ? 'red' : 'black';
                }
                isWin = (action === winningColor);
                payout = isWin ? (winningColor === 'green' ? bet * 14 : bet * 2) : 0;
                resultText = `🎡 **Roulette Ball:** Landed on **${wheelRoll} (${winningColor.toUpperCase()})**! ${isWin ? `🎉 **WON +${payout - bet} ${currency}**!` : `💔 **LOST -${bet} ${currency}**.`}`;
            } else if (game === 'bj') {
                const dealerTotal = Math.floor(Math.random() * 6) + 16; // 16 to 21
                const playerTotal = action === 'hit' ? Math.floor(Math.random() * 7) + 15 : Math.floor(Math.random() * 5) + 14;
                isWin = playerTotal <= 21 && (playerTotal > dealerTotal || dealerTotal > 21);
                payout = isWin ? bet * 2 : 0;
                resultText = `🃏 **Blackjack Showdown:** Your Total: **${playerTotal}** | Dealer Total: **${dealerTotal}**\n${isWin ? `🎉 **BLACKJACK WIN! Won +${bet} ${currency}**!` : `💔 **BUST / LOST -${bet} ${currency}**.`}`;
            } else if (game === 'hilow') {
                const nextCard = Math.floor(Math.random() * 10) + 2;
                const prevCard = extra;
                isWin = (action === 'higher' && nextCard > prevCard) || (action === 'lower' && nextCard < prevCard);
                payout = isWin ? Math.round(bet * 1.95) : 0;
                resultText = `🔼 **Higher / Lower:** Next card was **${nextCard}** (Previous: ${prevCard}).\n${isWin ? `🎉 **CORRECT GUESS! Won +${payout - bet} ${currency}**!` : `💔 **WRONG GUESS! Lost -${bet} ${currency}**.`}`;
            } else if (game === 'rb') {
                const rbOutcome = Math.random() < 0.5 ? 'red' : 'black';
                isWin = (action === rbOutcome);
                payout = isWin ? bet * 2 : 0;
                resultText = `🔴 **Red or Black:** Landed on **${rbOutcome.toUpperCase()}**!\n${isWin ? `🎉 **WIN! Won +${bet} ${currency}**!` : `💔 **LOSS! Lost -${bet} ${currency}**.`}`;
            } else if (game === 'crash') {
                const crashPoint = (Math.random() * 3 + 1).toFixed(2); // 1.00x to 4.00x
                isWin = action === 'cashout' ? parseFloat(crashPoint) > 1.2 : parseFloat(crashPoint) > 2.5;
                payout = isWin ? Math.round(bet * (action === 'cashout' ? 1.5 : 3.0)) : 0;
                resultText = `📈 **Crash Multiplier:** Rocket crashed at **${crashPoint}x**!\n${isWin ? `🎉 **SUCCESSFUL ESCAPE! Won +${payout - bet} ${currency}**!` : `💥 **CRASHED BEFORE ESCAPE! Lost -${bet} ${currency}**.`}`;
            } else if (game === 'mines') {
                isWin = action === 'safe' ? Math.random() < 0.6 : Math.random() < 0.35;
                payout = isWin ? Math.round(bet * (action === 'safe' ? 1.8 : 3.5)) : 0;
                resultText = `💣 **Minesweeper:** Digging complete!\n${isWin ? `💎 **FOUND GEM! Won +${payout - bet} ${currency}**!` : `💥 **HIT LANDMINE! Lost -${bet} ${currency}**.`}`;
            }

            const newWins = isWin ? user.casinoWins + 1 : user.casinoWins;
            const newLosses = !isWin ? user.casinoLosses + 1 : user.casinoLosses;

            await user.update({ 
                wallet: (user.wallet - bet) + payout,
                casinoWins: newWins,
                casinoLosses: newLosses
            });

            return interaction.update({ content: resultText, components: [] });

        } catch (err) {
            console.error("Interactive Button Error:", err);
            return interaction.update({ content: '❌ An error occurred resolving your interactive game move.', components: [] }).catch(() => {});
        }
    }
};