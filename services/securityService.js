const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { storage } = require('../config/database');
const { saveSecurityData } = require('./dataService');

class SecurityService {
    constructor() {}

    // Log security events
    logSecurityEvent(type, message, severity = 'info', ip = null) {
        const logEntry = {
            type,
            message,
            severity,
            ip,
            timestamp: new Date().toISOString()
        };

        storage.securityLogs.unshift(logEntry);
        if (storage.securityLogs.length > 1000) {
            storage.securityLogs = storage.securityLogs.slice(0, 1000);
        }

        saveSecurityData();
        return logEntry;
    }

    // Validate password against policy
    validatePassword(password) {
        const policy = storage.securitySettings.passwordPolicy;
        const errors = [];

        if (password.length < policy.minLength) {
            errors.push(`Password must be at least ${policy.minLength} characters long`);
        }

        if (policy.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (policy.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (policy.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return errors;
    }

    // Check login attempts
    checkLoginAttempts(ip) {
        const attempts = storage.loginAttempts.get(ip);
        
        if (!attempts) {
            return { allowed: true };
        }

        if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
            return { 
                allowed: false, 
                message: `Too many failed attempts. Try again in ${Math.ceil((attempts.lockedUntil - Date.now()) / 1000)} seconds` 
            };
        }

        if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
            storage.loginAttempts.delete(ip);
            return { allowed: true };
        }

        return { allowed: true };
    }

    // Record failed login attempt
    recordFailedAttempt(ip) {
        const attempts = storage.loginAttempts.get(ip) || { count: 0 };
        attempts.count++;

        if (attempts.count >= storage.securitySettings.loginAttempts.maxAttempts) {
            attempts.lockedUntil = Date.now() + (storage.securitySettings.loginAttempts.lockoutDuration * 1000);
            this.logSecurityEvent('account_locked', `Account locked due to too many failed attempts from ${ip}`, 'warning', ip);
        }

        storage.loginAttempts.set(ip, attempts);
    }

    // Authenticate user
    async authenticateUser(username, password, ip) {
        const attemptCheck = this.checkLoginAttempts(ip);
        if (!attemptCheck.allowed) {
            throw new Error(attemptCheck.message);
        }

        const user = storage.users.find(u => u.username === username);
        if (!user || !await bcrypt.compare(password, user.password)) {
            this.recordFailedAttempt(ip);
            this.logSecurityEvent('login_failed', `Failed login attempt for ${username} from ${ip}`, 'warning', ip);
            throw new Error('Invalid credentials');
        }

        if (!user.isActive) {
            throw new Error('Account is disabled');
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: `${storage.securitySettings.sessionTimeout}s` }
        );

        user.lastLogin = new Date().toISOString();
        
        const session = {
            id: Date.now().toString(),
            userId: user.id,
            username: user.username,
            ipAddress: ip,
            userAgent: 'Web Dashboard',
            startedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };

        storage.activeSessions.push(session);
        await saveSecurityData();

        this.logSecurityEvent('login_success', `Successful login for ${username} from ${ip}`, 'info', ip);

        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                twoFactorEnabled: user.twoFactorEnabled
            }
        };
    }

    // Create user
    async createUser(userData, createdBy) {
        const { username, email, password, role } = userData;

        const errors = this.validatePassword(password);
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }

        if (storage.users.find(u => u.username === username || u.email === email)) {
            throw new Error('User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password: hashedPassword,
            role: role || 'viewer',
            twoFactorEnabled: false,
            twoFactorSecret: null,
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        storage.users.push(newUser);
        await saveSecurityData();

        this.logSecurityEvent('user_created', `New user created: ${username} by ${createdBy}`, 'info');
        return newUser;
    }

    // Delete user
    async deleteUser(userId, deletedBy) {
        const userIndex = storage.users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            throw new Error('User not found');
        }

        const deletedUser = storage.users[userIndex];
        storage.users.splice(userIndex, 1);
        await saveSecurityData();

        this.logSecurityEvent('user_deleted', `User deleted: ${deletedUser.username} by ${deletedBy}`, 'warning');
        return deletedUser;
    }

    // Get users (safe - no passwords)
    getUsers() {
        return storage.users.map(user => ({
            ...user,
            password: undefined,
            twoFactorSecret: undefined
        }));
    }

    // Get security settings
    getSecuritySettings() {
        return storage.securitySettings;
    }

    // Update security settings
    async updateSecuritySettings(newSettings, updatedBy) {
        storage.securitySettings = { ...storage.securitySettings, ...newSettings };
        await saveSecurityData();
        this.logSecurityEvent('settings_changed', `Security settings updated by ${updatedBy}`, 'info');
        return storage.securitySettings;
    }

    // Get security logs
    getSecurityLogs(limit = 100) {
        return storage.securityLogs.slice(0, limit);
    }

    // Get whitelisted IPs
    getWhitelistedIPs() {
        return storage.whitelistedIPs;
    }

    // Add IP to whitelist
    async addToWhitelist(ip, addedBy) {
        if (!ip || !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
            throw new Error('Invalid IP address format');
        }

        if (storage.whitelistedIPs.find(item => item.address === ip)) {
            throw new Error('IP address already whitelisted');
        }

        storage.whitelistedIPs.push({
            address: ip,
            createdAt: new Date().toISOString(),
            lastSeen: null,
            addedBy: addedBy
        });

        await saveSecurityData();
        this.logSecurityEvent('ip_whitelisted', `IP ${ip} added to whitelist by ${addedBy}`, 'info');
        return true;
    }

    // Remove IP from whitelist
    async removeFromWhitelist(ip, removedBy) {
        const index = storage.whitelistedIPs.findIndex(item => item.address === ip);
        
        if (index === -1) {
            throw new Error('IP address not found in whitelist');
        }

        storage.whitelistedIPs.splice(index, 1);
        await saveSecurityData();

        this.logSecurityEvent('ip_removed', `IP ${ip} removed from whitelist by ${removedBy}`, 'info');
        return true;
    }

    // Get active sessions
    getActiveSessions() {
        return storage.activeSessions;
    }

    // Terminate session
    async terminateSession(sessionId, terminatedBy) {
        const index = storage.activeSessions.findIndex(s => s.id === sessionId);
        
        if (index === -1) {
            throw new Error('Session not found');
        }

        const session = storage.activeSessions[index];
        storage.activeSessions.splice(index, 1);

        this.logSecurityEvent('session_terminated', `Session terminated for ${session.username} by ${terminatedBy}`, 'warning');
        return session;
    }

    // Setup 2FA
    async setup2FA(userId) {
        const secret = speakeasy.generateSecret({
            name: `Discord Bot Dashboard`,
            length: 32
        });

        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        const user = storage.users.find(u => u.id === userId);
        if (user) {
            user.tempTwoFactorSecret = secret.base32;
            await saveSecurityData();
        }

        return {
            qrCode: qrCodeUrl,
            secret: secret.base32
        };
    }

    // Export security data
    async exportSecurityData(exportedBy) {
        const exportData = {
            settings: storage.securitySettings,
            users: this.getUsers(),
            logs: storage.securityLogs,
            whitelist: storage.whitelistedIPs,
            exportedAt: new Date().toISOString(),
            exportedBy: exportedBy
        };

        this.logSecurityEvent('data_export', `Security data exported by ${exportedBy}`, 'info');
        return exportData;
    }
}

module.exports = new SecurityService();
