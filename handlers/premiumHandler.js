const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig } = require('../database/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    if (customId === 'admin_menu_select' && selectedValue === 'setup_tier') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const isPremium = config?.isPremiumServer || false;
        const embed = new EmbedBuilder().setTitle('🏷️ BuddyBot License & Tier Manager').setDescription(`Current Server Status: **${isPremium ? '⭐ PREMIUM TIER' : '🆓 FREE TIER'}**\n\n` + (isPremium ? `✅ Your server has full access to all 20 casino minigames, automated RCON auto-events, and advanced modules.\n*Subscription Status:* \`${config?.subscriptionStatus || 'active'}\`` : '⚠️ You are currently on the **Free Tier**. Subscribe via Stripe, then click **Verify Subscription** below to activate!')).setColor(isPremium ? '#f1c40f' : '#95a5a6');
        const row1 = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Upgrade to Premium (Stripe)').setStyle(ButtonStyle.Link).setURL('https://buy.stripe.com/8x29AU3Hg3vIazV7yn9bO01'), new ButtonBuilder().setCustomId('btn_open_verify_modal').setLabel('Verify Subscription').setStyle(ButtonStyle.Success).setEmoji('✔️'));
        const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('toggle_tier_status').setLabel(isPremium ? 'Switch to Free (Admin)' : 'Force Activate Premium (Admin)').setStyle(isPremium ? ButtonStyle.Secondary : ButtonStyle.Success));
        return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }
    if (customId === 'btn_open_verify_modal') {
        const modal = new ModalBuilder().setCustomId('modal_verify_email').setTitle('Verify Stripe Subscription');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stripe_email').setLabel("Stripe Checkout Email").setStyle(TextInputStyle.Short).setPlaceholder('your@email.com').setRequired(true)));
        return interaction.showModal(modal);
    }
    if (customId === 'toggle_tier_status') {
        if (interaction.user.id !== process.env.GLOBAL_OWNER_ID) return interaction.reply({ content: '❌ **Access Denied:** Only the Bot Developer can manually overwrite tier licenses.', flags: 64 });
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const newStatus = !(config?.isPremiumServer || false);
        await GuildConfig.upsert({ guildId: interaction.guild.id, isPremiumServer: newStatus });
        return interaction.update({ content: `✅ Server tier successfully updated to: **${newStatus ? '⭐ PREMIUM TIER' : '🆓 FREE TIER'}**!`, embeds: [], components: [] });
    }
    if (interaction.isModalSubmit() && customId === 'modal_verify_email') {
        await interaction.deferReply({ flags: 64 });
        const email = interaction.fields.getTextInputValue('stripe_email').trim().toLowerCase();
        try {
            const customers = await stripe.customers.list({ email: email, limit: 1 });
            if (customers.data.length === 0) return interaction.editReply({ content: `❌ No Stripe customer found with the email **${email}**.` });
            const customerId = customers.data[0].id;
            const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
            if (subscriptions.data.length === 0) return interaction.editReply({ content: `❌ No **active subscriptions** detected for **${email}**.` });
            await GuildConfig.upsert({ guildId: interaction.guild.id, isPremiumServer: true, stripeCustomerId: customerId, subscriptionStatus: 'active', subscriptionExpiresAt: new Date(subscriptions.data[0].current_period_end * 1000) });
            const embed = new EmbedBuilder().setTitle('⭐ Premium Subscription Verified!').setDescription(`Successfully verified active subscription for **${email}**!\n\n**${interaction.guild.name}** is now upgraded to **⭐ Premium Tier**. All 20 minigames and auto-events are unlocked!`).setColor('#f1c40f').setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        } catch (error) { return interaction.editReply({ content: `❌ Stripe API Error: ${error.message}` }); }
    }
};