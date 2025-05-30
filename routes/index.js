const express = require('express');
const path = require('path');

// Import route modules
const commandRoutes = require('./commands');
const ticketRoutes = require('./tickets');
const securityRoutes = require('./security');
const guildRoutes = require('./guilds');
const moderationRoutes = require('./moderation');
const analyticsRoutes = require('./analytics');
const notificationRoutes = require('./notifications');
const buttonRoleRoutes = require('./buttonRoles');

function setupRoutes(app, client, io) {
    // Mount API routes with proper paths
    app.use('/api', commandRoutes(client, io));
    app.use('/api', ticketRoutes(client, io));
    app.use('/api', securityRoutes(io));
    app.use('/api', guildRoutes(client));
    app.use('/api', moderationRoutes(client, io));
    app.use('/api', analyticsRoutes(client, io));
    app.use('/api', notificationRoutes(client, io));
    app.use('/api', buttonRoleRoutes(client, io));

    // Serve React app in production
    if (process.env.NODE_ENV === 'production') {
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../client/build/index.html'));
        });
    }

    console.log('✅ API routes configured');
}

module.exports = { setupRoutes };
