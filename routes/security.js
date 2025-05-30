const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const securityService = require('../services/securityService');
const { authenticateToken } = require('../middleware/auth');

module.exports = (io) => {
    // Login endpoint (no auth required)
    router.post('/auth/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            const clientIP = req.ip || req.connection.remoteAddress;

            const result = await securityService.authenticateUser(username, password, clientIP);
            
            io.emit('newLogin', { username, ip: clientIP });
            res.json(result);
        } catch (error) {
            res.status(401).json({ message: error.message });
        }
    });

    // All routes below require authentication
    router.use(authenticateToken);

    // Get security settings
    router.get('/security/settings', (req, res) => {
        res.json(securityService.getSecuritySettings());
    });

    // Update security settings
    router.post('/security/settings', async (req, res) => {
        try {
            const settings = await securityService.updateSecuritySettings(req.body, req.user.username);
            res.json({ success: true, settings });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get users
    router.get('/security/users', (req, res) => {
        res.json(securityService.getUsers());
    });

    // Create user
    router.post('/security/users', [
        body('username').isLength({ min: 3 }).trim(),
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 1 })
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ message: errors.array()[0].msg });
            }

            await securityService.createUser(req.body, req.user.username);
            res.json({ success: true, message: 'User created successfully' });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    });

    // Delete user
    router.delete('/security/users/:id', async (req, res) => {
        try {
            await securityService.deleteUser(req.params.id, req.user.username);
            res.json({ success: true, message: 'User deleted successfully' });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    });

    // Get security logs
    router.get('/security/logs', (req, res) => {
        res.json(securityService.getSecurityLogs());
    });

    // Get IP whitelist
    router.get('/security/whitelist', (req, res) => {
        res.json(securityService.getWhitelistedIPs());
    });

    // Add IP to whitelist
    router.post('/security/whitelist', async (req, res) => {
        try {
            await securityService.addToWhitelist(req.body.ip, req.user.username);
            res.json({ success: true, message: 'IP address added to whitelist' });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    });

    // Remove IP from whitelist
    router.delete('/security/whitelist/:ip', async (req, res) => {
        try {
            const ip = decodeURIComponent(req.params.ip);
            await securityService.removeFromWhitelist(ip, req.user.username);
            res.json({ success: true, message: 'IP address removed from whitelist' });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    });

    // Get active sessions
    router.get('/security/sessions', (req, res) => {
        res.json(securityService.getActiveSessions());
    });

    // Terminate session
    router.delete('/security/sessions/:id', async (req, res) => {
        try {
            await securityService.terminateSession(req.params.id, req.user.username);
            res.json({ success: true, message: 'Session terminated successfully' });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    });

    // Setup 2FA
    router.post('/security/2fa/setup', async (req, res) => {
        try {
            const result = await securityService.setup2FA(req.user.id);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Export security data
    router.get('/security/export', async (req, res) => {
        try {
            const data = await securityService.exportSecurityData(req.user.username);
            res.json({ data });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
