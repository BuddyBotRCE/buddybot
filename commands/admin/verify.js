const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { GuildConfig } = require('../../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your Stripe subscription and activate Premium instantly')
        .addStringOption(option => 
            option.setName('email')
                .setDescription('The email address used during Stripe checkout')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        const email = interaction.options.getString('email').trim().toLowerCase();
        const guildId = interaction.guild.id;

        try {
            const customers = await stripe.customers.list({ email: email, limit: 1 });
            if (customers.data.length === 0) {
                return interaction.editReply({ content: `❌ No Stripe customer found with the email **${email}**. Please make sure you used the correct email.` });
            }

            const customerId = customers.data[0].id;
            const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });

            if (subscriptions.data.length === 0) {
                return interaction.editReply({ content: `❌ Found customer account **${email}**, but no **active subscriptions** were detected. Please complete checkout or contact support.` });
            }

            await GuildConfig.upsert({
                guildId: guildId,
                isPremiumServer: true,
                stripeCustomerId: customerId,
                subscriptionStatus: 'active',
                subscriptionExpiresAt: new Date(subscriptions.data[0].current_period_end * 1000)
            });

            const embed = new EmbedBuilder()
                .setTitle('⭐ Premium Subscription Verified!')
                .setDescription(`Successfully verified active subscription for **${email}**!\n\n**${interaction.guild.name}** is now upgraded to **⭐ Premium Tier**. All 20 minigames and auto-events are unlocked!`)
                .setColor('#f1c40f')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[STRIPE VERIFY ERROR]', error);
            return interaction.editReply({ content: `❌ Error communicating with Stripe API: ${error.message}` });
        }
    }
};