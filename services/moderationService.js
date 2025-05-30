const { EmbedBuilder } = require('discord.js');
const { storage } = require('../config/database');
const { saveDataDebounced } = require('./dataService');

class ModerationService {
    constructor() {
        this.warnings = new Map(); // userId -> warnings[]
        this.punishments = new Map(); // userId -> punishments[]
        this.moderationLogs = [];
        this.autoModConfig = {
            enabled: true,
            spamProtection: {
                enabled: true,
                maxMessages: 5,
                timeWindow: 5000, // 5 seconds
                punishment: 'mute',
                duration: 300000 // 5 minutes
            },
            profanityFilter: {
                enabled: true,
                words: ['badword1', 'badword2'], // Add your list
                punishment: 'warn',
                deleteMessage: true
            },
            linkProtection: {
                enabled: true,
                whitelist: ['discord.gg', 'youtube.com', 'github.com'],
                punishment: 'warn',
                deleteMessage: true
            },
            antiRaid: {
                enabled: true,
                maxJoins: 10,
                timeWindow: 60000, // 1 minute
                action: 'lockdown'
            },
            capsProtection: {
                enabled: true,
                maxCapsPercentage: 70,
                minLength: 10,
                punishment: 'warn'
            }
        };
        this.messageHistory = new Map(); // userId -> messages[]
        this.joinHistory = [];
    }

    // Warning System
    async addWarning(guildId, userId, moderatorId, reason) {
        const warningId = Date.now().toString();
        const warning = {
            id: warningId,
            guildId,
            userId,
            moderatorId,
            reason,
            timestamp: new Date().toISOString(),
            active: true
        };

        const userWarnings = this.warnings.get(userId) || [];
        userWarnings.push(warning);
        this.warnings.set(userId, userWarnings);

        await this.logModerationAction('warning', {
            targetId: userId,
            moderatorId,
            reason,
            warningId
        });

        // Check for escalation
        await this.checkWarningEscalation(guildId, userId);

        return warning;
    }

    async removeWarning(warningId, moderatorId) {
        for (const [userId, warnings] of this.warnings.entries()) {
            const warningIndex = warnings.findIndex(w => w.id === warningId);
            if (warningIndex !== -1) {
                warnings[warningIndex].active = false;
                warnings[warningIndex].removedBy = moderatorId;
                warnings[warningIndex].removedAt = new Date().toISOString();
                
                await this.logModerationAction('warning_removed', {
                    targetId: userId,
                    moderatorId,
                    warningId
                });
                
                return true;
            }
        }
        return false;
    }

    getUserWarnings(userId, activeOnly = true) {
        const warnings = this.warnings.get(userId) || [];
        return activeOnly ? warnings.filter(w => w.active) : warnings;
    }

    // Punishment System
    async addPunishment(guildId, userId, type, duration, moderatorId, reason) {
        const punishmentId = Date.now().toString();
        const punishment = {
            id: punishmentId,
            guildId,
            userId,
            type, // 'mute', 'ban', 'kick', 'timeout'
            duration,
            moderatorId,
            reason,
            timestamp: new Date().toISOString(),
            expiresAt: duration ? new Date(Date.now() + duration).toISOString() : null,
            active: true
        };

        const userPunishments = this.punishments.get(userId) || [];
        userPunishments.push(punishment);
        this.punishments.set(userId, userPunishments);

        await this.logModerationAction(type, {
            targetId: userId,
            moderatorId,
            reason,
            duration,
            punishmentId
        });

        // Schedule auto-removal for temporary punishments
        if (duration) {
            setTimeout(() => {
                this.removePunishment(punishmentId, 'system', 'Automatic expiry');
            }, duration);
        }

        return punishment;
    }

    async removePunishment(punishmentId, moderatorId, reason = 'Manual removal') {
        for (const [userId, punishments] of this.punishments.entries()) {
            const punishmentIndex = punishments.findIndex(p => p.id === punishmentId);
            if (punishmentIndex !== -1) {
                punishments[punishmentIndex].active = false;
                punishments[punishmentIndex].removedBy = moderatorId;
                punishments[punishmentIndex].removedAt = new Date().toISOString();
                punishments[punishmentIndex].removalReason = reason;
                
                await this.logModerationAction('punishment_removed', {
                    targetId: userId,
                    moderatorId,
                    punishmentId,
                    reason
                });
                
                return punishments[punishmentIndex];
            }
        }
        return null;
    }

    getUserPunishments(userId, activeOnly = true) {
        const punishments = this.punishments.get(userId) || [];
        return activeOnly ? punishments.filter(p => p.active) : punishments;
    }

    // Warning Escalation
    async checkWarningEscalation(guildId, userId) {
        const activeWarnings = this.getUserWarnings(userId, true);
        const warningCount = activeWarnings.length;

        // Escalation rules
        if (warningCount >= 3 && warningCount < 5) {
            // Mute for 1 hour
            await this.addPunishment(guildId, userId, 'mute', 3600000, 'system', 'Automatic escalation: 3 warnings');
        } else if (warningCount >= 5 && warningCount < 7) {
            // Mute for 24 hours
            await this.addPunishment(guildId, userId, 'mute', 86400000, 'system', 'Automatic escalation: 5 warnings');
        } else if (warningCount >= 7) {
            // Temporary ban for 7 days
            await this.addPunishment(guildId, userId, 'ban', 604800000, 'system', 'Automatic escalation: 7 warnings');
        }
    }

    // Moderation Logging
    async logModerationAction(action, data) {
        const logEntry = {
            id: Date.now().toString(),
            action,
            timestamp: new Date().toISOString(),
            ...data
        };

        this.moderationLogs.unshift(logEntry);
        if (this.moderationLogs.length > 1000) {
            this.moderationLogs = this.moderationLogs.slice(0, 1000);
        }

        // Emit to dashboard
        try {
            const { io } = require('../bot');
            if (io) {
                io.emit('moderationAction', logEntry);
            }
        } catch (error) {
            // Ignore if io is not available
        }

        await this.saveModerationData();
        return logEntry;
    }

    // Message Tracking for Spam Detection
    trackMessage(userId, messageId, content, timestamp) {
        const userMessages = this.messageHistory.get(userId) || [];
        userMessages.push({
            id: messageId,
            content,
            timestamp
        });

        // Keep only last 10 messages per user
        if (userMessages.length > 10) {
            userMessages.shift();
        }

        this.messageHistory.set(userId, userMessages);
    }

    // Spam Detection
    detectSpam(userId) {
        const config = this.autoModConfig.spamProtection;
        if (!config.enabled) return false;

        const userMessages = this.messageHistory.get(userId) || [];
        const now = Date.now();
        
        // Count messages in time window
        const recentMessages = userMessages.filter(msg => 
            now - new Date(msg.timestamp).getTime() < config.timeWindow
        );

        return recentMessages.length >= config.maxMessages;
    }

    // Profanity Detection
    detectProfanity(content) {
        const config = this.autoModConfig.profanityFilter;
        if (!config.enabled) return false;

        const lowerContent = content.toLowerCase();
        return config.words.some(word => lowerContent.includes(word.toLowerCase()));
    }

    // Link Detection
    detectUnauthorizedLinks(content) {
        const config = this.autoModConfig.linkProtection;
        if (!config.enabled) return false;

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = content.match(urlRegex) || [];
        
        return urls.some(url => {
            return !config.whitelist.some(whitelisted => url.includes(whitelisted));
        });
    }

    // Caps Detection
    detectExcessiveCaps(content) {
        const config = this.autoModConfig.capsProtection;
        if (!config.enabled || content.length < config.minLength) return false;

        const capsCount = (content.match(/[A-Z]/g) || []).length;
        const capsPercentage = (capsCount / content.length) * 100;
        
        return capsPercentage > config.maxCapsPercentage;
    }

    // Join Tracking for Anti-Raid
    trackJoin(userId, timestamp) {
        this.joinHistory.push({ userId, timestamp });
        
        // Keep only last hour of joins
        const oneHourAgo = Date.now() - 3600000;
        this.joinHistory = this.joinHistory.filter(join => 
            new Date(join.timestamp).getTime() > oneHourAgo
        );
    }

    // Raid Detection
    detectRaid() {
        const config = this.autoModConfig.antiRaid;
        if (!config.enabled) return false;

        const now = Date.now();
        const recentJoins = this.joinHistory.filter(join => 
            now - new Date(join.timestamp).getTime() < config.timeWindow
        );

        return recentJoins.length >= config.maxJoins;
    }

    // Data Management
    async saveModerationData() {
        try {
            const data = {
                warnings: Object.fromEntries(this.warnings),
                punishments: Object.fromEntries(this.punishments),
                moderationLogs: this.moderationLogs,
                autoModConfig: this.autoModConfig
            };

            const fs = require('fs').promises;
            const path = require('path');
            const { ensureDataDir } = require('./dataService');
            
            await ensureDataDir();
            await fs.writeFile(
                path.join(__dirname, '../data/moderation-data.json'),
                JSON.stringify(data, null, 2)
            );
        } catch (error) {
            console.error('Failed to save moderation data:', error);
        }
    }

    async loadModerationData() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const data = await fs.readFile(
                path.join(__dirname, '../data/moderation-data.json'),
                'utf8'
            );
            
            const parsed = JSON.parse(data);
            this.warnings = new Map(Object.entries(parsed.warnings || {}));
            this.punishments = new Map(Object.entries(parsed.punishments || {}));
            this.moderationLogs = parsed.moderationLogs || [];
            this.autoModConfig = { ...this.autoModConfig, ...parsed.autoModConfig };
            
            console.log('✅ Loaded moderation data');
        } catch (error) {
            console.log('📋 No existing moderation data found');
        }
    }

    // Statistics
    getModerationStats() {
        const totalWarnings = Array.from(this.warnings.values()).flat().length;
        const activeWarnings = Array.from(this.warnings.values()).flat().filter(w => w.active).length;
        const totalPunishments = Array.from(this.punishments.values()).flat().length;
        const activePunishments = Array.from(this.punishments.values()).flat().filter(p => p.active).length;

        return {
            totalWarnings,
            activeWarnings,
            totalPunishments,
            activePunishments,
            totalActions: this.moderationLogs.length,
            autoModConfig: this.autoModConfig
        };
    }

    // Get all data for API
    getAllData() {
        return {
            warnings: Object.fromEntries(this.warnings),
            punishments: Object.fromEntries(this.punishments),
            logs: this.moderationLogs,
            stats: this.getModerationStats(),
            config: this.autoModConfig
        };
    }

    // Update configuration
    updateConfig(newConfig) {
        this.autoModConfig = { ...this.autoModConfig, ...newConfig };
        this.saveModerationData();
        return this.autoModConfig;
    }
}

module.exports = new ModerationService();
