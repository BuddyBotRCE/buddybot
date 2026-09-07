const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { PrisonCell, JailedPlayer, PrisonLog, UserEconomy } = require('../database/db');
const { captureAdminPosition } = require('../utils/rconPosTracker');
const { sendRconCommand } = require('../utils/rconManager');

async function renderPrisonPanel(interaction, messageOverride = '') {
    const guildId = interaction.guild.id;
    const cells = await PrisonCell.findAll({ where: { guildId }, order: [['cellNumber', 'ASC']] });
    const jailed = await JailedPlayer.findAll({ where: { guildId } });

    let cellStatus = '';
    for (let i = 1; i <= 20; i++) {
        const found = cells.find(c => c.cellNumber === i);
        const hasRf = found && found.rfFrequency ? '📻' : '';
        cellStatus += found ? `🟢 \`${i}\`${hasRf} ` : `🔴 \`${i}\` `;
        if (i === 10) cellStatus += '\n';
    }

    let inmateList = jailed.length > 0 
        ? jailed.map(p => `• **${p.inGameName}** (Cell #${p.cellNumber}) — *${p.isTemp ? 'Temp (' + Math.ceil((new Date(p.expiresAt) - Date.now())/60000) + 'm left)' : 'Permanent'}* | Reason: \`${p.reason}\``).join('\n')
        : '*No prisoners currently locked up.*';

    const embed = new EmbedBuilder()
        .setTitle('🔒 Advanced Prison, Cells & RF Door Manager')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Manage 20 jail cells, inmate sentences, RF door frequencies, coordinate resets, and audit logs.\n\n` +
            `**Cell Map (1–20):**\n${cellStatus}\n*(🟢 Set + 📻 RF | 🔴 Unset)*\n\n` +
            `**Active Prisoners (${jailed.length}):**\n${inmateList}`
        )
        .setColor('#e74c3c');

    const cellOptions = [];
    for (let i = 1; i <= 20; i++) {
        const isSet = cells.some(c => c.cellNumber === i);
        cellOptions.push({ label: `Cell #${i} ${isSet ? '(Configured)' : '(Empty)'}`, value: `set_cell_${i}`, emoji: isSet ? '🟢' : '🔴' });
    }

    const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('prison_select_cell').setPlaceholder('📍 Select cell (1-20) to capture or update position...').addOptions(cellOptions.slice(0, 25))
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prison_btn_jail').setLabel('Jail Player').setStyle(ButtonStyle.Danger).setEmoji('⛓️'),
        new ButtonBuilder().setCustomId('prison_btn_unjail').setLabel('Release Player').setStyle(ButtonStyle.Success).setEmoji('🔓'),
        new ButtonBuilder().setCustomId('prison_btn_rf').setLabel('Set Cell RF').setStyle(ButtonStyle.Primary).setEmoji('📻'),
        new ButtonBuilder().setCustomId('prison_btn_reset_pos').setLabel('Reset Cell Pos').setStyle(ButtonStyle.Danger).setEmoji('♻️'),
        new ButtonBuilder().setCustomId('prison_btn_logs').setLabel('Logs').setStyle(ButtonStyle.Secondary).setEmoji('📋')
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Dashboard').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    const payload = { embeds: [embed], components: [row1, row2, row3], flags: 64 };
    
    if (interaction.isMessageComponent()) {
        if (interaction.replied || interaction.deferred) return await interaction.editReply(payload);
        else return await interaction.update(payload);
    } else {
        return await interaction.reply(payload);
    }
}

module.exports = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        const selectedVal = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';

        if (interaction.isStringSelectMenu() && selectedVal.startsWith('set_cell_')) {
            const cellNum = selectedVal.replace('set_cell_', '');
            await interaction.reply({ content: `📍 **Capturing your position for Cell #${cellNum} via RCON...**`, flags: 64 });
            return await captureAdminPosition(interaction, 'prison_cell', cellNum);
        }

        if (interaction.isButton() && customId === 'prison_btn_reset_pos') {
            const modal = new ModalBuilder().setCustomId('modal_prison_reset_pos').setTitle('Reset Cell Position');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reset_cell_num').setLabel('Cell Number to Wipe (1 - 20)').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isButton() && customId === 'prison_btn_jail') {
            const registeredPlayers = await UserEconomy.findAll({ where: { guildId } });
            const validPlayers = registeredPlayers.filter(p => p.inGameName && p.inGameName.trim() !== '');

            if (validPlayers.length === 0) {
                return interaction.reply({ content: '❌ **No players found!** Players must link their in-game name via `/playerpanel` first.', flags: 64 });
            }

            const options = validPlayers.slice(0, 25).map(p => ({
                label: p.inGameName.substring(0, 100),
                value: `jail_target_${p.inGameName}`
            }));

            const menu = new StringSelectMenuBuilder()
                .setCustomId('prison_select_jail_target')
                .setPlaceholder('Select player to sentence...')
                .addOptions(options);

            return interaction.reply({ content: '⛓️ **Prison System:** Select the player you wish to send to jail:', components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
        }

        if (interaction.isStringSelectMenu() && customId === 'prison_select_jail_target') {
            const targetName = selectedVal.replace('jail_target_', '');
            const modal = new ModalBuilder().setCustomId(`modal_prison_jail_exec_${targetName}`).setTitle(`Sentence: ${targetName}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('p_cell').setLabel('Cell Number (1 - 20)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('p_reason').setLabel('Mandatory Reason').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('p_mins').setLabel('Duration in Mins (Leave blank for Lifer)').setStyle(TextInputStyle.Short).setRequired(false))
            );
            return await interaction.showModal(modal);
        }

        // Set RF Frequency Modal Trigger
        if (interaction.isButton() && customId === 'prison_btn_rf') {
            const modal = new ModalBuilder().setCustomId('modal_prison_set_rf').setTitle('Configure Cell RF Frequency');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rf_cell').setLabel('Cell Number (1 - 20)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rf_freq').setLabel('RF Frequency (e.g. 8051)').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isButton() && customId === 'prison_btn_logs') {
            const logs = await PrisonLog.findAll({ where: { guildId }, order: [['createdAt', 'DESC']], limit: 10 });
            let logText = logs.length > 0
                ? logs.map(l => `• \`${new Date(l.createdAt).toLocaleTimeString()}\` | **${l.inGameName}** (Cell #${l.cellNumber}) — **${l.action}**\n> Reason: *${l.reason || 'None'}*`).join('\n\n')
                : '*No audit logs recorded yet.*';

            const embed = new EmbedBuilder().setTitle('📋 Prison Inspection & Audit Logs').setDescription(logText).setColor('#f39c12');
            return interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('prison_back_main').setLabel('Back').setStyle(ButtonStyle.Secondary))], flags: 64 });
        }

        if (interaction.isButton() && customId === 'prison_btn_unjail') {
            const modal = new ModalBuilder().setCustomId('modal_prison_unjail').setTitle('Release a Prisoner');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('p_name').setLabel('In-Game Exact Name to Release').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit()) {
            if (customId === 'modal_prison_reset_pos') {
                const cellNum = parseInt(interaction.fields.getTextInputValue('reset_cell_num'));
                const deleted = await PrisonCell.destroy({ where: { guildId, cellNumber: cellNum } });
                if (deleted) {
                    return await renderPrisonPanel(interaction, `♻️ Successfully wiped coordinates for Cell #${cellNum}. It is now unconfigured.`);
                } else {
                    return interaction.reply({ content: `❌ Cell #${cellNum} was already empty or not found.`, flags: 64 });
                }
            }

            if (customId.startsWith('modal_prison_jail_exec_')) {
                const targetName = customId.replace('modal_prison_jail_exec_', '');
                const cellNum = parseInt(interaction.fields.getTextInputValue('p_cell'));
                const reason = interaction.fields.getTextInputValue('p_reason').trim();
                const mins = parseInt(interaction.fields.getTextInputValue('p_mins'));

                const cellObj = await PrisonCell.findOne({ where: { guildId, cellNumber: cellNum } });
                if (!cellObj) {
                    return interaction.reply({ content: `❌ **Cell #${cellNum} has not been set up with coordinates yet!**`, flags: 64 });
                }

                const isTemp = !isNaN(mins) && mins > 0;
                const expiresAt = isTemp ? new Date(Date.now() + mins * 60000) : null;

                await JailedPlayer.upsert({ guildId, inGameName: targetName, reason, cellNumber: cellNum, isTemp, expiresAt, jailedBy: interaction.user.id });
                await PrisonLog.create({ guildId, inGameName: targetName, cellNumber: cellNum, action: 'JAILED', reason, wardenDiscordId: interaction.user.id });

                await sendRconCommand(guildId, `teleportpos (${cellObj.posX},${cellObj.posY},${cellObj.posZ}) "${targetName}"`, client);
                await sendRconCommand(guildId, `say "🔒 ${targetName} has been thrown into Cell #${cellNum} for: ${reason}!"`, client);

                return interaction.update({ content: `✅ Successfully jailed **${targetName}** in Cell #${cellNum}!\n*Reason: ${reason}*`, components: [] });
            }

            if (customId === 'modal_prison_set_rf') {
                const cellNum = parseInt(interaction.fields.getTextInputValue('rf_cell'));
                const rfFrequency = interaction.fields.getTextInputValue('rf_freq').trim();

                const cellObj = await PrisonCell.findOne({ where: { guildId, cellNumber: cellNum } });
                if (!cellObj) {
                    return interaction.reply({ content: `❌ Cell #${cellNum} does not exist yet. Capture its position first!`, flags: 64 });
                }

                await cellObj.update({ rfFrequency });
                return await renderPrisonPanel(interaction, `✅ Successfully linked RF Frequency \`${rfFrequency}\` to Cell #${cellNum}!`);
            }

            if (customId === 'modal_prison_unjail') {
                const name = interaction.fields.getTextInputValue('p_name').trim();
                const inmate = await JailedPlayer.findOne({ where: { guildId, inGameName: name } });
                
                if (inmate) {
                    const cellObj = await PrisonCell.findOne({ where: { guildId, cellNumber: inmate.cellNumber } });
                    if (cellObj && cellObj.rfFrequency) {
                        await sendRconCommand(guildId, `rf.trigger ${cellObj.rfFrequency}`, client);
                    }
                    await PrisonLog.create({ guildId, inGameName: name, cellNumber: inmate.cellNumber, action: 'RELEASED', reason: 'Manual Release by Staff', wardenDiscordId: interaction.user.id });
                }

                await JailedPlayer.destroy({ where: { guildId, inGameName: name } });
                await sendRconCommand(guildId, `say "🔓 ${name} has been released from prison!"`, client);

                return await renderPrisonPanel(interaction, `✅ Successfully released **${name}** and triggered their cell door!`);
            }
        }

        if (interaction.isButton() && (customId === 'admin_menu_back' || customId === 'prison_back_main')) {
            if (customId === 'admin_menu_back') {
                const adminHandler = require('./adminHandler');
                if (adminHandler && adminHandler.renderMainPanel) return await adminHandler.renderMainPanel(interaction);
            }
            return await renderPrisonPanel(interaction);
        }

        return await renderPrisonPanel(interaction);
    } catch (err) {
        console.error('[PRISON HANDLER ERROR]', err);
    }
};

module.exports.refreshPanelViaInteraction = async (interaction, message) => {
    if (message) await interaction.editReply({ content: message }).catch(() => {});
    await renderPrisonPanel(interaction);
};