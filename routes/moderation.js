const express = require('express');
const router = express.Router();
const moderationService = require('../services/moderationService');
const { authenticateToken } = require('../middleware/auth');

module.exports = (client, io) => {
    // All moderation routes require authentication
    router.use(authenticateToken);

    // Get all moderation data
    router.get('/moderation', (req, res) => {
        try {
            const data = moderationService.getAllData();
            res.json(data);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get moderation statistics
    router.get('/moderation/stats', (req, res) => {
        try {
            const stats = moderationService.getModerationStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Add warning
    router.post('/moderation/warn', async (req, res) => {
        try {
            const { guildId, userId, reason } = req.body;
            const moderatorId = req.user.id;

            if (!guildId || !userId || !reason) {
                return res.status(400).json({ message: 'Guild ID, user ID, and reason are required' });
            }

            const warning = await moderationService.addWarning(guildId, userId, moderatorId, reason);
            
            // Try to DM the user
            try {
                const user = await client.users.fetch(userId);
                const guild = await client.guilds.fetch(guildId);
                
                const embed = new (require('discord.js').EmbedBuilder)()
                    .setTitle('⚠️ Warning Received')
                    .setDescription(`You have received a warning in **${guild.name}**`)
                    .addFields({ name: 'Reason', value: reason })
                    .setColor('#ff9900')
                    .setTimestamp();
                
                await user.send({ embeds: [embed] });
            } catch (error) {
                console.log('Could not DM user about warning');
            }

            io.emit('moderationAction', {
                type: 'warning_added',
                warning,
                moderator: req.user.username
            });

            res.json({ success: true, warning });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Remove warning
    router.delete('/moderation/warn/:warningId', async (req, res) => {
        try {
            const { warningId } = req.params;
            const moderatorId = req.user.id;

            const success = await moderationService.removeWarning(warningId, moderatorId);
            
            if (success) {
                io.emit('moderationAction', {
                    type: 'warning_removed',
                    warningId,
                    moderator: req.user.username
                });
                res.json({ success: true, message: 'Warning removed successfully' });
            } else {
                res.status(404).json({ success: false, message: 'Warning not found' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Add punishment (mute, ban, kick)
    router.post('/moderation/punish', async (req, res) => {
        try {
            const { guildId, userId, type, duration, reason } = req.body;
            const moderatorId = req.user.id;

            if (!guildId || !userId || !type || !reason) {
                return res.status(400).json({ message: 'Guild ID, user ID, type, and reason are required' });
            }

            const guild = await client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            const moderator = await guild.members.fetch(moderatorId);

            // Execute the punishment
            let success = false;
            switch (type) {
                case 'mute':
                    if (duration) {
                        await member.timeout(duration, reason);
                        success = true;
                    }
                    break;
                case 'kick':
                    await member.kick(reason);
                    success = true;
                    break;
                case 'ban':
                    await member.ban({ reason, deleteMessageDays: 1 });
                    success = true;
                    break;
            }

            if (success) {
                const punishment = await moderationService.addPunishment(
                    guildId, userId, type, duration, moderatorId, reason
                );

                // Try to DM the user
                try {
                    const user = await client.users.fetch(userId);
                    const embed = new (require('discord.js').EmbedBuilder)()
                        .setTitle(`🚫 ${type.charAt(0).toUpperCase() + type.slice(1)} Applied`)
                        .setDescription(`You have been ${type}${type === 'ban' ? 'ned' : type === 'kick' ? 'ed' : 'd'} from **${guild.name}**`)
                        .addFields(
                            { name: 'Reason', value: reason },
                            { name: 'Moderator', value: moderator.user.username }
                        )
                        .setColor('#ff0000')
                        .setTimestamp();
                    
                    if (duration && type !== 'ban' && type !== 'kick') {
                        embed.addFields({ name: 'Duration', value: `${Math.floor(duration / 60000)} minutes` });
                    }
                    
                    await user.send({ embeds: [embed] });
                } catch (error) {
                    console.log('Could not DM user about punishment');
                }

                io.emit('moderationAction', {
                    type: 'punishment_added',
                    punishment,
                    moderator: req.user.username
                });

                res.json({ success: true, punishment });
            } else {
                res.status(400).json({ success: false, message: 'Failed to apply punishment' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Remove punishment
    router.delete('/moderation/punish/:punishmentId', async (req, res) => {
        try {
            const { punishmentId } = req.params;
            const { reason } = req.body;
            const moderatorId = req.user.id;

            const punishment = await moderationService.removePunishment(punishmentId, moderatorId, reason);
            
            if (punishment) {
                // Try to remove the actual punishment from Discord
                try {
                    const guild = await client.guilds.fetch(punishment.guildId);
                    const member = await guild.members.fetch(punishment.userId);
                    
                    if (punishment.type === 'mute' && member.isCommunicationDisabled()) {
                        await member.timeout(null, 'Punishment removed');
                    } else if (punishment.type === 'ban') {
                        await guild.members.unban(punishment.userId, 'Punishment removed');
                    }
                } catch (error) {
                    console.log('Could not remove punishment from Discord:', error.message);
                }

                io.emit('moderationAction', {
                    type: 'punishment_removed',
                    punishmentId,
                    moderator: req.user.username
                });

                res.json({ success: true, message: 'Punishment removed successfully' });
            } else {
                res.status(404).json({ success: false, message: 'Punishment not found' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get user moderation history
    router.get('/moderation/user/:userId', (req, res) => {
        try {
            const { userId } = req.params;
            const warnings = moderationService.getUserWarnings(userId, false);
            const punishments = moderationService.getUserPunishments(userId, false);
            
            res.json({
                userId,
                warnings,
                punishments,
                activeWarnings: warnings.filter(w => w.active).length,
                activePunishments: punishments.filter(p => p.active).length
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Update auto-moderation configuration
    router.post('/moderation/config', async (req, res) => {
        try {
            const config = moderationService.updateConfig(req.body);
            
            io.emit('moderationConfigUpdated', config);
            res.json({ success: true, config });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get moderation logs
    router.get('/moderation/logs', (req, res) => {
        try {
            const { limit = 50, offset = 0 } = req.query;
            const logs = moderationService.moderationLogs.slice(offset, offset + parseInt(limit));
            
            res.json({
                logs,
                total: moderationService.moderationLogs.length,
                hasMore: offset + parseInt(limit) < moderationService.moderationLogs.length
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
