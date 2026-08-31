const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig, Giveaway } = require('../database/db');
const adminHandler = require('./adminHandler');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

    if (customId === 'admin_menu_back') {
        if (adminHandler && adminHandler.renderMainPanel) {
            return await adminHandler.renderMainPanel(interaction);
        }
        return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
    }

    if (customId === 'admin_menu_select' && selectedValue === 'setup_giveaways') {
        const embed = new EmbedBuilder().setTitle('🎉 Giveaway Manager').setDescription('Manage your server giveaways.').setColor('#9b59b6');
        
        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('giveaway_action_select').setPlaceholder('Select a giveaway action...')
            .addOptions([
                { label: 'Start Giveaway', value: 'ga_start', emoji: '🚀' }, 
                { label: 'Set Default Channel', value: 'ga_channel', emoji: '📺' }, 
                { label: 'Set Ping Role', value: 'ga_ping_role', description: 'Select the role to ping (e.g. Server Member)', emoji: '🔔' },
                { label: 'Set Default Banner', value: 'ga_banner', emoji: '🖼️' }, 
                { label: 'Reroll Winner', value: 'ga_reroll', emoji: '🎲' }, 
                { label: 'View Participants', value: 'ga_players', emoji: '👥' }, 
                { label: 'Cancel Giveaway', value: 'ga_cancel', emoji: '❌' }
            ])
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
        );

        return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
    }

    if (customId === 'select_giveaway_channel') {
        await GuildConfig.upsert({ guildId: interaction.guild.id, giveawayChannelId: interaction.values[0] });
        return interaction.update({ content: `✅ Default Giveaway channel linked!`, components: [] });
    }

    if (customId === 'select_ga_ping_role') {
        await GuildConfig.upsert({ guildId: interaction.guild.id, giveawayPingRoleId: interaction.values[0] });
        return interaction.update({ content: `✅ Giveaway ping role successfully linked!`, components: [] });
    }

    if (customId.startsWith('select_ga_reroll_')) {
        const gaId = customId.replace('select_ga_reroll_', '');
        const ga = await Giveaway.findByPk(gaId);
        if (!ga) return interaction.reply({ content: '❌ Giveaway not found.', flags: 64 });
        
        let entries = JSON.parse(ga.entries || '[]').filter(id => id !== interaction.values[0]);
        await ga.update({ entries: JSON.stringify(entries) });
        
        if (entries.length === 0) return interaction.reply({ content: '❌ No valid entries left to reroll.', flags: 64 });
        
        const newWinner = entries[Math.floor(Math.random() * entries.length)];
        const channel = client.channels.cache.get(ga.channelId);
        if (channel) channel.send(`🎲 **Giveaway Rerolled!** (ID: #${ga.id})\n<@${interaction.values[0]}> was replaced by our new winner: <@${newWinner}>! 🎉`);
        
        return interaction.update({ content: `✅ Rerolled successfully!`, components: [] });
    }

    if (customId === 'giveaway_action_select') {
        if (selectedValue === 'ga_start') {
            const modal = new ModalBuilder().setCustomId('modal_ga_start').setTitle('Start Giveaway');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('prize').setLabel("Prize").setStyle(TextInputStyle.Short).setRequired(true)), 
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('minutes').setLabel("Duration in Minutes").setStyle(TextInputStyle.Short).setRequired(true)), 
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('winners').setLabel("Number of Winners").setStyle(TextInputStyle.Short).setValue('1').setRequired(true))
            );
            return interaction.showModal(modal);
        }
        if (selectedValue === 'ga_channel') return interaction.reply({ content: '📺 Select default giveaway channel:', components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('select_giveaway_channel').setPlaceholder('Select Channel...'))], flags: 64 });
        
        if (selectedValue === 'ga_ping_role') {
            return interaction.reply({ 
                content: '🔔 Select the role to ping when a giveaway starts (e.g. your Server Member role):', 
                components: [new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('select_ga_ping_role').setPlaceholder('Select Role...'))], 
                flags: 64 
            });
        }

        if (selectedValue === 'ga_banner') {
            const modal = new ModalBuilder().setCustomId('modal_ga_banner').setTitle('Set Banner URL');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('banner_url').setLabel("Image URL").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'ga_reroll') {
            const modal = new ModalBuilder().setCustomId('modal_ga_reroll').setTitle('Reroll Giveaway');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ga_id').setLabel("Giveaway ID (e.g. 1, 2, 3)").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'ga_cancel') {
            const modal = new ModalBuilder().setCustomId('modal_ga_cancel').setTitle('Cancel Giveaway');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ga_id').setLabel("Giveaway ID (e.g. 1, 2, 3)").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (selectedValue === 'ga_players') {
            const modal = new ModalBuilder().setCustomId('modal_ga_players').setTitle('View Participants');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ga_id').setLabel("Giveaway ID (e.g. 1, 2, 3)").setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
    }

    if (customId === 'enter_giveaway') {
        const giveaway = await Giveaway.findOne({ where: { messageId: interaction.message.id } });
        // Assume active if isActive is null (in case of old databases) or true
        if (!giveaway || giveaway.isActive === false) return interaction.reply({ content: '❌ This giveaway has ended or does not exist!', flags: 64 });
        
        let entries = [];
        try { entries = JSON.parse(giveaway.entries || '[]'); } catch (e) {}

        if (!entries.includes(interaction.user.id)) { 
            entries.push(interaction.user.id); 
            await giveaway.update({ entries: JSON.stringify(entries) }); 
            return interaction.reply({ content: `🎉 You have successfully entered the giveaway for **${giveaway.prize}**! Good luck!`, flags: 64 });
        } else {
            return interaction.reply({ content: '❌ You are already entered into this giveaway!', flags: 64 });
        }
    }

    if (interaction.isModalSubmit()) {
        if (customId === 'modal_ga_start') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const targetChannelId = config?.giveawayChannelId || interaction.channel.id;
            const targetChannel = client.channels.cache.get(targetChannelId) || await client.channels.fetch(targetChannelId).catch(() => null);
            
            if (!targetChannel) return interaction.reply({ content: '❌ Error: Could not find the default giveaway channel. Please set it again in the Giveaway Manager.', flags: 64 });

            const minutes = parseInt(interaction.fields.getTextInputValue('minutes')) || 60;
            const winners = parseInt(interaction.fields.getTextInputValue('winners')) || 1;
            const prize = interaction.fields.getTextInputValue('prize');
            const endTime = new Date(Date.now() + minutes * 60000);

            const embed = new EmbedBuilder()
                .setTitle('🎉 GIVEAWAY TIME 🎉')
                .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endTime.getTime()/1000)}:R>`)
                .setColor('#9b59b6')
                .setFooter({ text: 'Giveaway ID: Pending... | Click below to enter!' });

            if (config?.giveawayBannerUrl) embed.setImage(config.giveawayBannerUrl);
            
            // Generate the ping text based on config
            let pingText = '🎊 **New Giveaway Started!**';
            if (config?.giveawayPingRoleId) {
                pingText += ` <@&${config.giveawayPingRoleId}>`;
            }
            
            const msg = await targetChannel.send({ 
                content: pingText,
                embeds: [embed], 
                components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('enter_giveaway').setLabel('Enter Giveaway').setStyle(ButtonStyle.Success).setEmoji('🎁'))] 
            });
            
            // 👇 Reverted to original .create structure to prevent DB crashes 👇
            const ga = await Giveaway.create({ 
                messageId: msg.id, 
                guildId: interaction.guild.id, 
                channelId: targetChannel.id, 
                prize: prize, 
                endTime: endTime, 
                winnersCount: winners 
            });
            
            const displayId = ga?.id || msg.id.slice(-4);
            
            embed.setFooter({ text: `Giveaway ID: #${displayId} | Click the button below to enter!` });
            await msg.edit({ embeds: [embed] }).catch(() => {});

            return interaction.reply({ content: `✅ Giveaway successfully started in <#${targetChannel.id}>!\n**Giveaway ID:** \`#${displayId}\``, flags: 64 });
        }

        if (customId === 'modal_ga_banner') {
            await GuildConfig.upsert({ guildId: interaction.guild.id, giveawayBannerUrl: interaction.fields.getTextInputValue('banner_url') });
            return interaction.reply({ content: `✅ Giveaway banner URL successfully updated!`, flags: 64 });
        }

        const fetchGiveawaySafely = async (input) => {
            let ga = null;
            if (!isNaN(input)) { ga = await Giveaway.findOne({ where: { id: parseInt(input), guildId: interaction.guild.id } }).catch(() => null); }
            if (!ga) { ga = await Giveaway.findOne({ where: { messageId: input, guildId: interaction.guild.id } }).catch(() => null); }
            return ga;
        };

        if (customId === 'modal_ga_reroll') {
            const inputId = interaction.fields.getTextInputValue('ga_id').trim();
            const ga = await fetchGiveawaySafely(inputId);
            
            if (!ga) return interaction.reply({ content: '❌ Giveaway not found. Make sure you entered a valid Giveaway ID (e.g. 1).', flags: 64 });
            return interaction.reply({ content: `🎲 Select the winner you want to replace for **Giveaway #${ga.id || inputId}**:`, components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`select_ga_reroll_${ga.id || ga.messageId}`).setPlaceholder('Select winner to replace...'))], flags: 64 });
        }

        if (customId === 'modal_ga_cancel') {
            const inputId = interaction.fields.getTextInputValue('ga_id').trim();
            const ga = await fetchGiveawaySafely(inputId);
            
            if (!ga) return interaction.reply({ content: '❌ Giveaway not found. Make sure you entered a valid Giveaway ID (e.g. 1).', flags: 64 });
            
            await ga.update({ isActive: false });
            return interaction.reply({ content: `✅ Giveaway **#${ga.id || inputId}** (${ga.prize}) has been successfully cancelled.`, flags: 64 });
        }

        if (customId === 'modal_ga_players') {
            const inputId = interaction.fields.getTextInputValue('ga_id').trim();
            const ga = await fetchGiveawaySafely(inputId);
            
            if (!ga) return interaction.reply({ content: '❌ Giveaway not found. Make sure you entered a valid Giveaway ID (e.g. 1).', flags: 64 });
            
            let entries = [];
            try { entries = JSON.parse(ga.entries || '[]'); } catch(e) {}

            if (entries.length === 0) return interaction.reply({ content: `👥 **Participants for Giveaway #${ga.id || inputId}:** None yet!`, flags: 64 });
            
            return interaction.reply({ content: `👥 **Participants for #${ga.id || inputId} (${entries.length}):**\n${entries.map(id => `<@${id}>`).join(', ')}`, flags: 64 });
        }
    }
};