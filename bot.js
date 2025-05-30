require('dotenv').config();

const { Client } = require('discord.js');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Import configurations and services
const { CLIENT_CONFIG, SERVER_CONFIG } = require('./config/constants');
const { setupEventHandlers } = require('./handlers/eventHandler');
const { loadAllData } = require('./services/dataService');
const roleAutomationService = require('./services/roleAutomationService');
const eventService = require('./services/eventService');

// Initialize Discord client and Express app
const client = new Client(CLIENT_CONFIG);
const app = express();
const server = http.createServer(app);
const io = socketIo(server, SERVER_CONFIG.socketOptions);

// Setup basic middleware first (CORS, JSON parsing, etc.)
const cors = require('cors');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup AUTH ROUTES FIRST (before auth middleware)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes(client, io));

// THEN setup other middleware (including auth middleware)
const { setupMiddleware } = require('./middleware');
setupMiddleware(app, io);

// THEN setup other protected routes
const { setupRoutes } = require('./routes');
setupRoutes(app, client, io);

// Setup event handlers
setupEventHandlers(client, io);

// Start the bot and server
async function startBot() {
    try {
        console.log('🚀 Starting Discord Bot Controller...');

        // Load all data
        await loadAllData();

        // Login to Discord
        await client.login(process.env.DISCORD_TOKEN);
        
        // Initialize new services
        await roleAutomationService.loadAutomationData();
        await eventService.loadEventData();
        
        // Start web server
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`🌐 Server running on port ${PORT}`);
            if (process.env.NODE_ENV !== 'production') {
                console.log(`📡 Dashboard: http://localhost:${PORT}`);
                console.log(`🔐 Default login: admin / admin123`);
            }
        });
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    client.destroy();
    server.close();
    process.exit(0);
});

// Start the application
startBot();

module.exports = { client, app, io };
