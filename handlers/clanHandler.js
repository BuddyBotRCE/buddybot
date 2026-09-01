const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { GuildConfig, UserEconomy, Clan, ClanMember, ClanInvite, GameServer } = require('../database/db');
const adminHandler = require('./adminHandler');

async function renderClanHub(interaction, member, editMode = false) {
    const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
    const currency = config?.economyCurrency || 'Scrap';
    const memberData = await ClanMember.findOne({ where: { guildId: interaction.guild.id, userId: member.user.id } });

    if (!memberData) {
        const invites = await ClanInvite.count({ where: { guildId: interaction.guild.id, userId: member.user.id } });
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Clan System')
            .setDescription(`You are currently not in a clan.\n\nCreate your own clan for **${config?.clanCreationCost || 1000} ${currency}**, or check if you have any pending invites.`)
            .setColor('#3498db');
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_clan_create').setLabel('Create Clan').setStyle(ButtonStyle.Success).setEmoji('➕'),
            new ButtonBuilder().setCustomId('btn_clan_invites').setLabel(`View Invites (${invites})`).setStyle(ButtonStyle.Secondary).setEmoji('📩'),
            new ButtonBuilder().setCustomId('btn_clan_leaderboard').setLabel('Top Clans').setStyle(ButtonStyle.Primary).setEmoji('🏆')
        );

        if (editMode) return interaction.editReply({ embeds: [embed], components: [row], content: null });
        if (interaction.replied || interaction.deferred) return interaction.followUp({ embeds: [embed], components: [row], flags: 64 });
        return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    }

    const clan = await Clan.findByPk(memberData.clanId);
    if (!clan) return interaction.reply({ content: '❌ Clan data corrupted.', flags: 64 });
    
    const memberCount = await ClanMember.count({ where: { clanId: clan.id } });
    const embed = new EmbedBuilder()
        .setTitle(`🛡️ ${clan.tag} ${clan.name}`)
        .setDescription(`**Your Role:** ${memberData.role}\n**Members:** ${memberCount} / ${clan.maxMembers}\n**Clan Bank:** ${clan.bankBalance} ${currency}\n**Tax Rate:** ${clan.taxRate}%`)
        .setColor('#f1c40f');

    if (memberData.role === 'Leader') {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`btn_clan_invite_${clan.id}`).setLabel('Invite Player').setStyle(ButtonStyle.Success).setEmoji('📩'),
            new ButtonBuilder().setCustomId(`btn_clan_manage_${clan.id}`).setLabel('Manage Members').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
            new ButtonBuilder().setCustomId(`btn_clan_bank_${clan.id}`).setLabel('Clan Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦')
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`btn_clan_codes_${clan.id}`).setLabel('Base Codes').setStyle(ButtonStyle.Secondary).setEmoji('🔐'),
            new ButtonBuilder().setCustomId(`btn_clan_wars_${clan.id}`).setLabel('Clan Wars').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId(`btn_clan_disband_${clan.id}`).setLabel('Disband Clan').setStyle(ButtonStyle.Danger).setEmoji('⚠️')
        );
        if (editMode) return interaction.editReply({ embeds: [embed], components: [row1, row2], content: null });
        return interaction.update({ embeds: [embed], components: [row1, row2], content: null });
    } else {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`btn_clan_bank_${clan.id}`).setLabel('Clan Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
            new ButtonBuilder().setCustomId(`btn_clan_codes_${clan.id}`).setLabel('View Base Codes').setStyle(ButtonStyle.Secondary).setEmoji('🔐'),
            new ButtonBuilder().setCustomId(`btn_clan_leave_${clan.id}`).setLabel('Leave Clan').setStyle(ButtonStyle.Danger).setEmoji('🚪')
        );
        if (editMode) return interaction.editReply({ embeds: [embed], components: [row1], content: null });
        return interaction.update({ embeds: [embed], components: [row1], content: null });
    }
}

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';
        const guildId = interaction.guild.id;

        if (customId === 'admin_menu_back') {
            if (adminHandler && adminHandler.renderMainPanel) {
                return await adminHandler.renderMainPanel(interaction);
            }
            return interaction.update({ content: '🔙 Returned to main dashboard.', embeds: [], components: [] });
        }

        if (customId === 'admin_menu_select' && selectedValue === 'setup_clans') {
            const config = await GuildConfig.findOne({ where: { guildId } });
            const activeClans = await Clan.count({ where: { guildId } });
            const currency = config?.economyCurrency || 'Scrap';

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Clan System Manager')
                .setDescription(`Configure server clan limits, creation costs, and automatic Discord channel syncing.\n\n• **Active Clans:** ${activeClans}\n• **Creation Cost:** ${config?.clanCreationCost || 1000} ${currency}\n• **Default Max Members:** ${config?.clanDefaultMaxMembers || 4}\n• **Discord Auto-Sync:** ${config?.clanDiscordSyncEnabled ? '🟢 Enabled' : '🔴 Disabled'}`)
                .setColor('#3498db');
            
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_clan_settings').setLabel('Configure Clan Settings').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
                new ButtonBuilder().setCustomId('btn_clan_toggle_sync').setLabel(config?.clanDiscordSyncEnabled ? 'Disable Discord Sync' : 'Enable Discord Sync').setStyle(config?.clanDiscordSyncEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('🔄')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
            );

            return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
        }

        if (interaction.isButton()) {
            if (customId === 'btn_clan_settings') {
                const config = await GuildConfig.findOne({ where: { guildId } });
                const modal = new ModalBuilder().setCustomId('modal_clan_config').setTitle('Clan Creation Settings');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cost').setLabel("Creation Cost (e.g. 1000)").setStyle(TextInputStyle.Short).setValue(`${config?.clanCreationCost || 1000}`).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('max_members').setLabel("Default Max Members (e.g. 4 or 8)").setStyle(TextInputStyle.Short).setValue(`${config?.clanDefaultMaxMembers || 4}`).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (customId === 'btn_clan_toggle_sync') {
                let [config] = await GuildConfig.findOrCreate({ where: { guildId } });
                const newState = !(config?.clanDiscordSyncEnabled || false);
                await config.update({ clanDiscordSyncEnabled: newState });
                return interaction.reply({ content: `✅ Discord Auto-Sync for clans has been turned **${newState ? 'ON 🟢' : 'OFF 🔴'}**!`, flags: 64 });
            }

            if (customId === 'hub_clans') {
                const userProfile = await UserEconomy.findOne({ where: { guildId, userId: interaction.user.id } });
                if (!userProfile || !userProfile.inGameName) {
                    return interaction.reply({ content: '❌ You must link your Rust account first using `/playerpanel` before using the Clan system!', flags: 64 });
                }
                return await renderClanHub(interaction, interaction.member);
            }

            if (customId === 'btn_clan_create') {
                const config = await GuildConfig.findOne({ where: { guildId } });
                const user = await UserEconomy.findOne({ where: { guildId, userId: interaction.user.id } });
                const currency = config?.economyCurrency || 'Scrap';
                
                if (!user || user.wallet < (config?.clanCreationCost || 1000)) {
                    return interaction.reply({ content: `❌ You need **${config?.clanCreationCost || 1000} ${currency}** in your wallet to create a clan!`, flags: 64 });
                }

                const modal = new ModalBuilder().setCustomId('modal_clan_create').setTitle('Create Your Clan');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('clan_name').setLabel("Full Clan Name").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('clan_tag').setLabel("Clan Tag (e.g. [BEST]) - Max 4 Chars").setStyle(TextInputStyle.Short).setMaxLength(6).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (customId === 'clan_modal_dep' || customId === 'clan_modal_with') {
                const action = customId === 'clan_modal_dep' ? 'deposit' : 'withdraw';
                const modal = new ModalBuilder().setCustomId(`modal_clan_bank_${action}`).setTitle(`Clan Bank - ${action.toUpperCase()}`);
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel("Amount (or type 'all')").setStyle(TextInputStyle.Short).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (customId.startsWith('btn_clan_bank_')) {
                const memberData = await ClanMember.findOne({ where: { guildId, userId: interaction.user.id } });
                const clan = await Clan.findByPk(memberData.clanId);
                const user = await UserEconomy.findOne({ where: { guildId, userId: interaction.user.id } });
                const config = await GuildConfig.findOne({ where: { guildId } });
                const currency = config?.economyCurrency || 'Scrap';

                const embed = new EmbedBuilder()
                    .setTitle(`🏦 Clan Bank: ${clan.name}`)
                    .setDescription(`• **Clan Bank Balance:** ${clan.bankBalance} ${currency}\n• **Your Wallet Balance:** ${user?.wallet || 0} ${currency}\n\nClick an option below to deposit or withdraw funds:`)
                    .setColor('#2ecc71');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('clan_modal_dep').setLabel('Deposit').setStyle(ButtonStyle.Success).setEmoji('📥'),
                    new ButtonBuilder().setCustomId('clan_modal_with').setLabel('Withdraw').setStyle(ButtonStyle.Primary).setEmoji('📤')
                );

                return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
            }

            if (customId.startsWith('btn_clan_manage_')) {
                const memberData = await ClanMember.findOne({ where: { guildId, userId: interaction.user.id } });
                const members = await ClanMember.findAll({ where: { clanId: memberData.clanId } });
                const memberList = members.map(m => `• <@${m.userId}> — \`${m.role}\``).join('\n');

                const embed = new EmbedBuilder().setTitle('👥 Manage Clan Members').setDescription(`**Roster:**\n${memberList}`).setColor('#3498db');
                const kickOptions = members.filter(m => m.userId !== interaction.user.id).map(m => ({ label: `Kick member ID: ${m.userId.substring(0, 10)}...`, value: `kick_${m.userId}` }));
                
                const row = kickOptions.length > 0 ? new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('select_clan_kick').setPlaceholder('Select a member to kick...').addOptions(kickOptions)
                ) : null;

                return interaction.reply({ embeds: [embed], components: row ? [row] : [], flags: 64 });
            }

            if (customId.startsWith('btn_clan_wars_')) {
                const embed = new EmbedBuilder()
                    .setTitle('⚔️ Clan Wars Hub')
                    .setDescription(`Clan Wars are currently in **Pre-Season / Development**. Soon you will be able to declare war on rival clans, compete for territory, and raid rival clan banks!`)
                    .setColor('#e74c3c');
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            if (customId.startsWith('btn_clan_invite_')) {
                const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('select_clan_invite_target').setPlaceholder('Select player to invite to your clan...'));
                return interaction.reply({ content: '📩 **Invite Player:** Select a user from the list below:', components: [row], flags: 64 });
            }

            if (customId.startsWith('btn_clan_leave_') || customId.startsWith('btn_clan_disband_')) {
                const memberData = await ClanMember.findOne({ where: { guildId, userId: interaction.user.id } });
                if (!memberData) return interaction.reply({ content: '❌ You are not in a clan.', flags: 64 });

                if (memberData.role === 'Leader') {
                    const clan = await Clan.findByPk(memberData.clanId);
                    if (clan.discordRoleId) {
                        await interaction.guild.roles.delete(clan.discordRoleId).catch(() => {});
                        await interaction.guild.channels.delete(clan.discordTextChannelId).catch(() => {});
                        await interaction.guild.channels.delete(clan.discordVoiceChannelId).catch(() => {});
                    }
                    await ClanMember.destroy({ where: { clanId: clan.id } });
                    await clan.destroy();
                    return interaction.update({ content: `⚠️ Your clan has been successfully disbanded.`, embeds: [], components: [] });
                } else {
                    await memberData.destroy();
                    return interaction.update({ content: `🚪 You have successfully left your clan.`, embeds: [], components: [] });
                }
            }

            if (customId.startsWith('btn_clan_codes_')) {
                const memberData = await ClanMember.findOne({ where: { guildId, userId: interaction.user.id } });
                const clan = await Clan.findByPk(memberData.clanId);
                const embed = new EmbedBuilder().setTitle(`🔐 Base Codes: ${clan.name}`).setDescription(`• **Door Code:** \`${clan.doorCode || 'Not Set'}\`\n• **Cupboard Code:** \`${clan.tcCode || 'Not Set'}\``).setColor('#3498db');
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_clan_set_codes').setLabel('Update Codes').setStyle(ButtonStyle.Primary));
                return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
            }

            if (customId === 'btn_clan_set_codes') {
                const modal = new ModalBuilder().setCustomId('modal_clan_update_codes').setTitle('Update Base Codes');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('door').setLabel("Door Code (e.g. 1234)").setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tc').setLabel("Tool Cupboard Code").setStyle(TextInputStyle.Short).setRequired(true))
                );
                return interaction.showModal(modal);
            }
        }

        if (interaction.isUserSelectMenu()) {
            if (customId === 'select_clan_invite_target') {
                const targetUserId = interaction.values[0];
                const memberData = await ClanMember.findOne({ where: { guildId, userId: interaction.user.id } });
                
                await ClanInvite.create({ guildId, clanId: memberData.clanId, userId: targetUserId });
                return interaction.reply({ content: `✅ Successfully sent a clan invite to <@${targetUserId}>!`, flags: 64 });
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (customId === 'select_clan_kick') {
                const targetUserId = selectedValue.replace('kick_', '');
                await ClanMember.destroy({ where: { guildId, userId: targetUserId } });
                return interaction.update({ content: `✅ Successfully kicked member from the clan.`, components: [] });
            }
        }

        if (interaction.isModalSubmit()) {
            if (customId === 'modal_clan_config') {
                const cost = parseInt(interaction.fields.getTextInputValue('cost')) || 1000;
                const maxMembers = parseInt(interaction.fields.getTextInputValue('max_members')) || 4;
                await GuildConfig.upsert({ guildId, clanCreationCost: cost, clanDefaultMaxMembers: maxMembers });
                return interaction.reply({ content: `✅ Clan creation settings updated!`, flags: 64 });
            }

            if (customId === 'modal_clan_create') {
                await interaction.deferReply({ flags: 64 });
                const config = await GuildConfig.findOne({ where: { guildId } });
                const user = await UserEconomy.findOne({ where: { guildId, userId: interaction.user.id } });
                const currency = config?.economyCurrency || 'Scrap';
                
                if (!user || user.wallet < (config?.clanCreationCost || 1000)) {
                    return interaction.editReply({ content: `❌ You do not have enough funds to create a clan.` });
                }

                const rawName = interaction.fields.getTextInputValue('clan_name').trim();
                const rawTag = interaction.fields.getTextInputValue('clan_tag').trim().toUpperCase();

                const existingClan = await Clan.findOne({ where: { guildId, tag: rawTag } });
                if (existingClan) {
                    return interaction.editReply({ content: `❌ The clan tag **${rawTag}** is already taken!` });
                }

                let roleId = null; let textId = null; let voiceId = null;

                if (config?.clanDiscordSyncEnabled) {
                    try {
                        const newRole = await interaction.guild.roles.create({ name: `${rawTag} Member`, color: '#e67e22', reason: 'Clan Creation Auto-Sync' });
                        roleId = newRole.id;
                        await interaction.member.roles.add(newRole);

                        const category = await interaction.guild.channels.create({
                            name: `🛡️ ${rawTag} Clan`, type: ChannelType.GuildCategory,
                            permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: newRole.id, allow: [PermissionFlagsBits.ViewChannel] }]
                        });

                        const textChan = await interaction.guild.channels.create({ name: 'clan-chat', type: ChannelType.GuildText, parent: category.id });
                        const voiceChan = await interaction.guild.channels.create({ name: 'Clan Voice', type: ChannelType.GuildVoice, parent: category.id });
                        textId = textChan.id; voiceId = voiceChan.id;
                    } catch (err) { console.error('[CLAN SYNC ERROR]', err); }
                }

                await user.update({ wallet: user.wallet - (config?.clanCreationCost || 1000) });
                
                const newClan = await Clan.create({
                    guildId, name: rawName, tag: rawTag, leaderId: interaction.user.id, maxMembers: config?.clanDefaultMaxMembers || 4, discordRoleId: roleId, discordTextChannelId: textId, discordVoiceChannelId: voiceId
                });

                await ClanMember.create({ guildId, userId: interaction.user.id, clanId: newClan.id, role: 'Leader' });

                return await renderClanHub(interaction, interaction.member, true);
            }

            if (customId === 'modal_clan_update_codes') {
                const door = interaction.fields.getTextInputValue('door').trim();
                const tc = interaction.fields.getTextInputValue('tc').trim();
                const memberData = await ClanMember.findOne({ where: { guildId, userId: interaction.user.id } });
                await Clan.update({ doorCode: door, tcCode: tc }, { where: { id: memberData.clanId } });
                return interaction.reply({ content: `✅ Base codes successfully updated!`, flags: 64 });
            }

            if (customId === 'modal_clan_bank_deposit' || customId === 'modal_clan_bank_withdraw') {
                const isDeposit = (customId === 'modal_clan_bank_deposit');
                const input = interaction.fields.getTextInputValue('amount').trim().toLowerCase();
                
                const memberData = await ClanMember.findOne({ where: { guildId, userId: interaction.user.id } });
                const clan = await Clan.findByPk(memberData.clanId);
                const user = await UserEconomy.findOne({ where: { guildId, userId: interaction.user.id } });
                const config = await GuildConfig.findOne({ where: { guildId } });
                const currency = config?.economyCurrency || 'Scrap';

                if (isDeposit) {
                    let amount = input === 'all' ? user.wallet : parseInt(input);
                    if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Please enter a valid number.', flags: 64 });
                    if (user.wallet < amount) return interaction.reply({ content: `❌ You only have **${user.wallet} ${currency}** in your wallet!`, flags: 64 });

                    await user.update({ wallet: user.wallet - amount });
                    await clan.update({ bankBalance: clan.bankBalance + amount });
                    return interaction.reply({ content: `🏦 Successfully deposited **${amount} ${currency}** into the clan bank!`, flags: 64 });
                } else {
                    if (memberData.role !== 'Leader') return interaction.reply({ content: `❌ Only the clan leader can withdraw funds from the clan bank!`, flags: 64 });
                    let amount = input === 'all' ? clan.bankBalance : parseInt(input);
                    if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '❌ Please enter a valid number.', flags: 64 });
                    if (clan.bankBalance < amount) return interaction.reply({ content: `❌ The clan bank only has **${clan.bankBalance} ${currency}**!`, flags: 64 });

                    await clan.update({ bankBalance: clan.bankBalance - amount });
                    await user.update({ wallet: user.wallet + amount });
                    return interaction.reply({ content: `🏧 Successfully withdrew **${amount} ${currency}** from the clan bank to your wallet!`, flags: 64 });
                }
            }
        }
    } catch (error) {
        console.error('[CLAN HANDLER ERROR]', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ An error occurred while processing the clan request.', flags: 64 }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ An error occurred while processing the clan request.', flags: 64 }).catch(() => {});
        }
    }
};