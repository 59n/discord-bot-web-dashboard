const express = require('express');
const router = express.Router();
const { saveTicketData, loadTicketData } = require('../services/dataService');

module.exports = (client, io) => {
    // Get ticket configuration
    router.get('/ticket/config', async (req, res) => {
        try {
            const ticketData = await loadTicketData();
            res.json({
                success: true,
                config: ticketData.ticketConfig || {},
                activeTickets: ticketData.activeTickets || [],
                closedTickets: ticketData.closedTickets || []
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Update ticket configuration
    router.post('/ticket/config', async (req, res) => {
        try {
            let ticketData = await loadTicketData();
            
            // Ensure ticketData has proper structure
            if (!ticketData || typeof ticketData !== 'object') {
                ticketData = {
                    activeTickets: [],
                    closedTickets: [],
                    ticketConfig: {}
                };
            }

            // Update config with new data
            ticketData.ticketConfig = {
                ...ticketData.ticketConfig,
                ...req.body
            };

            console.log('💾 Saving ticket config:', ticketData.ticketConfig);
            await saveTicketData(ticketData);

            res.json({
                success: true,
                message: 'Ticket configuration updated',
                config: ticketData.ticketConfig
            });
        } catch (error) {
            console.error('❌ Error updating ticket config:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Get all tickets
    router.get('/tickets', async (req, res) => {
        try {
            const ticketData = await loadTicketData();
            res.json({
                success: true,
                activeTickets: ticketData.activeTickets || [],
                closedTickets: ticketData.closedTickets || []
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Close a ticket
    router.post('/ticket/:ticketId/close', async (req, res) => {
        try {
            const { ticketId } = req.params;
            const { reason = 'No reason provided' } = req.body;
            let ticketData = await loadTicketData();

            // Ensure proper structure
            if (!ticketData.activeTickets) ticketData.activeTickets = [];
            if (!ticketData.closedTickets) ticketData.closedTickets = [];

            // Find active ticket
            const ticketIndex = ticketData.activeTickets.findIndex(t => t.id === ticketId);
            if (ticketIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Ticket not found'
                });
            }

            // Move to closed tickets
            const ticket = ticketData.activeTickets.splice(ticketIndex, 1)[0];
            ticket.closedAt = new Date().toISOString();
            ticket.closeReason = reason;
            ticket.closedBy = req.user?.username || 'System';

            ticketData.closedTickets.unshift(ticket);
            await saveTicketData(ticketData);

            res.json({
                success: true,
                message: 'Ticket closed successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Create ticket type
    router.post('/ticket/types', async (req, res) => {
        try {
            const ticketData = await loadTicketData();
            
            // Create new ticket type
            const newType = {
                id: Date.now().toString(),
                ...req.body,
                createdAt: new Date().toISOString(),
                createdBy: req.user?.username || 'System'
            };
            
            // Ensure ticketTypes array exists
            if (!ticketData.ticketConfig.ticketTypes) {
                ticketData.ticketConfig.ticketTypes = [];
            }
            ticketData.ticketConfig.ticketTypes.push(newType);
            
            await saveTicketData(ticketData);
            
            res.json({
                success: true,
                message: 'Ticket type created successfully',
                ticketType: newType
            });
        } catch (error) {
            console.error('Error creating ticket type:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    });

    // Update ticket type
    router.put('/ticket/types/:typeId', async (req, res) => {
        try {
            const { typeId } = req.params;
            const ticketData = await loadTicketData();
            
            // Find and update ticket type
            const typeIndex = ticketData.ticketConfig.ticketTypes.findIndex(t => t.id === typeId);
            if (typeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Ticket type not found'
                });
            }
            
            ticketData.ticketConfig.ticketTypes[typeIndex] = {
                ...ticketData.ticketConfig.ticketTypes[typeIndex],
                ...req.body,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user?.username || 'System'
            };
            
            await saveTicketData(ticketData);
            
            res.json({
                success: true,
                message: 'Ticket type updated successfully',
                ticketType: ticketData.ticketConfig.ticketTypes[typeIndex]
            });
        } catch (error) {
            console.error('Error updating ticket type:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    });

    // Delete ticket type
    router.delete('/ticket/types/:typeId', async (req, res) => {
        try {
            const { typeId } = req.params;
            const ticketData = await loadTicketData();
            
            // Find and remove ticket type
            const typeIndex = ticketData.ticketConfig.ticketTypes.findIndex(t => t.id === typeId);
            if (typeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Ticket type not found'
                });
            }
            
            const deletedType = ticketData.ticketConfig.ticketTypes.splice(typeIndex, 1)[0];
            
            await saveTicketData(ticketData);
            
            res.json({
                success: true,
                message: 'Ticket type deleted successfully',
                deletedType
            });
        } catch (error) {
            console.error('Error deleting ticket type:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    });

    // Deploy ticket embed
    router.post('/ticket/deploy', async (req, res) => {
        try {
            const { channelId, embed, buttons, ticketTypes } = req.body;
            
            if (!channelId) {
                return res.status(400).json({
                    success: false,
                    message: 'Channel ID is required'
                });
            }

            // Get the channel
            const channel = await client.channels.fetch(channelId);
            if (!channel) {
                return res.status(404).json({
                    success: false,
                    message: 'Channel not found'
                });
            }

            // Create embed
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
            const embedObj = new EmbedBuilder()
                .setTitle(embed.title || 'Create a Support Ticket')
                .setDescription(embed.description || 'Click the button below to create a support ticket.')
                .setColor(embed.color || '#5865f2');

            if (embed.thumbnail) embedObj.setThumbnail(embed.thumbnail);
            if (embed.image) embedObj.setImage(embed.image);
            if (embed.footer) embedObj.setFooter({ text: embed.footer });
            if (embed.timestamp) embedObj.setTimestamp();

            // Create button
            const button = new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel(buttons.label || 'Create Ticket')
                .setStyle(ButtonStyle[buttons.style] || ButtonStyle.Primary);

            if (buttons.emoji) button.setEmoji(buttons.emoji);

            const row = new ActionRowBuilder().addComponents(button);

            // Send embed with button
            await channel.send({
                embeds: [embedObj],
                components: [row]
            });

            console.log(`✅ Ticket embed deployed to channel: ${channel.name} (${channelId})`);
            
            res.json({
                success: true,
                message: 'Ticket embed deployed successfully'
            });
        } catch (error) {
            console.error('Error deploying embed:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    });

    // Get guild data (channels, roles, categories)
    router.get('/guild-data/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(404).json({
                    success: false,
                    message: 'Guild not found'
                });
            }
            
            // Get channels
            const channels = guild.channels.cache
                .filter(channel => channel.type === 0 || channel.type === 4) // Text channels and categories
                .map(channel => ({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    parentId: channel.parentId
                }));
                
            // Get roles
            const roles = guild.roles.cache
                .filter(role => !role.managed && role.name !== '@everyone')
                .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor,
                    position: role.position
                }));
                
            const categories = channels.filter(ch => ch.type === 4);
            const textChannels = channels.filter(ch => ch.type === 0);
            
            res.json({
                success: true,
                channels: textChannels,
                categories,
                roles: roles.sort((a, b) => b.position - a.position)
            });
        } catch (error) {
            console.error('Error getting guild data:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    });

    // Delete closed ticket
    router.delete('/ticket/closed/:ticketId', async (req, res) => {
        try {
            const { ticketId } = req.params;
            let ticketData = await loadTicketData();

            // Ensure proper structure
            if (!ticketData.closedTickets) ticketData.closedTickets = [];

            // Find and remove closed ticket
            const ticketIndex = ticketData.closedTickets.findIndex(t => t.id === ticketId);
            if (ticketIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Closed ticket not found'
                });
            }

            const deletedTicket = ticketData.closedTickets.splice(ticketIndex, 1)[0];
            await saveTicketData(ticketData);

            res.json({
                success: true,
                message: 'Closed ticket deleted successfully',
                deletedTicket
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    return router;
};
