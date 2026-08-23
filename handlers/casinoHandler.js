const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, UserEconomy, CasinoCooldown } = require('../database/db');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    // --- ADMIN SETUP HUB ---
    if (customId === 'admin_menu_select' && selectedValue === 'setup_minigames') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const embed = new EmbedBuilder()
            .setTitle('🎰 Minigames Casino Manager')
            .setDescription(`Configure global limits for all 20 casino minigames:\n\n• **Max Bet Amount:** ${config?.casinoMaxBet || 1000} Scrap\n• **Game Cooldown:** ${config?.casinoCooldownSeconds || 5} seconds`)
            .setColor('#e74c3c');
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_casino_settings').setLabel('Configure Casino Limits').setStyle(ButtonStyle.Primary).setEmoji('⚙️')
        );
        return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }

    if (customId === 'casino_game_select') {
        const gameKey = selectedValue;
        const modal = new ModalBuilder().setCustomId(`modal_play_${gameKey}`).setTitle(`Play ${gameKey.toUpperCase()}`);
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bet').setLabel("Enter Bet Amount").setStyle(TextInputStyle.Short).setRequired(true)));
        return interaction.showModal(modal);
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
                { label: 'Dice Roll', val: 'dice', emoji: '🎲' }
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
                    { label: 'Scrap Scavenger', val: 'scavenger', emoji: '⚙️' }
                );
            }

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('casino_game_select')
                    .setPlaceholder(isPremium ? 'Select a Minigame (All 20 Unlocked)...' : 'Select a Minigame (Free Tier: 3 Games)...')
                    .addOptions(games.map(g => ({ label: g.label, value: g.val, emoji: g.emoji })))
            );

            const footerText = isPremium ? '⭐ **Premium Tier Active:** All 20 minigames are unlocked!' : '💡 **Free Tier:** Upgrade to Premium in the Admin Panel to unlock all 20 minigames!';
            return interaction.reply({ content: `🎰 **Server Casino Hub:**\n${footerText}`, components: [row], flags: 64 });
        }
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
                    const genericWin = Math.random() < 0.45;
                    payout = genericWin ? Math.round(bet * 2) : 0;
                    resultMsg = genericWin ? `🎮 **${gameType.toUpperCase()} WON!** You won **+${bet} ${currency}**!` : `🎮 **${gameType.toUpperCase()} LOST!** You lost **-${bet} ${currency}**.`;
                    break;
            }

            await user.update({ wallet: (user.wallet - bet) + payout });
            return interaction.reply({ content: resultMsg, flags: 64 });
        }
    }
};