const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig } = require('../database/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    // --- ENTRY FROM ADMIN PANEL ---
    if (customId === 'admin_menu_select' && selectedValue === 'setup_tier') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const isPremium = config?.isPremiumServer || false;
        
        const embed = new EmbedBuilder()
            .setTitle('🏷️ BuddyBot License & Tier Manager')
            .setDescription(`Current Server Status: **${isPremium ? '⭐ PREMIUM TIER' : '🆓 FREE TIER'}**\n\n` + 
                (isPremium 
                    ? `✅ Your server has full access to all premium features, custom zones, and automated modules.\n*Subscription Status:* \`${config?.subscriptionStatus || 'active'}\`` 
                    : '⚠️ You are currently on the **Free Tier**. Click **Buy Premium** below to unlock all features!'))
            .setColor(isPremium ? '#f1c40f' : '#95a5a6');

        // ROW 1: Purchase & Verification
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Buy Premium').setStyle(ButtonStyle.Link).setURL('https://buy.stripe.com/8x29AU3Hg3vIazV7yn9bO01').setEmoji('⭐'),
            new ButtonBuilder().setCustomId('btn_open_verify_modal').setLabel('Verify Subscription').setStyle(ButtonStyle.Success).setEmoji('✔️')
        );

        // ROW 2: Management (Manage/Cancel & Transfer Server)
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_manage_stripe').setLabel('Manage / Cancel Subscription').setStyle(ButtonStyle.Secondary).setEmoji('⚙️').setDisabled(!config?.stripeCustomerId),
            new ButtonBuilder().setCustomId('btn_transfer_license').setLabel('Transfer License Here').setStyle(ButtonStyle.Primary).setEmoji('🔄')
        );

        const componentsArray = [row1, row2];

        // ROW 3: Bot Owner Override (ONLY SHOWN IF YOU ARE THE OWNER)
        if (interaction.user.id === process.env.GLOBAL_OWNER_ID) {
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_tier_status').setLabel(isPremium ? 'Switch to Free (Owner Override)' : 'Force Activate Premium (Owner Override)').setStyle(isPremium ? ButtonStyle.Secondary : ButtonStyle.Success)
            );
            componentsArray.push(row3);
        }

        return interaction.reply({ embeds: [embed], components: componentsArray, flags: 64 });
    }

    // --- OPEN VERIFY EMAIL MODAL ---
    if (customId === 'btn_open_verify_modal') {
        const modal = new ModalBuilder().setCustomId('modal_verify_email').setTitle('Verify Stripe Subscription');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stripe_email').setLabel("Stripe Checkout Email").setStyle(TextInputStyle.Short).setPlaceholder('your@email.com').setRequired(true)));
        return interaction.showModal(modal);
    }

    // --- GENERATE STRIPE BILLING PORTAL (MANAGE / CANCEL) ---
    if (customId === 'btn_manage_stripe') {
        await interaction.deferReply({ flags: 64 });
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        
        if (!config || !config.stripeCustomerId) {
            return interaction.editReply({ content: '❌ No linked Stripe customer found for this server. Please verify your subscription first.' });
        }

        try {
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: config.stripeCustomerId,
                return_url: `https://discord.com`
            });

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Stripe Billing Portal')
                .setDescription(`Click the link below to manage your subscription, update your payment card, or **cancel your subscription**.\n\n[Open Stripe Billing Portal](${portalSession.url})`)
                .setColor('#3498db');

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            return interaction.editReply({ content: `❌ Could not generate billing portal: ${error.message}` });
        }
    }

    // --- TRANSFER LICENSE TO THIS SERVER ---
    if (customId === 'btn_transfer_license') {
        const modal = new ModalBuilder().setCustomId('modal_transfer_license').setTitle('Transfer License');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stripe_email').setLabel("Your Stripe Checkout Email").setStyle(TextInputStyle.Short).setPlaceholder('your@email.com').setRequired(true)));
        return interaction.showModal(modal);
    }

    // --- ADMIN OVERRIDE EXECUTION ---
    if (customId === 'toggle_tier_status') {
        if (interaction.user.id !== process.env.GLOBAL_OWNER_ID) {
            return interaction.reply({ content: '❌ **Access Denied:** Only the Bot Developer can manually overwrite tier licenses.', flags: 64 });
        }
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const newStatus = !(config?.isPremiumServer || false);
        await GuildConfig.upsert({ guildId: interaction.guild.id, isPremiumServer: newStatus });
        return interaction.update({ content: `✅ Server tier successfully updated to: **${newStatus ? '⭐ PREMIUM TIER' : '🆓 FREE TIER'}**!`, embeds: [], components: [] });
    }

    // =========================================================================
    // MODAL SUBMISSIONS
    // =========================================================================

    if (interaction.isModalSubmit()) {
        
        // 1. VERIFY EMAIL SUBMISSION
        if (customId === 'modal_verify_email') {
            await interaction.deferReply({ flags: 64 });
            const email = interaction.fields.getTextInputValue('stripe_email').trim().toLowerCase();
            try {
                const customers = await stripe.customers.list({ email: email, limit: 1 });
                if (customers.data.length === 0) return interaction.editReply({ content: `❌ No Stripe customer found with the email **${email}**.` });
                
                const customerId = customers.data[0].id;
                const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
                if (subscriptions.data.length === 0) return interaction.editReply({ content: `❌ No **active subscriptions** detected for **${email}**.` });
                
                await GuildConfig.upsert({ 
                    guildId: interaction.guild.id, 
                    isPremiumServer: true, 
                    stripeCustomerId: customerId, 
                    subscriptionStatus: 'active', 
                    subscriptionExpiresAt: new Date(subscriptions.data[0].current_period_end * 1000) 
                });

                const embed = new EmbedBuilder().setTitle('⭐ Premium Subscription Verified!').setDescription(`Successfully verified active subscription for **${email}**!\n\n**${interaction.guild.name}** is now upgraded to **⭐ Premium Tier**.`).setColor('#f1c40f').setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            } catch (error) { return interaction.editReply({ content: `❌ Stripe API Error: ${error.message}` }); }
        }

        // 2. TRANSFER LICENSE SUBMISSION
        if (customId === 'modal_transfer_license') {
            await interaction.deferReply({ flags: 64 });
            const email = interaction.fields.getTextInputValue('stripe_email').trim().toLowerCase();
            
            try {
                const customers = await stripe.customers.list({ email: email, limit: 1 });
                if (customers.data.length === 0) return interaction.editReply({ content: `❌ No Stripe customer found with the email **${email}**.` });
                
                const customerId = customers.data[0].id;
                const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
                if (subscriptions.data.length === 0) return interaction.editReply({ content: `❌ No **active subscriptions** found for **${email}** to transfer.` });

                await GuildConfig.update(
                    { isPremiumServer: false, subscriptionStatus: 'transferred' },
                    { where: { stripeCustomerId: customerId } }
                );

                await GuildConfig.upsert({ 
                    guildId: interaction.guild.id, 
                    isPremiumServer: true, 
                    stripeCustomerId: customerId, 
                    subscriptionStatus: 'active', 
                    subscriptionExpiresAt: new Date(subscriptions.data[0].current_period_end * 1000) 
                });

                const embed = new EmbedBuilder()
                    .setTitle('🔄 License Transferred Successfully!')
                    .setDescription(`Your active subscription has been successfully unbound from your old server and transferred to **${interaction.guild.name}**!`)
                    .setColor('#2ecc71')
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } catch (error) {
                return interaction.editReply({ content: `❌ Transfer Error: ${error.message}` });
            }
        }
    }
};