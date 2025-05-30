const jwt = require('jsonwebtoken');
const { storage } = require('../config/database');

// Middleware to check authentication
const authenticateToken = (req, res, next) => {
    // Skip authentication for auth routes
    if (req.path.startsWith('/api/auth/')) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Middleware to check IP whitelist
const checkIPWhitelist = (req, res, next) => {
    if (!storage.securitySettings.ipWhitelisting) {
        return next();
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    const isWhitelisted = storage.whitelistedIPs.some(ip => ip.address === clientIP);
    
    if (!isWhitelisted) {
        const securityService = require('../services/securityService');
        securityService.logSecurityEvent('unauthorized_access', `Blocked access from non-whitelisted IP: ${clientIP}`, 'warning', clientIP);
        return res.status(403).json({ message: 'Access denied: IP not whitelisted' });
    }

    next();
};

module.exports = {
    authenticateToken,
    checkIPWhitelist
};
