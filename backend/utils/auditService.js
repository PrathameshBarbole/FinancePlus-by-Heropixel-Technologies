const mainDb = require('../config/db_main');

class AuditService {
    static async logActivity(userId, actionType, targetType = null, targetId = null, description, req = null) {
        try {
            const ipAddress = req ? (req.ip || req.connection.remoteAddress || 'unknown') : 'system';
            const userAgent = req ? (req.get('User-Agent') || 'unknown') : 'system';

            const result = await mainDb.run(
                `INSERT INTO activity_logs (user_id, action_type, target_type, target_id, description, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, actionType, targetType, targetId, description, ipAddress, userAgent]
            );

            console.log(`📝 Audit log created: ${actionType} by user ${userId}`);
            return { success: true, logId: result.id };
        } catch (error) {
            console.error('Error creating audit log:', error);
            return { success: false, error: error.message };
        }
    }

    static async getActivityLogs(filters = {}) {
        try {
            let query = `
                SELECT al.*, u.name as user_name, u.email as user_email
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE 1=1
            `;
            const params = [];

            // Apply filters
            if (filters.userId) {
                query += ' AND al.user_id = ?';
                params.push(filters.userId);
            }

            if (filters.actionType) {
                query += ' AND al.action_type = ?';
                params.push(filters.actionType);
            }

            if (filters.targetType) {
                query += ' AND al.target_type = ?';
                params.push(filters.targetType);
            }

            if (filters.startDate) {
                query += ' AND DATE(al.created_at) >= ?';
                params.push(filters.startDate);
            }

            if (filters.endDate) {
                query += ' AND DATE(al.created_at) <= ?';
                params.push(filters.endDate);
            }

            if (filters.search) {
                query += ' AND (al.description LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            // Pagination
            const limit = filters.limit || 50;
            const offset = filters.offset || 0;
            
            query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const logs = await mainDb.all(query, params);

            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(*) as total
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE 1=1
            `;
            const countParams = params.slice(0, -2); // Remove limit and offset

            if (filters.userId) countQuery += ' AND al.user_id = ?';
            if (filters.actionType) countQuery += ' AND al.action_type = ?';
            if (filters.targetType) countQuery += ' AND al.target_type = ?';
            if (filters.startDate) countQuery += ' AND DATE(al.created_at) >= ?';
            if (filters.endDate) countQuery += ' AND DATE(al.created_at) <= ?';
            if (filters.search) countQuery += ' AND (al.description LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';

            const countResult = await mainDb.get(countQuery, countParams);

            return {
                success: true,
                logs: logs,
                total: countResult.total,
                limit: limit,
                offset: offset
            };
        } catch (error) {
            console.error('Error fetching activity logs:', error);
            return { success: false, error: error.message };
        }
    }

    static async getActivityStats(userId = null, days = 30) {
        try {
            let query = `
                SELECT 
                    action_type,
                    COUNT(*) as count,
                    DATE(created_at) as date
                FROM activity_logs
                WHERE created_at >= datetime('now', '-${days} days')
            `;
            const params = [];

            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            query += ' GROUP BY action_type, DATE(created_at) ORDER BY date DESC';

            const stats = await mainDb.all(query, params);

            // Get summary stats
            let summaryQuery = `
                SELECT 
                    action_type,
                    COUNT(*) as total_count
                FROM activity_logs
                WHERE created_at >= datetime('now', '-${days} days')
            `;

            if (userId) {
                summaryQuery += ' AND user_id = ?';
            }

            summaryQuery += ' GROUP BY action_type ORDER BY total_count DESC';

            const summary = await mainDb.all(summaryQuery, userId ? [userId] : []);

            return {
                success: true,
                dailyStats: stats,
                summary: summary
            };
        } catch (error) {
            console.error('Error fetching activity stats:', error);
            return { success: false, error: error.message };
        }
    }

    static async cleanupOldLogs(daysToKeep = 365) {
        try {
            const result = await mainDb.run(
                `DELETE FROM activity_logs 
                 WHERE created_at < datetime('now', '-${daysToKeep} days')`,
                []
            );

            console.log(`🗑️ Cleaned up ${result.changes} old audit logs`);
            return { success: true, deletedCount: result.changes };
        } catch (error) {
            console.error('Error cleaning up old audit logs:', error);
            return { success: false, error: error.message };
        }
    }

    // Predefined action types for consistency
    static get ACTION_TYPES() {
        return {
            // Authentication
            LOGIN: 'login',
            LOGOUT: 'logout',
            LOGIN_FAILED: 'login_failed',
            PASSWORD_CHANGE: 'password_change',

            // User Management
            USER_CREATE: 'user_create',
            USER_UPDATE: 'user_update',
            USER_DELETE: 'user_delete',
            USER_ACTIVATE: 'user_activate',
            USER_DEACTIVATE: 'user_deactivate',

            // Customer Management
            CUSTOMER_CREATE: 'customer_create',
            CUSTOMER_UPDATE: 'customer_update',
            CUSTOMER_DELETE: 'customer_delete',
            CUSTOMER_VIEW: 'customer_view',

            // Account Management
            ACCOUNT_CREATE: 'account_create',
            ACCOUNT_UPDATE: 'account_update',
            ACCOUNT_DELETE: 'account_delete',

            // Transactions
            DEPOSIT: 'deposit',
            WITHDRAWAL: 'withdrawal',
            TRANSFER: 'transfer',
            INTEREST_APPLY: 'interest_apply',

            // Fixed Deposits
            FD_CREATE: 'fd_create',
            FD_UPDATE: 'fd_update',
            FD_CLOSE: 'fd_close',
            FD_PREMATURE_CLOSE: 'fd_premature_close',

            // Recurring Deposits
            RD_CREATE: 'rd_create',
            RD_UPDATE: 'rd_update',
            RD_CLOSE: 'rd_close',
            RD_INSTALLMENT: 'rd_installment',

            // Loans
            LOAN_CREATE: 'loan_create',
            LOAN_UPDATE: 'loan_update',
            LOAN_CLOSE: 'loan_close',
            LOAN_PAYMENT: 'loan_payment',

            // System
            BACKUP_CREATE: 'backup_create',
            BACKUP_RESTORE: 'backup_restore',
            SETTINGS_UPDATE: 'settings_update',
            REPORT_GENERATE: 'report_generate',
            EMAIL_SEND: 'email_send',

            // Data Export/Import
            DATA_EXPORT: 'data_export',
            DATA_IMPORT: 'data_import'
        };
    }

    // Helper methods for common audit logs
    static async logLogin(userId, success = true, req = null) {
        const actionType = success ? this.ACTION_TYPES.LOGIN : this.ACTION_TYPES.LOGIN_FAILED;
        const description = success ? 'User logged in successfully' : 'Failed login attempt';
        return await this.logActivity(userId, actionType, null, null, description, req);
    }

    static async logLogout(userId, req = null) {
        return await this.logActivity(userId, this.ACTION_TYPES.LOGOUT, null, null, 'User logged out', req);
    }

    static async logCustomerAction(userId, action, customerId, customerName, req = null) {
        const description = `${action} customer: ${customerName} (ID: ${customerId})`;
        return await this.logActivity(userId, action, 'customer', customerId, description, req);
    }

    static async logTransaction(userId, transactionType, accountId, amount, customerId, req = null) {
        const description = `${transactionType} of ₹${amount} for account ${accountId}`;
        return await this.logActivity(userId, transactionType, 'account', accountId, description, req);
    }

    static async logSystemAction(userId, action, description, req = null) {
        return await this.logActivity(userId, action, 'system', null, description, req);
    }
}

module.exports = AuditService;