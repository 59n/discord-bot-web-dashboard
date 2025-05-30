const moderationService = require('../services/moderationService');

// Helper function to check if user is exempt
async function isUserExempt(message) {
    if (message.author.bot) return true;
    if (message.member?.permissions.has('Administrator')) return true;
    if (message.member?.permissions.has('ModerateMembers')) return true;
    return false;
}

function setupModerationHandler(client, io) {
    // Message monitoring for auto-moderation
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Check if user is exempt from auto-moderation
        if (await isUserExempt(message)) return;

        const userId = message.author.id;
        const guildId = message.guild.id;
        const content = message.content;

        // Track message for spam detection
        moderationService.trackMessage(userId, message.id, content, message.createdAt);

        // Spam Detection
        if (moderationService.detectSpam(userId)) {
            try {
                await message.delete();
                await moderationService.addWarning(guildId, userId, 'system', 'Spam detected');
                
                const member = await message.guild.members.fetch(userId);
                await member.timeout(300000, 'Auto-moderation: Spam'); // 5 minute timeout
                
                const embed = new (require('discord.js').EmbedBuilder)()
                    .setTitle('🚫 Auto-Moderation: Spam Detected')
                    .setDescription(`${message.author} has been timed out for spamming.`)
                    .setColor('#ff0000')
                    .setTimestamp();
                
                await message.channel.send({ embeds: [embed] });
                
                io.emit('autoModAction', {
                    type: 'spam',
                    userId,
                    action: 'timeout',
                    duration: 300000
                });
            } catch (error) {
                console.error('Error handling spam:', error);
            }
            return;
        }

        // Profanity Detection
        if (moderationService.detectProfanity(content)) {
            try {
                await message.delete();
                await moderationService.addWarning(guildId, userId, 'system', 'Profanity detected');
                
                const embed = new (require('discord.js').EmbedBuilder)()
                    .setTitle('🚫 Auto-Moderation: Profanity Detected')
                    .setDescription(`${message.author}, please keep the chat family-friendly.`)
                    .setColor('#ff9900')
                    .setTimestamp();
                
                const warningMsg = await message.channel.send({ embeds: [embed] });
                setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
                
                io.emit('autoModAction', {
                    type: 'profanity',
                    userId,
                    action: 'delete_warn'
                });
            } catch (error) {
                console.error('Error handling profanity:', error);
            }
            return;
        }

        // Link Protection
        if (moderationService.detectUnauthorizedLinks(content)) {
            try {
                await message.delete();
                await moderationService.addWarning(guildId, userId, 'system', 'Unauthorized link posted');
                
                const embed = new (require('discord.js').EmbedBuilder)()
                    .setTitle('🔗 Auto-Moderation: Unauthorized Link')
                    .setDescription(`${message.author}, that link is not allowed in this server.`)
                    .setColor('#ff9900')
                    .setTimestamp();
                
                const warningMsg = await message.channel.send({ embeds: [embed] });
                setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
                
                io.emit('autoModAction', {
                    type: 'unauthorized_link',
                    userId,
                    action: 'delete_warn'
                });
            } catch (error) {
                console.error('Error handling unauthorized link:', error);
            }
            return;
        }

        // Excessive Caps Detection
        if (moderationService.detectExcessiveCaps(content)) {
            try {
                await message.delete();
                await moderationService.addWarning(guildId, userId, 'system', 'Excessive caps usage');
                
                const embed = new (require('discord.js').EmbedBuilder)()
                    .setTitle('📢 Auto-Moderation: Excessive Caps')
                    .setDescription(`${message.author}, please do not use excessive capital letters.`)
                    .setColor('#ff9900')
                    .setTimestamp();
                
                const warningMsg = await message.channel.send({ embeds: [embed] });
                setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
                
                io.emit('autoModAction', {
                    type: 'excessive_caps',
                    userId,
                    action: 'delete_warn'
                });
            } catch (error) {
                console.error('Error handling excessive caps:', error);
            }
            return;
        }
    });

    // Member join monitoring for raid detection
    client.on('guildMemberAdd', async (member) => {
        const userId = member.user.id;
        const guildId = member.guild.id;
        
        moderationService.trackJoin(userId, new Date());

        // Raid Detection
        if (moderationService.detectRaid()) {
            try {
                // Enable slowmode in all text channels
                const channels = member.guild.channels.cache.filter(ch => ch.type === 0);
                for (const [, channel] of channels) {
                    await channel.setRateLimitPerUser(30, 'Auto-moderation: Raid detected');
                }

                const embed = new (require('discord.js').EmbedBuilder)()
                    .setTitle('🚨 Auto-Moderation: Raid Detected')
                    .setDescription('Suspicious activity detected. Slowmode has been enabled in all channels.')
                    .setColor('#ff0000')
                    .setTimestamp();

                // Send alert to moderation log channel (if configured)
                const logChannel = member.guild.channels.cache.find(ch => ch.name === 'mod-logs');
                if (logChannel) {
                    await logChannel.send({ embeds: [embed] });
                }

                io.emit('autoModAction', {
                    type: 'raid_detected',
                    guildId,
                    action: 'slowmode_enabled'
                });

                await moderationService.logModerationAction('raid_detected', {
                    guildId,
                    moderatorId: 'system',
                    reason: 'Automatic raid detection'
                });
            } catch (error) {
                console.error('Error handling raid detection:', error);
            }
        }
    });

    console.log('✅ Moderation handler configured');
}

module.exports = { setupModerationHandler };
