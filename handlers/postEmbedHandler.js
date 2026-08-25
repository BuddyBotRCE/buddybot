const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const { GuildConfig, CustomEmbed } = require('../database/db');

const embedSessions = new Map();

const RUST_TEMPLATES = {
    wipe: {
        templateName: '🪓 Wipe Announcement',
        title: '🪓 WIPE ANNOUNCEMENT — FRESH MAP!',
        description: 'The server has successfully wiped!\n\n• **Map Seed:** [Insert Seed]\n• **Map Size:** [Insert Size]\n• **Blueprints:** [Force / Kept]\n\nConnect via F1 console: `connect server.ip:port`',
        color: '#e74c3c',
        thumbnailUrl: '',
        imageUrl: '',
        footerText: 'Good luck out there, survivors!'
    },
    rules: {
        templateName: '📜 Server Rules',
        title: '📜 RUST CONSOLE COMMUNITY RULES',
        description: 'Please follow these rules to keep the server fun and fair for everyone:\n\n1️⃣ No racism, hate speech, or excessive toxicity in chat.\n2️⃣ Max team limits must be strictly respected.\n3️⃣ No exploiting bugs, glitches, or under-map building.\n4️⃣ Be respectful to admins and community members.',
        color: '#f1c40f',
        thumbnailUrl: '',
        imageUrl: '',
        footerText: 'Breaking rules will result in a permanent ban.'
    },
    store: {
        templateName: '🛒 Store & VIP',
        title: '🛒 SUPPORT THE SERVER & VIP',
        description: 'Want to support the community and grab cool perks? Check out our official store for VIP kits, skins, and economy packages!\n\nType `/playerpanel` in-game or visit our store link to browse available packages.',
        color: '#2ecc71',
        thumbnailUrl: '',
        imageUrl: '',
        footerText: 'All proceeds go directly back into server hosting.'
    },
    vote: {
        templateName: '🗳️ Vote & Earn Rewards',
        title: '🗳️ VOTE FOR FREE SCRAP',
        description: 'Help our community grow by voting for the server daily! Every vote grants free scrap directly to your in-game wallet.\n\nClick the link or use the vote menu in your player panel to claim.',
        color: '#9b59b6',
        thumbnailUrl: '',
        imageUrl: '',
        footerText: 'Thank you for supporting our server!'
    }
};

const postEmbedHandler = async (interaction, client) => {
    try {
        const customId = interaction.customId || '';
        const guildId = interaction.guild.id;
        let selectedValue = interaction.isStringSelectMenu() ? interaction.values[0] : '';

        if (!embedSessions.has(guildId)) {
            embedSessions.set(guildId, {
                title: '📢 Server Announcement',
                description: 'Type your announcement details here using the builder controls below.',
                color: '#3498db',
                thumbnailUrl: '',
                imageUrl: '',
                footerText: ''
            });
        }
        const session = embedSessions.get(guildId);

        const renderBuilder = async (inter, messageOverride = '') => {
            const previewEmbed = new EmbedBuilder()
                .setTitle(session.title)
                .setDescription(session.description)
                .setColor(session.color)
                .setTimestamp();

            if (session.thumbnailUrl) previewEmbed.setThumbnail(session.thumbnailUrl);
            if (session.imageUrl) previewEmbed.setImage(session.imageUrl);
            if (session.footerText) previewEmbed.setFooter({ text: session.footerText });

            const configEmbed = new EmbedBuilder()
                .setTitle('🎨 Post Embed Builder')
                .setDescription(`${messageOverride ? `**${messageOverride}**\n\n` : ''}Design your custom announcement with banners, thumbnails, and custom text, then publish it live.`)
                .setColor('#f39c12');

            // Template Select Menu
            const templateRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('select_emb_template').setPlaceholder('⚡ Load Pre-Made Rust Template...').addOptions([
                    { label: '🪓 Wipe Announcement', value: 'wipe', description: 'Fresh map & connection details' },
                    { label: '📜 Server Rules', value: 'rules', description: 'Community guidelines & limits' },
                    { label: '🛒 Store & VIP', value: 'store', description: 'Donations and VIP packages' },
                    { label: '🗳️ Vote & Rewards', value: 'vote', description: 'Voting links and scrap rewards' }
                ])
            );

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_emb_title').setLabel('Title').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                new ButtonBuilder().setCustomId('btn_emb_desc').setLabel('Description').setStyle(ButtonStyle.Primary).setEmoji('📝'),
                new ButtonBuilder().setCustomId('btn_emb_color').setLabel('Color').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
                new ButtonBuilder().setCustomId('btn_emb_thumb').setLabel('Thumbnail').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
                new ButtonBuilder().setCustomId('btn_emb_image').setLabel('Banner Image').setStyle(ButtonStyle.Secondary).setEmoji('🌟')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_emb_footer').setLabel('Footer Text').setStyle(ButtonStyle.Secondary).setEmoji('📌'),
                new ButtonBuilder().setCustomId('btn_emb_publish').setLabel('Select Channel & Post').setStyle(ButtonStyle.Success).setEmoji('🚀')
            );

            const payload = { embeds: [configEmbed, previewEmbed], components: [templateRow, row1, row2], flags: 64 };
            if (inter.isRepliable() && !inter.replied && !inter.deferred) return await inter.reply(payload);
            return await inter.update(payload).catch(() => inter.followUp(payload));
        };

        // --- ADMIN MENU TRIGGER ---
        if (customId === 'admin_menu_select' && (selectedValue === 'setup_postembed' || selectedValue.includes('embed'))) {
            return await renderBuilder(interaction);
        }

        // --- SELECT MENU TEMPLATE LOADER ---
        if (interaction.isStringSelectMenu() && customId === 'select_emb_template') {
            const template = RUST_TEMPLATES[selectedValue];
            if (template) {
                session.title = template.title;
                session.description = template.description;
                session.color = template.color;
                session.thumbnailUrl = template.thumbnailUrl;
                session.imageUrl = template.imageUrl;
                session.footerText = template.footerText;
                embedSessions.set(guildId, session);
                return await renderBuilder(interaction, `⚡ Loaded template: **${template.templateName}**!`);
            }
        }

        // --- BUTTON CLICKS ---
        if (interaction.isButton()) {
            if (customId === 'btn_emb_title') {
                const modal = new ModalBuilder().setCustomId('modal_emb_title').setTitle('Set Embed Title');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Title Text').setStyle(TextInputStyle.Short).setValue(session.title).setRequired(true)));
                return await interaction.showModal(modal);
            }
            if (customId === 'btn_emb_desc') {
                const modal = new ModalBuilder().setCustomId('modal_emb_desc').setTitle('Set Embed Description');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Description (Markdown supported)').setStyle(TextInputStyle.Paragraph).setValue(session.description).setRequired(true)));
                return await interaction.showModal(modal);
            }
            if (customId === 'btn_emb_color') {
                const modal = new ModalBuilder().setCustomId('modal_emb_color').setTitle('Set Embed Color');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Hex Code (e.g. #e74c3c)').setStyle(TextInputStyle.Short).setValue(session.color).setRequired(true)));
                return await interaction.showModal(modal);
            }
            if (customId === 'btn_emb_thumb') {
                const modal = new ModalBuilder().setCustomId('modal_emb_thumb').setTitle('Set Thumbnail URL');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Corner Thumbnail Image URL').setStyle(TextInputStyle.Short).setValue(session.thumbnailUrl || '').setRequired(false)));
                return await interaction.showModal(modal);
            }
            if (customId === 'btn_emb_image') {
                const modal = new ModalBuilder().setCustomId('modal_emb_image').setTitle('Set Banner Image URL');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Large Banner Image URL').setStyle(TextInputStyle.Short).setValue(session.imageUrl || '').setRequired(false)));
                return await interaction.showModal(modal);
            }
            if (customId === 'btn_emb_footer') {
                const modal = new ModalBuilder().setCustomId('modal_emb_footer').setTitle('Set Footer Text');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Footer Text').setStyle(TextInputStyle.Short).setValue(session.footerText || '').setRequired(false)));
                return await interaction.showModal(modal);
            }
            if (customId === 'btn_emb_publish') {
                const menuRow = new ActionRowBuilder().addComponents(
                    new ChannelSelectMenuBuilder().setCustomId('select_emb_target_channel').setPlaceholder('Select channel to post announcement...').setChannelTypes([0])
                );
                return await interaction.reply({ content: '📢 Select the Discord channel where you want to post this embed:', components: [menuRow], flags: 64 });
            }
        }

        // --- CHANNEL SELECTION TO PUBLISH ---
        if (interaction.isChannelSelectMenu() && customId === 'select_emb_target_channel') {
            const channelId = interaction.values[0];
            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) return await interaction.reply({ content: '❌ Target channel not found.', flags: 64 });

            const finalEmbed = new EmbedBuilder()
                .setTitle(session.title)
                .setDescription(session.description)
                .setColor(session.color)
                .setTimestamp();

            if (session.thumbnailUrl) finalEmbed.setThumbnail(session.thumbnailUrl);
            if (session.imageUrl) finalEmbed.setImage(session.imageUrl);
            if (session.footerText) finalEmbed.setFooter({ text: session.footerText });

            await channel.send({ embeds: [finalEmbed] });
            return await interaction.update({ content: `✅ Announcement successfully posted to <#${channelId}>!`, components: [] });
        }

        // --- MODAL SUBMISSIONS ---
        if (interaction.isModalSubmit()) {
            const val = interaction.fields.getTextInputValue('val');
            if (customId === 'modal_emb_title') session.title = val;
            if (customId === 'modal_emb_desc') session.description = val;
            if (customId === 'modal_emb_color') session.color = val;
            if (customId === 'modal_emb_thumb') session.thumbnailUrl = val;
            if (customId === 'modal_emb_image') session.imageUrl = val;
            if (customId === 'modal_emb_footer') session.footerText = val;

            embedSessions.set(guildId, session);
            return await renderBuilder(interaction, '✅ Embed preview updated!');
        }

    } catch (error) {
        console.error('[POST EMBED HANDLER ERROR]', error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred with the embed builder.', flags: 64 }).catch(() => {});
        }
    }
};

module.exports = postEmbedHandler;