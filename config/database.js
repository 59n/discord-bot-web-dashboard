const NodeCache = require('node-cache');

// Initialize cache with 5 minute TTL
const cache = new NodeCache({ stdTTL: 300 });

// In-memory storage (you can replace with actual database later)
let storage = {
    // Bot data
    customCommands: new Map(),
    slashCommands: new Map(),
    commandStats: {
        totalCommandsUsed: 0,
        builtinUsage: {},
        customUsage: {},
        slashUsage: {}
    },
    
    // Ticket system
    ticketConfig: {
        enabled: false,
        categoryId: null,
        channelId: null,
        supportRoles: [],
        embed: {
            title: 'Create a Ticket',
            description: 'Click the button below to create a support ticket',
            color: '#5865f2',
            image: null
        },
        ticketTypes: [
            {
                id: 'general',
                name: 'General Support',
                description: 'General questions and concerns',
                emoji: '❓',
                questions: [
                    { label: 'What is your issue?', placeholder: 'Describe your problem...', required: true },
                    { label: 'Additional details', placeholder: 'Any other information...', required: false }
                ]
            }
        ]
    },
    activeTickets: new Map(),
    closedTickets: [],
    
    // Security
    securitySettings: {
        twoFactorEnabled: false,
        ipWhitelisting: false,
        sessionTimeout: 3600,
        passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true
        },
        loginAttempts: {
            maxAttempts: 5,
            lockoutDuration: 900
        },
        encryption: true,
        auditLogging: true
    },
    users: [],
    securityLogs: [],
    whitelistedIPs: [],
    activeSessions: [],
    loginAttempts: new Map(),
    
    // Bot stats
    botStats: {
        status: 'offline',
        guilds: 0,
        users: 0,
        uptime: 0,
        startTime: Date.now(),
        commands: [],
        avatar: null,
        username: null,
        commandsUsed: 0
    },
    
    // Recent activity
    recentMessages: [],
    recentCommands: [],
    
    // Misc
    registrationInProgress: false
};

module.exports = {
    cache,
    storage
};
