const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Convert single role to array for consistency
            const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

            // Check if user's role is in the allowed roles
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`
                });
            }

            next();
        } catch (error) {
            console.error('Role middleware error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error during role verification'
            });
        }
    };
};

// Predefined role middleware functions
const adminOnly = roleMiddleware(['admin']);
const employeeOnly = roleMiddleware(['employee']);
const adminOrEmployee = roleMiddleware(['admin', 'employee']);

// Middleware to check if user can modify another user
const canModifyUser = (req, res, next) => {
    try {
        const targetUserId = parseInt(req.params.id || req.body.id);
        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;

        // Admin can modify anyone except themselves (for role changes)
        if (currentUserRole === 'admin') {
            // Prevent admin from downgrading their own role
            if (targetUserId === currentUserId && req.body.role && req.body.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin cannot downgrade their own role'
                });
            }
            return next();
        }

        // Employee can only modify themselves
        if (currentUserRole === 'employee' && targetUserId === currentUserId) {
            // Employee cannot change their own role
            if (req.body.role) {
                return res.status(403).json({
                    success: false,
                    message: 'Employees cannot change their own role'
                });
            }
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'You can only modify your own profile'
        });
    } catch (error) {
        console.error('User modification check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during permission check'
        });
    }
};

// Middleware to check if user can delete another user
const canDeleteUser = (req, res, next) => {
    try {
        const targetUserId = parseInt(req.params.id);
        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;

        // Only admin can delete users
        if (currentUserRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can delete users'
            });
        }

        // Admin cannot delete themselves
        if (targetUserId === currentUserId) {
            return res.status(403).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }

        next();
    } catch (error) {
        console.error('User deletion check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during permission check'
        });
    }
};

// Middleware to check if user can view sensitive data
const canViewSensitiveData = (req, res, next) => {
    try {
        const currentUserRole = req.user.role;

        // Admin can view all sensitive data
        if (currentUserRole === 'admin') {
            return next();
        }

        // Employee has limited access to sensitive data
        if (currentUserRole === 'employee') {
            // Add specific restrictions for employees here
            // For now, allow access but this can be customized
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions to view this data'
        });
    } catch (error) {
        console.error('Sensitive data access check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during permission check'
        });
    }
};

// Middleware to check if user can perform financial operations
const canPerformFinancialOps = (req, res, next) => {
    try {
        const currentUserRole = req.user.role;

        // Both admin and employee can perform financial operations
        if (['admin', 'employee'].includes(currentUserRole)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions to perform financial operations'
        });
    } catch (error) {
        console.error('Financial operations check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during permission check'
        });
    }
};

// Middleware to check if user can apply interest (admin only operation)
const canApplyInterest = (req, res, next) => {
    try {
        const currentUserRole = req.user.role;

        if (currentUserRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can apply interest'
            });
        }

        next();
    } catch (error) {
        console.error('Interest application check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during permission check'
        });
    }
};

module.exports = {
    roleMiddleware,
    adminOnly,
    employeeOnly,
    adminOrEmployee,
    canModifyUser,
    canDeleteUser,
    canViewSensitiveData,
    canPerformFinancialOps,
    canApplyInterest
};