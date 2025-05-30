const express = require('express');
const router = express.Router();
const { cache } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

module.exports = (client) => {
    // Add authentication middleware to all guild routes
    router.use(authenticateToken);

    // Get all guilds
    router.get('/guilds', async (req, res) => {
        try {
            const guilds = client.guilds.cache.map(guild => ({
                id: guild.id,
                name: guild.name,
                memberCount: guild.memberCount,
                icon: guild.iconURL(),
                channels: guild.channels.cache
                    .filter(channel => channel.type === 0)
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name,
                        type: channel.type
                    }))
            }));
            res.json(guilds);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get guild data with caching
    router.get('/guild-data/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            const cacheKey = `guild-data-${guildId}`;
            
            // Check cache first
            const cachedData = cache.get(cacheKey);
            if (cachedData) {
                return res.json(cachedData);
            }
            
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return res.status(404).json({ success: false, message: 'Guild not found' });
            }

            const guildData = {
                categories: guild.channels.cache
                    .filter(channel => channel.type === 4)
                    .map(category => ({ id: category.id, name: category.name })),
                channels: guild.channels.cache
                    .filter(channel => channel.type === 0)
                    .map(channel => ({ id: channel.id, name: channel.name, categoryId: channel.parentId })),
                roles: guild.roles.cache
                    .filter(role => !role.managed && role.name !== '@everyone')
                    .map(role => ({ id: role.id, name: role.name, color: role.hexColor }))
            };

            // Cache the result for 5 minutes
            cache.set(cacheKey, guildData);
            res.json(guildData);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get bot stats (no auth needed)
    router.get('/stats', (req, res) => {
        const { storage } = require('../config/database');
        res.json(storage.botStats);
    });

    // Get recent messages
    router.get('/messages', (req, res) => {
        const { storage } = require('../config/database');
        res.json(storage.recentMessages);
    });

    // Send message to channel
    router.post('/send-message', async (req, res) => {
        const { channelId, message } = req.body;
        
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel) {
                await channel.send(message);
                res.json({ success: true, message: 'Message sent successfully' });
            } else {
                res.status(404).json({ success: false, message: 'Channel not found' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Change bot status
    router.post('/change-status', async (req, res) => {
        const { status, activity, activityType } = req.body;
        
        try {
            const activityTypes = {
                'playing': 0,
                'streaming': 1,
                'listening': 2,
                'watching': 3,
                'competing': 5
            };

            await client.user.setPresence({
                status: status,
                activities: activity ? [{
                    name: activity,
                    type: activityTypes[activityType] || 0
                }] : []
            });
            
            res.json({ success: true, message: 'Status updated successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
