const { GatewayIntentBits } = require('discord.js');

const CLIENT_CONFIG = {
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions 
    ]
};

const SERVER_CONFIG = {
    socketOptions: {
        cors: {
            origin: process.env.NODE_ENV === 'production' 
                ? false 
                : ["http://localhost:3001", "http://localhost:3000"],
            methods: ["GET", "POST"],
            credentials: true
        }
    }
};

const BOT_START_TIME = Date.now();

const DATA_PATHS = {
    DATA_DIR: './data',
    COMMANDS_FILE: './data/commands.json',
    STATS_FILE: './data/command-stats.json',
    SLASH_FILE: './data/slash-commands.json',
    TICKET_CONFIG_FILE: './data/ticket-config.json',
    ACTIVE_TICKETS_FILE: './data/active-tickets.json',
    CLOSED_TICKETS_FILE: './data/closed-tickets.json',
    SECURITY_SETTINGS_FILE: './data/security-settings.json',
    USERS_FILE: './data/users.json',
    SECURITY_LOGS_FILE: './data/security-logs.json',
    WHITELIST_FILE: './data/whitelist.json'
};

const BUILT_IN_COMMANDS = {
    ping: {
        name: 'ping',
        description: 'Check bot latency',
        response: 'Pong! 🏓',
        type: 'builtin',
        category: 'utility',
        options: []
    },
    serverinfo: {
        name: 'serverinfo',
        description: 'Get server information',
        response: 'embed',
        type: 'builtin',
        category: 'info',
        options: []
    },
    userinfo: {
        name: 'userinfo',
        description: 'Get user information',
        response: 'embed',
        type: 'builtin',
        category: 'info',
        options: [
            {
                name: 'user',
                description: 'User to get info about',
                type: 6,
                required: false
            }
        ]
    },
    help: {
        name: 'help',
        description: 'Show all available commands',
        response: 'embed',
        type: 'builtin',
        category: 'utility',
        options: []
    },
    clear: {
        name: 'clear',
        description: 'Clear messages (1-100)',
        response: 'function',
        type: 'builtin',
        category: 'moderation',
        permissions: ['ManageMessages'],
        options: [
            {
                name: 'amount',
                description: 'Number of messages to clear',
                type: 4,
                required: true,
                min_value: 1,
                max_value: 100
            }
        ]
    },
    echo: {
        name: 'echo',
        description: 'Repeat a message',
        response: 'function',
        type: 'builtin',
        category: 'fun',
        options: [
            {
                name: 'message',
                description: 'Message to echo',
                type: 3,
                required: true
            }
        ]
    },
    roll: {
        name: 'roll',
        description: 'Roll dice (e.g., 2d6)',
        response: 'function',
        type: 'builtin',
        category: 'fun',
        options: [
            {
                name: 'dice',
                description: 'Dice notation (e.g., 2d6)',
                type: 3,
                required: false
            }
        ]
    },
    warn: {
        name: 'warn',
        description: 'Warn a user',
        response: 'function',
        type: 'builtin',
        category: 'moderation',
        permissions: ['ModerateMembers'],
        options: [
            {
                name: 'user',
                description: 'User to warn',
                type: 6,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for warning',
                type: 3,
                required: false
            }
        ]
    },
    mute: {
        name: 'mute',
        description: 'Mute a user',
        response: 'function',
        type: 'builtin',
        category: 'moderation',
        permissions: ['ModerateMembers'],
        options: [
            {
                name: 'user',
                description: 'User to mute',
                type: 6,
                required: true
            },
            {
                name: 'duration',
                description: 'Duration (e.g., 10m, 1h, 1d)',
                type: 3,
                required: false
            },
            {
                name: 'reason',
                description: 'Reason for mute',
                type: 3,
                required: false
            }
        ]
    },
    unmute: {
        name: 'unmute',
        description: 'Unmute a user',
        response: 'function',
        type: 'builtin',
        category: 'moderation',
        permissions: ['ModerateMembers'],
        options: [
            {
                name: 'user',
                description: 'User to unmute',
                type: 6,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for unmute',
                type: 3,
                required: false
            }
        ]
    },
    kick: {
        name: 'kick',
        description: 'Kick a user from the server',
        response: 'function',
        type: 'builtin',
        category: 'moderation',
        permissions: ['KickMembers'],
        options: [
            {
                name: 'user',
                description: 'User to kick',
                type: 6,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for kick',
                type: 3,
                required: false
            }
        ]
    },
    ban: {
        name: 'ban',
        description: 'Ban a user from the server',
        response: 'function',
        type: 'builtin',
        category: 'moderation',
        permissions: ['BanMembers'],
        options: [
            {
                name: 'user',
                description: 'User to ban',
                type: 6,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for ban',
                type: 3,
                required: false
            },
            {
                name: 'delete_days',
                description: 'Days of messages to delete (0-7)',
                type: 4,
                required: false,
                min_value: 0,
                max_value: 7
            }
        ]
    },
    unban: {
        name: 'unban',
        description: 'Unban a user',
        response: 'function',
        type: 'builtin',
        category: 'moderation',
        permissions: ['BanMembers'],
        options: [
            {
                name: 'user_id',
                description: 'User ID to unban',
                type: 3,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for unban',
                type: 3,
                required: false
            }
        ]
    },
    warnings: {
        name: 'warnings',
        description: 'View user warnings',
        response: 'function',
        type: 'builtin',
        category: 'moderation',
        permissions: ['ModerateMembers'],
        options: [
            {
                name: 'user',
                description: 'User to check warnings for',
                type: 6,
                required: true
            }
        ]
    },
    // TICKET COMMANDS
    open: {
        name: 'open',
        description: 'Open a new support ticket',
        response: 'function',
        type: 'builtin',
        category: 'ticket',
        options: [
            {
                name: 'type',
                description: 'Type of ticket to create',
                type: 3, // STRING
                required: false,
                autocomplete: true // This enables autocomplete
            },
            {
                name: 'subject',
                description: 'Brief description of your issue',
                type: 3,
                required: false
            }
        ]
    },
    close: {
        name: 'close',
        description: 'Close the current ticket',
        response: 'function',
        type: 'builtin',
        category: 'ticket',
        options: [
            {
                name: 'reason',
                description: 'Reason for closing the ticket',
                type: 3,
                required: false
            }
        ]
    },
    add: {
        name: 'add',
        description: 'Add a user to the current ticket',
        response: 'function',
        type: 'builtin',
        category: 'ticket',
        options: [
            {
                name: 'user',
                description: 'User to add (ID, mention, or username)',
                type: 3,
                required: true
            },
            {
                name: 'reason',
                description: 'Reason for adding the user',
                type: 3,
                required: false
            }
        ]
    },
    claim: {
        name: 'claim',
        description: 'Claim the current ticket',
        response: 'function',
        type: 'builtin',
        category: 'ticket',
        options: []
    },
    unclaim: {
        name: 'unclaim',
        description: 'Unclaim the current ticket',
        response: 'function',
        type: 'builtin',
        category: 'ticket',
        options: []
    },
    removeclosedelay: {
        name: 'removeclosedelay',
        description: 'Remove the automatic close delay for this ticket',
        response: 'function',
        type: 'builtin',
        category: 'ticket',
        options: []
    },
    reactionrole: {
        name: 'reactionrole',
        description: 'Setup a reaction role',
        response: 'function',
        type: 'builtin',
        category: 'management',
        options: [
            {
                name: 'message-id',
                description: 'Message ID to add reaction role to',
                type: 3,
                required: true
            },
            {
                name: 'emoji',
                description: 'Emoji to react with',
                type: 3,
                required: true
            },
            {
                name: 'role',
                description: 'Role to assign',
                type: 8,
                required: true
            }
        ]
    },
    createevent: {
        name: 'createevent',
        description: 'Create a server event',
        response: 'function',
        type: 'builtin',
        category: 'management',
        options: [
            {
                name: 'title',
                description: 'Event title',
                type: 3,
                required: true
            },
            {
                name: 'description',
                description: 'Event description',
                type: 3,
                required: true
            },
            {
                name: 'start-time',
                description: 'Start time (YYYY-MM-DD HH:MM)',
                type: 3,
                required: true
            }
        ]
    },
    serverstats: {
        name: 'serverstats',
        description: 'Show server management statistics',
        response: 'function',
        type: 'builtin',
        category: 'management',
        options: []
    }
};

module.exports = {
    CLIENT_CONFIG,
    SERVER_CONFIG,
    BOT_START_TIME,
    DATA_PATHS,
    BUILT_IN_COMMANDS
};
