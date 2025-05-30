// Add this to handlers/analyticsHandler.js
const analyticsService = require('../services/analyticsService');

function setupAnalyticsHandler(client, io) {
    // Track message activity
    client.on('messageCreate', (message) => {
        if (message.author.bot || !message.guild) return;
        
        analyticsService.trackMessage(
            message.guild.id,
            message.channel.id,
            message.author.id,
            message.createdAt
        );
        
        // Save data every 50 messages to prevent data loss
        if (Math.random() < 0.02) { // 2% chance = roughly every 50 messages
            analyticsService.saveAnalyticsData();
        }
    });

    // Track member joins
    client.on('guildMemberAdd', (member) => {
        analyticsService.trackMemberJoin(
            member.guild.id,
            member.user.id,
            new Date()
        );
        
        // Save immediately for important events
        analyticsService.saveAnalyticsData();
        
        // Emit real-time update
        io.emit('memberJoined', {
            guildId: member.guild.id,
            userId: member.user.id,
            username: member.user.username,
            timestamp: new Date().toISOString()
        });
    });

    // Track member leaves
    client.on('guildMemberRemove', (member) => {
        analyticsService.trackMemberLeave(
            member.guild.id,
            member.user.id,
            new Date()
        );
        
        // Save immediately for important events
        analyticsService.saveAnalyticsData();
        
        // Emit real-time update
        io.emit('memberLeft', {
            guildId: member.guild.id,
            userId: member.user.id,
            username: member.user.username,
            timestamp: new Date().toISOString()
        });
    });

    // Voice state tracking (same as before but with periodic saves)
    const voiceSessions = new Map();
    
    client.on('voiceStateUpdate', (oldState, newState) => {
        const userId = newState.member.user.id;
        const guildId = newState.guild.id;
        const now = new Date();
        
        // User joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            voiceSessions.set(userId, {
                channelId: newState.channelId,
                joinTime: now
            });
            
            analyticsService.trackVoiceJoin(
                guildId,
                newState.channelId,
                userId,
                now
            );
        }
        
        // User left a voice channel
        if (oldState.channelId && !newState.channelId) {
            const session = voiceSessions.get(userId);
            if (session) {
                const duration = now.getTime() - session.joinTime.getTime();
                analyticsService.trackVoiceLeave(
                    guildId,
                    oldState.channelId,
                    userId,
                    now,
                    duration
                );
                voiceSessions.delete(userId);
                
                // Save voice data immediately
                analyticsService.saveAnalyticsData();
            }
        }
        
        // User switched channels
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const session = voiceSessions.get(userId);
            if (session) {
                const duration = now.getTime() - session.joinTime.getTime();
                analyticsService.trackVoiceLeave(
                    guildId,
                    oldState.channelId,
                    userId,
                    now,
                    duration
                );
            }
            
            voiceSessions.set(userId, {
                channelId: newState.channelId,
                joinTime: now
            });
            
            analyticsService.trackVoiceJoin(
                guildId,
                newState.channelId,
                userId,
                now
            );
        }
    });

    // Track command usage (integrate with existing command handler)
    const originalEmit = io.emit;
    io.emit = function(event, data) {
        if (event === 'commandUsed') {
            analyticsService.trackCommand(
                data.command,
                data.user,
                data.guild,
                new Date(data.timestamp)
            );
        }
        return originalEmit.apply(this, arguments);
    };

    console.log('✅ Analytics handler configured with data persistence');
}

module.exports = { setupAnalyticsHandler };
