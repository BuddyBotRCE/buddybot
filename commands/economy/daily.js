const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { UserEconomy, GuildConfig } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily free money and bank interest!'),
        
    async execute(interaction) {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config ? config.economyCurrency : 'Scrap';
        const interestRate = config ? config.economyInterest : 5.0;
        
        const [userWallet] = await UserEconomy.findOrCreate({
            where: { guildId: interaction.guild.id, userId: interaction.user.id },
            defaults: { wallet: 0, bank: 0 }
        });

        const now = new Date();
        const lastDaily = userWallet.lastDaily ? new Date(userWallet.lastDaily) : null;
        
        // 24 Hour Cooldown Check
        if (lastDaily && (now - lastDaily) < 24 * 60 * 60 * 1000) {
            const timeLeft = 24 * 60 * 60 * 1000 - (now - lastDaily);
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            return interaction.reply({ 
                content: `⏳ You have already claimed your daily reward! Come back in **${hours}h ${minutes}m**.`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        // Base reward for claiming
        const dailyReward = 250;
        
        // Calculate bonus interest from their bank (if they have money stored)
        const interestEarned = Math.floor(userWallet.bank * (interestRate / 100));

        // Update database
        await userWallet.update({
            wallet: userWallet.wallet + dailyReward + interestEarned,
            lastDaily: now
        });

        const embed = new EmbedBuilder()
            .setTitle('🎁 Daily Reward Claimed!')
            .setDescription(`You received **${dailyReward} ${currency}**!`)
            .setColor('#00ff00');
            
        if (interestEarned > 0) {
            embed.addFields({ name: 'Bank Interest', value: `You also earned **${interestEarned} ${currency}** from your bank savings (${interestRate}%)!` });
        }

        embed.addFields({ name: 'New Wallet Balance', value: `${userWallet.wallet} ${currency}` });

        await interaction.reply({ embeds: [embed] });
    }
};