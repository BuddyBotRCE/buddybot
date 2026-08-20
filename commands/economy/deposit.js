const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { UserEconomy, GuildConfig } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit money from your wallet into your bank to earn interest')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('The amount to deposit')
                .setRequired(true)
                .setMinValue(1) // Prevents them from depositing negative numbers or zero!
        ),
        
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config ? config.economyCurrency : 'Scrap';

        // Find their wallet
        const [userWallet] = await UserEconomy.findOrCreate({
            where: { guildId: interaction.guild.id, userId: interaction.user.id },
            defaults: { wallet: 0, bank: 0 }
        });

        // Check if they are trying to deposit more than they own
        if (userWallet.wallet < amount) {
            return interaction.reply({ 
                content: `❌ You do not have enough **${currency}** in your wallet! (Wallet Balance: ${userWallet.wallet})`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        // Move the money
        await userWallet.update({
            wallet: userWallet.wallet - amount,
            bank: userWallet.bank + amount
        });

        const embed = new EmbedBuilder()
            .setTitle('🏦 Deposit Successful')
            .setDescription(`Moved **${amount} ${currency}** to your bank. You will now earn interest on this!`)
            .addFields(
                { name: 'Wallet Balance', value: `${userWallet.wallet}`, inline: true },
                { name: 'Bank Balance', value: `${userWallet.bank}`, inline: true }
            )
            .setColor('#2b2d31');

        await interaction.reply({ embeds: [embed] });
    }
};