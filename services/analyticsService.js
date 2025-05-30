const { storage } = require('../config/database');
const { saveDataDebounced } = require('./dataService');

class AnalyticsService {
    constructor() {
        this.analytics = {
            serverGrowth: [], // Daily member counts
            messageActivity: [], // Hourly message counts
            channelActivity: new Map(), // channelId -> activity data
            userActivity: new Map(), // userId -> activity data
            commandUsage: new Map(), // command -> usage over time
            voiceActivity: [], // Voice channel usage
            joinLeaveEvents: [], // Member join/leave tracking
            dailyStats: new Map(), // date -> daily statistics
            weeklyStats: new Map(), // week -> weekly statistics
            monthlyStats: new Map() // month -> monthly statistics
        };
        
        this.realTimeData = {
            activeUsers: new Set(),
            currentVoiceUsers: new Set(),
            messagesLastHour: 0,
            commandsLastHour: 0
        };
        
        this.startDataCollection();
    }

    // Data Collection
    startDataCollection() {
        // Collect hourly stats
        setInterval(() => {
            this.collectHourlyStats();
        }, 60 * 60 * 1000); // Every hour

        // Collect daily stats
        setInterval(() => {
            this.collectDailyStats();
        }, 24 * 60 * 60 * 1000); // Every day

        // Reset real-time counters
        setInterval(() => {
            this.resetRealTimeCounters();
        }, 60 * 60 * 1000); // Every hour
    }

    // Track message activity
    trackMessage(guildId, channelId, userId, timestamp) {
        const hour = new Date(timestamp).getHours();
        const date = new Date(timestamp).toDateString();
        
        // Track hourly activity
        const hourlyKey = `${date}-${hour}`;
        const hourlyActivity = this.analytics.messageActivity.find(h => h.key === hourlyKey);
        if (hourlyActivity) {
            hourlyActivity.count++;
        } else {
            this.analytics.messageActivity.push({
                key: hourlyKey,
                date,
                hour,
                count: 1,
                timestamp
            });
        }

        // Track channel activity
        const channelData = this.analytics.channelActivity.get(channelId) || {
            channelId,
            messageCount: 0,
            uniqueUsers: new Set(),
            hourlyActivity: new Array(24).fill(0),
            dailyActivity: new Map()
        };
        
        channelData.messageCount++;
        channelData.uniqueUsers.add(userId);
        channelData.hourlyActivity[hour]++;
        
        const dayKey = date;
        channelData.dailyActivity.set(dayKey, (channelData.dailyActivity.get(dayKey) || 0) + 1);
        
        this.analytics.channelActivity.set(channelId, channelData);

        // Track user activity
        const userData = this.analytics.userActivity.get(userId) || {
            userId,
            messageCount: 0,
            channelsUsed: new Set(),
            hourlyActivity: new Array(24).fill(0),
            dailyActivity: new Map(),
            firstSeen: timestamp,
            lastSeen: timestamp
        };
        
        userData.messageCount++;
        userData.channelsUsed.add(channelId);
        userData.hourlyActivity[hour]++;
        userData.lastSeen = timestamp;
        
        userData.dailyActivity.set(dayKey, (userData.dailyActivity.get(dayKey) || 0) + 1);
        
        this.analytics.userActivity.set(userId, userData);

        // Real-time tracking
        this.realTimeData.activeUsers.add(userId);
        this.realTimeData.messagesLastHour++;

        // Limit array sizes
        if (this.analytics.messageActivity.length > 24 * 30) { // Keep 30 days
            this.analytics.messageActivity = this.analytics.messageActivity.slice(-24 * 30);
        }
    }

    // Track command usage
    trackCommand(commandName, userId, guildId, timestamp) {
        const date = new Date(timestamp).toDateString();
        const hour = new Date(timestamp).getHours();
        
        const commandData = this.analytics.commandUsage.get(commandName) || {
            commandName,
            totalUsage: 0,
            uniqueUsers: new Set(),
            hourlyUsage: new Array(24).fill(0),
            dailyUsage: new Map(),
            recentUsage: []
        };
        
        commandData.totalUsage++;
        commandData.uniqueUsers.add(userId);
        commandData.hourlyUsage[hour]++;
        commandData.dailyUsage.set(date, (commandData.dailyUsage.get(date) || 0) + 1);
        commandData.recentUsage.push({ userId, timestamp, guildId });
        
        // Keep only last 100 recent usages
        if (commandData.recentUsage.length > 100) {
            commandData.recentUsage = commandData.recentUsage.slice(-100);
        }
        
        this.analytics.commandUsage.set(commandName, commandData);
        this.realTimeData.commandsLastHour++;
    }

    // Track member join/leave
    trackMemberJoin(guildId, userId, timestamp) {
        this.analytics.joinLeaveEvents.push({
            type: 'join',
            guildId,
            userId,
            timestamp
        });

        // Update daily stats
        this.updateDailyGrowth(guildId, timestamp, 1);
        
        // Limit events array
        if (this.analytics.joinLeaveEvents.length > 10000) {
            this.analytics.joinLeaveEvents = this.analytics.joinLeaveEvents.slice(-10000);
        }
    }

    trackMemberLeave(guildId, userId, timestamp) {
        this.analytics.joinLeaveEvents.push({
            type: 'leave',
            guildId,
            userId,
            timestamp
        });

        // Update daily stats
        this.updateDailyGrowth(guildId, timestamp, -1);
    }

    // Track voice activity
    trackVoiceJoin(guildId, channelId, userId, timestamp) {
        this.analytics.voiceActivity.push({
            type: 'join',
            guildId,
            channelId,
            userId,
            timestamp
        });
        
        this.realTimeData.currentVoiceUsers.add(userId);
    }

    trackVoiceLeave(guildId, channelId, userId, timestamp, duration) {
        this.analytics.voiceActivity.push({
            type: 'leave',
            guildId,
            channelId,
            userId,
            timestamp,
            duration
        });
        
        this.realTimeData.currentVoiceUsers.delete(userId);
        
        // Limit voice activity array
        if (this.analytics.voiceActivity.length > 5000) {
            this.analytics.voiceActivity = this.analytics.voiceActivity.slice(-5000);
        }
    }

    // Update daily growth stats
    updateDailyGrowth(guildId, timestamp, change) {
        const date = new Date(timestamp).toDateString();
        const growthData = this.analytics.serverGrowth.find(g => g.date === date && g.guildId === guildId);
        
        if (growthData) {
            growthData.netChange += change;
            growthData.joins += change > 0 ? 1 : 0;
            growthData.leaves += change < 0 ? 1 : 0;
        } else {
            this.analytics.serverGrowth.push({
                date,
                guildId,
                netChange: change,
                joins: change > 0 ? 1 : 0,
                leaves: change < 0 ? 1 : 0,
                timestamp
            });
        }
    }

    // Collect hourly statistics
    collectHourlyStats() {
        const now = new Date();
        const hour = now.getHours();
        const date = now.toDateString();
        
        // This would be called every hour to aggregate data
        console.log(`📊 Collecting hourly stats for ${date} ${hour}:00`);
    }

    // Collect daily statistics
    collectDailyStats() {
        const now = new Date();
        const date = now.toDateString();
        
        const dailyStats = {
            date,
            totalMessages: Array.from(this.analytics.channelActivity.values())
                .reduce((sum, channel) => sum + (channel.dailyActivity.get(date) || 0), 0),
            activeUsers: this.realTimeData.activeUsers.size,
            commandsUsed: Array.from(this.analytics.commandUsage.values())
                .reduce((sum, cmd) => sum + (cmd.dailyUsage.get(date) || 0), 0),
            voiceMinutes: this.calculateDailyVoiceMinutes(date),
            topChannels: this.getTopChannels(date),
            topCommands: this.getTopCommands(date)
        };
        
        this.analytics.dailyStats.set(date, dailyStats);
        console.log(`📊 Daily stats collected for ${date}`);
    }

    // Calculate daily voice minutes
    calculateDailyVoiceMinutes(date) {
        const dayStart = new Date(date).getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        
        return this.analytics.voiceActivity
            .filter(activity => {
                const timestamp = new Date(activity.timestamp).getTime();
                return timestamp >= dayStart && timestamp < dayEnd && activity.duration;
            })
            .reduce((total, activity) => total + activity.duration, 0) / (1000 * 60); // Convert to minutes
    }

    // Get top channels for a date
    getTopChannels(date, limit = 5) {
        return Array.from(this.analytics.channelActivity.entries())
            .map(([channelId, data]) => ({
                channelId,
                messages: data.dailyActivity.get(date) || 0
            }))
            .sort((a, b) => b.messages - a.messages)
            .slice(0, limit);
    }

    // Get top commands for a date
    getTopCommands(date, limit = 5) {
        return Array.from(this.analytics.commandUsage.entries())
            .map(([commandName, data]) => ({
                commandName,
                usage: data.dailyUsage.get(date) || 0
            }))
            .sort((a, b) => b.usage - a.usage)
            .slice(0, limit);
    }

    // Reset real-time counters
    resetRealTimeCounters() {
        this.realTimeData.messagesLastHour = 0;
        this.realTimeData.commandsLastHour = 0;
        this.realTimeData.activeUsers.clear();
    }

    // Get analytics for specific time period
    getAnalytics(period = '7d', guildId = null) {
        const now = new Date();
        let startDate;
        
        switch (period) {
            case '24h':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        return {
            period,
            startDate: startDate.toISOString(),
            endDate: now.toISOString(),
            serverGrowth: this.getServerGrowthData(startDate, guildId),
            messageActivity: this.getMessageActivityData(startDate),
            channelActivity: this.getChannelActivityData(startDate),
            userActivity: this.getUserActivityData(startDate),
            commandUsage: this.getCommandUsageData(startDate),
            voiceActivity: this.getVoiceActivityData(startDate),
            realTimeStats: this.getRealTimeStats(),
            summary: this.getAnalyticsSummary(startDate, guildId)
        };
    }

    // Get server growth data
    getServerGrowthData(startDate, guildId = null) {
        return this.analytics.serverGrowth
            .filter(growth => {
                const growthDate = new Date(growth.timestamp);
                return growthDate >= startDate && (!guildId || growth.guildId === guildId);
            })
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Get message activity data
    getMessageActivityData(startDate) {
        return this.analytics.messageActivity
            .filter(activity => new Date(activity.timestamp) >= startDate)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Get channel activity data
    getChannelActivityData(startDate) {
        const result = {};
        for (const [channelId, data] of this.analytics.channelActivity.entries()) {
            result[channelId] = {
                channelId,
                messageCount: data.messageCount,
                uniqueUsers: data.uniqueUsers.size,
                hourlyActivity: data.hourlyActivity,
                recentActivity: Array.from(data.dailyActivity.entries())
                    .filter(([date]) => new Date(date) >= startDate)
                    .sort(([a], [b]) => new Date(a) - new Date(b))
            };
        }
        return result;
    }

    // Get user activity data
    getUserActivityData(startDate) {
        const result = {};
        for (const [userId, data] of this.analytics.userActivity.entries()) {
            if (new Date(data.lastSeen) >= startDate) {
                result[userId] = {
                    userId,
                    messageCount: data.messageCount,
                    channelsUsed: data.channelsUsed.size,
                    hourlyActivity: data.hourlyActivity,
                    firstSeen: data.firstSeen,
                    lastSeen: data.lastSeen
                };
            }
        }
        return result;
    }

    // Get command usage data
    getCommandUsageData(startDate) {
        const result = {};
        for (const [commandName, data] of this.analytics.commandUsage.entries()) {
            result[commandName] = {
                commandName,
                totalUsage: data.totalUsage,
                uniqueUsers: data.uniqueUsers.size,
                hourlyUsage: data.hourlyUsage,
                recentActivity: Array.from(data.dailyUsage.entries())
                    .filter(([date]) => new Date(date) >= startDate)
                    .sort(([a], [b]) => new Date(a) - new Date(b))
            };
        }
        return result;
    }

    // Get voice activity data
    getVoiceActivityData(startDate) {
        return this.analytics.voiceActivity
            .filter(activity => new Date(activity.timestamp) >= startDate)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Get real-time stats
    getRealTimeStats() {
        return {
            activeUsers: this.realTimeData.activeUsers.size,
            currentVoiceUsers: this.realTimeData.currentVoiceUsers.size,
            messagesLastHour: this.realTimeData.messagesLastHour,
            commandsLastHour: this.realTimeData.commandsLastHour,
            timestamp: new Date().toISOString()
        };
    }

    // Get analytics summary
    getAnalyticsSummary(startDate, guildId = null) {
        const growth = this.getServerGrowthData(startDate, guildId);
        const messages = this.getMessageActivityData(startDate);
        const commands = Object.values(this.getCommandUsageData(startDate));
        
        const totalJoins = growth.reduce((sum, g) => sum + g.joins, 0);
        const totalLeaves = growth.reduce((sum, g) => sum + g.leaves, 0);
        const totalMessages = messages.reduce((sum, m) => sum + m.count, 0);
        const totalCommands = commands.reduce((sum, c) => sum + c.totalUsage, 0);
        
        return {
            memberGrowth: {
                joins: totalJoins,
                leaves: totalLeaves,
                netGrowth: totalJoins - totalLeaves
            },
            activity: {
                totalMessages,
                totalCommands,
                activeUsers: Object.keys(this.getUserActivityData(startDate)).length
            },
            engagement: {
                avgMessagesPerUser: totalMessages / Math.max(Object.keys(this.getUserActivityData(startDate)).length, 1),
                avgCommandsPerUser: totalCommands / Math.max(Object.keys(this.getUserActivityData(startDate)).length, 1)
            }
        };
    }

    // Update the saveAnalyticsData method in services/analyticsService.js
    async saveAnalyticsData() {
        try {
            const data = {
                analytics: {
                    serverGrowth: this.analytics.serverGrowth,
                    messageActivity: this.analytics.messageActivity.slice(-2000), // Keep last 2000
                    channelActivity: Object.fromEntries(
                        Array.from(this.analytics.channelActivity.entries()).map(([id, data]) => [
                            id, 
                            {
                                ...data,
                                uniqueUsers: Array.from(data.uniqueUsers),
                                dailyActivity: Object.fromEntries(data.dailyActivity)
                            }
                        ])
                    ),
                    userActivity: Object.fromEntries(
                        Array.from(this.analytics.userActivity.entries()).map(([id, data]) => [
                            id,
                            {
                                ...data,
                                channelsUsed: Array.from(data.channelsUsed),
                                dailyActivity: Object.fromEntries(data.dailyActivity)
                            }
                        ])
                    ),
                    commandUsage: Object.fromEntries(
                        Array.from(this.analytics.commandUsage.entries()).map(([name, data]) => [
                            name,
                            {
                                ...data,
                                uniqueUsers: Array.from(data.uniqueUsers),
                                dailyUsage: Object.fromEntries(data.dailyUsage)
                            }
                        ])
                    ),
                    voiceActivity: this.analytics.voiceActivity.slice(-2000), // Keep last 2000
                    joinLeaveEvents: this.analytics.joinLeaveEvents.slice(-2000), // Keep last 2000
                    dailyStats: Object.fromEntries(this.analytics.dailyStats),
                    weeklyStats: Object.fromEntries(this.analytics.weeklyStats),
                    monthlyStats: Object.fromEntries(this.analytics.monthlyStats)
                },
                realTimeData: {
                    activeUsers: Array.from(this.realTimeData.activeUsers),
                    currentVoiceUsers: Array.from(this.realTimeData.currentVoiceUsers),
                    messagesLastHour: this.realTimeData.messagesLastHour,
                    commandsLastHour: this.realTimeData.commandsLastHour
                },
                lastSaved: new Date().toISOString()
            };

            const fs = require('fs').promises;
            const path = require('path');
            const { ensureDataDir } = require('./dataService');
            
            await ensureDataDir();
            await fs.writeFile(
                path.join(__dirname, '../data/analytics-data.json'),
                JSON.stringify(data, null, 2)
            );
            
            console.log('💾 Analytics data saved successfully');
        } catch (error) {
            console.error('❌ Failed to save analytics data:', error);
        }
    }

    // Update the loadAnalyticsData method in services/analyticsService.js
    async loadAnalyticsData() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const data = await fs.readFile(
                path.join(__dirname, '../data/analytics-data.json'),
                'utf8'
            );
            
            const parsed = JSON.parse(data);
            const analytics = parsed.analytics || {};
            const realTimeData = parsed.realTimeData || {};
            
            // Restore analytics data
            this.analytics.serverGrowth = analytics.serverGrowth || [];
            this.analytics.messageActivity = analytics.messageActivity || [];
            this.analytics.voiceActivity = analytics.voiceActivity || [];
            this.analytics.joinLeaveEvents = analytics.joinLeaveEvents || [];
            this.analytics.dailyStats = new Map(Object.entries(analytics.dailyStats || {}));
            this.analytics.weeklyStats = new Map(Object.entries(analytics.weeklyStats || {}));
            this.analytics.monthlyStats = new Map(Object.entries(analytics.monthlyStats || {}));
            
            // Restore Maps with proper data structures
            this.analytics.channelActivity = new Map(
                Object.entries(analytics.channelActivity || {}).map(([id, data]) => [
                    id,
                    {
                        ...data,
                        uniqueUsers: new Set(data.uniqueUsers || []),
                        dailyActivity: new Map(Object.entries(data.dailyActivity || {}))
                    }
                ])
            );
            
            this.analytics.userActivity = new Map(
                Object.entries(analytics.userActivity || {}).map(([id, data]) => [
                    id,
                    {
                        ...data,
                        channelsUsed: new Set(data.channelsUsed || []),
                        dailyActivity: new Map(Object.entries(data.dailyActivity || {}))
                    }
                ])
            );
            
            this.analytics.commandUsage = new Map(
                Object.entries(analytics.commandUsage || {}).map(([name, data]) => [
                    name,
                    {
                        ...data,
                        uniqueUsers: new Set(data.uniqueUsers || []),
                        dailyUsage: new Map(Object.entries(data.dailyUsage || {}))
                    }
                ])
            );

            // Restore real-time data
            this.realTimeData.activeUsers = new Set(realTimeData.activeUsers || []);
            this.realTimeData.currentVoiceUsers = new Set(realTimeData.currentVoiceUsers || []);
            this.realTimeData.messagesLastHour = realTimeData.messagesLastHour || 0;
            this.realTimeData.commandsLastHour = realTimeData.commandsLastHour || 0;
            
            console.log(`✅ Analytics data loaded - Last saved: ${parsed.lastSaved || 'Unknown'}`);
            console.log(`📊 Loaded ${this.analytics.messageActivity.length} message activities, ${this.analytics.channelActivity.size} channels, ${this.analytics.userActivity.size} users`);
        } catch (error) {
            console.log('📊 No existing analytics data found, starting fresh');
            // Initialize with empty data
            this.analytics = {
                serverGrowth: [],
                messageActivity: [],
                channelActivity: new Map(),
                userActivity: new Map(),
                commandUsage: new Map(),
                voiceActivity: [],
                joinLeaveEvents: [],
                dailyStats: new Map(),
                weeklyStats: new Map(),
                monthlyStats: new Map()
            };
            this.realTimeData = {
                activeUsers: new Set(),
                currentVoiceUsers: new Set(),
                messagesLastHour: 0,
                commandsLastHour: 0
            };
        }
    }

}

module.exports = new AnalyticsService();
