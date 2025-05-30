const express = require('express');
const router = express.Router();
const roleAutomationService = require('../services/roleAutomationService');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Helper function to create enhanced embed
function createEnhancedEmbed(embedData, buttons, guild) {
    const embed = new EmbedBuilder()
        .setTitle(embedData.title)
        .setColor(embedData.color || '#5865f2');

    // Add timestamp if enabled
    if (embedData.showTimestamp) {
        embed.setTimestamp();
    }

    // Enhanced description with customizable elements
    let description = embedData.description || '';

    // Add role count info if enabled
    if (embedData.showRoleCount && buttons.length > 0) {
        description += description ? '\n\n' : '';
        description += `🎯 **Available Roles:** ${buttons.length}\n`;
    }

    // Add instructions if enabled
    if (embedData.showInstructions) {
        description += description ? '\n' : '';
        description += `📝 Click the buttons below to add or remove roles!\n`;
        description += `💡 *Tip: Click again to remove a role you already have*`;
    }

    if (description) {
        embed.setDescription(description);
    }

    // Add role information field only if enabled
    if (embedData.showAvailableRoles) {
        const roleList = buttons.map(button => {
            const role = guild.roles.cache.get(button.roleId);
            return `${button.emoji} **${button.label}** ${role ? `(<@&${role.id}>)` : ''}`;
        }).join('\n');

        if (roleList) {
            embed.addFields([
                {
                    name: embedData.availableRolesTitle || '🎭 Available Roles',
                    value: roleList.length > 1024 ? roleList.substring(0, 1021) + '...' : roleList,
                    inline: false
                }
            ]);
        }
    }

    // Add footer with customizable text
    if (embedData.showFooter) {
        let footerText = '';
        if (embedData.customFooter) {
            footerText = embedData.customFooter;
        } else {
            footerText = `${buttons.length} role${buttons.length !== 1 ? 's' : ''} available`;
            if (embedData.showFooterInstructions) {
                footerText += ' • Click buttons to toggle roles';
            }
        }
        
        embed.setFooter({ 
            text: footerText,
            iconURL: embedData.showServerIcon ? guild.iconURL() || undefined : undefined
        });
    }

    // Add author field if enabled
    if (embedData.showAuthor) {
        embed.setAuthor({
            name: embedData.customAuthor || `${guild.name} Role Selection`,
            iconURL: embedData.showAuthorIcon ? guild.iconURL() || undefined : undefined
        });
    }

    // Optional fields
    if (embedData.thumbnail && embedData.thumbnail.trim() !== '') {
        embed.setThumbnail(embedData.thumbnail);
    }

    if (embedData.image && embedData.image.trim() !== '') {
        embed.setImage(embedData.image);
    }

    return embed;
}

// Helper function to create buttons with customization
function createCustomButtons(buttons, embedData, guild, setupId) {
    const actionRows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        const rowButtons = buttons.slice(i, i + 5);
        const actionRow = new ActionRowBuilder();
        
        rowButtons.forEach((button, buttonIndex) => {
            const role = guild.roles.cache.get(button.roleId);
            const memberCount = role ? role.members.size : 0;
            
            // Build custom button label
            let buttonLabel = button.customLabel || button.label;
            
            // Add member count if enabled
            if (embedData.showMemberCount) {
                buttonLabel += ` (${memberCount})`;
            }
            
            // Add role name if enabled and different from label
            if (embedData.showRoleInButton && role && role.name !== buttonLabel) {
                buttonLabel = `${buttonLabel} - ${role.name}`;
            }
            
            const uniqueButtonId = `${setupId}_${i * 5 + buttonIndex}`;
            
            const discordButton = new ButtonBuilder()
                .setCustomId(`button_role_${uniqueButtonId}_${button.roleId}`)
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle[button.style] || ButtonStyle.Primary);
            
            if (button.emoji) {
                discordButton.setEmoji(button.emoji);
            }
            
            actionRow.addComponents(discordButton);
        });
        
        actionRows.push(actionRow);
    }
    return actionRows;
}

module.exports = (client, io) => {
    // Get all button role setups for a guild
    router.get('/button-roles/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            console.log(`🔍 Loading button roles for guild: ${guildId}`);
            
            const buttonRoles = roleAutomationService.getAllButtonRoles(guildId);
            console.log(`🔍 Found ${buttonRoles.length} button role setups`);
            
            res.json({
                success: true,
                buttonRoles
            });
        } catch (error) {
            console.error('Error loading button roles:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Create new button role setup
    router.post('/button-roles', async (req, res) => {
        try {
            const { embedData, buttons, guildId, channelId, loggingConfig } = req.body;
            
            // Validate input
            if (!embedData.title || !buttons || buttons.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Title and at least one button are required'
                });
            }
            
            if (buttons.length > 25) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum 25 buttons allowed'
                });
            }
            
            // Check for duplicate roles
            const roleIds = buttons.map(b => b.roleId);
            const duplicateRoles = roleIds.filter((roleId, index) => roleIds.indexOf(roleId) !== index);
            
            if (duplicateRoles.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each role can only be assigned to one button. Please remove duplicate roles.'
                });
            }
            
            // Create button role setup
            const setup = await roleAutomationService.setupButtonRoles(
                embedData,
                buttons,
                guildId,
                channelId,
                loggingConfig
            );
            
            // Send message to Discord
            const guild = client.guilds.cache.get(guildId);
            const channel = await guild.channels.fetch(channelId);
            
            if (!channel) {
                return res.status(404).json({
                    success: false,
                    message: 'Channel not found'
                });
            }
            
            // Create enhanced embed
            const embed = createEnhancedEmbed(embedData, buttons, guild);
            
            // Create customized buttons
            const actionRows = createCustomButtons(buttons, embedData, guild, setup.id.split('_')[2]);
            
            // Send message
            const message = await channel.send({
                embeds: [embed],
                components: actionRows
            });
            
            // Update setup with message ID
            setup.messageId = message.id;
            roleAutomationService.buttonRoles.set(setup.id, setup);
            await roleAutomationService.saveAutomationData();
            
            res.json({
                success: true,
                message: 'Button role setup created successfully',
                setup,
                messageUrl: message.url
            });
            
        } catch (error) {
            console.error('Error creating button roles:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Redeploy existing button role setup
    router.post('/button-roles/redeploy', async (req, res) => {
        try {
            const { setupId, channelId, guildId } = req.body;
            
            // Get the existing setup
            const setup = roleAutomationService.buttonRoles.get(`button_roles_${setupId}`);
            if (!setup) {
                return res.status(404).json({
                    success: false,
                    message: 'Button role setup not found'
                });
            }
            
            // Get guild and channel
            const guild = client.guilds.cache.get(guildId);
            const channel = await guild.channels.fetch(channelId);
            
            if (!channel) {
                return res.status(404).json({
                    success: false,
                    message: 'Channel not found'
                });
            }
            
            // Create enhanced embed
            const embed = createEnhancedEmbed(setup.embedData, setup.buttons, guild);
            
            // Create customized buttons
            const actionRows = createCustomButtons(setup.buttons, setup.embedData, guild, setupId);
            
            // Send message
            const message = await channel.send({
                embeds: [embed],
                components: actionRows
            });
            
            // Update setup with new message ID and channel
            setup.messageId = message.id;
            setup.channelId = channelId;
            setup.redeployedAt = new Date().toISOString();
            roleAutomationService.buttonRoles.set(`button_roles_${setupId}`, setup);
            await roleAutomationService.saveAutomationData();
            
            res.json({
                success: true,
                message: 'Button role setup redeployed successfully',
                messageUrl: message.url
            });
            
        } catch (error) {
            console.error('Error redeploying button roles:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Update existing button role setup
    router.put('/button-roles/:setupId', async (req, res) => {
        try {
            const { setupId } = req.params;
            const { embedData, buttons, channelId, guildId } = req.body;
            
            // Validate input
            if (!embedData.title || !buttons || buttons.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Title and at least one button are required'
                });
            }
            
            if (buttons.length > 25) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum 25 buttons allowed'
                });
            }
            
            // Check for duplicate roles
            const roleIds = buttons.map(b => b.roleId);
            const duplicateRoles = roleIds.filter((roleId, index) => roleIds.indexOf(roleId) !== index);
            
            if (duplicateRoles.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each role can only be assigned to one button. Please remove duplicate roles.'
                });
            }
            
            // Get the existing setup
            const setup = roleAutomationService.buttonRoles.get(`button_roles_${setupId}`);
            if (!setup) {
                return res.status(404).json({
                    success: false,
                    message: 'Button role setup not found'
                });
            }
            
            // Update the setup
            setup.embedData = embedData;
            setup.buttons = buttons;
            setup.channelId = channelId;
            setup.updatedAt = new Date().toISOString();
            
            roleAutomationService.buttonRoles.set(`button_roles_${setupId}`, setup);
            await roleAutomationService.saveAutomationData();
            
            // Get guild and channel for redeployment
            const guild = client.guilds.cache.get(guildId);
            const channel = await guild.channels.fetch(channelId);
            
            if (!channel) {
                return res.status(404).json({
                    success: false,
                    message: 'Channel not found'
                });
            }
            
            // Create enhanced embed with updated data
            const embed = createEnhancedEmbed(embedData, buttons, guild);
            
            // Create customized buttons
            const actionRows = createCustomButtons(buttons, embedData, guild, setupId);
            
            // Send updated message
            const message = await channel.send({
                embeds: [embed],
                components: actionRows
            });
            
            // Update setup with new message ID
            setup.messageId = message.id;
            roleAutomationService.buttonRoles.set(`button_roles_${setupId}`, setup);
            await roleAutomationService.saveAutomationData();
            
            res.json({
                success: true,
                message: 'Button role setup updated and redeployed successfully',
                setup,
                messageUrl: message.url
            });
            
        } catch (error) {
            console.error('Error updating button roles:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Delete button role setup
    router.delete('/button-roles/:setupId', async (req, res) => {
        try {
            const { setupId } = req.params;
            
            await roleAutomationService.deleteButtonRoleSetup(setupId);
            
            res.json({
                success: true,
                message: 'Button role setup deleted'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Save role logging configuration
    router.post('/role-logging-config', async (req, res) => {
        try {
            const { guildId, loggingConfig } = req.body;
            
            if (!guildId) {
                return res.status(400).json({
                    success: false,
                    message: 'Guild ID is required'
                });
            }
            
            // Save the logging configuration
            await roleAutomationService.updateRoleLoggingConfig(guildId, loggingConfig);
            
            res.json({
                success: true,
                message: 'Logging configuration saved successfully'
            });
            
        } catch (error) {
            console.error('Error saving logging config:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Load role logging configuration
    router.get('/role-logging-config/:guildId', async (req, res) => {
        try {
            const { guildId } = req.params;
            
            const config = roleAutomationService.getRoleLoggingConfig(guildId);
            
            res.json({
                success: true,
                config
            });
            
        } catch (error) {
            console.error('Error loading logging config:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Get button role statistics
    router.get('/button-roles/:guildId/stats', async (req, res) => {
        try {
            const { guildId } = req.params;
            
            const stats = roleAutomationService.getDetailedButtonRoleStats(guildId);
            
            res.json({
                success: true,
                stats
            });
            
        } catch (error) {
            console.error('Error getting button role stats:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    return router;
};
