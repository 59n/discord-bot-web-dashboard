const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { authenticateToken } = require('../middleware/auth');

module.exports = (client, io) => {
    // All notification routes require authentication
    router.use(authenticateToken);

    // Get all notifications
    router.get('/notifications', (req, res) => {
        try {
            const notifications = notificationService.getAllNotifications();
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // RSS Feed Management
    router.post('/notifications/rss', async (req, res) => {
        try {
            const config = {
                ...req.body,
                createdBy: req.user.username
            };
            
            const feed = await notificationService.addRSSFeed(config);
            res.json({ success: true, feed });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    router.delete('/notifications/rss/:feedId', async (req, res) => {
        try {
            const { feedId } = req.params;
            const deleted = await notificationService.removeRSSFeed(feedId);
            
            if (deleted) {
                res.json({ success: true, message: 'RSS feed removed successfully' });
            } else {
                res.status(404).json({ success: false, message: 'RSS feed not found' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Social Media Management
    router.post('/notifications/social', async (req, res) => {
        try {
            const config = {
                ...req.body,
                createdBy: req.user.username
            };
            
            const account = await notificationService.addSocialMediaAccount(config);
            res.json({ success: true, account });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    router.delete('/notifications/social/:accountId', async (req, res) => {
        try {
            const { accountId } = req.params;
            const deleted = await notificationService.removeSocialMediaAccount(accountId);
            
            if (deleted) {
                res.json({ success: true, message: 'Social media account removed successfully' });
            } else {
                res.status(404).json({ success: false, message: 'Social media account not found' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Scheduled Messages
    router.post('/notifications/scheduled', async (req, res) => {
        try {
            const config = {
                ...req.body,
                createdBy: req.user.username
            };
            
            const message = await notificationService.addScheduledMessage(config);
            res.json({ success: true, message });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    router.delete('/notifications/scheduled/:messageId', async (req, res) => {
        try {
            const { messageId } = req.params;
            const deleted = await notificationService.removeScheduledMessage(messageId);
            
            if (deleted) {
                res.json({ success: true, message: 'Scheduled message removed successfully' });
            } else {
                res.status(404).json({ success: false, message: 'Scheduled message not found' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Webhooks
    router.post('/notifications/webhook', async (req, res) => {
        try {
            const config = {
                ...req.body,
                createdBy: req.user.username
            };
            
            const webhook = await notificationService.addWebhook(config);
            res.json({ success: true, webhook });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    router.delete('/notifications/webhook/:webhookId', async (req, res) => {
        try {
            const { webhookId } = req.params;
            const deleted = await notificationService.removeWebhook(webhookId);
            
            if (deleted) {
                res.json({ success: true, message: 'Webhook removed successfully' });
            } else {
                res.status(404).json({ success: false, message: 'Webhook not found' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Webhook endpoint for external services
    router.post('/webhook/:webhookId', async (req, res) => {
        try {
            const { webhookId } = req.params;
            await notificationService.processWebhookEvent(webhookId, req.body);
            res.json({ success: true, message: 'Webhook processed' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

        // Debug route to check scheduled messages
    router.get('/notifications/scheduled/debug', async (req, res) => {
        try {
            const now = new Date();
            const messages = Array.from(notificationService.notifications.scheduledMessages.values());
            
            const debugInfo = messages.map(message => ({
                id: message.id,
                name: message.name,
                enabled: message.enabled,
                schedule: message.schedule,
                lastSent: message.lastSent,
                shouldSend: notificationService.shouldSendScheduledMessage(message, now),
                currentTime: now.toISOString(),
                currentHour: now.getHours(),
                currentMinute: now.getMinutes()
            }));
            
            res.json({
                currentTime: now.toISOString(),
                messages: debugInfo
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    
        // Force process all scheduled messages now
    router.post('/notifications/scheduled/process-now', async (req, res) => {
        try {
            await notificationService.processScheduledMessages();
            res.json({ success: true, message: 'Scheduled messages processed' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Add this route for manual testing
    router.post('/notifications/scheduled/:messageId/test', async (req, res) => {
        try {
            const { messageId } = req.params;
            const message = notificationService.notifications.scheduledMessages.get(messageId);
            
            if (!message) {
                return res.status(404).json({ success: false, message: 'Scheduled message not found' });
            }
            
            if (!message.enabled) {
                return res.status(400).json({ success: false, message: 'Message is disabled' });
            }
            
            // Force send the message
            await notificationService.sendScheduledMessage(message);
            
            res.json({ success: true, message: 'Scheduled message sent successfully' });
        } catch (error) {
            console.error('Error testing scheduled message:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Debug current time and messages
    router.get('/notifications/scheduled/debug', (req, res) => {
        try {
            const now = new Date();
            const utcNow = new Date(now.toISOString());
            
            const messages = Array.from(notificationService.notifications.scheduledMessages.values()).map(message => {
                const shouldSend = notificationService.shouldSendScheduledMessage(message, now);
                return {
                    id: message.id,
                    name: message.name,
                    enabled: message.enabled,
                    schedule: message.schedule,
                    lastSent: message.lastSent,
                    shouldSend,
                    timeMatch: (() => {
                        const [scheduleHour, scheduleMinute] = message.schedule.time.split(':').map(Number);
                        return utcNow.getUTCHours() === scheduleHour && utcNow.getUTCMinutes() === scheduleMinute;
                    })()
                };
            });
            
            res.json({
                serverTime: now.toISOString(),
                utcTime: utcNow.toISOString(),
                currentUTCHour: utcNow.getUTCHours(),
                currentUTCMinute: utcNow.getUTCMinutes(),
                messages
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });


    // Test RSS feed
    router.post('/notifications/rss/test', async (req, res) => {
        try {
            const { url } = req.body;
            const Parser = require('rss-parser');
            const parser = new Parser();
            
            const feed = await parser.parseURL(url);
            
            res.json({
                success: true,
                feedInfo: {
                    title: feed.title,
                    description: feed.description,
                    itemCount: feed.items.length,
                    lastUpdated: feed.lastBuildDate,
                    sampleItems: feed.items.slice(0, 3).map(item => ({
                        title: item.title,
                        pubDate: item.pubDate,
                        link: item.link
                    }))
                }
            });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Invalid RSS feed URL' });
        }
    });

    return router;
};
