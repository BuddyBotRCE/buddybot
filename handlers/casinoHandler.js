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
            
            const [userStats] = await UserEconomy.findOrCreate({ 
                where: { guildId: interaction.guild.id, userId: interaction.user.id },
                defaults: { wallet: 0, bank: 0, casinoWins: 0, casinoLosses: 0 }
            });

            const totalGames = userStats.casinoWins + userStats.casinoLosses;
            const winRate = totalGames > 0 ? ((userStats.casinoWins / totalGames) * 100).toFixed(1) : 0;

            const games = [
                { label: '🪙 Coinflip', val: 'coinflip', description: 'Interactive Heads or Tails' },
                { label: '🎰 Slots', val: 'slots', description: 'Spin the multi-reel slot machine' },
                { label: '🎲 Dice Roll', val: 'dice', description: 'High/Low interactive prediction' },
                { label: '🎟️ Scratchcard', val: 'scratchcard', description: 'Multi-box interactive ticket reveal' },
                { label: '✂️ Rock Paper Scissors', val: 'rps', description: 'Classic 3-way interactive duel' },
                { label: '🎡 Roulette', val: 'roulette', description: 'Pick Red, Black, or Green pocket' },
                { label: '🃏 Blackjack', val: 'blackjack', description: 'Multi-turn Hit, Stand, or Double table' },
                { label: '🔼 Higher / Lower', val: 'hilow', description: 'Guess card streak values' },
                { label: '♠️ Poker Hands', val: 'poker', description: 'Multi-card draw poker evaluation' },
                { label: '☸️ Wheel of Fortune', val: 'wheel', description: 'Spin progressive multi-tier wheel' },
                { label: '📈 Crash Multiplier', val: 'crash', description: 'Live ticking rocket cash-out game' },
                { label: '🎴 Baccarat', val: 'baccarat', description: 'Player vs Banker card showdown' },
                { label: '🔴 Red or Black', val: 'redblack', description: 'Color choice double-up table' },
                { label: '🎴 Three Card Brag', val: 'brag', description: 'British 3-card ranking table' },
                { label: '🎯 Keno', val: 'keno', description: 'Interactive multi-spot number board' },
                { label: '🔢 Lucky Numbers', val: 'luckynum', description: 'Precision digit target match' },
                { label: '🎲 Craps', val: 'craps', description: 'Street dice shooter progression' },
                { label: '🏮 Sic Bo', val: 'sicbo', description: 'Triple dice sum betting layout' },
                { label: '💻 Video Poker', val: 'videopoker', description: 'Jacks or Better hold & draw table' },
                { label: '🀄 Pai Gow', val: 'paigow', description: 'Two-hand tile/card splitter' },
                { label: '💣 Raid Gamble', val: 'raidgamble', description: 'Vault breaching multiplier sequence' },
                { label: '⚙️ Scrap Scavenger', val: 'scavenger', description: 'Monument loot run simulation' },
                { label: '🐎 Horse Racing', val: 'horseracing', description: 'Stallion track heat showdown' },
                { label: '💣 Mines', val: 'mines', description: 'Multi-tile progressive gem board' },
                { label: '🔴 Plinko', val: 'plinko', description: 'Peg drop path multiplier game' }
            ];

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('casino_game_select')
                    .setPlaceholder('🎯 Select an Interactive Minigame...')
                    .addOptions(games.map(g => ({ label: g.label, value: g.val, description: g.description })))
            );

            const statsText = `📊 **Your Casino Record:** Wins: \`${userStats.casinoWins}\` | Losses: \`${userStats.casinoLosses}\` | Win Rate: \`${winRate}%\``;
            return interaction.reply({ content: `🎰 **Fully Interactive Server Casino Hub:**\n${statsText}\n\n👇 Choose any game below to set your bet and launch the interactive game board!`, components: [row], flags: 64 });
        }
    }

    // --- SELECT MENU (OPENS BETTING MODAL) ---
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

            // Deduct bet immediately upon game initialization
            await user.update({ wallet: user.wallet - bet });

            // =========================================================================
            // 🕹️ IMMERSIVE MULTI-STEP GAME BOARDS & INTERACTIVE BOOTSTRAPS
            // =========================================================================

            if (gameType === 'coinflip') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_cf_heads_${bet}`).setLabel('Heads').setStyle(ButtonStyle.Primary).setEmoji('🪙'),
                    new ButtonBuilder().setCustomId(`g_cf_tails_${bet}`).setLabel('Tails').setStyle(ButtonStyle.Danger).setEmoji('🪙')
                );
                return interaction.reply({ content: `🪙 **Coinflip Arena** | Stake: **${bet} ${currency}**\n*The coin is spinning in the air... Make your call!*`, components: [row], flags: 64 });
            }

            if (gameType === 'dice') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_dice_low_${bet}`).setLabel('Low [1 - 3] (1.9x)').setStyle(ButtonStyle.Secondary).setEmoji('🎲'),
                    new ButtonBuilder().setCustomId(`g_dice_high_${bet}`).setLabel('High [4 - 6] (1.9x)').setStyle(ButtonStyle.Success).setEmoji('🎲')
                );
                return interaction.reply({ content: `🎲 **Dice Roll Arena** | Stake: **${bet} ${currency}**\n*Select your predicted bracket before the dealer shakes the cup:*`, components: [row], flags: 64 });
            }

            if (gameType === 'roulette') {
                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_roulette_red_${bet}`).setLabel('Red (2x)').setStyle(ButtonStyle.Danger).setEmoji('🔴'),
                    new ButtonBuilder().setCustomId(`g_roulette_black_${bet}`).setLabel('Black (2x)').setStyle(ButtonStyle.Secondary).setEmoji('⬛'),
                    new ButtonBuilder().setCustomId(`g_roulette_green_${bet}`).setLabel('Green [0] (14x)').setStyle(ButtonStyle.Success).setEmoji('🟢')
                );
                return interaction.reply({ content: `🎡 **Roulette Wheel** | Stake: **${bet} ${currency}**\n*The ball is spinning across the wheel layout. Choose your pocket:*`, components: [row1], flags: 64 });
            }

            if (gameType === 'blackjack') {
                const playerCard1 = Math.floor(Math.random() * 9) + 2;
                const playerCard2 = Math.floor(Math.random() * 9) + 2;
                const playerTotal = playerCard1 + playerCard2;
                const dealerCard = Math.floor(Math.random() * 9) + 2;

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_bj_hit_${bet}_${playerTotal}`).setLabel('Hit (Card)').setStyle(ButtonStyle.Primary).setEmoji('🃏'),
                    new ButtonBuilder().setCustomId(`g_bj_stand_${bet}_${playerTotal}`).setLabel('Stand').setStyle(ButtonStyle.Success).setEmoji('🛑'),
                    new ButtonBuilder().setCustomId(`g_bj_double_${bet}_${playerTotal}`).setLabel('Double Down').setStyle(ButtonStyle.Secondary).setEmoji('⚡')
                );
                return interaction.reply({ content: `🃏 **Blackjack Table** | Stake: **${bet} ${currency}**\n• Dealer Showing: **${dealerCard}**\n• Your Hand: **[ ${playerCard1} , ${playerCard2} ] (Total: ${playerTotal})**\n\n*Choose your next strategic move:*`, components: [row], flags: 64 });
            }

            if (gameType === 'hilow') {
                const cardVal = Math.floor(Math.random() * 11) + 2;
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_hilow_higher_${bet}_${cardVal}_1`).setLabel('Higher 🔼').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`g_hilow_lower_${bet}_${cardVal}_1`).setLabel('Lower 🔽').setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ content: `🔼 **Higher / Lower Streak** | Stake: **${bet} ${currency}**\n• Current Base Card: **[ ${cardVal} ]** | Streak: **0**\n\n*Will the next deal be higher or lower?*`, components: [row], flags: 64 });
            }

            if (gameType === 'redblack') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_rb_red_${bet}`).setLabel('Red Suit (2x)').setStyle(ButtonStyle.Danger).setEmoji('🔴'),
                    new ButtonBuilder().setCustomId(`g_rb_black_${bet}`).setLabel('Black Suit (2x)').setStyle(ButtonStyle.Secondary).setEmoji('⬛')
                );
                return interaction.reply({ content: `🔴 **Red or Black Double-Up** | Stake: **${bet} ${currency}**\n*Select the winning card color:*`, components: [row], flags: 64 });
            }

            if (gameType === 'crash') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_crash_cashout_${bet}`).setLabel('Cash Out (1.5x)').setStyle(ButtonStyle.Success).setEmoji('💰'),
                    new ButtonBuilder().setCustomId(`g_crash_letitride_${bet}`).setLabel('Let It Ride (3.0x)').setStyle(ButtonStyle.Danger).setEmoji('🚀')
                );
                return interaction.reply({ content: `📈 **Crash Multiplier Rocket** | Stake: **${bet} ${currency}**\n🚀 *Rocket status: Ascending through atmosphere...*`, components: [row], flags: 64 });
            }

            if (gameType === 'mines') {
                // Interactive 3-tile progressive board layout
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_mines_tile1_${bet}_2`).setLabel('Tile 1 [?]').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`g_mines_tile2_${bet}_2`).setLabel('Tile 2 [?]').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`g_mines_tile3_${bet}_2`).setLabel('Tile 3 [?]').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ content: `💣 **Minesweeper Grid** | Stake: **${bet} ${currency}**\n*Select a safe tile to uncover hidden gems (2x multiplier payout):*`, components: [row], flags: 64 });
            }

            if (gameType === 'slots') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_slots_spin_${bet}`).setLabel('SPIN REELS 🎰').setStyle(ButtonStyle.Success)
                );
                return interaction.reply({ content: `🎰 **Vegas Slot Machine** | Stake: **${bet} ${currency}**\n• Reel Display: ` + '` ❓ | ❓ | ❓ `' + `\n\n*Click below to spin the machine reels:*`, components: [row], flags: 64 });
            }

            if (gameType === 'scratchcard') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_scratch_reveal_${bet}`).setLabel('SCRATCH TICKET 🎟️').setStyle(ButtonStyle.Primary)
                );
                return interaction.reply({ content: `🎟️ **Scavenger Scratchcard** | Stake: **${bet} ${currency}**\n• Ticket State: ` + '` [ 🟫 ] [ 🟫 ] [ 🟫 ] `' + `\n\n*Scratch open the hidden icons to check for matches:*`, components: [row], flags: 64 });
            }

            if (gameType === 'rps') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`g_rps_rock_${bet}`).setLabel('Rock').setStyle(ButtonStyle.Secondary).setEmoji('🪨'),
                    new ButtonBuilder().setCustomId(`g_rps_paper_${bet}`).setLabel('Paper').setStyle(ButtonStyle.Primary).setEmoji('📄'),
                    new ButtonBuilder().setCustomId(`g_rps_scissors_${bet}`).setLabel('Scissors').setStyle(ButtonStyle.Danger).setEmoji('✂️')
                );
                return interaction.reply({ content: `✂️ **Rock Paper Scissors Arena** | Stake: **${bet} ${currency}**\n*Make your hand sign throw against the house opponent:*`, components: [row], flags: 64 });
            }

            // Interactive button fallback mapping for remaining specialized table & arcade games
            const genericGameNames = {
                poker: '🃏 Poker Hands', wheel: '☸️ Wheel of Fortune', baccarat: '🎴 Baccarat', brag: '🎴 Three Card Brag',
                keno: '🎯 Keno', luckynum: '🔢 Lucky Numbers', craps: '🎲 Craps', sicbo: '🏮 Sic Bo',
                videopoker: '💻 Video Poker', paigow: '🀄 Pai Gow', raidgamble: '💣 Raid Vault', scavenger: '⚙️ Scavenge Monument',
                horseracing: '🐎 Horse Racing', plinko: '🔴 Plinko Drop'
            };

            const gName = genericGameNames[gameType] || `🎮 ${gameType.toUpperCase()}`;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`g_generic_play_${bet}_${gameType}`).setLabel(`EXECUTE ${gameType.toUpperCase()} ROUND`).setStyle(ButtonStyle.Success).setEmoji('🎯')
            );
            return interaction.reply({ content: `${gName} | Stake: **${bet} ${currency}**\n*Interactive simulation session initialized. Click below to execute round:*`, components: [row], flags: 64 });
        }
    }

    // =========================================================================
    // 🕹️ RESOLVE INTERACTIVE GAME BUTTON CHOICE CLICKS (Live Engine)
    // =========================================================================
    if (interaction.isButton() && customId.startsWith('g_')) {
        try {
            const parts = customId.split('_');
            const game = parts[1]; 
            const action = parts[2];
            const bet = parseInt(parts[3]);
            const extra = parts[4] ? parts[4] : null;

            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';

            const [user] = await UserEconomy.findOrCreate({ 
                where: { guildId: interaction.guild.id, userId: interaction.user.id },
                defaults: { wallet: 0, bank: 0, casinoWins: 0, casinoLosses: 0 }
            });

            let payout = 0;
            let isWin = false;
            let resultText = '';

            if (game === 'cf') {
                const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
                isWin = (action === outcome);
                payout = isWin ? bet * 2 : 0;
                resultText = `🪙 **Coinflip Result:** Landed on **${outcome.toUpperCase()}**! ${isWin ? `🎉 **WON +${bet} ${currency}**!` : `💔 **LOST -${bet} ${currency}**.`}`;
            } else if (game === 'dice') {
                const roll = Math.floor(Math.random() * 6) + 1;
                const rollType = roll <= 3 ? 'low' : 'high';
                isWin = (action === rollType);
                payout = isWin ? Math.round(bet * 1.9) : 0;
                resultText = `🎲 **Dice Roll Result:** Rolled a **${roll}** (${rollType.toUpperCase()})! ${isWin ? `🎉 **WON +${payout - bet} ${currency}**!` : `💔 **LOST -${bet} ${currency}**.`}`;
            } else if (game === 'roulette') {
                const wheelRoll = Math.floor(Math.random() * 37);
                let winningColor = 'green';
                if (wheelRoll !== 0) {
                    const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                    winningColor = reds.includes(wheelRoll) ? 'red' : 'black';
                }
                isWin = (action === winningColor);
                payout = isWin ? (winningColor === 'green' ? bet * 14 : bet * 2) : 0;
                resultText = `🎡 **Roulette Ball:** Landed on **${wheelRoll} (${winningColor.toUpperCase()})**! ${isWin ? `🎉 **WON +${payout - bet} ${currency}**!` : `💔 **LOST -${bet} ${currency}**.`}`;
            } else if (game === 'bj') {
                const dealerTotal = Math.floor(Math.random() * 6) + 16;
                const currentTotal = parseInt(extra) || 16;
                let finalTotal = currentTotal;
                
                if (action === 'hit') finalTotal += Math.floor(Math.random() * 6) + 2;
                if (action === 'double') {
                    if (user.wallet >= bet) {
                        await user.update({ wallet: user.wallet - bet }); // Double down extra deduction
                        finalTotal += Math.floor(Math.random() * 6) + 4;
                    }
                }

                const effectiveBet = action === 'double' ? bet * 2 : bet;
                isWin = finalTotal <= 21 && (finalTotal > dealerTotal || dealerTotal > 21);
                payout = isWin ? effectiveBet * 2 : 0;
                resultText = `🃏 **Blackjack Table Finalized:** Your Hand: **${finalTotal}** | Dealer Hand: **${dealerTotal}**\n${isWin ? `🎉 **TABLE WIN! Won +${effectiveBet} ${currency}**!` : `💔 **BUST / LOST -${effectiveBet} ${currency}**.`}`;
            } else if (game === 'hilow') {
                const nextCard = Math.floor(Math.random() * 11) + 2;
                const prevCard = parseInt(extra);
                isWin = (action === 'higher' && nextCard > prevCard) || (action === 'lower' && nextCard < prevCard);
                payout = isWin ? Math.round(bet * 1.95) : 0;
                resultText = `🔼 **Higher / Lower:** Next card was **${nextCard}** (Previous: ${prevCard}).\n${isWin ? `🎉 **STREAK CORRECT! Won +${payout - bet} ${currency}**!` : `💔 **WRONG GUESS! Lost -${bet} ${currency}**.`}`;
            } else if (game === 'rb') {
                const rbOutcome = Math.random() < 0.5 ? 'red' : 'black';
                isWin = (action === rbOutcome);
                payout = isWin ? bet * 2 : 0;
                resultText = `🔴 **Red or Black:** Landed on **${rbOutcome.toUpperCase()}**!\n${isWin ? `🎉 **WIN! Won +${bet} ${currency}**!` : `💔 **LOSS! Lost -${bet} ${currency}**.`}`;
            } else if (game === 'crash') {
                const crashPoint = (Math.random() * 3 + 1).toFixed(2);
                isWin = action === 'cashout' ? parseFloat(crashPoint) > 1.2 : parseFloat(crashPoint) > 2.5;
                payout = isWin ? Math.round(bet * (action === 'cashout' ? 1.5 : 3.0)) : 0;
                resultText = `📈 **Crash Multiplier:** Rocket exploded at **${crashPoint}x**!\n${isWin ? `🎉 **SUCCESSFUL ESCAPE! Won +${payout - bet} ${currency}**!` : `💥 **CRASHED BEFORE ESCAPE! Lost -${bet} ${currency}**.`}`;
            } else if (game === 'mines') {
                const gemTile = Math.floor(Math.random() * 3) + 1;
                const chosenTile = parseInt(action.replace('tile', ''));
                isWin = (chosenTile === gemTile);
                payout = isWin ? bet * 2 : 0;
                resultText = `💣 **Minesweeper Board:** Gem was hidden under **Tile ${gemTile}** (You selected Tile ${chosenTile}).\n${isWin ? `💎 **FOUND GEM! Won +${bet} ${currency}**!` : `💥 **HIT LANDMINE! Lost -${bet} ${currency}**.`}`;
            } else if (game === 'slots') {
                const icons = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
                const r1 = icons[Math.floor(Math.random() * icons.length)]; 
                const r2 = icons[Math.floor(Math.random() * icons.length)]; 
                const r3 = icons[Math.floor(Math.random() * icons.length)];
                if (r1 === r2 && r2 === r3) { 
                    payout = bet * 5; isWin = true;
                    resultText = `🎰 | ${r1} | ${r2} | ${r3} | **JACKPOT! (5x)** Won **+${bet * 4} ${currency}**!`; 
                } else if (r1 === r2 || r2 === r3 || r1 === r3) { 
                    payout = Math.round(bet * 1.5); isWin = true;
                    resultText = `🎰 | ${r1} | ${r2} | ${r3} | **Partial Match! (1.5x)** Won **+${Math.round(bet * 0.5)} ${currency}**!`; 
                } else { 
                    payout = 0; isWin = false;
                    resultText = `🎰 | ${r1} | ${r2} | ${r3} | **Loss!** Lost **-${bet} ${currency}**.`; 
                }
            } else if (game === 'scratch') {
                const symbols = ['⭐', '❌', '💎', '🍀'];
                const s1 = symbols[Math.floor(Math.random() * symbols.length)];
                const s2 = symbols[Math.floor(Math.random() * symbols.length)];
                const s3 = symbols[Math.floor(Math.random() * symbols.length)];
                if (s1 === s2 && s2 === s3) {
                    payout = bet * 3; isWin = true;
                    resultText = `🎟️ [ ${s1} | ${s2} | ${s3} ] **SCRATCHCARD WIN! (3x)** Won **+${bet * 2} ${currency}**!`;
                } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                    payout = Math.round(bet * 1.2); isWin = true;
                    resultText = `🎟️ [ ${s1} | ${s2} | ${s3} ] **SMALL WIN! (1.2x)** Won **+${Math.round(bet * 0.2)} ${currency}**!`;
                } else {
                    payout = 0; isWin = false;
                    resultText = `🎟️ [ ${s1} | ${s2} | ${s3} ] **LOSS!** Lost **-${bet} ${currency}**.`;
                }
            } else if (game === 'rps') {
                const choices = ['Rock', 'Paper', 'Scissors'];
                const botChoice = choices[Math.floor(Math.random() * choices.length)];
                const userChoice = action.charAt(0).toUpperCase() + action.slice(1);
                if (userChoice === botChoice) { payout = bet; isWin = false; resultText = `✂️ You threw ${userChoice}, house threw ${botChoice}. **TIE!** Bet fully refunded.`; }
                else if ((userChoice === 'Rock' && botChoice === 'Scissors') || (userChoice === 'Paper' && botChoice === 'Rock') || (userChoice === 'Scissors' && botChoice === 'Paper')) {
                    payout = bet * 2; isWin = true; resultText = `✂️ You threw ${userChoice}, house threw ${botChoice}. **DUEL WIN! (2x)** Won **+${bet} ${currency}**!`;
                } else {
                    payout = 0; isWin = false; resultText = `✂️ You threw ${userChoice}, house threw ${botChoice}. **DUEL LOSS!** Lost **-${bet} ${currency}**.`;
                }
            } else if (game === 'generic') {
                const subType = extra || 'arcade';
                const winChance = Math.random() < 0.45;
                const mult = (Math.random() * 1.7 + 1.3).toFixed(1);
                payout = winChance ? Math.round(bet * parseFloat(mult)) : 0;
                isWin = winChance;
                resultText = winChance ? `🎯 **${subType.toUpperCase()} ROUND WIN! (${mult}x)** Won **+${payout - bet} ${currency}**!` : `🎯 **${subType.toUpperCase()} ROUND LOSS!** House wins, lost **-${bet} ${currency}**.`;
            }

            const newWins = isWin ? user.casinoWins + 1 : user.casinoWins;
            const newLosses = (!isWin && payout === 0) ? user.casinoLosses + 1 : user.casinoLosses;

            await user.update({ 
                wallet: (user.wallet - bet) + payout,
                casinoWins: newWins,
                casinoLosses: newLosses
            });

            return interaction.update({ content: resultText, components: [] });

        } catch (err) {
            console.error("Interactive Button Error:", err);
            return interaction.update({ content: '❌ An error occurred resolving your interactive minigame move.', components: [] }).catch(() => {});
        }
    }
};