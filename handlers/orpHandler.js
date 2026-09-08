const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { OrpConfig, PlayerOrpBase } = require('../database/db');

async function renderOrpPanel(interaction, messageOverride = '') {
    const guildId = interaction.guild.id;
    const [orpConf] = await OrpConfig.findOrCreate({ where: { guildId } });
    const registeredBases = await PlayerOrpBase.count({ where: { guildId } }).catch(() => 0);

    const embed = new EmbedBuilder()
        .setTitle('🛡️ ORP Manager (Offline Raid Protection)')
        .setDescription(
            (messageOverride ? `**${messageOverride}**\n\n` : '') +
            `Configure your Offline Raid Protection (ORP) settings.\nPlayers can register their base coordinates to automatically generate a protective zone when they log off.\n\n` +
            `**Current Server Rules:**\n` +
            `• **Protection Radius:** \`${orpConf.zoneSize} meters\`\n` +
            `• **Online Color:** \`${orpConf.onlineColor}\`\n` +
            `• **Offline Color:** \`${orpConf.offlineColor}\`\n` +
            `• **Max Duration:** \`${orpConf.activeDurationHours} hours\`\n` +
            `• **Registered Bases:** \`${registeredBases} active bases\`\n`
        )
        .setColor('#3498db');

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_orp_config').setLabel('Configure Settings').setStyle(ButtonStyle.Primary).setEmoji('⚙️'),
        new ButtonBuilder().setCustomId('btn_orp_clear').setLabel('Clear All Bases').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );
    
    const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_menu_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('🔙')
    );

    const payload = { embeds: [embed], components: [row1, backRow], flags: 64 };

    if (interaction.isMessageComponent()) {
        if (interaction.replied || interaction.deferred) return await interaction.editReply(payload);
        else return await interaction.update(payload);
    } else {
        return await interaction.reply(payload);
    }
}

const orpHandler = async (interaction, client) => {
    const customId = interaction.customId || '';
    const selectedValue = interaction.isStringSelectMenu() && interaction.values ? interaction.values[0] : '';
    const guildId = interaction.guild.id;

    try {
        if (selectedValue === 'setup_orp') {
            return await renderOrpPanel(interaction);
        }

        if (interaction.isButton()) {
            if (customId === 'btn_orp_config') {
                const [orpConf] = await OrpConfig.findOrCreate({ where: { guildId } });
                const modal = new ModalBuilder().setCustomId('modal_orp_config').setTitle('Configure ORP Parameters');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('radius').setLabel("Zone Radius (meters)").setStyle(TextInputStyle.Short).setValue(`${orpConf.zoneSize}`).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('duration').setLabel("Max Duration (hours)").setStyle(TextInputStyle.Short).setValue(`${orpConf.activeDurationHours}`).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('online_color').setLabel("Online Color (hex or name)").setStyle(TextInputStyle.Short).setValue(`${orpConf.onlineColor}`).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('offline_color').setLabel("Offline Color (hex or name)").setStyle(TextInputStyle.Short).setValue(`${orpConf.offlineColor}`).setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            if (customId === 'btn_orp_clear') {
                await PlayerOrpBase.destroy({ where: { guildId } });
                return await renderOrpPanel(interaction, '✅ Successfully cleared all registered ORP bases for this server.');
            }
        }

        if (interaction.isModalSubmit()) {
            if (customId === 'modal_orp_config') {
                const radius = parseInt(interaction.fields.getTextInputValue('radius')) || 25;
                const duration = parseInt(interaction.fields.getTextInputValue('duration')) || 24;
                const onlineCol = interaction.fields.getTextInputValue('online_color');
                const offlineCol = interaction.fields.getTextInputValue('offline_color');

                await OrpConfig.upsert({
                    guildId,
                    zoneSize: radius,
                    activeDurationHours: duration,
                    onlineColor: onlineCol,
                    offlineColor: offlineCol
                });

                return await renderOrpPanel(interaction, `✅ **ORP Settings Updated!**\n• Radius: \`${radius}m\`\n• Max Duration: \`${duration}h\``);
            }
        }

        return await renderOrpPanel(interaction);
    } catch (err) {
        console.error('[ORP HANDLER ERROR]', err);
        if (interaction.isRepliable() && !interaction.replied) {
            return interaction.reply({ content: '❌ An error occurred processing the ORP action.', flags: 64 }).catch(() => {});
        }
    }
};

orpHandler.refreshPanelViaInteraction = async (interaction, message) => {
    if (message) await interaction.editReply({ content: message }).catch(() => {});
    await renderOrpPanel(interaction);
};

module.exports = orpHandler;