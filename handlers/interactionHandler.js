const { EmbedBuilder } = require('discord.js');
const { storage } = require('../config/database');
const { BUILT_IN_COMMANDS } = require('../config/constants');
const ticketService = require('../services/ticketService');
const { saveDataDebounced, loadTicketData, saveTicketData } = require('../services/dataService');
const roleAutomationService = require('../services/roleAutomationService');
const eventService = require('../services/eventService');

function safeReply(interaction, options) {
    // Convert ephemeral to flags if needed
    if (options.ephemeral) {
        options.flags = options.flags || [];
        if (Array.isArray(options.flags)) {
            options.flags.push('Ephemeral');
        } else {
            options.flags = ['Ephemeral'];
        }
        delete options.ephemeral;
    }

    if (interaction.replied) {
        return interaction.followUp(options);
    } else if (interaction.deferred) {
        return interaction.editReply(options);
    } else {
        return interaction.reply(options);
    }
}

function safeUpdate(interaction, options) {
    if (interaction.replied) {
        return interaction.editReply(options);
    } else if (interaction.deferred) {
        return interaction.editReply(options);
    } else {
        return interaction.update(options);
    }
}

// Logging function for ticket events
async function logTicketEvent(ticketConfig, guild, eventType, ticket, user, additionalInfo = {}) {
    if (!ticketConfig.logChannelId) return;
    
    try {
        const logChannel = await guild.channels.fetch(ticketConfig.logChannelId);
        if (!logChannel) return;
        
        let embed = new EmbedBuilder()
            .setTimestamp()
            .setFooter({ text: `Ticket ID: ${ticket.id}` });
        
        switch (eventType) {
            case 'created':
                embed
                    .setTitle('🎫 Ticket Created')
                    .setDescription(`A new ticket has been created`)
                    .setColor('#00ff00')
                    .addFields([
                        { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Type', value: ticket.typeName || 'General Support', inline: true },
                        { name: 'Channel', value: `<#${ticket.channelId}>`, inline: true }
                    ]);
                
                if (ticket.responses && ticket.responses.length > 0) {
                    const responseText = ticket.responses.map(r => 
                        `**${r.question}:** ${r.answer}`
                    ).join('\n').substring(0, 1024);
                    embed.addFields([{ name: 'Initial Responses', value: responseText, inline: false }]);
                }
                break;
                
            case 'claimed':
                embed
                    .setTitle('✋ Ticket Claimed')
                    .setDescription(`Ticket has been claimed`)
                    .setColor('#ffaa00')
                    .addFields([
                        { name: 'Claimed By', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Original User', value: `<@${ticket.userId}>`, inline: true },
                        { name: 'Channel', value: `<#${ticket.channelId}>`, inline: true }
                    ]);
                break;
                
            case 'unclaimed':
                embed
                    .setTitle('🔓 Ticket Unclaimed')
                    .setDescription(`Ticket has been unclaimed`)
                    .setColor('#ff6600')
                    .addFields([
                        { name: 'Unclaimed By', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Original User', value: `<@${ticket.userId}>`, inline: true },
                        { name: 'Channel', value: `<#${ticket.channelId}>`, inline: true }
                    ]);
                break;
                
            case 'closed':
                embed
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(`Ticket has been closed`)
                    .setColor('#ff0000')
                    .addFields([
                        { name: 'Closed By', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Original User', value: `<@${ticket.userId}>`, inline: true },
                        { name: 'Duration', value: calculateDuration(ticket.createdAt, new Date().toISOString()), inline: true }
                    ]);
                
                if (additionalInfo.reason) {
                    embed.addFields([{ name: 'Close Reason', value: additionalInfo.reason, inline: false }]);
                }
                break;
                
            case 'user_added':
                embed
                    .setTitle('➕ User Added to Ticket')
                    .setDescription(`A user has been added to the ticket`)
                    .setColor('#00aaff')
                    .addFields([
                        { name: 'Added User', value: `${additionalInfo.addedUser.tag} (${additionalInfo.addedUser.id})`, inline: true },
                        { name: 'Added By', value: `${user.tag} (${user.id})`, inline: true },
                        { name: 'Channel', value: `<#${ticket.channelId}>`, inline: true }
                    ]);
                
                if (additionalInfo.reason) {
                    embed.addFields([{ name: 'Reason', value: additionalInfo.reason, inline: false }]);
                }
                break;
        }
        
        await logChannel.send({ embeds: [embed] });
        console.log(`📝 Logged ticket event: ${eventType} for ticket ${ticket.id}`);
        
    } catch (error) {
        console.error('Error logging ticket event:', error);
    }
}

function calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// General ticket creation function
async function createGeneralTicket(interaction, ticketData, ticketConfig, category, io) {
    const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    
    // Create ticket channel
    const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            {
                id: interaction.guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: interaction.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ],
            },
            // Add support roles
            ...ticketConfig.supportRoles.map(roleId => ({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ],
            }))
        ],
    });
    
    console.log('✅ General ticket channel created:', ticketChannel.name);
    
    // Create ticket record
    const newTicket = {
        id: `ticket_${Date.now()}`,
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: ticketChannel.id,
        guildId: interaction.guild.id,
        subject: 'General Support',
        typeName: 'General Support',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'open',
        priority: 'normal',
        claimed: false,
        claimedBy: null,
        claimedAt: null,
        addedUsers: []
    };
    
    // Add to active tickets
    if (!ticketData.activeTickets) {
        ticketData.activeTickets = [];
    }
    ticketData.activeTickets.push(newTicket);
    
    // Save ticket data
    await saveTicketData(ticketData);
    
    // Log the creation
    await logTicketEvent(ticketConfig, interaction.guild, 'created', newTicket, interaction.user);
    
    // Send welcome message
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎫 Support Ticket Created')
        .setDescription(`Hello ${interaction.user}, thank you for creating a support ticket!\n\nOur support team will be with you shortly. Please describe your issue in detail.`)
        .setColor('#00ff00')
        .addFields([
            { name: 'Ticket ID', value: newTicket.id, inline: true },
            { name: 'Type', value: 'General Support', inline: true },
            { name: 'Created By', value: `${interaction.user.tag}`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
            { name: 'Status', value: '🟢 Open', inline: true },
            { name: 'Claimed By', value: '❌ Unclaimed', inline: true }
        ])
        .setTimestamp();
    
    // Create action buttons
    const ticketButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Claim Ticket')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✋'),
            new ButtonBuilder()
                .setCustomId('add_user_ticket')
                .setLabel('Add User')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➕'),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒')
        );
    
    // Send message with user mention and buttons
    await ticketChannel.send({
        content: `${interaction.user} - Your ticket has been created!\n${ticketConfig.mentionSupport ? 
            `${ticketConfig.supportRoles.map(roleId => `<@&${roleId}>`).join(' ')} - New ticket created` : 
            ''}`,
        embeds: [welcomeEmbed],
        components: [ticketButtons]
    });
    
    // Reply to user
    await safeReply(interaction, {
        content: `✅ Your ticket has been created! Please check ${ticketChannel}`,
        ephemeral: true
    });
    
    // Emit to dashboard
    io.emit('ticketCreated', newTicket);
    
    console.log('✅ General ticket created successfully:', newTicket.id);
}

// Ticket creation with type function
async function createTicketWithType(interaction, ticketType, responses) {
    const ticketData = await loadTicketData();
    const ticketConfig = ticketData.ticketConfig;
    
    // Get category (use type-specific or default)
    const categoryId = ticketType.categoryId || ticketConfig.categoryId;
    const category = await interaction.guild.channels.fetch(categoryId);
    
    if (!category) {
        throw new Error('Ticket category not found');
    }
    
    const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    
    // Create ticket channel
    const ticketChannel = await interaction.guild.channels.create({
        name: `${ticketType.name.toLowerCase().replace(/\s+/g, '-')}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            {
                id: interaction.guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: interaction.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ],
            },
            // Add support roles
            ...ticketConfig.supportRoles.map(roleId => ({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ],
            })),
            // Add auto-assign roles
            ...ticketType.autoAssignRoles.map(roleId => ({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages
                ],
            }))
        ],
    });
    
    // Create ticket record
    const newTicket = {
        id: `ticket_${Date.now()}`,
        userId: interaction.user.id,
        username: interaction.user.username,
        channelId: ticketChannel.id,
        guildId: interaction.guild.id,
        subject: ticketType.name,
        typeName: ticketType.name,
        typeId: ticketType.id,
        responses: responses.map((response, index) => ({
            question: ticketType.questions[index]?.label || `Question ${index + 1}`,
            answer: response
        })),
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        status: 'open',
        priority: 'normal',
        claimed: false,
        claimedBy: null,
        claimedAt: null,
        addedUsers: []
    };
    
    // Add to active tickets
    if (!ticketData.activeTickets) {
        ticketData.activeTickets = [];
    }
    ticketData.activeTickets.push(newTicket);
    
    // Save ticket data
    await saveTicketData(ticketData);
    
    // Log the creation
    await logTicketEvent(ticketConfig, interaction.guild, 'created', newTicket, interaction.user);
    
    // Send welcome message
    const welcomeEmbed = new EmbedBuilder()
        .setTitle(`${ticketType.emoji || '🎫'} ${ticketType.name} Ticket Created`)
        .setDescription(`Hello ${interaction.user}, thank you for creating a ${ticketType.name} ticket!\n\n${ticketType.description || 'Our support team will be with you shortly.'}`)
        .setColor(ticketType.color || '#00ff00')
        .addFields([
            { name: 'Ticket ID', value: newTicket.id, inline: true },
            { name: 'Type', value: ticketType.name, inline: true },
            { name: 'Created By', value: `${interaction.user.tag}`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
            { name: 'Status', value: '🟢 Open', inline: true },
            { name: 'Claimed By', value: '❌ Unclaimed', inline: true }
        ])
        .setTimestamp();
    
    // Add responses if any
    if (responses.length > 0) {
        const responseText = responses.map((response, index) => 
            `**${ticketType.questions[index]?.label || `Question ${index + 1}`}:**\n${response}`
        ).join('\n\n');
        
        welcomeEmbed.addFields([
            { name: '📝 Your Responses', value: responseText.substring(0, 1024), inline: false }
        ]);
    }
    
    // Create action buttons
    const ticketButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('claim_ticket')
                .setLabel('Claim Ticket')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✋'),
            new ButtonBuilder()
                .setCustomId('add_user_ticket')
                .setLabel('Add User')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➕'),
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒')
        );
    
    // Send message with user mention and buttons
    await ticketChannel.send({
        content: `${interaction.user} - Your ${ticketType.name} ticket has been created!\n${ticketConfig.mentionSupport ? 
            `${ticketConfig.supportRoles.map(roleId => `<@&${roleId}>`).join(' ')} ${ticketType.autoAssignRoles.map(roleId => `<@&${roleId}>`).join(' ')} - New ${ticketType.name} ticket created` : 
            ''}`,
        embeds: [welcomeEmbed],
        components: [ticketButtons]
    });
    
    console.log('✅ Typed ticket created successfully:', newTicket.id);
    return ticketChannel;
}

async function closeTicketWithReason(interaction, reason, io) {
    try {
        // Load ticket data
        const ticketData = await loadTicketData();
        const activeTickets = ticketData.activeTickets || [];
        const ticketIndex = activeTickets.findIndex(t => t.channelId === interaction.channelId);
        
        if (ticketIndex === -1) {
            return safeReply(interaction, { 
                content: '❌ This is not a valid ticket channel.', 
                ephemeral: true 
            });
        }

        const ticket = activeTickets[ticketIndex];

        // CREATE the embed BEFORE using it
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(`Ticket closed by ${interaction.user}\n**Reason:** ${reason}\n\nSaving transcript and deleting channel in 10 seconds...`)
            .setColor('#ff0000')
            .addFields([
                { name: 'Ticket ID', value: ticket.id, inline: true },
                { name: 'Duration', value: calculateDuration(ticket.createdAt, new Date().toISOString()), inline: true },
                { name: 'Closed By', value: interaction.user.tag, inline: true }
            ])
            .setTimestamp();

        // Check for infinite delay
        const deleteDelay = ticket.noCloseDelay ? 999 * 60 * 60 * 1000 : 10000; // 999 hours or 10 seconds
        const deleteDelayText = ticket.noCloseDelay ? 'indefinitely (removeclosedelay was used)' : '10 seconds';

        // Update the description if needed
        closeEmbed.setDescription(`Ticket closed by ${interaction.user}\n**Reason:** ${reason}\n\nChannel will remain open ${deleteDelayText}...`);

        // NOW use the embed in safeUpdate
        await safeUpdate(interaction, {
            content: 'Saving transcript and closing ticket...',
            components: [],
            embeds: [closeEmbed]
        });

        // Move ticket to closed tickets
        const closedTicket = {
            ...ticket,
            closedAt: new Date().toISOString(),
            closedBy: interaction.user.username,
            closeReason: reason
        };

        // Remove from active tickets
        activeTickets.splice(ticketIndex, 1);
        
        // Add to closed tickets
        if (!ticketData.closedTickets) {
            ticketData.closedTickets = [];
        }
        ticketData.closedTickets.unshift(closedTicket);

        // Save data
        await saveTicketData(ticketData);

        // Log the close event
        await logTicketEvent(ticketData.ticketConfig, interaction.guild, 'closed', closedTicket, interaction.user, { reason });

        // Emit to dashboard
        io.emit('ticketClosed', { ticketId: interaction.channelId, closedTicket });

        // Delete channel after delay
        setTimeout(async () => {
            try {
                if (!ticket.noCloseDelay) {
                    await interaction.channel.delete();
                    console.log('✅ Ticket channel deleted:', interaction.channelId);
                } else {
                    console.log('⏰ Ticket channel kept open due to infinite delay:', interaction.channelId);
                }
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, deleteDelay);

    } catch (error) {
        console.error('Error in closeTicketWithReason:', error);
        await safeReply(interaction, {
            content: '❌ An error occurred while closing the ticket.',
            ephemeral: true
        });
    }
}

async function handleReactionRoleCommand(interaction) {
    try {
        const messageId = interaction.options.getString('message-id');
        const emoji = interaction.options.getString('emoji');
        const role = interaction.options.getRole('role');

        // Verify message exists
        const message = await interaction.channel.messages.fetch(messageId);
        
        // Setup reaction role
        await roleAutomationService.setupReactionRole(
            messageId,
            emoji,
            role.id,
            interaction.guild.id,
            `Get ${role.name} role`
        );

        // Add the reaction to the message
        await message.react(emoji);

        const embed = new EmbedBuilder()
            .setTitle('✅ Reaction Role Setup Complete')
            .setDescription(`Users can now react with ${emoji} to get the ${role.name} role!`)
            .addFields([
                { name: 'Message', value: `[Jump to message](${message.url})`, inline: true },
                { name: 'Emoji', value: emoji, inline: true },
                { name: 'Role', value: role.toString(), inline: true }
            ])
            .setColor('#00ff00')
            .setTimestamp();

        await safeReply(interaction, { embeds: [embed] });
        
    } catch (error) {
        console.error('Error in reaction role command:', error);
        await safeReply(interaction, { 
            content: `❌ Error: ${error.message}`, 
            ephemeral: true 
        });
    }
}

async function handleCreateEventCommand(interaction) {
    try {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const startTimeStr = interaction.options.getString('start-time');

        // Parse start time with better format handling
        let startTime;
        
        // Try YYYY-MM-DD HH:MM format
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(startTimeStr)) {
            startTime = new Date(startTimeStr);
        } else {
            // Try other formats
            startTime = new Date(startTimeStr);
        }

        if (isNaN(startTime.getTime())) {
            throw new Error('Invalid date format. Use YYYY-MM-DD HH:MM (example: 2025-05-24 20:00)');
        }

        if (startTime < new Date()) {
            throw new Error('Event start time must be in the future');
        }

        // Create event
        const event = await eventService.createEvent({
            title,
            description,
            startTime: startTime.toISOString(),
            endTime: new Date(startTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
            createdBy: interaction.user.id,
            reminders: ['1h', '15m']
        });

        const embed = new EmbedBuilder()
            .setTitle('📅 Event Created!')
            .setDescription(description)
            .addFields([
                { name: '📝 Title', value: title, inline: true },
                { name: '🕐 Start Time', value: `<t:${Math.floor(startTime.getTime() / 1000)}:F>`, inline: true },
                { name: '🆔 Event ID', value: event.id, inline: true }
            ])
            .setColor('#00ff00')
            .setTimestamp();

        await safeReply(interaction, { embeds: [embed] });
        
    } catch (error) {
        console.error('Error creating event:', error);
        await safeReply(interaction, { 
            content: `❌ Error: ${error.message}`, 
            ephemeral: true 
        });
    }
}


async function handleServerStatsCommand(interaction) {
    try {
        const roleStats = roleAutomationService.getAutomationStats(interaction.guild.id);
        const eventStats = eventService.getEventStats(interaction.guild.id);

        const embed = new EmbedBuilder()
            .setTitle('📊 Server Management Statistics')
            .addFields([
                { name: '🤖 Role Automation', value: `**Reaction Roles:** ${roleStats.reactionRoles}\n**Total Usage:** ${roleStats.totalReactionRoleUsage}`, inline: true },
                { name: '📅 Events', value: `**Total Events:** ${eventStats.totalEvents}\n**Upcoming:** ${eventStats.upcomingEvents}\n**Past:** ${eventStats.pastEvents}`, inline: true },
                { name: '👥 Event Attendance', value: `**Total Attendees:** ${eventStats.totalAttendees}`, inline: true }
            ])
            .setColor('#5865f2')
            .setTimestamp();

        await safeReply(interaction, { embeds: [embed] });
        
    } catch (error) {
        console.error('Error getting server stats:', error);
        await safeReply(interaction, { 
            content: '❌ Error getting server statistics', 
            ephemeral: true 
        });
    }
}

function setupInteractionHandler(client, io) {
    client.on('interactionCreate', async interaction => {
        try {
            if (interaction.isChatInputCommand()) {
                await handleSlashCommand(interaction, io);
            } else if (interaction.isButton()) {
                await handleButtonInteraction(interaction, client, io);
            } else if (interaction.isStringSelectMenu()) {
                await handleSelectMenuInteraction(interaction);
            } else if (interaction.isModalSubmit()) {
                await handleModalSubmit(interaction, client, io);
            } else if (interaction.isAutocomplete()) {
                await handleAutocomplete(interaction);
            }
        } catch (error) {
            console.error('Error handling interaction:', error);
            // Try to respond if we haven't already
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ content: '❌ An error occurred processing your request.', ephemeral: true });
                } catch (e) {
                    console.error('Failed to send error message:', e);
                }
            }
        }
    });
}


// Add this function to handle autocomplete
async function handleAutocomplete(interaction) {
    if (interaction.commandName === 'open') {
        const focusedOption = interaction.options.getFocused(true);
        
        if (focusedOption.name === 'type') {
            try {
                // Load ticket types
                const ticketData = await loadTicketData();
                const ticketTypes = ticketData.ticketConfig?.ticketTypes || [];
                
                // Filter based on user input
                const filtered = ticketTypes
                    .filter(type => type.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25) // Discord limit
                    .map(type => ({
                        name: `${type.emoji || '🎫'} ${type.name}`,
                        value: type.id
                    }));
                
                // Add "General Support" option
                if ('general support'.includes(focusedOption.value.toLowerCase())) {
                    filtered.unshift({
                        name: '🎫 General Support',
                        value: 'general'
                    });
                }
                
                await interaction.respond(filtered);
            } catch (error) {
                console.error('Error in autocomplete:', error);
                await interaction.respond([
                    { name: '🎫 General Support', value: 'general' }
                ]);
            }
        }
    }
}

async function handleSlashCommand(interaction, io) {
    const commandName = interaction.commandName;
    console.log(`⚡ Slash command used: /${commandName} by ${interaction.user.username}`);
    
    storage.commandStats.totalCommandsUsed = (storage.commandStats.totalCommandsUsed || 0) + 1;
    
    const commandLog = {
        command: commandName,
        user: interaction.user.username,
        guild: interaction.guild?.name || 'DM',
        timestamp: new Date().toISOString(),
        type: 'slash'
    };
    
    storage.recentCommands.unshift(commandLog);
    if (storage.recentCommands.length > 50) {
        storage.recentCommands = storage.recentCommands.slice(0, 50);
    }
    
    storage.botStats.commandsUsed = storage.commandStats.totalCommandsUsed;
    io.emit('commandUsed', commandLog);
    io.emit('statsUpdate', storage.botStats);

    if (BUILT_IN_COMMANDS[commandName]) {
        storage.commandStats.builtinUsage = storage.commandStats.builtinUsage || {};
        storage.commandStats.builtinUsage[commandName] = (storage.commandStats.builtinUsage[commandName] || 0) + 1;
        await handleBuiltInSlashCommand(interaction, commandName, io);
    } else if (storage.slashCommands.has(commandName)) {
        const command = storage.slashCommands.get(commandName);
        storage.commandStats.slashUsage = storage.commandStats.slashUsage || {};
        storage.commandStats.slashUsage[commandName] = (storage.commandStats.slashUsage[commandName] || 0) + 1;
        await handleCustomSlashCommand(interaction, command);
    } else {
        console.log(`❓ Unknown slash command: /${commandName}`);
        await safeReply(interaction, { content: '❌ Unknown command!', ephemeral: true });
    }
    
    saveDataDebounced();
}

async function handleBuiltInSlashCommand(interaction, commandName, io) {
    try {
        switch (commandName) {
            case 'ping':
                const latency = Date.now() - interaction.createdTimestamp;
                await safeReply(interaction, `Pong! 🏓\nLatency: ${latency}ms\nAPI Latency: ${Math.round(interaction.client.ws.ping)}ms`);
                break;

            case 'serverinfo':
                if (!interaction.guild) {
                    await safeReply(interaction, { content: 'This command can only be used in servers!', ephemeral: true });
                    return;
                }
                
                const embed = new EmbedBuilder()
                    .setTitle(`📊 ${interaction.guild.name} Server Info`)
                    .setThumbnail(interaction.guild.iconURL())
                    .addFields(
                        { name: '👑 Owner', value: `<@${interaction.guild.ownerId}>`, inline: true },
                        { name: '👥 Members', value: interaction.guild.memberCount.toString(), inline: true },
                        { name: '📅 Created', value: interaction.guild.createdAt.toDateString(), inline: true }
                    )
                    .setColor('#5865f2')
                    .setTimestamp();
                
                await safeReply(interaction, { embeds: [embed] });
                break;

            case 'userinfo':
                const user = interaction.options.getUser('user') || interaction.user;
                const member = interaction.guild?.members.cache.get(user.id);
                
                const userEmbed = new EmbedBuilder()
                    .setTitle(`👤 ${user.username} User Info`)
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: '🏷️ Tag', value: user.tag, inline: true },
                        { name: '🆔 ID', value: user.id, inline: true },
                        { name: '📅 Account Created', value: user.createdAt.toDateString(), inline: true }
                    )
                    .setColor('#5865f2')
                    .setTimestamp();

                if (member) {
                    userEmbed.addFields(
                        { name: '📅 Joined Server', value: member.joinedAt.toDateString(), inline: true }
                    );
                }

                await safeReply(interaction, { embeds: [userEmbed] });
                break;

            case 'clear':
                if (!interaction.member?.permissions.has('ManageMessages')) {
                    await safeReply(interaction, { content: '❌ You need "Manage Messages" permission!', ephemeral: true });
                    return;
                }

                const amount = interaction.options.getInteger('amount');
                const deleted = await interaction.channel.bulkDelete(amount);
                await safeReply(interaction, { content: `✅ Deleted ${deleted.size} messages!`, ephemeral: true });
                break;

            case 'echo':
                const message = interaction.options.getString('message');
                await safeReply(interaction, message);
                break;

            case 'open':
                await handleOpenTicketCommand(interaction, io);
                break;

            case 'close':
                await handleCloseTicketCommand(interaction, io);
                break;
            
            case 'reactionrole':
                await handleReactionRoleCommand(interaction);
                break;

            case 'createevent':
                await handleCreateEventCommand(interaction);
                break;

            case 'serverstats':
                await handleServerStatsCommand(interaction);
                break;

            case 'add':
                await handleAddUserCommand(interaction);
                break;

            case 'claim':
                await handleClaimTicketCommand(interaction);
                break;

            case 'unclaim':
                await handleUnclaimTicketCommand(interaction);
                break;

            case 'removeclosedelay':
                await handleRemoveCloseDelayCommand(interaction);
                break;

            case 'roll':
                const diceInput = interaction.options.getString('dice');
                if (!diceInput) {
                    const roll = Math.floor(Math.random() * 6) + 1;
                    await safeReply(interaction, `🎲 You rolled a ${roll}!`);
                } else {
                    const match = diceInput.match(/^(\d+)d(\d+)$/);
                    if (match) {
                        const [, numDice, sides] = match;
                        const rolls = [];
                        let total = 0;
                        for (let i = 0; i < Math.min(numDice, 10); i++) {
                            const roll = Math.floor(Math.random() * sides) + 1;
                            rolls.push(roll);
                            total += roll;
                        }
                        await safeReply(interaction, `🎲 ${diceInput}: [${rolls.join(', ')}] = **${total}**`);
                    } else {
                        await safeReply(interaction, '❌ Invalid dice notation! Use format like `2d6` or `1d20`');
                    }
                }
                break;
        }
    } catch (error) {
        console.error('Error executing slash command:', error);
        await safeReply(interaction, { content: '❌ An error occurred!', ephemeral: true });
    }
}

async function handleCustomSlashCommand(interaction, command) {
    try {
        let response = command.response;
        
        response = response.replace(/{user}/g, interaction.user.username);
        response = response.replace(/{mention}/g, `<@${interaction.user.id}>`);
        response = response.replace(/{server}/g, interaction.guild?.name || 'DM');
        
        if (command.options) {
            command.options.forEach(option => {
                const value = interaction.options.get(option.name)?.value || '';
                response = response.replace(new RegExp(`{${option.name}}`, 'g'), value);
            });
        }
        
        if (command.embed) {
            const embed = new EmbedBuilder()
                .setTitle(command.embedTitle || command.name)
                .setDescription(response)
                .setColor(command.embedColor || '#5865f2');
            
            if (command.embedImage) {
                embed.setImage(command.embedImage);
            }
            
            await safeReply(interaction, { embeds: [embed] });
        } else {
            await safeReply(interaction, response);
        }
    } catch (error) {
        console.error('Error executing custom slash command:', error);
        await safeReply(interaction, { content: '❌ An error occurred!', ephemeral: true });
    }
}
// Add these functions after your existing helper functions

async function handleOpenTicketCommand(interaction, io) {
    try {
        // Load ticket configuration
        const ticketData = await loadTicketData();
        const ticketConfig = ticketData.ticketConfig;
        
        if (!ticketConfig.enabled) {
            return safeReply(interaction, {
                content: '❌ Ticket system is currently disabled.',
                ephemeral: true
            });
        }

        // Check if user already has tickets
        const activeTickets = ticketData.activeTickets || [];
        const userTickets = activeTickets.filter(ticket => ticket.userId === interaction.user.id);
        
        if (userTickets.length >= ticketConfig.maxTicketsPerUser) {
            return safeReply(interaction, {
                content: `❌ You already have ${userTickets.length} active ticket(s). Please close your existing ticket(s) before creating a new one.`,
                ephemeral: true
            });
        }

        const typeInput = interaction.options.getString('type');
        const subject = interaction.options.getString('subject') || 'General Support';

        // Check if type was specified and exists
        if (typeInput && typeInput !== 'general' && ticketConfig.ticketTypes && ticketConfig.ticketTypes.length > 0) {
            const ticketType = ticketConfig.ticketTypes.find(t => t.id === typeInput);

            if (ticketType) {
                // Create typed ticket
                await interaction.deferReply({ ephemeral: true });
                const channel = await createTicketWithType(interaction, ticketType, []);
                return interaction.editReply({
                    content: `✅ Your ${ticketType.name} ticket has been created! Check ${channel}`
                });
            } else {
                return safeReply(interaction, {
                    content: '❌ Invalid ticket type selected. Please use the autocomplete suggestions.',
                    ephemeral: true
                });
            }
        }

        // Create general ticket
        const category = await interaction.guild.channels.fetch(ticketConfig.categoryId);
        if (!category) {
            return safeReply(interaction, {
                content: '❌ Ticket category not found. Please contact an administrator.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });
        await createGeneralTicket(interaction, ticketData, ticketConfig, category, io);

    } catch (error) {
        console.error('Error in open ticket command:', error);
        await safeReply(interaction, {
            content: '❌ An error occurred while creating your ticket.',
            ephemeral: true
        });
    }
}


async function handleCloseTicketCommand(interaction, io) {
    try {
        // Check if this is a ticket channel
        const ticketData = await loadTicketData();
        const activeTickets = ticketData.activeTickets || [];
        const ticket = activeTickets.find(t => t.channelId === interaction.channelId);
        
        if (!ticket) {
            return safeReply(interaction, {
                content: '❌ This command can only be used in ticket channels.',
                ephemeral: true
            });
        }

        // Check permissions
        const canClose = ticket.userId === interaction.user.id || 
                        ticketData.ticketConfig.supportRoles.some(roleId => 
                            interaction.member.roles.cache.has(roleId)
                        ) ||
                        interaction.member.permissions.has('ManageChannels');

        if (!canClose) {
            return safeReply(interaction, {
                content: '❌ You do not have permission to close this ticket.',
                ephemeral: true
            });
        }

        const reason = interaction.options.getString('reason') || 'Closed via command';
        
        await interaction.deferReply({ ephemeral: true });
        await closeTicketWithReason(interaction, reason, io);

    } catch (error) {
        console.error('Error in close ticket command:', error);
        await safeReply(interaction, {
            content: '❌ An error occurred while closing the ticket.',
            ephemeral: true
        });
    }
}

async function handleAddUserCommand(interaction) {
    try {
        // Check if this is a ticket channel
        const ticketData = await loadTicketData();
        const activeTickets = ticketData.activeTickets || [];
        const ticket = activeTickets.find(t => t.channelId === interaction.channelId);
        
        if (!ticket) {
            return safeReply(interaction, {
                content: '❌ This command can only be used in ticket channels.',
                ephemeral: true
            });
        }

        // Check permissions (support roles or ticket owner)
        const canAddUsers = ticket.userId === interaction.user.id || 
                           ticketData.ticketConfig.supportRoles.some(roleId => 
                               interaction.member.roles.cache.has(roleId)
                           ) ||
                           interaction.member.permissions.has('ManageChannels');

        if (!canAddUsers) {
            return safeReply(interaction, {
                content: '❌ You do not have permission to add users to this ticket.',
                ephemeral: true
            });
        }

        const userInput = interaction.options.getString('user');
        const reason = interaction.options.getString('reason') || 'Added via command';
        
        let userToAdd = null;
        
        // Try different methods to find the user
        try {
            // Method 1: Check if it's a mention
            const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
            if (mentionMatch) {
                userToAdd = await interaction.guild.members.fetch(mentionMatch[1]);
            }
            // Method 2: Check if it's a user ID
            else if (/^\d+$/.test(userInput)) {
                userToAdd = await interaction.guild.members.fetch(userInput);
            }
            // Method 3: Search by username
            else {
                const members = await interaction.guild.members.fetch();
                userToAdd = members.find(member => 
                    member.user.username.toLowerCase() === userInput.toLowerCase() ||
                    member.displayName.toLowerCase() === userInput.toLowerCase()
                );
            }
        } catch (error) {
            console.error('Error finding user:', error);
        }
        
        if (!userToAdd) {
            return safeReply(interaction, {
                content: '❌ User not found! Please make sure the user is in this server.',
                ephemeral: true
            });
        }

        // Check if user already has access
        const permissions = interaction.channel.permissionsFor(userToAdd);
        if (permissions && permissions.has('ViewChannel')) {
            return safeReply(interaction, {
                content: `❌ ${userToAdd.user.tag} already has access to this ticket!`,
                ephemeral: true
            });
        }

        // Add user to ticket channel
        await interaction.channel.permissionOverwrites.create(userToAdd.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true
        });

        // Log the user addition
        await logTicketEvent(ticketData.ticketConfig, interaction.guild, 'user_added', ticket, interaction.user, {
            addedUser: userToAdd.user,
            reason: reason
        });

        const addEmbed = new EmbedBuilder()
            .setTitle('➕ User Added to Ticket')
            .setDescription(`${userToAdd} has been added to this ticket by ${interaction.user}`)
            .addFields([
                { name: 'Added User', value: `${userToAdd.user.tag}`, inline: true },
                { name: 'Added By', value: `${interaction.user.tag}`, inline: true },
                { name: 'Reason', value: reason, inline: false }
            ])
            .setColor('#00ff00')
            .setTimestamp();

        await safeReply(interaction, { embeds: [addEmbed] });
        
        // Notify the added user
        await interaction.followUp({ 
            content: `${userToAdd} You have been added to this support ticket.`,
            ephemeral: false 
        });

    } catch (error) {
        console.error('Error in add user command:', error);
        await safeReply(interaction, {
            content: '❌ Failed to add user to ticket.',
            ephemeral: true
        });
    }
}

async function handleClaimTicketCommand(interaction) {
    try {
        // Check if this is a ticket channel
        const ticketData = await loadTicketData();
        const activeTickets = ticketData.activeTickets || [];
        const ticketIndex = activeTickets.findIndex(t => t.channelId === interaction.channelId);
        
        if (ticketIndex === -1) {
            return safeReply(interaction, {
                content: '❌ This command can only be used in ticket channels.',
                ephemeral: true
            });
        }

        const ticket = activeTickets[ticketIndex];

        // Check if already claimed
        if (ticket.claimed) {
            const claimedUser = await interaction.guild.members.fetch(ticket.claimedBy).catch(() => null);
            return safeReply(interaction, {
                content: `❌ This ticket is already claimed by ${claimedUser ? claimedUser.user.tag : 'Unknown User'}`,
                ephemeral: true
            });
        }

        // Claim the ticket
        ticket.claimed = true;
        ticket.claimedBy = interaction.user.id;
        ticket.claimedAt = new Date().toISOString();
        activeTickets[ticketIndex] = ticket;
        await saveTicketData(ticketData);

        // Log the claim event
        await logTicketEvent(ticketData.ticketConfig, interaction.guild, 'claimed', ticket, interaction.user);

        const claimEmbed = new EmbedBuilder()
            .setTitle('✋ Ticket Claimed')
            .setDescription(`This ticket has been claimed by ${interaction.user}`)
            .setColor('#00ff00')
            .setTimestamp();

        await safeReply(interaction, { embeds: [claimEmbed] });

    } catch (error) {
        console.error('Error in claim ticket command:', error);
        await safeReply(interaction, {
            content: '❌ An error occurred while claiming the ticket.',
            ephemeral: true
        });
    }
}

async function handleUnclaimTicketCommand(interaction) {
    try {
        // Check if this is a ticket channel
        const ticketData = await loadTicketData();
        const activeTickets = ticketData.activeTickets || [];
        const ticketIndex = activeTickets.findIndex(t => t.channelId === interaction.channelId);
        
        if (ticketIndex === -1) {
            return safeReply(interaction, {
                content: '❌ This command can only be used in ticket channels.',
                ephemeral: true
            });
        }

        const ticket = activeTickets[ticketIndex];

        // Check if ticket is claimed by this user
        if (!ticket.claimed || ticket.claimedBy !== interaction.user.id) {
            return safeReply(interaction, {
                content: '❌ You can only unclaim tickets that you have claimed.',
                ephemeral: true
            });
        }

        // Unclaim the ticket
        ticket.claimed = false;
        ticket.claimedBy = null;
        activeTickets[ticketIndex] = ticket;
        await saveTicketData(ticketData);

        // Log the unclaim event
        await logTicketEvent(ticketData.ticketConfig, interaction.guild, 'unclaimed', ticket, interaction.user);

        const unclaimEmbed = new EmbedBuilder()
            .setTitle('🔓 Ticket Unclaimed')
            .setDescription(`This ticket has been unclaimed by ${interaction.user}`)
            .setColor('#ffaa00')
            .setTimestamp();

        await safeReply(interaction, { embeds: [unclaimEmbed] });

    } catch (error) {
        console.error('Error in unclaim ticket command:', error);
        await safeReply(interaction, {
            content: '❌ An error occurred while unclaiming the ticket.',
            ephemeral: true
        });
    }
}

async function handleRemoveCloseDelayCommand(interaction) {
    try {
        // Check if this is a ticket channel
        const ticketData = await loadTicketData();
        const activeTickets = ticketData.activeTickets || [];
        const ticketIndex = activeTickets.findIndex(t => t.channelId === interaction.channelId);
        
        if (ticketIndex === -1) {
            return safeReply(interaction, {
                content: '❌ This command can only be used in ticket channels.',
                ephemeral: true
            });
        }

        const ticket = activeTickets[ticketIndex];

        // Check permissions (support roles only)
        const canRemoveDelay = ticketData.ticketConfig.supportRoles.some(roleId => 
                               interaction.member.roles.cache.has(roleId)
                           ) ||
                           interaction.member.permissions.has('ManageChannels');

        if (!canRemoveDelay) {
            return safeReply(interaction, {
                content: '❌ You do not have permission to remove close delays.',
                ephemeral: true
            });
        }

        // Set infinite delay (999 hours)
        ticket.noCloseDelay = true;
        activeTickets[ticketIndex] = ticket;
        await saveTicketData(ticketData);

        const delayEmbed = new EmbedBuilder()
            .setTitle('⏰ Close Delay Removed')
            .setDescription(`The automatic close delay has been removed by ${interaction.user}\n\nThis ticket will now remain open indefinitely when closed until manually deleted.`)
            .setColor('#ff9900')
            .setTimestamp();

        await safeReply(interaction, { embeds: [delayEmbed] });

        console.log(`⏰ Close delay removed for ticket ${ticket.id} by ${interaction.user.tag}`);

    } catch (error) {
        console.error('Error in remove close delay command:', error);
        await safeReply(interaction, {
            content: '❌ An error occurred while removing the close delay.',
            ephemeral: true
        });
    }
}

async function handleButtonInteraction(interaction, client, io) {
        // Handle button role interactions FIRST
    if (interaction.customId.startsWith('button_role_')) {
        console.log(`🎯 Handling button role interaction: ${interaction.customId}`);
        
        try {
            const result = await roleAutomationService.handleButtonRoleInteraction(
                interaction.customId,
                interaction.user.id,
                interaction.guild.id,
                interaction.guild
            );
            
            console.log(`🎯 Button role result:`, result);
            
    // Update the button role interaction response
    if (result.success) {
        const actionText = result.action === 'added' ? 'Added' : 'Removed';
        const emoji = result.emoji || '🎯';
        const actionEmoji = result.action === 'added' ? '✅' : '➖';
        
        // Create enhanced response embed
        const responseEmbed = new EmbedBuilder()
            .setTitle(`${actionEmoji} Role ${actionText}!`)
            .setDescription(`${emoji} **${result.role}** role has been ${result.action === 'added' ? 'added to' : 'removed from'} your account.`)
            .setColor(result.action === 'added' ? '#00ff00' : '#ff9900')
            .addFields([
                {
                    name: '👤 User',
                    value: `${interaction.user}`,
                    inline: true
                },
                {
                    name: '🎭 Role',
                    value: `${emoji} ${result.role}`,
                    inline: true
                },
                {
                    name: '⚡ Action',
                    value: `${actionEmoji} ${actionText}`,
                    inline: true
                }
            ])
            .setFooter({
                text: `Role ${result.action} successfully`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();
        
        await interaction.reply({
            embeds: [responseEmbed],
            ephemeral: true
        });
        
        console.log(`✅ ${result.action} role ${result.role} for ${interaction.user.username}`);
    } else {
        // Enhanced error response
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Role Update Failed')
            .setDescription('Unable to update your role. This might be due to permissions or the role no longer existing.')
            .setColor('#ff0000')
            .addFields([
                {
                    name: '🔍 Possible Causes',
                    value: '• Bot lacks permissions\n• Role was deleted\n• Server configuration changed',
                    inline: false
                }
            ])
            .setFooter({
                text: 'Contact an administrator if this persists',
                iconURL: interaction.guild.iconURL()
            })
            .setTimestamp();
        
        await interaction.reply({
            embeds: [errorEmbed],
            ephemeral: true
        });
    }



        } catch (error) {
            console.error('Error handling button role interaction:', error);
            
            // Make sure we respond to the interaction
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while updating your role.',
                    ephemeral: true
                });
            }
        }
        return; // Important: return here so we don't continue to other handlers
    }

    if (interaction.customId === 'create_ticket') {
        try {
            console.log('🎫 Ticket creation button clicked by:', interaction.user.username);
            
            // Load fresh ticket data
            const ticketData = await loadTicketData();
            const ticketConfig = ticketData.ticketConfig;
            
            console.log('🎫 Ticket system status:', {
                enabled: ticketConfig.enabled,
                categoryId: ticketConfig.categoryId,
                maxTicketsPerUser: ticketConfig.maxTicketsPerUser,
                ticketTypes: ticketConfig.ticketTypes?.length || 0
            });
            
            // Check if ticket system is enabled
            if (!ticketConfig.enabled) {
                console.log('❌ Ticket system is disabled');
                return await safeReply(interaction, {
                    content: '❌ Ticket system is currently disabled.',
                    ephemeral: true
                });
            }
            
            // Check if category exists
            if (!ticketConfig.categoryId) {
                console.log('❌ No ticket category configured');
                return await safeReply(interaction, {
                    content: '❌ Ticket system is not properly configured. Please contact an administrator.',
                    ephemeral: true
                });
            }
            
            // Get the category
            const category = await interaction.guild.channels.fetch(ticketConfig.categoryId);
            if (!category) {
                console.log('❌ Ticket category not found:', ticketConfig.categoryId);
                return await safeReply(interaction, {
                    content: '❌ Ticket category not found. Please contact an administrator.',
                    ephemeral: true
                });
            }
            
            // Check if user already has tickets
            const activeTickets = ticketData.activeTickets || [];
            const userTickets = activeTickets.filter(ticket => ticket.userId === interaction.user.id);
            
            if (userTickets.length >= ticketConfig.maxTicketsPerUser) {
                console.log('❌ User has too many tickets:', userTickets.length);
                return await safeReply(interaction, {
                    content: `❌ You already have ${userTickets.length} active ticket(s). Please close your existing ticket(s) before creating a new one.`,
                    ephemeral: true
                });
            }
            
            // Check if there are ticket types configured
            if (ticketConfig.ticketTypes && ticketConfig.ticketTypes.length > 0) {
                console.log('🎯 Showing ticket type selection:', ticketConfig.ticketTypes.length);
                
                // Show ticket type selection
                const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
                
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('ticket_type_select')
                    .setPlaceholder('Select a ticket type...')
                    .addOptions(
                        ticketConfig.ticketTypes.map(type => ({
                            label: type.name,
                            description: type.description || 'No description',
                            value: type.id,
                            emoji: type.emoji || '🎫'
                        }))
                    );
                
                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                return await safeReply(interaction, {
                    content: '🎫 **Select a ticket type:**\nChoose the type that best describes your issue.',
                    components: [row],
                    ephemeral: true
                });
            } else {
                console.log('📝 No ticket types configured, creating general ticket');
                // No ticket types configured, create a general ticket
                await createGeneralTicket(interaction, ticketData, ticketConfig, category, io);
            }
            
        } catch (error) {
            console.error('❌ Error creating ticket:', error);
            await safeReply(interaction, {
                content: '❌ An error occurred while creating your ticket. Please try again later.',
                ephemeral: true
            });
        }
    }

    if (interaction.customId === 'claim_ticket') {
        try {
            // Load ticket data to find the ticket
            const ticketData = await loadTicketData();
            const activeTickets = ticketData.activeTickets || [];
            const ticketIndex = activeTickets.findIndex(t => t.channelId === interaction.channelId);
            
            if (ticketIndex === -1) {
                return safeReply(interaction, { 
                    content: '❌ This is not a valid ticket channel.', 
                    ephemeral: true 
                });
            }

            const ticket = activeTickets[ticketIndex];

            // Check if already claimed
            if (ticket.claimed && ticket.claimedBy !== interaction.user.id) {
                const claimedUser = await interaction.guild.members.fetch(ticket.claimedBy).catch(() => null);
                return safeReply(interaction, { 
                    content: `❌ This ticket is already claimed by ${claimedUser ? claimedUser.user.tag : 'Unknown User'}`, 
                    ephemeral: true 
                });
            }


            // Check if user is unclaiming their own ticket
            if (ticket.claimed && ticket.claimedBy === interaction.user.id) {
                // Unclaim the ticket
                ticket.claimed = false;
                ticket.claimedBy = null;
                activeTickets[ticketIndex] = ticket;
                await saveTicketData(ticketData);

                // Log the unclaim event
                await logTicketEvent(ticketData.ticketConfig, interaction.guild, 'unclaimed', ticket, interaction.user);

                const unclaimEmbed = new EmbedBuilder()
                    .setTitle('🔓 Ticket Unclaimed')
                    .setDescription(`This ticket has been unclaimed by ${interaction.user}\nOther support members can now claim it.`)
                    .setColor('#ffaa00')
                    .setTimestamp();

                // Update the original embed
                const originalEmbed = interaction.message.embeds[0];
                const updatedEmbed = EmbedBuilder.from(originalEmbed)
                    .setFields(
                        originalEmbed.fields.map(field => 
                            field.name === 'Claimed By' 
                                ? { name: 'Claimed By', value: '❌ Unclaimed', inline: true }
                                : field
                        )
                    );

                await safeUpdate(interaction, {
                    embeds: [updatedEmbed],
                    components: interaction.message.components
                });

                await interaction.followUp({ embeds: [unclaimEmbed] });
                return;
            }

            // Claim the ticket
            ticket.claimed = true;
            ticket.claimedBy = interaction.user.id;
            ticket.claimedAt = new Date().toISOString();
            activeTickets[ticketIndex] = ticket;
            await saveTicketData(ticketData);

            // Log the claim event
            await logTicketEvent(ticketData.ticketConfig, interaction.guild, 'claimed', ticket, interaction.user);

            const claimEmbed = new EmbedBuilder()
                .setTitle('✋ Ticket Claimed')
                .setDescription(`This ticket has been claimed by ${interaction.user}\nOther support members can still view but should let ${interaction.user} handle this ticket.`)
                .setColor('#00ff00')
                .setTimestamp();

            // Update the original embed
            const originalEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setFields(
                    originalEmbed.fields.map(field => 
                        field.name === 'Claimed By' 
                            ? { name: 'Claimed By', value: `✅ ${interaction.user.tag}`, inline: true }
                            : field
                    )
                );

            await safeUpdate(interaction, {
                embeds: [updatedEmbed],
                components: interaction.message.components
            });

            await interaction.followUp({ embeds: [claimEmbed] });

        } catch (error) {
            console.error('Error in claim ticket:', error);
            await safeReply(interaction, { content: '❌ An error occurred.', ephemeral: true });
        }
    }

    if (interaction.customId === 'add_user_ticket') {
        try {
            // Load ticket data to verify this is a ticket channel
            const ticketData = await loadTicketData();
            const activeTickets = ticketData.activeTickets || [];
            const ticket = activeTickets.find(t => t.channelId === interaction.channelId);
            
            if (!ticket) {
                return safeReply(interaction, { 
                    content: '❌ This is not a valid ticket channel.', 
                    ephemeral: true 
                });
            }

            // Create modal for adding user
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
            const modal = new ModalBuilder()
                .setCustomId('add_user_modal')
                .setTitle('Add User to Ticket');

            const userInput = new TextInputBuilder()
                .setCustomId('user_input')
                .setLabel('User ID, @mention, or username')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('123456789012345678 or @username or username')
                .setRequired(true)
                .setMaxLength(100);

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason_input')
                .setLabel('Reason for adding (optional)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Why are you adding this user?')
                .setRequired(false)
                .setMaxLength(200);

            const userRow = new ActionRowBuilder().addComponents(userInput);
            const reasonRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(userRow, reasonRow);

            return interaction.showModal(modal);

        } catch (error) {
            console.error('Error in add user ticket:', error);
            await safeReply(interaction, { content: '❌ An error occurred.', ephemeral: true });
        }
    }

    if (interaction.customId === 'close_ticket') {
        try {
            // Load ticket data to find the ticket
            const ticketData = await loadTicketData();
            const activeTickets = ticketData.activeTickets || [];
            const ticket = activeTickets.find(t => t.channelId === interaction.channelId);
            
            if (!ticket) {
                return safeReply(interaction, { 
                    content: '❌ This is not a valid ticket channel.', 
                    ephemeral: true 
                });
            }

            // Check if user has permission to close
            const canClose = ticket.userId === interaction.user.id || 
                            ticketData.ticketConfig.supportRoles.some(roleId => 
                                interaction.member.roles.cache.has(roleId)
                            ) ||
                            interaction.member.permissions.has('ManageChannels');

            if (!canClose) {
                return safeReply(interaction, { 
                    content: '❌ You do not have permission to close this ticket.', 
                    ephemeral: true 
                });
            }

            // Show close reason modal if required
            if (ticketData.ticketConfig.requireReason) {
                const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                const modal = new ModalBuilder()
                    .setCustomId('close_ticket_modal')
                    .setTitle('Close Ticket');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('close_reason')
                    .setLabel('Reason for closing (required)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Please provide a reason for closing this ticket...')
                    .setRequired(true)
                    .setMaxLength(500);

                const row = new ActionRowBuilder().addComponents(reasonInput);
                modal.addComponents(row);

                return interaction.showModal(modal);
            } else {
                // Show confirmation without reason
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const confirmRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirm_close_ticket')
                            .setLabel('✅ Confirm Close')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('cancel_close_ticket')
                            .setLabel('❌ Cancel')
                            .setStyle(ButtonStyle.Secondary)
                    );

                return safeReply(interaction, {
                    content: '⚠️ Are you sure you want to close this ticket? This action cannot be undone.',
                    components: [confirmRow],
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error in close ticket:', error);
            await safeReply(interaction, { content: '❌ An error occurred.', ephemeral: true });
        }
    }

    if (interaction.customId === 'confirm_close_ticket') {
        try {
            await closeTicketWithReason(interaction, 'No reason provided', io);
        } catch (error) {
            console.error('Error in confirm close ticket:', error);
        }
    }

    if (interaction.customId === 'cancel_close_ticket') {
        return safeUpdate(interaction, {
            content: '❌ Ticket close cancelled.',
            components: []
        });
    }
}

async function handleSelectMenuInteraction(interaction) {
    if (interaction.customId === 'ticket_type_select') {
        const typeId = interaction.values[0];
        
        // Load ticket data to get the ticket type
        const ticketData = await loadTicketData();
        const ticketType = ticketData.ticketConfig.ticketTypes.find(t => t.id === typeId);
        
        if (!ticketType) {
            return safeReply(interaction, { content: '❌ Invalid ticket type selected.', ephemeral: true });
        }

        console.log('🎯 Selected ticket type:', ticketType.name);

        // Check if the ticket type has questions
        if (ticketType.questions && ticketType.questions.length > 0) {
            // Create modal with questions
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
            
            const modal = new ModalBuilder()
                .setCustomId(`ticket_modal_${typeId}`)
                .setTitle(`${ticketType.name} - ${ticketType.emoji || '🎫'}`);

            // Add up to 5 questions (Discord modal limit)
            const questions = ticketType.questions.slice(0, 5);
            
            questions.forEach((question, index) => {
                const textInput = new TextInputBuilder()
                    .setCustomId(`question_${index}`)
                    .setLabel(question.label)
                    .setStyle(question.type === 'textarea' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setRequired(question.required || false)
                    .setMaxLength(question.maxLength || (question.type === 'textarea' ? 1000 : 100));

                if (question.placeholder) {
                    textInput.setPlaceholder(question.placeholder);
                }
                if (question.minLength) {
                    textInput.setMinLength(question.minLength);
                }

                const actionRow = new ActionRowBuilder().addComponents(textInput);
                modal.addComponents(actionRow);
            });

            return interaction.showModal(modal);
        } else {
            // No questions, create ticket directly
            await interaction.deferReply({ ephemeral: true });
            
            try {
                await createTicketWithType(interaction, ticketType, []);
                return interaction.editReply({
                    content: `✅ Your ${ticketType.name} ticket has been created!`
                });
            } catch (error) {
                console.error('Error creating ticket:', error);
                return interaction.editReply({
                    content: '❌ There was an error creating your ticket. Please try again.'
                });
            }
        }
    }
}

async function handleModalSubmit(interaction, client, io) {
    if (interaction.customId === 'add_user_modal') {
        try {
            // Load ticket data to verify this is a ticket channel
            const ticketData = await loadTicketData();
            const activeTickets = ticketData.activeTickets || [];
            const ticket = activeTickets.find(t => t.channelId === interaction.channelId);
            
            if (!ticket) {
                return safeReply(interaction, { 
                    content: '❌ This is not a valid ticket channel.', 
                    ephemeral: true 
                });
            }

            const userInput = interaction.fields.getTextInputValue('user_input');
            const reason = interaction.fields.getTextInputValue('reason_input') || 'No reason provided';
            
            let userToAdd = null;
            
            // Try different methods to find the user
            try {
                // Method 1: Check if it's a mention
                const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
                if (mentionMatch) {
                    userToAdd = await interaction.guild.members.fetch(mentionMatch[1]);
                }
                // Method 2: Check if it's a user ID
                else if (/^\d+$/.test(userInput)) {
                    userToAdd = await interaction.guild.members.fetch(userInput);
                }
                // Method 3: Search by username
                else {
                    const members = await interaction.guild.members.fetch();
                    userToAdd = members.find(member => 
                        member.user.username.toLowerCase() === userInput.toLowerCase() ||
                        member.displayName.toLowerCase() === userInput.toLowerCase()
                    );
                }
            } catch (error) {
                console.error('Error finding user:', error);
            }
            
            if (!userToAdd) {
                return safeReply(interaction, { 
                    content: '❌ User not found! Please make sure:\n• The user is in this server\n• You used the correct username, ID, or mention\n• The user ID is valid', 
                    ephemeral: true 
                });
            }

            // Check if user already has access
            const permissions = interaction.channel.permissionsFor(userToAdd);
            if (permissions && permissions.has('ViewChannel')) {
                return safeReply(interaction, { 
                    content: `❌ ${userToAdd.user.tag} already has access to this ticket!`, 
                    ephemeral: true 
                });
            }

            // Add user to ticket channel
            await interaction.channel.permissionOverwrites.create(userToAdd.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            });

            // Log the user addition
            await logTicketEvent(ticketData.ticketConfig, interaction.guild, 'user_added', ticket, interaction.user, {
                addedUser: userToAdd.user,
                reason: reason
            });

            const addEmbed = new EmbedBuilder()
                .setTitle('➕ User Added to Ticket')
                .setDescription(`${userToAdd} has been added to this ticket by ${interaction.user}`)
                .addFields([
                    { name: 'Added User', value: `${userToAdd.user.tag}`, inline: true },
                    { name: 'Added By', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                ])
                .setColor('#00ff00')
                .setTimestamp();

            await safeReply(interaction, { embeds: [addEmbed] });
            
            // Notify the added user
            await interaction.followUp({ 
                content: `${userToAdd} You have been added to this support ticket.`,
                ephemeral: false 
            });

            console.log(`✅ User ${userToAdd.user.tag} added to ticket ${ticket.id} by ${interaction.user.tag}`);

        } catch (error) {
            console.error('Error adding user to ticket:', error);
            await safeReply(interaction, { 
                content: '❌ Failed to add user. Please make sure the user exists and is in this server.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.customId === 'close_ticket_modal') {
        try {
            const reason = interaction.fields.getTextInputValue('close_reason');
            
            // Defer the reply since closing might take time
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ ephemeral: true });
            }
            
            await closeTicketWithReason(interaction, reason, io);
        } catch (error) {
            console.error('Error in close ticket modal:', error);
            await safeReply(interaction, { 
                content: '❌ An error occurred.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.customId.startsWith('ticket_modal_')) {
        const typeId = interaction.customId.replace('ticket_modal_', '');
        
        // Load ticket data to get the ticket type
        const ticketData = await loadTicketData();
        const ticketType = ticketData.ticketConfig.ticketTypes.find(t => t.id === typeId);
        
        if (!ticketType) {
            return safeReply(interaction, { content: '❌ Invalid ticket type.', ephemeral: true });
        }

        const responses = [];
        for (let i = 0; i < ticketType.questions.length && i < 5; i++) {
            const response = interaction.fields.getTextInputValue(`question_${i}`);
            responses.push(response);
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = await createTicketWithType(interaction, ticketType, responses);
            
            return interaction.editReply({
                content: `✅ Your ${ticketType.name} ticket has been created! Please check ${channel}`
            });
        } catch (error) {
            console.error('Error creating ticket:', error);
            return interaction.editReply({
                content: '❌ There was an error creating your ticket. Please try again or contact an administrator.'
            });
        }
    }
}

module.exports = { setupInteractionHandler };
