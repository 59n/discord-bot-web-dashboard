const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { storage } = require('../config/database');
const { saveTicketData } = require('./dataService');

class TicketService {
    constructor() {}

    // Create ticket embed
    createTicketEmbed() {
        const embed = new EmbedBuilder()
            .setTitle(storage.ticketConfig.embed.title)
            .setDescription(storage.ticketConfig.embed.description)
            .setColor(storage.ticketConfig.embed.color)
            .setTimestamp();

        if (storage.ticketConfig.embed.image) {
            embed.setImage(storage.ticketConfig.embed.image);
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('🎫 Create Ticket')
                    .setStyle(ButtonStyle.Primary)
            );

        return { embeds: [embed], components: [row] };
    }

    // Create ticket type menu
    createTicketTypeMenu() {
        const options = storage.ticketConfig.ticketTypes.map(type => ({
            label: type.name,
            description: type.description,
            value: type.id,
            emoji: type.emoji || '🎫'
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_type_select')
            .setPlaceholder('Select a ticket type...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        return {
            content: 'Please select the type of ticket you want to create:',
            components: [row],
            ephemeral: true
        };
    }

    // Create ticket modal
    createTicketModal(ticketType) {
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${ticketType.id}`)
            .setTitle(`${ticketType.name} - Ticket Creation`);

        ticketType.questions.forEach((question, index) => {
            if (index < 5) {
                const textInput = new TextInputBuilder()
                    .setCustomId(`question_${index}`)
                    .setLabel(question.label)
                    .setStyle(question.required ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setPlaceholder(question.placeholder || 'Enter your response...')
                    .setRequired(question.required);

                const actionRow = new ActionRowBuilder().addComponents(textInput);
                modal.addComponents(actionRow);
            }
        });

        return modal;
    }

    // Create ticket channel
    async createTicketChannel(guild, user, ticketType, responses) {
        try {
            const ticketNumber = Date.now().toString().slice(-6);
            const channelName = `ticket-${user.username}-${ticketNumber}`;

            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: storage.ticketConfig.categoryId,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    ...storage.ticketConfig.supportRoles.map(roleId => ({
                        id: roleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages
                        ]
                    }))
                ]
            });

            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 ${ticketType.name} Ticket`)
                .setDescription(`Ticket created by ${user}`)
                .setColor('#00ff00')
                .setThumbnail(user.displayAvatarURL())
                .setTimestamp();

            responses.forEach((response, index) => {
                const question = ticketType.questions[index];
                if (question && response) {
                    ticketEmbed.addFields({
                        name: question.label,
                        value: response,
                        inline: false
                    });
                }
            });

            const controlRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Close Ticket')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('✋ Claim Ticket')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('add_user_ticket')
                        .setLabel('➕ Add User')
                        .setStyle(ButtonStyle.Success)
                );

            await channel.send({
                content: `${user} Welcome to your support ticket!\n${storage.ticketConfig.supportRoles.map(roleId => `<@&${roleId}>`).join(' ')}`,
                embeds: [ticketEmbed],
                components: [controlRow]
            });

            const ticketData = {
                id: channel.id,
                userId: user.id,
                username: user.username,
                type: ticketType.id,
                typeName: ticketType.name,
                createdAt: new Date().toISOString(),
                claimed: false,
                claimedBy: null,
                responses: responses
            };

            storage.activeTickets.set(channel.id, ticketData);
            await saveTicketData();

            return { channel, ticketData };
        } catch (error) {
            console.error('Error creating ticket channel:', error);
            throw error;
        }
    }

    // Close ticket with transcript
    async closeTicketWithTranscript(channelId, closedBy, client) {
        try {
            const ticket = storage.activeTickets.get(channelId);
            if (!ticket) return null;

            const channel = await client.channels.fetch(channelId);
            if (!channel) return null;

            const messages = await channel.messages.fetch({ limit: 100 });
            const transcript = messages
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
                .map(msg => ({
                    author: msg.author.username,
                    authorId: msg.author.id,
                    content: msg.content,
                    timestamp: msg.createdAt.toISOString(),
                    attachments: msg.attachments.map(att => att.url)
                }));

            const closedTicket = {
                ...ticket,
                closedAt: new Date().toISOString(),
                closedBy: closedBy.id,
                closedByUsername: closedBy.username,
                transcript: transcript,
                messageCount: transcript.length
            };

            storage.closedTickets.unshift(closedTicket);
            if (storage.closedTickets.length > 500) {
                storage.closedTickets = storage.closedTickets.slice(0, 500);
            }

            storage.activeTickets.delete(channelId);
            await saveTicketData();

            // Delete channel after 5 seconds
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (error) {
                    console.error('Error deleting channel:', error);
                }
            }, 5000);

            return closedTicket;
        } catch (error) {
            console.error('Error closing ticket with transcript:', error);
            throw error;
        }
    }

    // Get ticket configuration
    getTicketConfig() {
        return storage.ticketConfig;
    }

    // Update ticket configuration
    async updateTicketConfig(newConfig) {
        storage.ticketConfig = { ...storage.ticketConfig, ...newConfig };
        await saveTicketData();
        return storage.ticketConfig;
    }

    // Get active tickets
    getActiveTickets() {
        return Array.from(storage.activeTickets.values());
    }

    // Get closed tickets
    getClosedTickets() {
        return storage.closedTickets;
    }

    // Get ticket types
    getTicketTypes() {
        return storage.ticketConfig.ticketTypes;
    }

    // Create ticket type
    async createTicketType(typeData) {
        const { name, description, emoji, questions } = typeData;
        
        if (!name || !description) {
            throw new Error('Name and description are required');
        }

        const ticketType = {
            id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            name,
            description,
            emoji: emoji || '🎫',
            questions: questions || []
        };

        const exists = storage.ticketConfig.ticketTypes.find(t => t.id === ticketType.id);
        if (exists) {
            throw new Error('Ticket type with this name already exists');
        }

        storage.ticketConfig.ticketTypes.push(ticketType);
        await saveTicketData();

        return ticketType;
    }

    // Update ticket type
    async updateTicketType(id, updateData) {
        const { name, description, emoji, questions } = updateData;

        const typeIndex = storage.ticketConfig.ticketTypes.findIndex(t => t.id === id);
        if (typeIndex === -1) {
            throw new Error('Ticket type not found');
        }

        storage.ticketConfig.ticketTypes[typeIndex] = {
            ...storage.ticketConfig.ticketTypes[typeIndex],
            name: name || storage.ticketConfig.ticketTypes[typeIndex].name,
            description: description || storage.ticketConfig.ticketTypes[typeIndex].description,
            emoji: emoji || storage.ticketConfig.ticketTypes[typeIndex].emoji,
            questions: questions || storage.ticketConfig.ticketTypes[typeIndex].questions
        };

        await saveTicketData();
        return storage.ticketConfig.ticketTypes[typeIndex];
    }

    // Delete ticket type
    async deleteTicketType(id) {
        storage.ticketConfig.ticketTypes = storage.ticketConfig.ticketTypes.filter(t => t.id !== id);
        await saveTicketData();
        return true;
    }

    // Delete closed ticket
    async deleteClosedTicket(ticketId) {
        storage.closedTickets = storage.closedTickets.filter(t => t.id !== ticketId);
        await saveTicketData();
        return true;
    }
}

module.exports = new TicketService();
