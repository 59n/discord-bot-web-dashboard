const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');
const { authenticateToken } = require('../middleware/auth');

module.exports = (client, io) => {
    // All analytics routes require authentication
    router.use(authenticateToken);

    // Get analytics overview
    router.get('/analytics', (req, res) => {
        try {
            const { period = '7d', guildId } = req.query;
            const analytics = analyticsService.getAnalytics(period, guildId);
            res.json(analytics);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get real-time stats
    router.get('/analytics/realtime', (req, res) => {
        try {
            const realTimeStats = analyticsService.getRealTimeStats();
            res.json(realTimeStats);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get server growth data
    router.get('/analytics/growth', (req, res) => {
        try {
            const { period = '30d', guildId } = req.query;
            const startDate = new Date();
            
            switch (period) {
                case '7d':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case '30d':
                    startDate.setDate(startDate.getDate() - 30);
                    break;
                case '90d':
                    startDate.setDate(startDate.getDate() - 90);
                    break;
            }
            
            const growthData = analyticsService.getServerGrowthData(startDate, guildId);
            res.json(growthData);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get message activity heatmap
    router.get('/analytics/heatmap', (req, res) => {
        try {
            const { period = '7d' } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(period.replace('d', '')));
            
            const messageData = analyticsService.getMessageActivityData(startDate);
            
            // Process into heatmap format (hour vs day)
            const heatmapData = [];
            for (let hour = 0; hour < 24; hour++) {
                for (let day = 0; day < 7; day++) {
                    const dayData = messageData.filter(m => {
                        const date = new Date(m.timestamp);
                        return date.getHours() === hour && date.getDay() === day;
                    });
                    
                    const count = dayData.reduce((sum, d) => sum + d.count, 0);
                    heatmapData.push({
                        hour,
                        day,
                        count,
                        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]
                    });
                }
            }
            
            res.json(heatmapData);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get top channels
    router.get('/analytics/channels', (req, res) => {
        try {
            const { period = '7d', limit = 10 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(period.replace('d', '')));
            
            const channelData = analyticsService.getChannelActivityData(startDate);
            
            const topChannels = Object.values(channelData)
                .map(channel => ({
                    channelId: channel.channelId,
                    messageCount: channel.messageCount,
                    uniqueUsers: channel.uniqueUsers
                }))
                .sort((a, b) => b.messageCount - a.messageCount)
                .slice(0, parseInt(limit));
            
            res.json(topChannels);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get top users
    router.get('/analytics/users', (req, res) => {
        try {
            const { period = '7d', limit = 10 } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(period.replace('d', '')));
            
            const userData = analyticsService.getUserActivityData(startDate);
            
            const topUsers = Object.values(userData)
                .map(user => ({
                    userId: user.userId,
                    messageCount: user.messageCount,
                    channelsUsed: user.channelsUsed
                }))
                .sort((a, b) => b.messageCount - a.messageCount)
                .slice(0, parseInt(limit));
            
            res.json(topUsers);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get command usage statistics
    router.get('/analytics/commands', (req, res) => {
        try {
            const { period = '7d' } = req.query;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(period.replace('d', '')));
            
            const commandData = analyticsService.getCommandUsageData(startDate);
            
            const commandStats = Object.values(commandData)
                .map(cmd => ({
                    commandName: cmd.commandName,
                    totalUsage: cmd.totalUsage,
                    uniqueUsers: cmd.uniqueUsers
                }))
                .sort((a, b) => b.totalUsage - a.totalUsage);
            
            res.json(commandStats);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

        // Add this route to routes/analytics.js
    router.post('/analytics/save', async (req, res) => {
        try {
            await analyticsService.saveAnalyticsData();
            res.json({ success: true, message: 'Analytics data saved successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

        // Add this route for generating test data
    router.post('/analytics/generate-test-data', async (req, res) => {
        try {
            const { generateTestData } = require('../scripts/generateTestData');
            await generateTestData();
            
            // Reload the analytics service with new data
            const analyticsService = require('../services/analyticsService');
            await analyticsService.loadAnalyticsData();
            
            res.json({ 
                success: true, 
                message: 'Test data generated and loaded successfully!' 
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    });


    // Export analytics data
    router.get('/analytics/export', (req, res) => {
        try {
            const { period = '30d', format = 'json' } = req.query;
            const analytics = analyticsService.getAnalytics(period);
            
            if (format === 'csv') {
                // Convert to CSV format
                let csv = 'Date,Messages,Commands,Active Users,Joins,Leaves\n';
                
                // Add daily data rows
                const dailyStats = Array.from(analyticsService.analytics.dailyStats.entries());
                dailyStats.forEach(([date, stats]) => {
                    csv += `${date},${stats.totalMessages},${stats.commandsUsed},${stats.activeUsers},0,0\n`;
                });
                
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
                res.send(csv);
            } else {
                res.json(analytics);
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
