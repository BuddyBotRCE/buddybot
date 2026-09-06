const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { PrisonCell, JailedPlayer } = require('../database/db');
const { captureAdminPosition } = require('../utils/rconPosTracker');

async function renderPrisonPanel(interaction, messageOverride = '') {
    const guildId = interaction.guild.id;
    const cells = await PrisonCell.findAll({ where: { guildId }, order: [['cellNumber', 'ASC']] });
    const jailed = await JailedPlayer.findAll({ where: { guildId } });

    let cellStatus = '';
    for (let i = 1; i <= 20; i++) {
        const found = cells.find(c => c.cellNumber === i);
        cellStatus += found ? `🟢 \`${i}\` ` : `🔴 \`${i}\` `;
        if (i === 10) cellStatus += '\n';
    }

    let inmateList = jailed.length > 0 
        ? jailed.map(p => `• **${p.inGameName}** (Cell #${p.cellNumber}) — *${p.isTemp ? 'Temp (' + Math.ceil((new Date(p.expiresAt) - Date.now())/60000) + 'm left)' : 'Permanent'}* | Reason: \`${p.reason}\``).join('\n')
        : '*No prisoners currently locked up.*';

    const embed = new EmbedBuilder()
        .setTitle('🔒 Advanced Prison & Cell Block Manager')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Manage up to 20 distinct jail cells and active prisoners (Lifers & Temp Sentences).\n\n` +
            `**Cell Map (1–20):**\n${cellStatus}\n*(🟢 Set | 🔴 Unset)*\n\n` +
            `**Active Prisoners (${jailed.length}):**\n${inmateList}`
        )
        .setColor('#e74c3c');

    const cellOptions = [];
    for (let i = 1; i <= 20; i++) {
        const isSet = cells.some(c => c.cellNumber === i);
        cellOptions.push({ label: `Cell #${i} ${isSet ? '(Configured)' : '(Empty)'}`, value: `set_cell_${i}`, emoji: isSet ? '🟢' : '🔴' });
    }

    const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('prison_select_cell').setPlaceholder('📍 Select a cell (1-20) to capture position...').addOptions(cellOptions.slice(0, 25))
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prison_btn_jail').setLabel('Jail Player').setStyle(ButtonStyle.Danger).setEmoji('⛓️'),
        new ButtonBuilder().setCustomId('prison_btn_unjail').setLabel('Release Player').setStyle(ButtonStyle.Success).setEmoji('🔓'),
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Dashboard').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    const payload = { embeds: [embed], components: [row1, row2], flags: 64 };
    
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
        const selectedVal = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        if (interaction.isStringSelectMenu() && selectedVal.startsWith('set_cell_')) {
            const cellNum = selectedVal.replace('set_cell_', '');
            await interaction.reply({ content: `📍 **Capturing your position for Cell #${cellNum} via RCON...**`, flags: 64 });
            return await captureAdminPosition(interaction, 'prison_cell', cellNum);
        }

        if (interaction.isButton() && customId === 'prison_btn_jail') {
            const modal = new ModalBuilder().setCustomId('modal_prison_jail').setTitle('Sentence a Player');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('p_name').setLabel('In-Game Exact Name').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('p_cell').setLabel('Cell Number (1 - 20)').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('p_reason').setLabel('Mandatory Reason').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('p_mins').setLabel('Duration in Mins (Leave blank for Lifers)').setStyle(TextInputStyle.Short).setRequired(false))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isButton() && customId === 'prison_btn_unjail') {
            const modal = new ModalBuilder().setCustomId('modal_prison_unjail').setTitle('Release a Prisoner');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('p_name').setLabel('In-Game Exact Name to Release').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit()) {
            if (customId === 'modal_prison_jail') {
                const name = interaction.fields.getTextInputValue('p_name').trim();
                const cellNum = parseInt(interaction.fields.getTextInputValue('p_cell'));
                const reason = interaction.fields.getTextInputValue('p_reason').trim();
                const mins = parseInt(interaction.fields.getTextInputValue('p_mins'));

                const cellObj = await PrisonCell.findOne({ where: { guildId, cellNumber: cellNum } });
                if (!cellObj) {
                    return interaction.reply({ content: `❌ **Cell #${cellNum} has not been set up with coordinates yet!** Select it from the dropdown first.`, flags: 64 });
                }

                const isTemp = !isNaN(mins) && mins > 0;
                const expiresAt = isTemp ? new Date(Date.now() + mins * 60000) : null;

                await JailedPlayer.upsert({ guildId, inGameName: name, reason, cellNumber: cellNum, isTemp, expiresAt, jailedBy: interaction.user.id });

                // Teleport them immediately via RCON
                const { sendRconCommand } = require('../utils/rconManager');
                await sendRconCommand(guildId, `teleportpos (${cellObj.posX},${cellObj.posY},${cellObj.posZ}) "${name}"`, client);
                await sendRconCommand(guildId, `say "🔒 ${name} has been thrown into Cell #${cellNum} for: ${reason}!"`, client);

                return await renderPrisonPanel(interaction, `✅ Successfully jailed **${name}** in Cell #${cellNum}!`);
            }

            if (customId === 'modal_prison_unjail') {
                const name = interaction.fields.getTextInputValue('p_name').trim();
                await JailedPlayer.destroy({ where: { guildId, inGameName: name } });

                const { sendRconCommand } = require('../utils/rconManager');
                await sendRconCommand(guildId, `say "🔓 ${name} has completed their sentence and been released!"`, client);

                return await renderPrisonPanel(interaction, `✅ Successfully released **${name}**!`);
            }
        }

        if (interaction.isButton() && customId === 'admin_menu_back') {
            const adminHandler = require('./adminHandler');
            if (adminHandler && adminHandler.renderMainPanel) return await adminHandler.renderMainPanel(interaction);
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