const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { GuildConfig, UserEconomy, Clan, ClanMember, ClanInvite } = require('../database/db');

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        // --- ADMIN SETUP HUB ---
        if (customId === 'admin_menu_select' && selectedValue === 'setup_clans') {
            const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
            const activeClans = await Clan.count({ where: { guildId: interaction.guild.id } });
            const currency = config?.economyCurrency || 'Scrap';

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Clan System Manager')
                .setDescription(`Configure server clan limits, creation costs, and automatic Discord channel syncing.\n\n• **Active Clans:** ${activeClans}\n• **Creation Cost:** ${config?.clanCreationCost || 1000} ${currency}\n• **Default Max Members:** ${config?.clanDefaultMaxMembers || 4}\n• **Discord Auto-Sync:** ${config?.clanDiscordSyncEnabled ? '🟢 Enabled' : '🔴 Disabled'}`)
                .setColor('#3498db');
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_clan_settings').setLabel('Configure Clan Settings').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
                new ButtonBuilder().setCustomId('btn_clan_toggle_sync').setLabel(config?.clanDiscordSyncEnabled ? 'Disable Discord Sync' : 'Enable Discord Sync').setStyle(config?.clanDiscordSyncEnabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji('🔄')
            );
            return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }

        // --- BUTTON CLICKS ---
        if (interaction.isButton()) {
            if (customId === 'btn_clan_settings') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const modal = new ModalBuilder().setCustomId('modal_clan_config').setTitle('Clan Creation Settings');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cost').setLabel("Creation Cost (e.g. 1000)").setStyle(TextInputStyle.Short).setValue(`${config?.clanCreationCost || 1000}`).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('max_members').setLabel("Default Max Members (e.g. 4 or 8)").setStyle(TextInputStyle.Short).setValue(`${config?.clanDefaultMaxMembers || 4}`).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (customId === 'btn_clan_toggle_sync') {
                let [config] = await GuildConfig.findOrCreate({ where: { guildId: interaction.guild.id } });
                const newState = !(config?.clanDiscordSyncEnabled || false);
                await config.update({ clanDiscordSyncEnabled: newState });
                return interaction.reply({ content: `✅ Discord Auto-Sync for clans has been turned **${newState ? 'ON 🟢' : 'OFF 🔴'}**!`, flags: 64 });
            }

            if (customId === 'hub_clans') {
                const userProfile = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                if (!userProfile || !userProfile.inGameName) {
                    return interaction.reply({ content: '❌ You must link your Rust account first using `/playerpanel` before using the Clan system!', flags: 64 });
                }

                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const currency = config?.economyCurrency || 'Scrap';
                const memberData = await ClanMember.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });

                if (!memberData) {
                    const invites = await ClanInvite.count({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                    
                    const embed = new EmbedBuilder()
                        .setTitle('🛡️ Clan System')
                        .setDescription(`You are currently not in a clan.\n\nCreate your own clan for **${config?.clanCreationCost || 1000} ${currency}**, or check if you have any pending invites.`)
                        .setColor('#3498db');
                    
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_clan_create').setLabel('Create Clan').setStyle(ButtonStyle.Success).setEmoji('➕'),
                        new ButtonBuilder().setCustomId('btn_clan_invites').setLabel(`View Invites (${invites})`).setStyle(ButtonStyle.Secondary).setEmoji('📩'),
                        new ButtonBuilder().setCustomId('btn_clan_leaderboard').setLabel('Top Clans').setStyle(ButtonStyle.Primary).setEmoji('🏆')
                    );
                    return interaction.reply({ embeds: [embed], components: [row], flags: 64 });
                } else {
                    const clan = await Clan.findByPk(memberData.clanId);
                    if (!clan) return interaction.reply({ content: '❌ Clan data corrupted. Please contact an admin.', flags: 64 });
                    
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
                        return interaction.reply({ embeds: [embed], components: [row1, row2], flags: 64 });
                    } else {
                        const row1 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`btn_clan_bank_${clan.id}`).setLabel('Clan Bank').setStyle(ButtonStyle.Primary).setEmoji('🏦'),
                            new ButtonBuilder().setCustomId(`btn_clan_codes_${clan.id}`).setLabel('View Base Codes').setStyle(ButtonStyle.Secondary).setEmoji('🔐'),
                            new ButtonBuilder().setCustomId(`btn_clan_leave_${clan.id}`).setLabel('Leave Clan').setStyle(ButtonStyle.Danger).setEmoji('🚪')
                        );
                        return interaction.reply({ embeds: [embed], components: [row1], flags: 64 });
                    }
                }
            }

            if (customId === 'btn_clan_create') {
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
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
        }

        // --- MODAL SUBMISSIONS ---
        if (interaction.isModalSubmit()) {
            if (customId === 'modal_clan_config') {
                const cost = parseInt(interaction.fields.getTextInputValue('cost')) || 1000;
                const maxMembers = parseInt(interaction.fields.getTextInputValue('max_members')) || 4;
                await GuildConfig.upsert({ guildId: interaction.guild.id, clanCreationCost: cost, clanDefaultMaxMembers: maxMembers });
                return interaction.reply({ content: `✅ Clan creation settings updated!`, flags: 64 });
            }

            if (customId === 'modal_clan_create') {
                await interaction.deferReply({ flags: 64 });
                const config = await GuildConfig.findOne({ where: { guildId: interaction.guild.id } });
                const user = await UserEconomy.findOne({ where: { guildId: interaction.guild.id, userId: interaction.user.id } });
                const currency = config?.economyCurrency || 'Scrap';
                
                if (!user || user.wallet < (config?.clanCreationCost || 1000)) {
                    return interaction.editReply({ content: `❌ You do not have enough funds to create a clan.` });
                }

                const rawName = interaction.fields.getTextInputValue('clan_name').trim();
                const rawTag = interaction.fields.getTextInputValue('clan_tag').trim().toUpperCase();

                const existingClan = await Clan.findOne({ where: { guildId: interaction.guild.id, tag: rawTag } });
                if (existingClan) {
                    return interaction.editReply({ content: `❌ The clan tag **${rawTag}** is already taken!` });
                }

                let roleId = null;
                let textId = null;
                let voiceId = null;

                if (config?.clanDiscordSyncEnabled) {
                    try {
                        const newRole = await interaction.guild.roles.create({ name: `${rawTag} Member`, color: '#e67e22', reason: 'Clan Creation Auto-Sync' });
                        roleId = newRole.id;
                        await interaction.member.roles.add(newRole);

                        const category = await interaction.guild.channels.create({
                            name: `🛡️ ${rawTag} Clan`,
                            type: ChannelType.GuildCategory,
                            permissionOverwrites: [
                                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                                { id: newRole.id, allow: [PermissionFlagsBits.ViewChannel] }
                            ]
                        });

                        const textChan = await interaction.guild.channels.create({ name: 'clan-chat', type: ChannelType.GuildText, parent: category.id });
                        const voiceChan = await interaction.guild.channels.create({ name: 'Clan Voice', type: ChannelType.GuildVoice, parent: category.id });
                        textId = textChan.id;
                        voiceId = voiceChan.id;
                    } catch (err) {
                        console.error('[CLAN SYNC ERROR]', err);
                    }
                }

                await user.update({ wallet: user.wallet - (config?.clanCreationCost || 1000) });
                
                const newClan = await Clan.create({
                    guildId: interaction.guild.id, name: rawName, tag: rawTag, leaderId: interaction.user.id, maxMembers: config?.clanDefaultMaxMembers || 4, discordRoleId: roleId, discordTextChannelId: textId, discordVoiceChannelId: voiceId
                });

                await ClanMember.create({ guildId: interaction.guild.id, userId: interaction.user.id, clanId: newClan.id, role: 'Leader' });

                return interaction.editReply({ content: `✅ Successfully created clan **${rawTag} ${rawName}**!` });
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