const rateLimit = require('express-rate-limit');

// Create different rate limiters for different user roles
const createRateLimiter = (windowMs, max, message = 'Too many requests') => rateLimit({
    windowMs,
    max,
    skip: (req) => req.method === 'OPTIONS',
    keyGenerator: (req) => {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                // Give admin users higher limits
                if (payload.role === 'admin') {
                    return `admin-${req.ip}-${payload.id}`;
                }
                return `${req.ip}-${payload.id}`;
            }
        } catch (error) {
            // Fall back to IP-based limiting
        }
        return req.ip;
    },
    handler: (req, res) => {
        res.status(429).json({ 
            error: message,
            retryAfter: Math.ceil(windowMs / 1000)
        });
    }
});

function setupRateLimiting(app) {
    // Different limits for different endpoints
    const generalLimiter = createRateLimiter(15 * 60 * 1000, 500, 'Too many requests, please slow down');
    const authLimiter = createRateLimiter(15 * 60 * 1000, 15, 'Too many authentication attempts');
    const adminLimiter = createRateLimiter(15 * 60 * 1000, 1000, 'Admin rate limit exceeded');

    // Apply rate limiters
    app.use('/api/auth', authLimiter);
    app.use('/api', (req, res, next) => {
        // Check if user is admin for higher limits
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.role === 'admin') {
                    return adminLimiter(req, res, next);
                }
            }
        } catch (error) {
            // Continue with general limiter
        }
        return generalLimiter(req, res, next);
    });

    console.log('✅ Rate limiting configured');
}

module.exports = { setupRateLimiting, createRateLimiter };
