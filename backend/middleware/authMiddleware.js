const JWTHelper = require('../utils/jwtHelper');
const mainDb = require('../config/db_main');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        try {
            // Verify the token
            const decoded = JWTHelper.verifyToken(token);
            
            // Check if user still exists and is active
            const user = await mainDb.get(
                'SELECT id, name, email, role, is_active FROM users WHERE id = ? AND is_active = 1',
                [decoded.id]
            );

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token. User not found or inactive.'
                });
            }

            // Add user info to request object
            req.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.is_active
            };

            next();
        } catch (tokenError) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token: ' + tokenError.message
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication'
        });
    }
};

// Optional auth middleware - doesn't fail if no token provided
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            
            try {
                const decoded = JWTHelper.verifyToken(token);
                const user = await mainDb.get(
                    'SELECT id, name, email, role, is_active FROM users WHERE id = ? AND is_active = 1',
                    [decoded.id]
                );

                if (user) {
                    req.user = {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        isActive: user.is_active
                    };
                }
            } catch (tokenError) {
                // Token is invalid, but we don't fail the request
                console.warn('Invalid token in optional auth:', tokenError.message);
            }
        }

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next(); // Continue even if there's an error
    }
};

// Middleware to refresh token if it's about to expire
const refreshTokenMiddleware = async (req, res, next) => {
    try {
        if (req.user) {
            const authHeader = req.headers.authorization;
            const token = authHeader.substring(7);
            
            // Check if token expires within the next hour
            const tokenExpiry = JWTHelper.getTokenExpiry(token);
            const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
            
            if (tokenExpiry && tokenExpiry < oneHourFromNow) {
                try {
                    const newToken = JWTHelper.refreshToken(token);
                    res.setHeader('X-New-Token', newToken);
                } catch (refreshError) {
                    console.warn('Token refresh failed:', refreshError.message);
                }
            }
        }
        
        next();
    } catch (error) {
        console.error('Token refresh middleware error:', error);
        next(); // Continue even if refresh fails
    }
};

module.exports = {
    authMiddleware,
    optionalAuthMiddleware,
    refreshTokenMiddleware
};