const express = require('express');
const router = express.Router();
const User = require('../models/User');
const JWTHelper = require('../utils/jwtHelper');
const AuditService = require('../utils/auditService');
const { authMiddleware } = require('../middleware/authMiddleware');

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Authenticate user
        const authResult = await User.authenticate(email, password);
        
        if (!authResult.success) {
            // Log failed login attempt
            const user = await User.findByEmail(email);
            if (user.success) {
                await AuditService.logActivity(
                    user.user.id,
                    AuditService.ACTION_TYPES.LOGIN_FAILED,
                    null,
                    null,
                    `Failed login attempt for ${email}`,
                    req
                );
            }

            return res.status(401).json({
                success: false,
                message: authResult.error
            });
        }

        const user = authResult.user;

        // Generate JWT token
        const token = JWTHelper.generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name
        });

        // Log successful login
        await AuditService.logActivity(
            user.id,
            AuditService.ACTION_TYPES.LOGIN,
            null,
            null,
            `User logged in successfully`,
            req
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                profile_photo: user.profile_photo
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during login'
        });
    }
});

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        // Log logout
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.LOGOUT,
            null,
            null,
            'User logged out',
            req
        );

        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during logout'
        });
    }
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const userResult = await User.findById(req.user.id);
        
        if (!userResult.success) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: userResult.user
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { name, profile_photo } = req.body;
        
        const updateResult = await User.update(req.user.id, {
            name,
            profile_photo
        });

        if (!updateResult.success) {
            return res.status(400).json({
                success: false,
                message: updateResult.error
            });
        }

        // Log profile update
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.USER_UPDATE,
            'user',
            req.user.id,
            'Profile updated',
            req
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updateResult.user
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Change password
router.put('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        const result = await User.updatePassword(req.user.id, currentPassword, newPassword);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Log password change
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.PASSWORD_CHANGE,
            'user',
            req.user.id,
            'Password changed successfully',
            req
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Verify token
router.get('/verify', authMiddleware, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Token is valid',
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Refresh token
router.post('/refresh', authMiddleware, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const currentToken = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Generate new token
        const newToken = JWTHelper.refreshToken(currentToken);

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            token: newToken
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(400).json({
            success: false,
            message: 'Token refresh failed: ' + error.message
        });
    }
});

// Get user stats (for dashboard)
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const userStats = await User.getStats();
        
        if (!userStats.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch user statistics'
            });
        }

        res.json({
            success: true,
            stats: userStats.stats
        });
    } catch (error) {
        console.error('User stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;