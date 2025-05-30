const { EmbedBuilder } = require('discord.js');
const { storage } = require('../config/database');
const { BOT_START_TIME } = require('../config/constants');
const commandService = require('../services/commandService');
const { setupInteractionHandler } = require('./interactionHandler');
const { setupCommandHandler } = require('./commandHandler');
const { setupModerationHandler } = require('./moderationHandler');
const { setupAnalyticsHandler } = require('./analyticsHandler');
const { setupNotificationHandler } = require('./notificationHandler');
const roleAutomationService = require('../services/roleAutomationService');

function setupEventHandlers(client, io) {
    // Bot ready event
    client.once('ready', async () => {
        console.log(`🤖 Bot is ready! Logged in as ${client.user.tag}`);
        console.log(`📊 Bot ID: ${client.user.id}`);
        console.log(`🌐 Connected to ${client.guilds.cache.size} servers`);
        
        // Register slash commands after a delay
        setTimeout(async () => {
            try {
                const result = await commandService.registerSlashCommands(client);
                if (result.success) {
                    console.log('🎉 Slash commands registration completed!');
                    io.emit('slashCommandsUpdated', result);
                }
            } catch (error) {
                console.log('⚠️ Slash commands registration failed, will retry...');
                io.emit('slashCommandError', { error: error.message });
                setTimeout(() => commandService.registerSlashCommands(client).catch(console.error), 10000);
            }
        }, 2000);
        
        // Update bot stats
        storage.botStats.status = 'online';
        storage.botStats.avatar = client.user.displayAvatarURL();
        storage.botStats.username = client.user.username;
        storage.botStats.commandsUsed = storage.commandStats.totalCommandsUsed || 0;
        
        updateStats(client);
        io.emit('botStatus', storage.botStats);
    });

    // Setup interaction and command handlers
    setupInteractionHandler(client, io);
    setupCommandHandler(client, io);
    setupModerationHandler(client, io);
    setupAnalyticsHandler(client, io);
    setupNotificationHandler(client, io);

    // Message create event for tracking
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const messageData = {
            id: message.id,
            guild: message.guild?.name || 'DM',
            guildId: message.guild?.id || null,
            channel: message.channel.name || 'DM',
            channelId: message.channel.id,
            author: message.author.username,
            authorAvatar: message.author.displayAvatarURL(),
            content: message.content,
            timestamp: new Date().toISOString()
        };
        
        storage.recentMessages.unshift(messageData);
        if (storage.recentMessages.length > 100) {
            storage.recentMessages = storage.recentMessages.slice(0, 100);
        }
        
        io.emit('newMessage', messageData);
    });

    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        
        // Handle partial reactions
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        
        console.log(`🔍 Reaction added: ${reaction.emoji.name} by ${user.username} on message ${reaction.message.id}`);
        
        try {
            const result = await roleAutomationService.handleReactionAdd(
                reaction.message.id,
                reaction.emoji.name,
                user.id,
                reaction.message.guild.id,
                reaction.message.guild
            );
            
            if (result.success) {
                console.log(`✅ ${result.action} role ${result.role} for ${user.username}`);
            } else {
                console.log(`ℹ️ Reaction role result:`, result);
            }
        } catch (error) {
            console.error('Error handling reaction add:', error);
        }
    });

    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;
        
        // Handle partial reactions
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        
        console.log(`🔍 Reaction removed: ${reaction.emoji.name} by ${user.username} on message ${reaction.message.id}`);
        
        try {
            const result = await roleAutomationService.handleReactionRemove(
                reaction.message.id,
                reaction.emoji.name,
                user.id,
                reaction.message.guild.id,
                reaction.message.guild
            );
            
            if (result.success) {
                console.log(`✅ ${result.action} role ${result.role} for ${user.username}`);
            }
        } catch (error) {
            console.error('Error handling reaction remove:', error);
        }
    });


    // Socket connection events
    io.on('connection', (socket) => {
        console.log('🌐 Web client connected');
        updateStats(client);
        socket.emit('botStatus', storage.botStats);
        socket.emit('messageHistory', storage.recentMessages);
        socket.emit('commandHistory', storage.recentCommands);
        
        socket.on('disconnect', () => {
            console.log('🌐 Web client disconnected');
        });
    });

    // Update stats every 5 seconds
    setInterval(() => {
        if (client.isReady()) {
            updateStats(client);
            io.emit('statsUpdate', storage.botStats);
        }
    }, 5000);

    console.log('✅ Event handlers configured');
}

function updateStats(client) {
    storage.botStats.guilds = client.guilds.cache.size;
    storage.botStats.users = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    storage.botStats.uptime = Math.floor((Date.now() - BOT_START_TIME) / 1000);
    storage.botStats.commandsUsed = storage.commandStats.totalCommandsUsed || 0;
    
    const builtinUsage = storage.commandStats.builtinUsage || {};
    const customUsage = storage.commandStats.customUsage || {};
    const slashUsage = storage.commandStats.slashUsage || {};
    
    storage.botStats.commands = [
        ...Object.entries(require('../config/constants').BUILT_IN_COMMANDS).map(([name, cmd]) => ({
            ...cmd,
            usage: builtinUsage[name] || 0
        })),
        ...Array.from(storage.customCommands.entries()).map(([name, cmd]) => ({
            ...cmd,
            usage: customUsage[name] || 0
        })),
        ...Array.from(storage.slashCommands.entries()).map(([name, cmd]) => ({
            ...cmd,
            usage: slashUsage[name] || 0,
            type: 'slash'
        }))
    ];
}

module.exports = { setupEventHandlers };
