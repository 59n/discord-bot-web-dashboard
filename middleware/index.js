const cors = require('cors');
const helmet = require('helmet');
const express = require('express');
const path = require('path');
const { setupRateLimiting } = require('./rateLimiting');
const { setupSecurity } = require('./security');

function setupMiddleware(app, io) {
    // Security middleware
    app.use(helmet());
    
    // CORS configuration
    app.use(cors({
        origin: process.env.NODE_ENV === 'production' 
            ? false 
            : ["http://localhost:3001", "http://localhost:3000"],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        optionsSuccessStatus: 200
    }));

    // Enable preflight for all routes
    app.options('*', cors());
    
    // Parse JSON bodies
    app.use(express.json());

    // Setup rate limiting
    setupRateLimiting(app);
    
    // Setup security middleware
    setupSecurity(app);

    // Static files in production
    if (process.env.NODE_ENV === 'production') {
        app.use(express.static(path.join(__dirname, '../client/build')));
    }

    console.log('✅ Middleware configured');
}

module.exports = { setupMiddleware };
