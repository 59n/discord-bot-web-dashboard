const fs = require('fs').promises;
const path = require('path');

// Storage object
const storage = {
    customCommands: new Map(),
    commandStats: {
        totalCommandsUsed: 0,
        builtinUsage: {},
        customUsage: {}
    },
    recentCommands: [],
    botStats: {
        uptime: Date.now(),
        commandsUsed: 0,
        serversJoined: 0
    }
};

// Debounced save function
let saveTimeout;
const saveDataDebounced = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await saveData();
    }, 5000); // Save after 5 seconds of inactivity
};

// Ensure data directory exists
async function ensureDataDir() {
    const dataDir = path.join(__dirname, '../data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
        console.log('📁 Created data directory');
    }
}

// Load commands
async function loadCommands() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/commands.json'), 'utf8');
        const parsed = JSON.parse(data);
        
        if (parsed.customCommands) {
            storage.customCommands = new Map(Object.entries(parsed.customCommands));
        }
        if (parsed.commandStats) {
            storage.commandStats = { ...storage.commandStats, ...parsed.commandStats };
        }
        if (parsed.recentCommands) {
            storage.recentCommands = parsed.recentCommands;
        }
        
        console.log(`✅ Loaded ${storage.customCommands.size} custom commands`);
        return parsed;
    } catch (error) {
        console.log('📋 No existing commands data found');
        return {};
    }
}

// Load tickets (placeholder)
async function loadTickets() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/tickets.json'), 'utf8');
        const parsed = JSON.parse(data);
        console.log('✅ Loaded tickets data');
        return parsed;
    } catch (error) {
        console.log('🎫 No existing tickets data found');
        return {};
    }
}


// Load moderation data (placeholder)
async function loadModeration() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/moderation.json'), 'utf8');
        const parsed = JSON.parse(data);
        console.log('✅ Loaded moderation data');
        return parsed;
    } catch (error) {
        console.log('🛡️ No existing moderation data found');
        return {};
    }
}
// Role Automation Data
async function loadRoleAutomationData() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/role-automation.json'), 'utf8');
        const parsed = JSON.parse(data);
        console.log('✅ Loaded role automation data');
        return parsed;
    } catch (error) {
        console.log('🔄 No existing role automation data found');
        return {};
    }
}

async function saveRoleAutomationData(data) {
    try {
        await ensureDataDir();
        await fs.writeFile(
            path.join(__dirname, '../data/role-automation.json'),
            JSON.stringify(data, null, 2)
        );
        console.log('💾 Role automation data saved');
    } catch (error) {
        console.error('❌ Failed to save role automation data:', error);
    }
}

// Event Data
async function loadEventData() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/events.json'), 'utf8');
        const parsed = JSON.parse(data);
        console.log('✅ Loaded event data');
        return parsed;
    } catch (error) {
        console.log('📅 No existing event data found');
        return {};
    }
}

async function saveEventData(data) {
    try {
        await ensureDataDir();
        await fs.writeFile(
            path.join(__dirname, '../data/events.json'),
            JSON.stringify(data, null, 2)
        );
        console.log('💾 Event data saved');
    } catch (error) {
        console.error('❌ Failed to save event data:', error);
    }
}


// Announcement Data
async function loadAnnouncementData() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/announcements.json'), 'utf8');
        const parsed = JSON.parse(data);
        console.log('✅ Loaded announcement data');
        return parsed;
    } catch (error) {
        console.log('📢 No existing announcement data found');
        return {};
    }
}

async function saveAnnouncementData(data) {
    try {
        await ensureDataDir();
        await fs.writeFile(
            path.join(__dirname, '../data/announcements.json'),
            JSON.stringify(data, null, 2)
        );
        console.log('💾 Announcement data saved');
    } catch (error) {
        console.error('❌ Failed to save announcement data:', error);
    }
}
// Load notifications (placeholder)
async function loadNotifications() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/notifications.json'), 'utf8');
        const parsed = JSON.parse(data);
        console.log('✅ Loaded notifications data');
        return parsed;
    } catch (error) {
        console.log('🔔 No existing notifications data found');
        return {};
    }
}

// Save data
async function saveData() {
    try {
        await ensureDataDir();
        
        const data = {
            customCommands: Object.fromEntries(storage.customCommands),
            commandStats: storage.commandStats,
            recentCommands: storage.recentCommands,
            botStats: storage.botStats,
            lastSaved: new Date().toISOString()
        };

        await fs.writeFile(
            path.join(__dirname, '../data/commands.json'),
            JSON.stringify(data, null, 2)
        );
        
        console.log('💾 Data saved successfully');
    } catch (error) {
        console.error('❌ Failed to save data:', error);
    }
}

// ADD THIS: Simple saveSecurityData function (placeholder)
async function saveSecurityData() {
    try {
        console.log('💾 Security data save called (placeholder)');
        // This is just a placeholder to prevent the error
        // Your existing auth middleware handles the actual security data
        return true;
    } catch (error) {
        console.error('❌ Failed to save security data:', error);
    }
}

// Load all data
async function loadAllData() {
    try {
        await ensureDataDir();
        
        // Load analytics data first
        const analyticsService = require('./analyticsService');
        await analyticsService.loadAnalyticsData();
        
        // Load other data
        const commandsData = await loadCommands();
        const ticketData = await loadTickets();
        const moderationData = await loadModeration();
        const notificationData = await loadNotifications();
        
        console.log('✅ All data loaded successfully');
        return {
            commands: commandsData,
            tickets: ticketData,
            moderation: moderationData,
            notifications: notificationData,
            analytics: true
        };
    } catch (error) {
        console.error('❌ Error loading data:', error);
        throw error;
    }
}

// Save all data
async function saveAllData() {
    try {
        const analyticsService = require('./analyticsService');
        await analyticsService.saveAnalyticsData();
        await saveDataDebounced();
        console.log('💾 All data saved successfully');
    } catch (error) {
        console.error('❌ Error saving data:', error);
    }
}

async function saveTicketData(ticketData) {
    try {
        await ensureDataDir();
        
        // Check if ticketData is valid
        if (!ticketData) {
            console.log('⚠️ No ticket data provided, using default structure');
            ticketData = {
                activeTickets: [],
                closedTickets: [],
                ticketConfig: {
                    enabled: true,
                    categoryId: null,
                    supportRoles: [],
                    maxTicketsPerUser: 1,
                    autoClose: false,
                    autoCloseTime: 24
                }
            };
        }
        
        // Ensure the data is a string
        const dataToWrite = JSON.stringify(ticketData, null, 2);
        
        await fs.writeFile(
            path.join(__dirname, '../data/tickets.json'),
            dataToWrite
        );
        
        console.log('💾 Ticket data saved successfully');
    } catch (error) {
        console.error('❌ Failed to save ticket data:', error);
    }
}

// Load ticket data
async function loadTicketData() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/tickets.json'), 'utf8');
        const parsed = JSON.parse(data);
        console.log('✅ Loaded ticket data');
        return parsed;
    } catch (error) {
        console.log('🎫 No existing ticket data found, returning empty structure');
        return {
            activeTickets: [],
            closedTickets: [],
            ticketConfig: {
                enabled: true,
                categoryId: null,
                supportRoles: [],
                maxTicketsPerUser: 1,
                autoClose: false,
                autoCloseTime: 24
            }
        };
    }
}
module.exports = {
    storage,
    saveDataDebounced,
    ensureDataDir,
    loadAllData,
    saveAllData,
    loadCommands,
    loadTickets,
    loadModeration,
    loadNotifications,
    saveData,
    saveSecurityData,
    saveTicketData,
    loadTicketData,
    loadRoleAutomationData,
    saveRoleAutomationData,
    loadEventData,
    saveEventData,
    loadAnnouncementData,
    saveAnnouncementData
};
