const { EmbedBuilder } = require('discord.js');
const { storage } = require('../config/database');
const { saveDataDebounced } = require('./dataService');

class NotificationService {
    constructor() {
        this.notifications = {
            rssFeeds: new Map(), // feedId -> feed config
            socialMedia: new Map(), // accountId -> account config
            scheduledMessages: new Map(), // messageId -> scheduled message
            webhooks: new Map(), // webhookId -> webhook config
            customNotifications: new Map() // notificationId -> custom notification
        };
        
        this.feedCache = new Map(); // feedUrl -> last items
        this.socialCache = new Map(); // accountId -> last posts
        this.scheduledJobs = new Map(); // jobId -> timeout reference
        
        this.startNotificationSystem();
    }

    // Start the notification system
    startNotificationSystem() {
        // Check RSS feeds every minute
        setInterval(() => {
            this.checkRSSFeeds();
        }, 1 * 60 * 1000);

        // Check social media every minute
        setInterval(() => {
            this.checkSocialMedia();
        }, 1 * 60 * 1000);

        // Process scheduled messages every minute
        setInterval(() => {
            this.processScheduledMessages();
        }, 60 * 1000);

        console.log('✅ Notification system started');
    }

    // RSS Feed Management
    async addRSSFeed(config) {
        const feedId = Date.now().toString();
        const feed = {
            id: feedId,
            name: config.name,
            url: config.url,
            channelId: config.channelId,
            guildId: config.guildId,
            enabled: true,
            lastCheck: null,
            itemCount: 0,
            embed: {
                enabled: config.embed?.enabled || true,
                color: config.embed?.color || '#5865f2',
                includeImage: config.embed?.includeImage || true,
                includeDescription: config.embed?.includeDescription || true
            },
            filters: {
                keywords: config.filters?.keywords || [],
                excludeKeywords: config.filters?.excludeKeywords || [],
                maxAge: config.filters?.maxAge || 24 // hours
            },
            createdAt: new Date().toISOString(),
            createdBy: config.createdBy
        };

        this.notifications.rssFeeds.set(feedId, feed);
        await this.saveNotificationData();
        
        // Initial check
        await this.checkSingleRSSFeed(feed);
        
        return feed;
    }

    async removeRSSFeed(feedId) {
        const deleted = this.notifications.rssFeeds.delete(feedId);
        if (deleted) {
            this.feedCache.delete(feedId);
            await this.saveNotificationData();
        }
        return deleted;
    }

    async checkRSSFeeds() {
        for (const [feedId, feed] of this.notifications.rssFeeds.entries()) {
            if (feed.enabled) {
                await this.checkSingleRSSFeed(feed);
            }
        }
    }

    async checkSingleRSSFeed(feed) {
        try {
            const Parser = require('rss-parser');
            const parser = new Parser();
            
            const rssFeed = await parser.parseURL(feed.url);
            const cachedItems = this.feedCache.get(feed.id) || [];
            const newItems = [];

            for (const item of rssFeed.items.slice(0, 20)) { // Check last 5 items
                const itemId = item.guid || item.link || item.title;
                
                if (!cachedItems.includes(itemId)) {
                    // Check if item is within age limit
                    const itemDate = new Date(item.pubDate || item.isoDate);
                    const ageHours = (Date.now() - itemDate.getTime()) / (1000 * 60 * 60);
                    
                    if (ageHours <= feed.filters.maxAge) {
                        // Check keyword filters
                        if (this.passesFilters(item, feed.filters)) {
                            newItems.push(item);
                            cachedItems.push(itemId);
                        }
                    }
                }
            }

            // Keep only last 50 cached items
            if (cachedItems.length > 50) {
                cachedItems.splice(0, cachedItems.length - 50);
            }
            this.feedCache.set(feed.id, cachedItems);

            // Send notifications for new items
            for (const item of newItems.reverse()) { // Oldest first
                await this.sendRSSNotification(feed, item, rssFeed);
            }

            // Update feed stats
            feed.lastCheck = new Date().toISOString();
            feed.itemCount += newItems.length;
            
        } catch (error) {
            console.error(`Error checking RSS feed ${feed.name}:`, error.message);
        }
    }

    passesFilters(item, filters) {
        const content = `${item.title} ${item.content || item.description || ''}`.toLowerCase();
        
        // Check include keywords
        if (filters.keywords.length > 0) {
            const hasKeyword = filters.keywords.some(keyword => 
                content.includes(keyword.toLowerCase())
            );
            if (!hasKeyword) return false;
        }
        
        // Check exclude keywords
        if (filters.excludeKeywords.length > 0) {
            const hasExcludeKeyword = filters.excludeKeywords.some(keyword => 
                content.includes(keyword.toLowerCase())
            );
            if (hasExcludeKeyword) return false;
        }
        
        return true;
    }

    async sendRSSNotification(feed, item, rssFeed) {
        try {
            const { client } = require('../bot');
            const channel = await client.channels.fetch(feed.channelId);
            
            if (!channel) return;

            if (feed.embed.enabled) {
                const embed = new EmbedBuilder()
                    .setTitle(item.title || 'New Post')
                    .setColor(feed.embed.color)
                    .setTimestamp(new Date(item.pubDate || item.isoDate))
                    .setFooter({ text: `${rssFeed.title || feed.name}` });

                if (item.link) {
                    embed.setURL(item.link);
                }

                if (feed.embed.includeDescription && (item.content || item.description)) {
                    let description = item.content || item.description;
                    // Strip HTML tags and limit length
                    description = description.replace(/<[^>]*>/g, '').substring(0, 2000);
                    embed.setDescription(description);
                }

                if (feed.embed.includeImage && item.enclosure?.url) {
                    embed.setImage(item.enclosure.url);
                }

                if (item.creator || item.author) {
                    embed.setAuthor({ name: item.creator || item.author });
                }

                await channel.send({ embeds: [embed] });
            } else {
                let message = `**${item.title}**\n${item.link || ''}`;
                if (item.content || item.description) {
                    const description = (item.content || item.description)
                        .replace(/<[^>]*>/g, '')
                        .substring(0, 500);
                    message += `\n${description}`;
                }
                await channel.send(message);
            }

            // Emit to dashboard
            const { io } = require('../bot');
            if (io) {
                io.emit('rssNotification', {
                    feedName: feed.name,
                    itemTitle: item.title,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error(`Error sending RSS notification:`, error.message);
        }
    }

    // Social Media Management
    async addSocialMediaAccount(config) {
        const accountId = Date.now().toString();
        const account = {
            id: accountId,
            platform: config.platform, // 'twitter', 'youtube', 'twitch'
            username: config.username,
            channelId: config.channelId,
            guildId: config.guildId,
            enabled: true,
            lastCheck: null,
            postCount: 0,
            notifications: {
                newPosts: config.notifications?.newPosts || true,
                liveStreams: config.notifications?.liveStreams || true,
                newVideos: config.notifications?.newVideos || true
            },
            embed: {
                enabled: config.embed?.enabled || true,
                color: config.embed?.color || '#1DA1F2',
                includeMedia: config.embed?.includeMedia || true
            },
            createdAt: new Date().toISOString(),
            createdBy: config.createdBy
        };

        this.notifications.socialMedia.set(accountId, account);
        await this.saveNotificationData();
        
        return account;
    }

    async removeSocialMediaAccount(accountId) {
        const deleted = this.notifications.socialMedia.delete(accountId);
        if (deleted) {
            this.socialCache.delete(accountId);
            await this.saveNotificationData();
        }
        return deleted;
    }

    async checkSocialMedia() {
        for (const [accountId, account] of this.notifications.socialMedia.entries()) {
            if (account.enabled) {
                await this.checkSingleSocialAccount(account);
            }
        }
    }

    async checkSingleSocialAccount(account) {
        try {
            switch (account.platform) {
                case 'youtube':
                    await this.checkYouTubeChannel(account);
                    break;
                case 'twitch':
                    await this.checkTwitchChannel(account);
                    break;
                case 'twitter':
                    // Twitter API requires special setup
                    console.log(`Twitter checking not implemented for ${account.username}`);
                    break;
            }
            
            account.lastCheck = new Date().toISOString();
        } catch (error) {
            console.error(`Error checking ${account.platform} account ${account.username}:`, error.message);
        }
    }

    async checkYouTubeChannel(account) {
        // This is a simplified example - you'd need YouTube API key
        // For now, we'll simulate the functionality
        console.log(`Checking YouTube channel: ${account.username}`);
        
        // In a real implementation, you'd:
        // 1. Use YouTube Data API v3
        // 2. Get channel's latest videos
        // 3. Compare with cached videos
        // 4. Send notifications for new videos
    }

    async checkTwitchChannel(account) {
        // This is a simplified example - you'd need Twitch API credentials
        console.log(`Checking Twitch channel: ${account.username}`);
        
        // In a real implementation, you'd:
        // 1. Use Twitch API
        // 2. Check if channel is live
        // 3. Send live stream notifications
    }

    // Scheduled Messages with Enhanced Timezone Support
    async addScheduledMessage(config) {
        const messageId = Date.now().toString();
        const scheduledMessage = {
            id: messageId,
            name: config.name,
            content: config.content,
            channelId: config.channelId,
            guildId: config.guildId,
            schedule: {
                type: config.schedule.type, // 'once', 'daily', 'weekly', 'monthly'
                time: config.schedule.time, // HH:MM format (24-hour)
                date: config.schedule.date, // For 'once' type
                dayOfWeek: config.schedule.dayOfWeek, // For 'weekly' type (0-6)
                dayOfMonth: config.schedule.dayOfMonth, // For 'monthly' type (1-31)
                timezone: config.schedule.timezone || 'UTC'
            },
            embed: config.embed || null,
            enabled: true,
            lastSent: null,
            sentCount: 0,
            createdAt: new Date().toISOString(),
            createdBy: config.createdBy
        };

        this.notifications.scheduledMessages.set(messageId, scheduledMessage);
        await this.saveNotificationData();
        
        return scheduledMessage;
    }

    async removeScheduledMessage(messageId) {
        const deleted = this.notifications.scheduledMessages.delete(messageId);
        if (deleted) {
            // Clear any scheduled job
            const job = this.scheduledJobs.get(messageId);
            if (job) {
                clearTimeout(job);
                this.scheduledJobs.delete(messageId);
            }
            await this.saveNotificationData();
        }
        return deleted;
    }

    async processScheduledMessages() {
        const now = new Date();
        console.log(`🕐 Processing scheduled messages at ${now.toISOString()}`);
        
        for (const [messageId, message] of this.notifications.scheduledMessages.entries()) {
            if (!message.enabled) {
                console.log(`⏭️ Skipping disabled message: ${message.name}`);
                continue;
            }
            
            console.log(`🔍 Checking message: ${message.name}`);
            
            if (this.shouldSendScheduledMessage(message, now)) {
                console.log(`📤 Sending scheduled message: ${message.name}`);
                await this.sendScheduledMessage(message);
            } else {
                console.log(`⏰ Not time for message: ${message.name}`);
            }
        }
    }

    shouldSendScheduledMessage(message, now) {
        const schedule = message.schedule;
        
        try {
            // Convert current time to the message's timezone
            let currentHour, currentMinute, currentDate, currentDay;
            
            if (schedule.timezone && schedule.timezone !== 'UTC') {
                // Get current time in the target timezone
                const nowInTargetTZ = new Date(now.toLocaleString("en-US", {timeZone: schedule.timezone}));
                currentHour = nowInTargetTZ.getHours();
                currentMinute = nowInTargetTZ.getMinutes();
                currentDate = nowInTargetTZ.getDate();
                currentDay = nowInTargetTZ.getDay();
                
                console.log(`⏰ Checking ${message.name} in ${schedule.timezone}: Current ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
            } else {
                // UTC handling
                const utcNow = new Date(now.toISOString());
                currentHour = utcNow.getUTCHours();
                currentMinute = utcNow.getUTCMinutes();
                currentDate = utcNow.getUTCDate();
                currentDay = utcNow.getUTCDay();
                
                console.log(`⏰ Checking ${message.name} in UTC: Current ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
            }
            
            // Parse schedule time
            const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
            console.log(`📅 Schedule time: ${scheduleHour}:${scheduleMinute.toString().padStart(2, '0')}`);
            
            // Check if current time matches scheduled time
            const isTimeMatch = currentHour === scheduleHour && currentMinute === scheduleMinute;
            
            if (!isTimeMatch) {
                return false;
            }
            
            // Check if already sent today
            if (message.lastSent) {
                const lastSent = new Date(message.lastSent);
                const today = new Date();
                
                // Convert both dates to the same timezone for comparison
                let todayInTZ, lastSentInTZ;
                
                if (schedule.timezone && schedule.timezone !== 'UTC') {
                    todayInTZ = new Date(today.toLocaleString("en-US", {timeZone: schedule.timezone}));
                    lastSentInTZ = new Date(lastSent.toLocaleString("en-US", {timeZone: schedule.timezone}));
                } else {
                    todayInTZ = new Date(today.toISOString().split('T')[0]);
                    lastSentInTZ = new Date(lastSent.toISOString().split('T')[0]);
                }
                
                todayInTZ.setHours(0, 0, 0, 0);
                lastSentInTZ.setHours(0, 0, 0, 0);
                
                if (lastSentInTZ.getTime() === todayInTZ.getTime()) {
                    console.log(`✅ Message ${message.name} already sent today`);
                    return false;
                }
            }
            
            switch (schedule.type) {
                case 'once':
                    if (!schedule.date) {
                        console.log(`❌ No date specified for once message: ${message.name}`);
                        return false;
                    }
                    
                    // Parse the target date
                    const targetDate = new Date(schedule.date + 'T00:00:00');
                    let todayDate;
                    
                    if (schedule.timezone && schedule.timezone !== 'UTC') {
                        todayDate = new Date(now.toLocaleString("en-US", {timeZone: schedule.timezone}));
                    } else {
                        todayDate = new Date();
                    }
                    
                    const shouldSend = targetDate.toDateString() === todayDate.toDateString() && !message.lastSent;
                    console.log(`📅 Once message ${message.name}: today ${todayDate.toDateString()}, target ${targetDate.toDateString()}, should send: ${shouldSend}`);
                    return shouldSend;
                    
                case 'daily':
                    console.log(`📅 Daily message ${message.name} should send`);
                    return true;
                    
                case 'weekly':
                    const shouldSendWeekly = currentDay === schedule.dayOfWeek;
                    console.log(`📅 Weekly message ${message.name}, current day: ${currentDay}, target day: ${schedule.dayOfWeek}, should send: ${shouldSendWeekly}`);
                    return shouldSendWeekly;
                    
                case 'monthly':
                    const shouldSendMonthly = currentDate === schedule.dayOfMonth;
                    console.log(`📅 Monthly message ${message.name}, current date: ${currentDate}, target date: ${schedule.dayOfMonth}, should send: ${shouldSendMonthly}`);
                    return shouldSendMonthly;
                    
                default:
                    console.log(`❌ Unknown schedule type: ${schedule.type}`);
                    return false;
            }
        } catch (error) {
            console.error(`Error processing timezone for ${message.name}:`, error);
            return false;
        }
    }

    async sendScheduledMessage(message) {
        try {
            console.log(`📤 Attempting to send message: ${message.name}`);
            
            const { client } = require('../bot');
            if (!client || !client.isReady()) {
                throw new Error('Discord client not ready');
            }
            
            const channel = await client.channels.fetch(message.channelId);
            if (!channel) {
                throw new Error(`Channel ${message.channelId} not found`);
            }

            console.log(`📍 Found channel: ${channel.name} (${channel.id})`);

            if (message.embed && message.embed.enabled) {
                const embed = new EmbedBuilder()
                    .setTitle(message.embed.title || 'Scheduled Message')
                    .setDescription(message.content)
                    .setColor(message.embed.color || '#5865f2')
                    .setTimestamp();

                if (message.embed.image) {
                    embed.setImage(message.embed.image);
                }

                await channel.send({ embeds: [embed] });
                console.log(`✅ Sent embed message: ${message.name}`);
            } else {
                await channel.send(message.content);
                console.log(`✅ Sent text message: ${message.name}`);
            }

            // Update message stats
            message.lastSent = new Date().toISOString();
            message.sentCount = (message.sentCount || 0) + 1;
            
            // If it's a 'once' message, disable it
            if (message.schedule.type === 'once') {
                message.enabled = false;
                console.log(`🔒 Disabled once message: ${message.name}`);
            }

            await this.saveNotificationData();

            // Emit to dashboard
            const { io } = require('../bot');
            if (io) {
                io.emit('scheduledMessageSent', {
                    messageName: message.name,
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`🎉 Successfully sent scheduled message: ${message.name}`);

        } catch (error) {
            console.error(`❌ Error sending scheduled message ${message.name}:`, error.message);
            throw error;
        }
    }

    // Manual trigger for testing
    async triggerScheduledMessage(messageId) {
        const message = this.notifications.scheduledMessages.get(messageId);
        if (message && message.enabled) {
            await this.sendScheduledMessage(message);
            return true;
        }
        return false;
    }

    // Webhook Management
    async addWebhook(config) {
        const webhookId = Date.now().toString();
        const webhook = {
            id: webhookId,
            name: config.name,
            url: config.url,
            secret: config.secret || null,
            channelId: config.channelId,
            guildId: config.guildId,
            enabled: true,
            eventCount: 0,
            filters: config.filters || {},
            embed: config.embed || { enabled: true, color: '#5865f2' },
            createdAt: new Date().toISOString(),
            createdBy: config.createdBy
        };

        this.notifications.webhooks.set(webhookId, webhook);
        await this.saveNotificationData();
        
        return webhook;
    }

    async removeWebhook(webhookId) {
        const deleted = this.notifications.webhooks.delete(webhookId);
        if (deleted) {
            await this.saveNotificationData();
        }
        return deleted;
    }

    async processWebhookEvent(webhookId, eventData) {
        const webhook = this.notifications.webhooks.get(webhookId);
        if (!webhook || !webhook.enabled) return;

        try {
            const { client } = require('../bot');
            const channel = await client.channels.fetch(webhook.channelId);
            
            if (!channel) return;

            if (webhook.embed.enabled) {
                const embed = new EmbedBuilder()
                    .setTitle(eventData.title || 'Webhook Event')
                    .setDescription(eventData.description || 'New webhook event received')
                    .setColor(webhook.embed.color)
                    .setTimestamp();

                if (eventData.url) embed.setURL(eventData.url);
                if (eventData.image) embed.setImage(eventData.image);
                if (eventData.author) embed.setAuthor({ name: eventData.author });

                await channel.send({ embeds: [embed] });
            } else {
                await channel.send(eventData.message || JSON.stringify(eventData, null, 2));
            }

            webhook.eventCount++;
            await this.saveNotificationData();

        } catch (error) {
            console.error(`Error processing webhook event:`, error.message);
        }
    }

    // Data Management
    getAllNotifications() {
        return {
            rssFeeds: Object.fromEntries(this.notifications.rssFeeds),
            socialMedia: Object.fromEntries(this.notifications.socialMedia),
            scheduledMessages: Object.fromEntries(this.notifications.scheduledMessages),
            webhooks: Object.fromEntries(this.notifications.webhooks),
            stats: this.getNotificationStats()
        };
    }

    getNotificationStats() {
        return {
            totalRSSFeeds: this.notifications.rssFeeds.size,
            activeRSSFeeds: Array.from(this.notifications.rssFeeds.values()).filter(f => f.enabled).length,
            totalSocialAccounts: this.notifications.socialMedia.size,
            activeSocialAccounts: Array.from(this.notifications.socialMedia.values()).filter(a => a.enabled).length,
            totalScheduledMessages: this.notifications.scheduledMessages.size,
            activeScheduledMessages: Array.from(this.notifications.scheduledMessages.values()).filter(m => m.enabled).length,
            totalWebhooks: this.notifications.webhooks.size,
            activeWebhooks: Array.from(this.notifications.webhooks.values()).filter(w => w.enabled).length
        };
    }

    async saveNotificationData() {
        try {
            const data = {
                notifications: {
                    rssFeeds: Object.fromEntries(this.notifications.rssFeeds),
                    socialMedia: Object.fromEntries(this.notifications.socialMedia),
                    scheduledMessages: Object.fromEntries(this.notifications.scheduledMessages),
                    webhooks: Object.fromEntries(this.notifications.webhooks),
                    customNotifications: Object.fromEntries(this.notifications.customNotifications)
                },
                cache: {
                    feedCache: Object.fromEntries(this.feedCache),
                    socialCache: Object.fromEntries(this.socialCache)
                }
            };

            const fs = require('fs').promises;
            const path = require('path');
            const { ensureDataDir } = require('./dataService');
            
            await ensureDataDir();
            await fs.writeFile(
                path.join(__dirname, '../data/notification-data.json'),
                JSON.stringify(data, null, 2)
            );
            
            console.log('💾 Notification data saved');
        } catch (error) {
            console.error('❌ Failed to save notification data:', error);
        }
    }

    async loadNotificationData() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const data = await fs.readFile(
                path.join(__dirname, '../data/notification-data.json'),
                'utf8'
            );
            
            const parsed = JSON.parse(data);
            const notifications = parsed.notifications || {};
            const cache = parsed.cache || {};
            
            this.notifications.rssFeeds = new Map(Object.entries(notifications.rssFeeds || {}));
            this.notifications.socialMedia = new Map(Object.entries(notifications.socialMedia || {}));
            this.notifications.scheduledMessages = new Map(Object.entries(notifications.scheduledMessages || {}));
            this.notifications.webhooks = new Map(Object.entries(notifications.webhooks || {}));
            this.notifications.customNotifications = new Map(Object.entries(notifications.customNotifications || {}));
            
            this.feedCache = new Map(Object.entries(cache.feedCache || {}));
            this.socialCache = new Map(Object.entries(cache.socialCache || {}));
            
            console.log('✅ Notification data loaded');
        } catch (error) {
            console.log('🔔 No existing notification data found, starting fresh');
        }
    }
}

module.exports = new NotificationService();
