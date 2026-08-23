const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, BuddyPassChallenge, BuddyPassReward, UserEconomy } = require('../database/db');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

    // --- ADMIN SETUP HUB ---
    if (customId === 'admin_menu_select' && selectedValue === 'setup_buddypass') {
        const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
        const challenges = await BuddyPassChallenge.findAll({ where: { guildId: interaction.guild.id } });
        const rewards = await BuddyPassReward.findAll({ where: { guildId: interaction.guild.id } });

        const embed = new EmbedBuilder()
            .setTitle('⭐ BuddyPass Manager')
            .setDescription(`Configure season XP multipliers, challenges, and level progression rewards (Levels 1-50).\n\n• **XP Rate Multiplier:** ${config?.buddyPassXpRate || 10}x\n• **Active Challenges:** ${challenges.length}\n• **Configured Tier Rewards:** ${rewards.length}/50`)
            .setColor('#f39c12');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bp_set_xp').setLabel('Set XP Rate').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
            new ButtonBuilder().setCustomId('bp_load_preloaded').setLabel('Load Preloaded Challenges').setStyle(ButtonStyle.Success).setEmoji('📥'),
            new ButtonBuilder().setCustomId('bp_add_custom').setLabel('Add Custom Challenge').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
            new ButtonBuilder().setCustomId('bp_set_reward').setLabel('Set Level Reward (1-50)').setStyle(ButtonStyle.Danger).setEmoji('🎁')
        );
        return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }

    if (customId === 'bp_reward_dropdown_select') {
        const parts = selectedValue.split('_');
        const rewardTypeKey = parts[0]; 
        const level = parseInt(parts[parts.length - 1]);
        
        let rewardType = 'coins';
        let rewardValue = '500';

        if (rewardTypeKey === 'coin') {
            rewardType = 'coins'; rewardValue = parts[1]; 
        } else if (rewardTypeKey === 'xp') {
            rewardType = 'xp'; rewardValue = parts[1]; 
        } else if (rewardTypeKey === 'item') {
            rewardType = 'item'; rewardValue = `${parts[1]} ${parts[2]}`;
        }

        await BuddyPassReward.upsert({ guildId: interaction.guild.id, level, rewardType, rewardValue });
        return interaction.update({ content: `✅ Successfully assigned reward for **Level ${level}**: **${rewardType.toUpperCase()} (${rewardValue})**!`, components: [] });
    }

    // --- BUTTON CLICKS ---
    if (interaction.isButton()) {
        if (customId === 'hub_buddypass_view') {
            const challenges = await BuddyPassChallenge.findAll({ where: { guildId: interaction.guild.id } });
            const challengeList = challenges.length 
                ? challenges.map(c => `• **${c.title}** — Target: *${c.targetAmount} ${c.targetType}* | Reward: **+${c.rewardXp} XP**`).join('\n') 
                : 'No active BuddyPass challenges configured on this server yet.';

            const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
            const lvl = user?.level || 1;
            const xp = user?.xp || 0;

            const embed = new EmbedBuilder()
                .setTitle('⭐ Server BuddyPass & Challenges')
                .setDescription(`Complete seasonal objectives to earn XP and unlock tier rewards!\n\n**Your Progress:** Level **${lvl}** (${xp} XP)\n\n**Active Season Challenges:**\n${challengeList}`)
                .setColor('#f39c12')
                .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (customId === 'bp_set_xp') {
            const modal = new ModalBuilder().setCustomId('modal_bp_xp').setTitle('Configure BuddyPass XP');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('xp_rate').setLabel("XP Rate Multiplier (e.g. 10)").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }

        if (customId === 'bp_load_preloaded') {
            const defaults = [
                { title: 'Kill 10 Scientists', targetType: 'scientist', targetAmount: 10, rewardXp: 150, isPreloaded: true },
                { title: 'Kill 5 Players', targetType: 'player', targetAmount: 5, rewardXp: 200, isPreloaded: true },
                { title: 'Visit 3 Monuments', targetType: 'monument', targetAmount: 3, rewardXp: 100, isPreloaded: true }
            ];
            for (const d of defaults) {
                await BuddyPassChallenge.findOrCreate({ where: { guildId: interaction.guild.id, title: d.title }, defaults: d });
            }
            return interaction.reply({ content: `✅ Loaded preloaded challenges successfully!`, flags: 64 });
        }

        if (customId === 'bp_add_custom') {
            const modal = new ModalBuilder().setCustomId('modal_bp_custom').setTitle('Add Custom Challenge');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel("Challenge Title").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('type').setLabel("Target Type").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Target Amount").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('xp').setLabel("Reward XP").setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        if (customId === 'bp_set_reward') {
            const modal = new ModalBuilder().setCustomId('modal_bp_level_select').setTitle('Select BuddyPass Level (1-50)');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('level').setLabel("Level Number (1 to 50)").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
    }

    // --- MODAL SUBMISSIONS ---
    if (interaction.isModalSubmit()) {
        if (customId === 'modal_bp_xp') {
            const rate = parseInt(interaction.fields.getTextInputValue('xp_rate')) || 10;
            await GuildConfig.upsert({ guildId: interaction.guild.id, buddyPassXpRate: rate });
            return interaction.reply({ content: `✅ BuddyPass XP rate multiplier set to **${rate}x**!`, flags: 64 });
        }

        if (customId === 'modal_bp_custom') {
            const title = interaction.fields.getTextInputValue('title');
            const targetType = interaction.fields.getTextInputValue('type');
            const targetAmount = parseInt(interaction.fields.getTextInputValue('amount')) || 1;
            const rewardXp = parseInt(interaction.fields.getTextInputValue('xp')) || 100;

            await BuddyPassChallenge.create({ guildId: interaction.guild.id, title, targetType, targetAmount, rewardXp, isPreloaded: false });
            return interaction.reply({ content: `✅ Custom challenge **"${title}"** added successfully!`, flags: 64 });
        }

        if (customId === 'modal_bp_level_select') {
            const level = parseInt(interaction.fields.getTextInputValue('level'));
            if (isNaN(level) || level < 1 || level > 50) {
                return interaction.reply({ content: `❌ Level must be a valid number between 1 and 50.`, flags: 64 });
            }

            const rewardOptions = [
                { label: '250 Scrap (Coins)', description: 'Give 250 server currency to wallet', value: `coin_250_${level}`, emoji: '💰' },
                { label: '500 Scrap (Coins)', description: 'Give 500 server currency to wallet', value: `coin_500_${level}`, emoji: '💰' },
                { label: '1000 Scrap (Coins)', description: 'Give 1000 server currency to wallet', value: `coin_1000_${level}`, emoji: '💰' },
                { label: '5000 Scrap (High Roller Coins)', description: 'Give 5000 server currency to wallet', value: `coin_5000_${level}`, emoji: '💎' },
                { label: 'Assault Rifle (AK47)', description: 'Give 1x AK47 via RCON', value: `item_rifle.ak_1_${level}`, emoji: '🔫' },
                { label: 'LR-300 Rifle', description: 'Give 1x LR-300 via RCON', value: `item_rifle.lr300_1_${level}`, emoji: '🔫' },
                { label: 'M249 Machine Gun', description: 'Give 1x M249 via RCON', value: `item_lmg.m249_1_${level}`, emoji: '💥' },
                { label: 'Timed Explosive (C4)', description: 'Give 2x C4 via RCON', value: `item_explosive.timed_2_${level}`, emoji: '💣' },
                { label: 'Satchel Charge', description: 'Give 3x Satchels via RCON', value: `item_explosive.satchel_3_${level}`, emoji: '🧨' },
                { label: 'Rocket (Basic)', description: 'Give 3x Rockets via RCON', value: `item_ammo.rocket.basic_3_${level}`, emoji: '🚀' },
                { label: '5.56 Rifle Ammo (100x)', description: 'Give 100x 5.56 ammo via RCON', value: `item_ammo.rifle_100_${level}`, emoji: '📦' },
                { label: 'Medical Syringes (10x)', description: 'Give 10x Medical Syringes via RCON', value: `item_syringe.medical_10_${level}`, emoji: '💉' },
                { label: '500 BuddyPass XP', description: 'Grant 500 XP towards leveling', value: `xp_500_${level}`, emoji: '⭐' },
                { label: '1000 BuddyPass XP', description: 'Grant 1000 XP towards leveling', value: `xp_1000_${level}`, emoji: '⭐' },
                { label: '5000 BuddyPass XP (Mega Boost)', description: 'Grant 5000 XP towards leveling', value: `xp_5000_${level}`, emoji: '🌟' }
            ];

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('bp_reward_dropdown_select').setPlaceholder(`Choose reward for Level ${level}...`).addOptions(rewardOptions)
            );

            return interaction.reply({ content: `🎁 **BuddyPass Level ${level} Manager:** Select a preloaded reward from the dropdown below:`, components: [row], flags: 64 });
        }
    }
};