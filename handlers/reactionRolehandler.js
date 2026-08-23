const { EmbedBuilder, ActionRowBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { GuildConfig } = require('../database/db');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- ADMIN MENU SELECT ENTRY ---
        if (customId === 'admin_menu_select' && selectedValue === 'setup_verification') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Verification System Setup')
                .setDescription(`Configure automated server verification. When enabled, users must complete verification to unlock the rest of the server.\n\n• **Status:** ${config?.verificationEnabled ? '🟢 Enabled' : '🔴 Disabled'}\n• **Target Channel:** ${config?.verificationChannelId ? `<#${config.verificationChannelId}>` : '`Not Set`'}\n• **Verified Role:** ${config?.verificationRoleId ? `<@&${config.verificationRoleId}>` : '`Not Set`'}`)
                .setColor('#3498db');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_verify_toggle').setLabel(config?.verificationEnabled ? 'Disable Verification' : 'Enable Verification').setStyle(config?.verificationEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('btn_verify_deploy').setLabel('Deploy Verify Panel').setStyle(ButtonStyle.Primary).setEmoji('📦')
            );
            
            // Native Discord Select Menus for Channels and Roles
            const channelSelectRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_verify_channel')
                    .setPlaceholder('📂 Select Verification Channel...')
                    .addChannelTypes(ChannelType.GuildText)
            );

            const roleSelectRow = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('select_verify_role')
                    .setPlaceholder('m Select Role to Grant Upon Verification...')
            );

            return interaction.reply({ 
                embeds: [embed], 
                components: [row1, channelSelectRow, roleSelectRow], 
                flags: 64 
            });
        }

        // --- HANDLE CHANNEL SELECT MENU ---
        if (interaction.isChannelSelectMenu() && customId === 'select_verify_channel') {
            const channelId = interaction.values[0];
            await GuildConfig.upsert({ guildId: interaction.guild.id, verificationChannelId: channelId });
            return interaction.reply({ content: `✅ Verification channel successfully set to <#${channelId}>!`, flags: 64 });
        }

        // --- HANDLE ROLE SELECT MENU ---
        if (interaction.isRoleSelectMenu() && customId === 'select_verify_role') {
            const roleId = interaction.values[0];
            await GuildConfig.upsert({ guildId: interaction.guild.id, verificationRoleId: roleId });
            return interaction.reply({ content: `✅ Verified role successfully set to <@&${roleId}>!`, flags: 64 });
        }

        // --- TOGGLE VERIFICATION STATUS ---
        if (interaction.isButton() && customId === 'btn_verify_toggle') {
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
            const newState = !(config?.verificationEnabled || false);
            await config.update({ verificationEnabled: newState });
            return interaction.reply({ content: `✅ Verification system has been turned **${newState ? 'ON 🟢' : 'OFF 🔴'}**!`, flags: 64 });
        }

        // --- DEPLOY VERIFICATION PANEL ---
        if (interaction.isButton() && customId === 'btn_verify_deploy') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            if (!config || !config.verificationChannelId) {
                return interaction.reply({ content: '❌ Please select a verification channel using the dropdown menu first!', flags: 64 });
            }

            const targetChannel = interaction.guild.channels.cache.get(config.verificationChannelId);
            if (!targetChannel) {
                return interaction.reply({ content: '❌ Could not find the configured verification channel. Please re-select it.', flags: 64 });
            }

            const verifyEmbed = new EmbedBuilder()
                .setTitle('🔐 Server Verification')
                .setDescription('Welcome! To gain access to the rest of the server, please click the **Verify** button below to complete the verification process.')
                .setColor('#2ecc71')
                .setTimestamp();

            const verifyRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_execute_verification').setLabel('Verify').setStyle(ButtonStyle.Success).setEmoji('✅')
            );

            await targetChannel.send({ embeds: [verifyEmbed], components: [verifyRow] });
            return interaction.reply({ content: `✅ Successfully deployed the verification panel to <#${config.verificationChannelId}>!`, flags: 64 });
        }

        // --- USER CLICKS "VERIFY" BUTTON ON THE PANEL ---
        if (interaction.isButton() && customId === 'btn_execute_verification') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            if (!config || !config.verificationRoleId) {
                return interaction.reply({ content: '❌ Verification role is not configured by server administrators yet.', flags: 64 });
            }

            try {
                await interaction.member.roles.add(config.verificationRoleId);
                return interaction.reply({ content: '🎉 **You have been successfully verified!** Enjoy your stay.', flags: 64 });
            } catch (err) {
                console.error('[VERIFICATION ERROR]', err);
                return interaction.reply({ content: '❌ Failed to assign the verified role. Please check the bot’s role hierarchy permissions.', flags: 64 });
            }
        }

    } catch (error) {
        console.error('[VERIFICATION HANDLER ERROR]', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred processing the verification settings.', flags: 64 }).catch(() => {});
        }
    }
};