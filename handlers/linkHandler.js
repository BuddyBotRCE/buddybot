const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { UserEconomy } = require('../database/db');

module.exports = async (interaction, client) => {
    const customId = interaction.customId || '';

    try {
        // 1. When user clicks "Link Account" button on the player panel
        if (customId === 'hub_link_account' || customId === 'link_account_start') {
            const modal = new ModalBuilder()
                .setCustomId('modal_link_account_submit')
                .setTitle('🔗 Link Rust Console Account');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('gamertag')
                        .setLabel('Exact In-Game Gamertag (PSN / Xbox)')
                        .setPlaceholder('e.g. cheggwin86')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                )
            );

            return await interaction.showModal(modal);
        }

        // 2. When the modal is submitted
        if (customId === 'modal_link_account_submit' && interaction.isModalSubmit()) {
            const gamertag = interaction.fields.getTextInputValue('gamertag').trim();
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            // Save or update the linked gamertag in the database
            await UserEconomy.upsert({
                guildId,
                userId,
                inGameName: gamertag
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Account Linked Successfully!')
                .setDescription(`Your Discord account has been successfully linked to the Rust Console gamertag: **${gamertag}**`)
                .setColor('#2ecc71')
                .setTimestamp();

            return await interaction.reply({ embeds: [embed], flags: 64 });
        }
    } catch (err) {
        console.error('[LINK HANDLER ERROR]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            return await interaction.reply({ content: '❌ Failed to link account. Please try again.', flags: 64 }).catch(() => {});
        }
    }
};