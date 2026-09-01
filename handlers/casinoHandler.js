// --- MODAL SUBMISSIONS ---
if (interaction.isModalSubmit()) {
    if (customId === 'modal_casino_config') {
        const maxBet = parseInt(interaction.fields.getTextInputValue('max_bet')) || 1000;
        const cooldown = parseInt(interaction.fields.getTextInputValue('cooldown_sec')) || 5;

        await GuildConfig.upsert({ guildId: interaction.guild.id, casinoMaxBet: maxBet, casinoCooldownSeconds: cooldown });
        return interaction.reply({ content: `✅ Casino limits updated! Max Bet: **${maxBet} Scrap** | Cooldown: **${cooldown} seconds**`, flags: 64 });
    }

    if (customId.startsWith('modal_play_')) {
        // Defer immediately so Discord never times out the interaction
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