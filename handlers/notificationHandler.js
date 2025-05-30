const notificationService = require('../services/notificationService');

function setupNotificationHandler(client, io) {
    // Listen for notification events from the service
    const originalEmit = io.emit;
    io.emit = function(event, data) {
        // Log notification events
        if (['rssNotification', 'scheduledMessageSent', 'socialMediaNotification'].includes(event)) {
            console.log(`📢 Notification event: ${event}`, data);
        }
        return originalEmit.apply(this, arguments);
    };

    // Handle real-time notification updates
    io.on('connection', (socket) => {
        socket.on('subscribeToNotifications', (data) => {
            console.log(`🔔 Client subscribed to notifications: ${socket.id}`);
            
            // Send current notification stats
            const stats = notificationService.getNotificationStats();
            socket.emit('notificationStats', stats);
        });

        socket.on('unsubscribeFromNotifications', () => {
            console.log(`🔕 Client unsubscribed from notifications: ${socket.id}`);
        });

        socket.on('testNotification', async (data) => {
            try {
                if (data.type === 'rss' && data.feedId) {
                    const feeds = notificationService.notifications.rssFeeds;
                    const feed = feeds.get(data.feedId);
                    if (feed) {
                        await notificationService.checkSingleRSSFeed(feed);
                        socket.emit('testNotificationResult', {
                            success: true,
                            message: 'RSS feed test completed'
                        });
                    }
                } else if (data.type === 'scheduled' && data.messageId) {
                    const messages = notificationService.notifications.scheduledMessages;
                    const message = messages.get(data.messageId);
                    if (message) {
                        await notificationService.sendScheduledMessage(message);
                        socket.emit('testNotificationResult', {
                            success: true,
                            message: 'Scheduled message sent'
                        });
                    }
                }
            } catch (error) {
                socket.emit('testNotificationResult', {
                    success: false,
                    message: error.message
                });
            }
        });
    });

    // Save notification data every 10 minutes
    setInterval(() => {
        notificationService.saveNotificationData();
    }, 10 * 60 * 1000);

    console.log('✅ Notification handler configured');
}

module.exports = { setupNotificationHandler };
