const fs = require('fs').promises;
const path = require('path');

async function generateTestData() {
    const now = new Date();
    
    // Generate fake server growth data for last 7 days
    const serverGrowth = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(now);
        day.setDate(day.getDate() - (6 - i));
        serverGrowth.push({
            date: day.toDateString(),
            guildId: '1160603423385866381', // Your actual guild ID
            netChange: Math.floor(Math.random() * 10) - 3, // Random between -3 and 6
            joins: Math.floor(Math.random() * 8),
            leaves: Math.floor(Math.random() * 5),
            timestamp: day.toISOString()
        });
    }

    // Generate fake message activity data for last 24 hours
    const messageActivity = [];
    for (let i = 0; i < 24; i++) {
        const hour = new Date(now);
        hour.setHours(hour.getHours() - (23 - i), 0, 0, 0);
        messageActivity.push({
            key: `${hour.toDateString()}-${hour.getHours()}`,
            date: hour.toDateString(),
            hour: hour.getHours(),
            count: Math.floor(Math.random() * 50) + 10, // Random between 10-60
            timestamp: hour.toISOString()
        });
    }

    // Generate fake channel activity
    const channelActivity = {
        '1245459380745539585': { // Your actual channel ID
            channelId: '1245459380745539585',
            messageCount: Math.floor(Math.random() * 1000) + 500,
            uniqueUsers: Array.from({length: Math.floor(Math.random() * 20) + 10}, (_, i) => `user${i + 1}`),
            hourlyActivity: Array.from({length: 24}, () => Math.floor(Math.random() * 20)),
            dailyActivity: Object.fromEntries(
                serverGrowth.map(day => [day.date, Math.floor(Math.random() * 100) + 50])
            )
        },
        'channel2': {
            channelId: 'channel2',
            messageCount: Math.floor(Math.random() * 500) + 200,
            uniqueUsers: Array.from({length: Math.floor(Math.random() * 15) + 5}, (_, i) => `user${i + 1}`),
            hourlyActivity: Array.from({length: 24}, () => Math.floor(Math.random() * 15)),
            dailyActivity: Object.fromEntries(
                serverGrowth.map(day => [day.date, Math.floor(Math.random() * 50) + 20])
            )
        }
    };

    // Generate fake user activity
    const userActivity = {};
    for (let i = 1; i <= 25; i++) {
        const userId = `user${i}`;
        userActivity[userId] = {
            userId,
            messageCount: Math.floor(Math.random() * 200) + 50,
            channelsUsed: Array.from({length: Math.floor(Math.random() * 3) + 1}, (_, j) => `channel${j + 1}`),
            hourlyActivity: Array.from({length: 24}, () => Math.floor(Math.random() * 10)),
            dailyActivity: Object.fromEntries(
                serverGrowth.map(day => [day.date, Math.floor(Math.random() * 20) + 5])
            ),
            firstSeen: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            lastSeen: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
        };
    }

    // Generate fake command usage
    const commands = ['ping', 'help', 'serverinfo', 'userinfo', 'roll', 'echo', 'warn', 'mute'];
    const commandUsage = {};
    commands.forEach(cmd => {
        commandUsage[cmd] = {
            commandName: cmd,
            totalUsage: Math.floor(Math.random() * 500) + 100,
            uniqueUsers: Array.from({length: Math.floor(Math.random() * 15) + 5}, (_, i) => `user${i + 1}`),
            hourlyUsage: Array.from({length: 24}, () => Math.floor(Math.random() * 20)),
            dailyUsage: Object.fromEntries(
                serverGrowth.map(day => [day.date, Math.floor(Math.random() * 50) + 10])
            ),
            recentUsage: []
        };
    });

    // Generate fake voice activity
    const voiceActivity = [];
    for (let i = 0; i < 20; i++) {
        const joinTime = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
        const duration = Math.floor(Math.random() * 3600) + 300; // 5 minutes to 1 hour
        const leaveTime = new Date(joinTime.getTime() + duration * 1000);
        
        voiceActivity.push({
            type: 'join',
            guildId: '1160603423385866381',
            channelId: 'voice_channel_1',
            userId: `user${Math.floor(Math.random() * 25) + 1}`,
            timestamp: joinTime.toISOString()
        });
        
        voiceActivity.push({
            type: 'leave',
            guildId: '1160603423385866381',
            channelId: 'voice_channel_1',
            userId: `user${Math.floor(Math.random() * 25) + 1}`,
            timestamp: leaveTime.toISOString(),
            duration: duration
        });
    }

    // Generate fake join/leave events
    const joinLeaveEvents = [];
    for (let i = 0; i < 14; i++) {
        const eventTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        joinLeaveEvents.push({
            type: Math.random() > 0.6 ? 'join' : 'leave',
            guildId: '1160603423385866381',
            userId: `user${Math.floor(Math.random() * 50) + 1}`,
            timestamp: eventTime.toISOString()
        });
    }

    // Generate daily stats
    const dailyStats = {};
    serverGrowth.forEach((day, index) => {
        dailyStats[day.date] = {
            date: day.date,
            totalMessages: Math.floor(Math.random() * 200) + 100,
            activeUsers: Math.floor(Math.random() * 30) + 10,
            commandsUsed: Math.floor(Math.random() * 50) + 20,
            voiceMinutes: Math.floor(Math.random() * 500) + 100,
            topChannels: [
                { channelId: '1245459380745539585', messages: Math.floor(Math.random() * 100) + 50 },
                { channelId: 'channel2', messages: Math.floor(Math.random() * 50) + 20 }
            ],
            topCommands: [
                { commandName: 'ping', usage: Math.floor(Math.random() * 20) + 10 },
                { commandName: 'help', usage: Math.floor(Math.random() * 15) + 5 }
            ]
        };
    });

    // Prepare the full analytics data structure
    const analyticsData = {
        analytics: {
            serverGrowth,
            messageActivity,
            channelActivity,
            userActivity,
            commandUsage,
            voiceActivity,
            joinLeaveEvents,
            dailyStats,
            weeklyStats: {},
            monthlyStats: {}
        },
        realTimeData: {
            activeUsers: Array.from({length: Math.floor(Math.random() * 10) + 5}, (_, i) => `user${i + 1}`),
            currentVoiceUsers: Array.from({length: Math.floor(Math.random() * 5)}, (_, i) => `user${i + 1}`),
            messagesLastHour: Math.floor(Math.random() * 50) + 20,
            commandsLastHour: Math.floor(Math.random() * 20) + 5
        },
        lastSaved: new Date().toISOString()
    };

    // Ensure data directory exists
    const dataDir = path.join(__dirname, '../data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }

    // Save the test data
    await fs.writeFile(
        path.join(dataDir, 'analytics-data.json'),
        JSON.stringify(analyticsData, null, 2)
    );

    console.log('✅ Test analytics data generated successfully!');
    console.log(`📊 Generated:`);
    console.log(`   - ${serverGrowth.length} days of server growth`);
    console.log(`   - ${messageActivity.length} hours of message activity`);
    console.log(`   - ${Object.keys(channelActivity).length} channels with activity`);
    console.log(`   - ${Object.keys(userActivity).length} users with activity`);
    console.log(`   - ${Object.keys(commandUsage).length} commands with usage data`);
    console.log(`   - ${voiceActivity.length} voice events`);
    console.log(`   - ${joinLeaveEvents.length} join/leave events`);
    console.log(`   - ${Object.keys(dailyStats).length} days of daily stats`);
}

// Run if called directly
if (require.main === module) {
    generateTestData().catch(console.error);
}

module.exports = { generateTestData };
