const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { UserEconomy, GuildConfig } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw money from your bank back into your wallet')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('The amount to withdraw')
                .setRequired(true)
                .setMinValue(1)
        ),
        
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config ? config.economyCurrency : 'Scrap';

        const [userWallet] = await UserEconomy.findOrCreate({
            where: { guildId: interaction.guild.id, userId: interaction.user.id },
            defaults: { wallet: 0, bank: 0 }
        });

        if (userWallet.bank < amount) {
            return interaction.reply({ 
                content: `❌ You do not have enough **${currency}** in your bank! (Bank Balance: ${userWallet.bank})`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        // Move the money
        await userWallet.update({
            wallet: userWallet.wallet + amount,
            bank: userWallet.bank - amount
        });

        const embed = new EmbedBuilder()
            .setTitle('🏦 Withdrawal Successful')
            .setDescription(`Moved **${amount} ${currency}** into your wallet. You can now spend this in the shop.`)
            .addFields(
                { name: 'Wallet Balance', value: `${userWallet.wallet}`, inline: true },
                { name: 'Bank Balance', value: `${userWallet.bank}`, inline: true }
            )
            .setColor('#2b2d31');

        await interaction.reply({ embeds: [embed] });
    }
};