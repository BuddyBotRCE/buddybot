const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { GuildConfig } = require('../database/db');

const amSessions = new Map();

const AM_MODULES = {
    caps: { name: '🔠 Anti-Caps', dbPrefix: 'amCaps', hasLimit: true, limitLabel: 'Max Caps % (e.g. 70)' },
    spam: { name: '📢 Anti-Spam', dbPrefix: 'amSpam', hasLimit: true, limitLabel: 'Max msgs per 5s (e.g. 5)' },
    mentions: { name: '🏷️ Mass Mentions', dbPrefix: 'amMentions', hasLimit: true, limitLabel: 'Max Pings Allowed (e.g. 4)' },
    link: { name: '🔗 Anti-Link', dbPrefix: 'amLink', hasLimit: false },
    invite: { name: '🛑 Anti-Invite', dbPrefix: 'amInvite', hasLimit: false },
    words: { name: '🤬 Banned Words', dbPrefix: 'amWords', hasLimit: true, limitLabel: 'Words (comma separated)' }
};

const ACTION_LABELS = {
    delete: '🗑️ Delete Message',
    warn: '⚠️ Warn & Delete',
    timeout_5m: '⏳ Timeout (5m)',
    timeout_1h: '⏳ Timeout (1h)',
    timeout_24h: '⏳ Timeout (24h)',
    ban: '🔨 Ban User'
};

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        
        let selectedValue = '';
        if (interaction.isStringSelectMenu()) selectedValue = interaction.values[0] || '';

        if (!amSessions.has(guildId)) {
            amSessions.set(guildId, { selectedModule: null, selectedAction: 'delete' });
        }
        const session = amSessions.get(guildId);

        const renderAutoModPanel = async (inter, messageOverride = '') => {
            let [config] = await GuildConfig.findOrCreate({ where: { guildId: inter.guild.id } });

            let statusBoard = '';
            for (const [key, data] of Object.entries(AM_MODULES)) {
                const isEnabled = config[`${data.dbPrefix}Enabled`];
                const action = ACTION_LABELS[config[`${data.dbPrefix}Action`]] || 'Unknown';
                const limitStr = data.hasLimit ? ` | Limit: ${config[`${data.dbPrefix}Limit`] || (key === 'words' ? 'Configured' : 'Default')}` : '';
                statusBoard += `${isEnabled ? '🟢' : '🔴'} **${data.name}:** ${isEnabled ? `Enabled (${action}${limitStr})` : 'Disabled'}\n`;
            }

            const activeMod = session.selectedModule ? AM_MODULES[session.selectedModule].name : 'None Selected';
            const activeAction = session.selectedAction ? ACTION_LABELS[session.selectedAction] : 'None';

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Auto-Moderation Suite')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Select a module to configure its punishment and limits.\n\n**Live Status Board:**\n${statusBoard}\n\n**Currently Editing:** \`${activeMod}\`\n**Pending Action:** \`${activeAction}\``)
                .setColor('#e74c3c');

            const moduleRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('am_module_select')
                    .setPlaceholder('1. Select Module to Edit...')
                    .addOptions(Object.entries(AM_MODULES).map(([key, data]) => ({
                        label: data.name, value: key
                    })))
            );

            const actionRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('am_action_select')
                    .setPlaceholder('2. Select Punishment Action...')
                    .addOptions(Object.entries(ACTION_LABELS).map(([key, label]) => ({
                        label: label, value: key
                    })))
            );

            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_am_config').setLabel('Configure Limits').setStyle(ButtonStyle.Primary).setEmoji('⚙️').setDisabled(!session.selectedModule || !AM_MODULES[session.selectedModule].hasLimit),
                new ButtonBuilder().setCustomId('btn_am_save').setLabel('Save & Enable').setStyle(ButtonStyle.Success).setEmoji('✅').setDisabled(!session.selectedModule),
                new ButtonBuilder().setCustomId('btn_am_disable').setLabel('Disable Module').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(!session.selectedModule),
                new ButtonBuilder().setCustomId('btn_am_back').setLabel('Back to Admin').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
            );

            const payload = { embeds: [embed], components: [moduleRow, actionRow, btnRow], flags: 64 };

            if (inter.isRepliable() && !inter.replied && !inter.deferred) {
                return await inter.reply(payload);
            } else {
                return await inter.update(payload).catch(() => inter.followUp(payload));
            }
        };

        if (customId === 'admin_menu_select' && selectedValue === 'setup_automod') {
            session.selectedModule = null; 
            session.selectedAction = 'delete';
            amSessions.set(guildId, session);
            return await renderAutoModPanel(interaction);
        }

        if (interaction.isStringSelectMenu()) {
            if (customId === 'am_module_select') {
                session.selectedModule = selectedValue;
                amSessions.set(guildId, session);
                return await renderAutoModPanel(interaction);
            }
            if (customId === 'am_action_select') {
                session.selectedAction = selectedValue;
                amSessions.set(guildId, session);
                return await renderAutoModPanel(interaction);
            }
        }

        if (interaction.isButton()) {
            if (customId === 'btn_am_back') {
                return await interaction.update({ content: '🔙 Closed Auto-Mod setup. Type `/adminpanel` to return to the main menu.', embeds: [], components: [] });
            }

            if (customId === 'btn_am_disable') {
                const modData = AM_MODULES[session.selectedModule];
                await GuildConfig.update({ [`${modData.dbPrefix}Enabled`]: false }, { where: { guildId } });
                return await renderAutoModPanel(interaction, `🔴 Disabled ${modData.name}!`);
            }

            if (customId === 'btn_am_save') {
                const modData = AM_MODULES[session.selectedModule];
                await GuildConfig.update({ 
                    [`${modData.dbPrefix}Enabled`]: true,
                    [`${modData.dbPrefix}Action`]: session.selectedAction 
                }, { where: { guildId } });
                return await renderAutoModPanel(interaction, `✅ Saved and Enabled ${modData.name}!`);
            }

            if (customId === 'btn_am_config') {
                const modData = AM_MODULES[session.selectedModule];
                let [config] = await GuildConfig.findOrCreate({ where: { guildId } });
                
                const modal = new ModalBuilder().setCustomId(`modal_am_limit_${session.selectedModule}`).setTitle(`Configure ${modData.name}`);
                
                const isWords = session.selectedModule === 'words';
                const currentVal = isWords ? (config.amWordsList || '') : (config[`${modData.dbPrefix}Limit`] || '');

                const textInput = new TextInputBuilder()
                    .setCustomId('limit_value')
                    .setLabel(modData.limitLabel)
                    .setStyle(isWords ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setPlaceholder(isWords ? "badword1, badword2, badword3" : "Enter a number...")
                    .setValue(currentVal.toString())
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(textInput));
                return await interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit() && customId.startsWith('modal_am_limit_')) {
            const moduleKey = customId.replace('modal_am_limit_', '');
            const modData = AM_MODULES[moduleKey];
            const rawValue = interaction.fields.getTextInputValue('limit_value');
            
            let updateObj = {};
            if (moduleKey === 'words') {
                updateObj.amWordsList = rawValue.toLowerCase(); 
            } else {
                updateObj[`${modData.dbPrefix}Limit`] = parseInt(rawValue) || 0; 
            }

            await GuildConfig.update(updateObj, { where: { guildId } });
            return await renderAutoModPanel(interaction, `✅ Limits updated for ${modData.name}!`);
        }

    } catch (error) {
        console.error('[AUTO MOD HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred.', flags: 64 }).catch(() => {});
        }
    }
};