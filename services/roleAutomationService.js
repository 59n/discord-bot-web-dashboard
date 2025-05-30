const { loadRoleAutomationData, saveRoleAutomationData } = require('./dataService');

class RoleAutomationService {
    constructor() {
        this.automationRules = new Map();
        this.reactionRoles = new Map();
        this.activityTracking = new Map();
        this.buttonRoles = new Map();
        this.roleLoggingConfigs = new Map();
    }

    async loadAutomationData() {
        try {
            const data = await loadRoleAutomationData();
            
            if (data.automationRules) {
                this.automationRules = new Map(Object.entries(data.automationRules));
            }
            
            if (data.reactionRoles) {
                this.reactionRoles = new Map(Object.entries(data.reactionRoles));
            }
            
            if (data.activityTracking) {
                this.activityTracking = new Map(Object.entries(data.activityTracking));
            }
            
            if (data.buttonRoles) {
                this.buttonRoles = new Map(Object.entries(data.buttonRoles));
            }
            
            if (data.roleLoggingConfigs) {
                this.roleLoggingConfigs = new Map(Object.entries(data.roleLoggingConfigs));
            }
            
            console.log('✅ Role automation data loaded');
        } catch (error) {
            console.log('🔄 No existing role automation data found, starting fresh');
        }
    }

    async saveAutomationData() {
        try {
            const data = {
                automationRules: Object.fromEntries(this.automationRules),
                reactionRoles: Object.fromEntries(this.reactionRoles),
                activityTracking: Object.fromEntries(this.activityTracking),
                buttonRoles: Object.fromEntries(this.buttonRoles),
                roleLoggingConfigs: Object.fromEntries(this.roleLoggingConfigs),
                lastSaved: new Date().toISOString()
            };
            
            await saveRoleAutomationData(data);
            console.log('💾 Role automation data saved');
        } catch (error) {
            console.error('❌ Failed to save role automation data:', error);
        }
    }

    // Button Role System
    async setupButtonRoles(embedData, buttons, guildId, channelId, loggingConfig = null) {
        const buttonRoleId = `button_roles_${Date.now()}`;
        
        const buttonRoleSetup = {
            id: buttonRoleId,
            embedData,
            buttons, // Array of {emoji, label, roleId, style}
            guildId,
            channelId,
            messageId: null, // Will be set after message is sent
            createdAt: new Date().toISOString(),
            usageStats: {}
        };
        
        this.buttonRoles.set(buttonRoleId, buttonRoleSetup);
        
        // Save logging configuration if provided
        if (loggingConfig) {
            this.roleLoggingConfigs.set(guildId, {
                ...loggingConfig,
                guildId,
                updatedAt: new Date().toISOString()
            });
        }
        
        await this.saveAutomationData();
        
        return buttonRoleSetup;
    }

    async handleButtonRoleInteraction(customId, userId, guildId, guild) {
        console.log(`🔍 Processing button role interaction:`, {
            customId,
            userId,
            guildId
        });
        
        // customId format: "button_role_{setupId}_{buttonIndex}_{roleId}"
        const parts = customId.split('_');
        console.log(`🔍 CustomId parts:`, parts);
        
        if (parts.length < 5) {
            console.log(`❌ Invalid customId format: ${customId}`);
            return { success: false, reason: 'invalid_custom_id' };
        }
        
        const [, , setupId, buttonIndex, roleId] = parts;
        const buttonRoleSetup = this.buttonRoles.get(`button_roles_${setupId}`);
        
        console.log(`🔍 Looking for setup: button_roles_${setupId}`);
        console.log(`🔍 Setup found:`, buttonRoleSetup ? 'Yes' : 'No');
        
        if (!buttonRoleSetup || buttonRoleSetup.guildId !== guildId) {
            console.log(`❌ Setup not found or guild mismatch`);
            return { success: false, reason: 'setup_not_found' };
        }
        
        try {
            const member = await guild.members.fetch(userId);
            const role = await guild.roles.fetch(roleId);
            
            console.log(`🔍 Member:`, member.user.tag);
            console.log(`🔍 Role:`, role ? role.name : 'Not found');
            
            if (!role) {
                return { success: false, reason: 'role_not_found' };
            }
            
            const hasRole = member.roles.cache.has(roleId);
            console.log(`🔍 User has role:`, hasRole);
            
            if (hasRole) {
                // Remove role
                await member.roles.remove(role);
                console.log(`➖ Removed role ${role.name} from ${member.user.tag}`);
                
                // Log the role removal
                await this.logRoleEvent(guildId, 'role_removed', member.user, role, guild, {
                    method: 'Button Role',
                    setupId: setupId,
                    buttonLabel: this.getButtonLabel(buttonRoleSetup, roleId)
                });
                
                // Update stats
                if (!buttonRoleSetup.usageStats[roleId]) {
                    buttonRoleSetup.usageStats[roleId] = { added: 0, removed: 0 };
                }
                buttonRoleSetup.usageStats[roleId].removed++;
                
                this.buttonRoles.set(`button_roles_${setupId}`, buttonRoleSetup);
                await this.saveAutomationData();
                
                return { 
                    success: true, 
                    action: 'removed', 
                    role: role.name,
                    emoji: this.getButtonEmoji(buttonRoleSetup, roleId)
                };
            } else {
                // Add role
                await member.roles.add(role);
                console.log(`➕ Added role ${role.name} to ${member.user.tag}`);
                
                // Log the role addition
                await this.logRoleEvent(guildId, 'role_added', member.user, role, guild, {
                    method: 'Button Role',
                    setupId: setupId,
                    buttonLabel: this.getButtonLabel(buttonRoleSetup, roleId)
                });
                
                // Update stats
                if (!buttonRoleSetup.usageStats[roleId]) {
                    buttonRoleSetup.usageStats[roleId] = { added: 0, removed: 0 };
                }
                buttonRoleSetup.usageStats[roleId].added++;
                
                this.buttonRoles.set(`button_roles_${setupId}`, buttonRoleSetup);
                await this.saveAutomationData();
                
                return { 
                    success: true, 
                    action: 'added', 
                    role: role.name,
                    emoji: this.getButtonEmoji(buttonRoleSetup, roleId)
                };
            }
        } catch (error) {
            console.error('Error in button role interaction:', error);
            return { success: false, error: error.message };
        }
    }

    // Add these methods to your RoleAutomationService class

    getButtonLabel(buttonRoleSetup, roleId) {
        const button = buttonRoleSetup.buttons.find(b => b.roleId === roleId);
        return button ? button.label : 'Unknown';
    }

    getButtonEmoji(buttonRoleSetup, roleId) {
        const button = buttonRoleSetup.buttons.find(b => b.roleId === roleId);
        return button ? button.emoji : '🎯';
    }

    getAllButtonRoles(guildId) {
        return Array.from(this.buttonRoles.values()).filter(br => br.guildId === guildId);
    }

    async deleteButtonRoleSetup(setupId) {
        this.buttonRoles.delete(`button_roles_${setupId}`);
        await this.saveAutomationData();
    }


    // Role Logging System
    async logRoleEvent(guildId, eventType, user, role, guild, additionalInfo = {}) {
        try {
            // Create a role event object
            const roleEvent = {
                id: `role_${Date.now()}`,
                userId: user.id,
                username: user.username,
                roleId: role.id,
                roleName: role.name,
                guildId: guildId,
                timestamp: new Date().toISOString(),
                ...additionalInfo
            };
            
            // Log to channel if configured
            await this.logRoleEventToChannel(guildId, eventType, roleEvent, user, role, guild, additionalInfo);
            
            console.log(`📝 Logged role event: ${eventType} for ${user.username}`);
        } catch (error) {
            console.error('Error logging role event:', error);
        }
    }

    async logRoleEventToChannel(guildId, eventType, roleEvent, user, role, guild, additionalInfo = {}) {
        // Get the logging configuration
        const roleConfig = this.getRoleLoggingConfig(guildId);
        
        if (!roleConfig.enabled || !roleConfig.logChannelId) return;
        
        try {
            const { EmbedBuilder } = require('discord.js');
            
            // Get the log channel
            const logChannel = await guild.channels.fetch(roleConfig.logChannelId);
            
            if (!logChannel) return;
            
            let embed = new EmbedBuilder()
                .setTimestamp()
                .setFooter({ 
                    text: `Role Event ID: ${roleEvent.id}`,
                    iconURL: guild.iconURL()
                });
            
            switch (eventType) {
                case 'role_added':
                    embed
                        .setTitle('➕ Role Added')
                        .setDescription(`A role has been added to a user`)
                        .setColor('#00ff00')
                        .addFields([
                            { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
                            { name: '🎭 Role', value: `${role.name} (<@&${role.id}>)`, inline: true },
                            { name: '📍 Method', value: additionalInfo.method || 'Button Role', inline: true },
                            { name: '📊 Total Members', value: `${role.members.size}`, inline: true },
                            { name: '🕐 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                            { name: '🔧 Setup', value: additionalInfo.buttonLabel || 'N/A', inline: true }
                        ])
                        .setThumbnail(user.displayAvatarURL());
                    break;
                    
                case 'role_removed':
                    embed
                        .setTitle('➖ Role Removed')
                        .setDescription(`A role has been removed from a user`)
                        .setColor('#ff9900')
                        .addFields([
                            { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
                            { name: '🎭 Role', value: `${role.name} (<@&${role.id}>)`, inline: true },
                            { name: '📍 Method', value: additionalInfo.method || 'Button Role', inline: true },
                            { name: '📊 Total Members', value: `${role.members.size}`, inline: true },
                            { name: '🕐 Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                            { name: '🔧 Setup', value: additionalInfo.buttonLabel || 'N/A', inline: true }
                        ])
                        .setThumbnail(user.displayAvatarURL());
                    break;
            }
            
            await logChannel.send({ embeds: [embed] });
            console.log(`📝 Logged role event to channel: ${eventType}`);
            
        } catch (error) {
            console.error('Error logging role event to channel:', error);
        }
    }

    getRoleLoggingConfig(guildId) {
        const config = this.roleLoggingConfigs.get(guildId);
        return config || {
            enabled: false,
            logChannelId: null,
            logRoleAdded: true,
            logRoleRemoved: true,
            logButtonRoles: true,
            logReactionRoles: true
        };
    }

    async updateRoleLoggingConfig(guildId, config) {
        this.roleLoggingConfigs.set(guildId, {
            ...config,
            guildId,
            updatedAt: new Date().toISOString()
        });
        await this.saveAutomationData();
    }

    // Reaction Role System (existing)
    async setupReactionRole(messageId, emoji, roleId, guildId, description) {
        const reactionRoleId = `${messageId}_${emoji}`;
        
        this.reactionRoles.set(reactionRoleId, {
            messageId,
            emoji,
            roleId,
            guildId,
            description,
            createdAt: new Date().toISOString(),
            usageCount: 0
        });
        
        await this.saveAutomationData();
        console.log(`✅ Reaction role setup: ${emoji} -> ${roleId} on message ${messageId}`);
        return reactionRoleId;
    }

    async handleReactionAdd(messageId, emoji, userId, guildId, guild) {
        const reactionRoleId = `${messageId}_${emoji}`;
        const reactionRole = this.reactionRoles.get(reactionRoleId);
        
        console.log(`🔍 Checking reaction role: ${reactionRoleId}`, reactionRole ? 'Found' : 'Not found');
        
        if (reactionRole && reactionRole.guildId === guildId) {
            try {
                const member = await guild.members.fetch(userId);
                const role = await guild.roles.fetch(reactionRole.roleId);
                
                if (role && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role);
                    
                    // Log the role addition
                    await this.logRoleEvent(guildId, 'role_added', member.user, role, guild, {
                        method: 'Reaction Role',
                        emoji: emoji,
                        messageId: messageId
                    });
                    
                    reactionRole.usageCount++;
                    this.reactionRoles.set(reactionRoleId, reactionRole);
                    await this.saveAutomationData();
                    
                    console.log(`✅ Added role ${role.name} to ${member.user.tag} via reaction`);
                    return { success: true, action: 'added', role: role.name };
                } else if (role && member.roles.cache.has(role.id)) {
                    console.log(`ℹ️ User ${member.user.tag} already has role ${role.name}`);
                    return { success: false, reason: 'already_has_role' };
                }
            } catch (error) {
                console.error('Error adding reaction role:', error);
                return { success: false, error: error.message };
            }
        }
        
        return { success: false, reason: 'no_reaction_role_found' };
    }

    async handleReactionRemove(messageId, emoji, userId, guildId, guild) {
        const reactionRoleId = `${messageId}_${emoji}`;
        const reactionRole = this.reactionRoles.get(reactionRoleId);
        
        if (reactionRole && reactionRole.guildId === guildId) {
            try {
                const member = await guild.members.fetch(userId);
                const role = await guild.roles.fetch(reactionRole.roleId);
                
                if (role && member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                    
                    // Log the role removal
                    await this.logRoleEvent(guildId, 'role_removed', member.user, role, guild, {
                        method: 'Reaction Role',
                        emoji: emoji,
                        messageId: messageId
                    });
                    
                    console.log(`➖ Removed role ${role.name} from ${member.user.tag} via reaction removal`);
                    return { success: true, action: 'removed', role: role.name };
                }
            } catch (error) {
                console.error('Error removing reaction role:', error);
                return { success: false, error: error.message };
            }
        }
        
        return { success: false };
    }

    // Activity-based role assignment
    async checkActivityRoles(userId, guildId, activityType, value) {
        const rules = Array.from(this.automationRules.values()).filter(rule => 
            rule.guildId === guildId && 
            rule.type === 'activity' && 
            rule.trigger === activityType &&
            rule.enabled
        );

        for (const rule of rules) {
            if (this.meetsActivityRequirement(userId, rule, value)) {
                await this.assignRole(userId, guildId, rule.roleId, `Activity milestone: ${rule.description}`);
            }
        }
    }

    meetsActivityRequirement(userId, rule, currentValue) {
        switch (rule.condition) {
            case 'messages_sent':
                return currentValue >= rule.threshold;
            case 'voice_time':
                return currentValue >= rule.threshold;
            case 'days_active':
                return currentValue >= rule.threshold;
            case 'reactions_given':
                return currentValue >= rule.threshold;
            default:
                return false;
        }
    }

    // Time-based role assignment
    async checkTimeBasedRoles(userId, guildId) {
        const rules = Array.from(this.automationRules.values()).filter(rule => 
            rule.guildId === guildId && 
            rule.type === 'time' && 
            rule.enabled
        );

        for (const rule of rules) {
            if (this.meetsTimeRequirement(userId, guildId, rule)) {
                await this.assignRole(userId, guildId, rule.roleId, `Time-based: ${rule.description}`);
            }
        }
    }

    meetsTimeRequirement(userId, guildId, rule) {
        const userActivity = this.activityTracking.get(`${guildId}_${userId}`);
        if (!userActivity) return false;

        const joinDate = new Date(userActivity.joinedAt);
        const daysSinceJoin = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return daysSinceJoin >= rule.threshold;
    }

    async assignRole(userId, guildId, roleId, reason) {
        // This will be called by the main bot to actually assign the role
        // We'll emit an event that the bot can listen to
        return {
            userId,
            guildId,
            roleId,
            reason,
            timestamp: new Date().toISOString()
        };
    }

    // Statistics and Analytics
    getAutomationStats(guildId) {
        const guildRules = Array.from(this.automationRules.values()).filter(rule => rule.guildId === guildId);
        const guildReactionRoles = Array.from(this.reactionRoles.values()).filter(rr => rr.guildId === guildId);
        const guildButtonRoles = Array.from(this.buttonRoles.values()).filter(br => br.guildId === guildId);
        
        return {
            totalRules: guildRules.length,
            activeRules: guildRules.filter(rule => rule.enabled).length,
            reactionRoles: guildReactionRoles.length,
            buttonRoles: guildButtonRoles.length,
            totalReactionRoleUsage: guildReactionRoles.reduce((sum, rr) => sum + (rr.usageCount || 0), 0),
            totalButtonRoleUsage: guildButtonRoles.reduce((sum, br) => {
                const stats = Object.values(br.usageStats || {});
                return sum + stats.reduce((total, stat) => total + (stat.added || 0) + (stat.removed || 0), 0);
            }, 0)
        };
    }

    getAllReactionRoles(guildId) {
        return Array.from(this.reactionRoles.values()).filter(rr => rr.guildId === guildId);
    }

    getDetailedButtonRoleStats(guildId) {
        const guildButtonRoles = this.getAllButtonRoles(guildId);
        
        return guildButtonRoles.map(setup => ({
            id: setup.id,
            title: setup.embedData.title,
            buttonCount: setup.buttons.length,
            totalUsage: Object.values(setup.usageStats || {}).reduce((sum, stat) => 
                sum + (stat.added || 0) + (stat.removed || 0), 0
            ),
            createdAt: setup.createdAt,
            buttons: setup.buttons.map(button => ({
                label: button.label,
                emoji: button.emoji,
                roleId: button.roleId,
                usage: setup.usageStats[button.roleId] || { added: 0, removed: 0 }
            }))
        }));
    }
}

module.exports = new RoleAutomationService();
