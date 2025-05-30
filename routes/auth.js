const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');
const { saveSecurityData } = require('../services/dataService');

const router = express.Router();

// Load users from your actual data file
async function loadUsers() {
    try {
        const data = await fs.readFile(path.join(__dirname, '../data/users.json'), 'utf8');
        const users = JSON.parse(data);
        console.log(`📋 Loaded ${users.length} users from users.json`);
        return users;
    } catch (error) {
        console.log('❌ No users.json found, using empty array');
        return [];
    }
}

// Save users back to file
async function saveUsers(users) {
    try {
        await fs.writeFile(
            path.join(__dirname, '../data/users.json'),
            JSON.stringify(users, null, 2)
        );
        console.log('💾 Users saved to users.json');
    } catch (error) {
        console.error('❌ Failed to save users:', error);
    }
}

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Increased from 5 to 10 for debugging
    message: { 
        success: false, 
        message: 'Too many login attempts, please try again later' 
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = (client, io) => {
    // Login route
    router.post('/login', authLimiter, async (req, res) => {
        try {
            console.log('\n=== LOGIN ATTEMPT ===');
            const { username, password } = req.body;
            
            console.log('Request body:', { username, password: password ? '***' : 'missing' });
            
            if (!username || !password) {
                console.log('❌ Missing username or password');
                return res.status(400).json({ 
                    success: false, 
                    message: 'Username and password are required' 
                });
            }

            // Load users from your actual data file
            const users = await loadUsers();
            console.log(`📋 Total users loaded: ${users.length}`);
            
            if (users.length === 0) {
                console.log('❌ No users found in database');
                return res.status(500).json({ 
                    success: false, 
                    message: 'No users configured' 
                });
            }
            
            // Debug: Show all usernames
            console.log('Available usernames:', users.map(u => u.username));
            
            // Find user by username or email
            const user = users.find(u => 
                (u.username === username || u.email === username) && u.isActive
            );
            
            if (!user) {
                console.log(`❌ User not found: ${username}`);
                console.log('Checked usernames:', users.map(u => `${u.username} (active: ${u.isActive})`));
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid credentials' 
                });
            }

            console.log(`✅ Found user: ${user.username} (ID: ${user.id})`);
            console.log(`User active: ${user.isActive}`);
            console.log(`User role: ${user.role}`);
            console.log(`Password hash: ${user.password}`);

            // Check password using bcrypt.compare
            console.log('🔐 Comparing passwords...');
            const isValidPassword = await bcrypt.compare(password, user.password);
            console.log(`Password comparison result: ${isValidPassword}`);
            
            // Additional debugging - test common passwords
            if (!isValidPassword) {
                console.log('🔍 Testing common passwords...');
                const testPasswords = ['admin', 'admin123', 'password', '123456'];
                for (const testPwd of testPasswords) {
                    const testResult = await bcrypt.compare(testPwd, user.password);
                    console.log(`  ${testPwd}: ${testResult}`);
                    if (testResult) {
                        console.log(`✅ Correct password is: ${testPwd}`);
                        break;
                    }
                }
            }
            
            if (!isValidPassword) {
                console.log(`❌ Invalid password for user: ${username}`);
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid credentials' 
                });
            }

            console.log(`✅ Login successful for user: ${username}`);

            // Generate JWT token
            const tokenPayload = { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            };
            
            console.log('🎫 Generating token with payload:', tokenPayload);
            
            const token = jwt.sign(
                tokenPayload,
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Update last login
            user.lastLogin = new Date().toISOString();
            await saveUsers(users);
            
            // Save security data (your placeholder function)
            await saveSecurityData();

            const responseData = {
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            };

            console.log('📤 Sending response:', { 
                ...responseData, 
                token: token.substring(0, 20) + '...' 
            });

            // Return success response
            res.json(responseData);

        } catch (error) {
            console.error('💥 Login error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Internal server error: ' + error.message 
            });
        }
    });

    // Verify token route
    router.get('/verify', async (req, res) => {
        try {
            console.log('\n=== TOKEN VERIFICATION ===');
            const authHeader = req.headers['authorization'];
            console.log('Auth header:', authHeader ? 'Bearer ***' : 'missing');
            
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                console.log('❌ No token provided');
                return res.status(401).json({ 
                    success: false, 
                    message: 'No token provided' 
                });
            }

            jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', async (err, decoded) => {
                if (err) {
                    console.log('❌ Token verification failed:', err.message);
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Invalid token' 
                    });
                }

                console.log('✅ Token decoded:', decoded);

                const users = await loadUsers();
                const user = users.find(u => u.id === decoded.id);
                
                if (!user || !user.isActive) {
                    console.log('❌ User not found or inactive');
                    return res.status(403).json({ 
                        success: false, 
                        message: 'User not found or inactive' 
                    });
                }

                console.log(`✅ Token verified for user: ${user.username}`);

                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role
                    }
                });
            });
        } catch (error) {
            console.error('💥 Token verification error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Internal server error' 
            });
        }
    });

    // Logout route (optional)
    router.post('/logout', (req, res) => {
        console.log('👋 User logged out');
        res.json({ 
            success: true, 
            message: 'Logged out successfully' 
        });
    });

    // Debug route to check users (remove in production)
    router.get('/debug/users', async (req, res) => {
        try {
            const users = await loadUsers();
            res.json({
                success: true,
                count: users.length,
                users: users.map(u => ({
                    id: u.id,
                    username: u.username,
                    email: u.email,
                    role: u.role,
                    isActive: u.isActive,
                    hasPassword: !!u.password
                }))
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    });

    return router;
};
