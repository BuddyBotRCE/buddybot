const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { UserEconomy, GuildConfig } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your current wallet and bank balance'),
        
    async execute(interaction) {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const currency = config ? config.economyCurrency : 'Scrap';

        // Find their wallet, or create one with 0 if they don't exist yet
        const [userWallet] = await UserEconomy.findOrCreate({
            where: { guildId: interaction.guild.id, userId: interaction.user.id },
            defaults: { wallet: 0, bank: 0 }
        });

        const embed = new EmbedBuilder()
            .setTitle('💰 Account Balance')
            .addFields(
                { name: 'Wallet', value: `${userWallet.wallet} ${currency}`, inline: true },
                { name: 'Bank', value: `${userWallet.bank} ${currency}`, inline: true }
            )
            .setColor('#2b2d31');

        await interaction.reply({ embeds: [embed] });
    }
};