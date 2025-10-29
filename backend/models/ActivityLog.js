const mainDb = require('../config/db_main');

class ActivityLog {
    static async create(logData) {
        try {
            const {
                user_id,
                action_type,
                target_type = null,
                target_id = null,
                description,
                ip_address = null,
                user_agent = null
            } = logData;

            // Validate required fields
            if (!user_id || !action_type || !description) {
                throw new Error('User ID, action type, and description are required');
            }

            const result = await mainDb.run(
                `INSERT INTO activity_logs (user_id, action_type, target_type, target_id, description, ip_address, user_agent, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [user_id, action_type, target_type, target_id, description, ip_address, user_agent]
            );

            return {
                success: true,
                log: {
                    id: result.id,
                    user_id,
                    action_type,
                    target_type,
                    target_id,
                    description,
                    ip_address,
                    user_agent,
                    created_at: new Date().toISOString()
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT al.*, u.name as user_name, u.email as user_email
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE 1=1
            `;
            const params = [];

            // Apply filters
            if (filters.user_id) {
                query += ' AND al.user_id = ?';
                params.push(filters.user_id);
            }

            if (filters.action_type) {
                query += ' AND al.action_type = ?';
                params.push(filters.action_type);
            }

            if (filters.target_type) {
                query += ' AND al.target_type = ?';
                params.push(filters.target_type);
            }

            if (filters.target_id) {
                query += ' AND al.target_id = ?';
                params.push(filters.target_id);
            }

            if (filters.start_date) {
                query += ' AND DATE(al.created_at) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                query += ' AND DATE(al.created_at) <= ?';
                params.push(filters.end_date);
            }

            if (filters.search) {
                query += ' AND (al.description LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            if (filters.ip_address) {
                query += ' AND al.ip_address = ?';
                params.push(filters.ip_address);
            }

            query += ' ORDER BY al.created_at DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
                
                if (filters.offset) {
                    query += ' OFFSET ?';
                    params.push(filters.offset);
                }
            }

            const logs = await mainDb.all(query, params);

            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(*) as total
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE 1=1
            `;
            const countParams = [];

            if (filters.user_id) {
                countQuery += ' AND al.user_id = ?';
                countParams.push(filters.user_id);
            }

            if (filters.action_type) {
                countQuery += ' AND al.action_type = ?';
                countParams.push(filters.action_type);
            }

            if (filters.target_type) {
                countQuery += ' AND al.target_type = ?';
                countParams.push(filters.target_type);
            }

            if (filters.target_id) {
                countQuery += ' AND al.target_id = ?';
                countParams.push(filters.target_id);
            }

            if (filters.start_date) {
                countQuery += ' AND DATE(al.created_at) >= ?';
                countParams.push(filters.start_date);
            }

            if (filters.end_date) {
                countQuery += ' AND DATE(al.created_at) <= ?';
                countParams.push(filters.end_date);
            }

            if (filters.search) {
                countQuery += ' AND (al.description LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                countParams.push(searchTerm, searchTerm, searchTerm);
            }

            if (filters.ip_address) {
                countQuery += ' AND al.ip_address = ?';
                countParams.push(filters.ip_address);
            }

            const countResult = await mainDb.get(countQuery, countParams);

            return { 
                success: true, 
                logs,
                total: countResult.total,
                limit: filters.limit || logs.length,
                offset: filters.offset || 0
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findById(id) {
        try {
            const log = await mainDb.get(`
                SELECT al.*, u.name as user_name, u.email as user_email
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE al.id = ?
            `, [id]);

            if (!log) {
                return { success: false, error: 'Activity log not found' };
            }

            return { success: true, log };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getRecentActivity(userId = null, limit = 50) {
        try {
            let query = `
                SELECT al.*, u.name as user_name, u.email as user_email
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
            `;
            const params = [];

            if (userId) {
                query += ' WHERE al.user_id = ?';
                params.push(userId);
            }

            query += ' ORDER BY al.created_at DESC LIMIT ?';
            params.push(limit);

            const logs = await mainDb.all(query, params);

            return { success: true, logs };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getActivityStats(filters = {}) {
        try {
            let whereClause = 'WHERE 1=1';
            const params = [];

            if (filters.user_id) {
                whereClause += ' AND user_id = ?';
                params.push(filters.user_id);
            }

            if (filters.start_date) {
                whereClause += ' AND DATE(created_at) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereClause += ' AND DATE(created_at) <= ?';
                params.push(filters.end_date);
            }

            const stats = await mainDb.get(`
                SELECT 
                    COUNT(*) as total_activities,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT action_type) as unique_actions,
                    COUNT(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 END) as activities_last_24h,
                    COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as activities_last_week
                FROM activity_logs 
                ${whereClause}
            `, params);

            return { success: true, stats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getActionTypeStats(filters = {}) {
        try {
            let whereClause = 'WHERE 1=1';
            const params = [];

            if (filters.user_id) {
                whereClause += ' AND user_id = ?';
                params.push(filters.user_id);
            }

            if (filters.start_date) {
                whereClause += ' AND DATE(created_at) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereClause += ' AND DATE(created_at) <= ?';
                params.push(filters.end_date);
            }

            const actionStats = await mainDb.all(`
                SELECT 
                    action_type,
                    COUNT(*) as count,
                    COUNT(DISTINCT user_id) as unique_users,
                    MIN(created_at) as first_occurrence,
                    MAX(created_at) as last_occurrence
                FROM activity_logs 
                ${whereClause}
                GROUP BY action_type
                ORDER BY count DESC
            `, params);

            return { success: true, action_stats: actionStats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getUserActivitySummary(userId, days = 30) {
        try {
            const summary = await mainDb.get(`
                SELECT 
                    COUNT(*) as total_activities,
                    COUNT(DISTINCT action_type) as unique_actions,
                    COUNT(DISTINCT DATE(created_at)) as active_days,
                    MIN(created_at) as first_activity,
                    MAX(created_at) as last_activity
                FROM activity_logs 
                WHERE user_id = ? AND created_at >= datetime('now', '-${days} days')
            `, [userId]);

            // Get top actions for this user
            const topActions = await mainDb.all(`
                SELECT 
                    action_type,
                    COUNT(*) as count
                FROM activity_logs 
                WHERE user_id = ? AND created_at >= datetime('now', '-${days} days')
                GROUP BY action_type
                ORDER BY count DESC
                LIMIT 10
            `, [userId]);

            return { 
                success: true, 
                summary: {
                    ...summary,
                    top_actions: topActions,
                    period_days: days
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getDailyActivityTrend(days = 30) {
        try {
            const trend = await mainDb.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as activity_count,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT action_type) as unique_actions
                FROM activity_logs 
                WHERE created_at >= datetime('now', '-${days} days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `);

            return { success: true, trend };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getHourlyActivityPattern() {
        try {
            const pattern = await mainDb.all(`
                SELECT 
                    strftime('%H', created_at) as hour,
                    COUNT(*) as activity_count,
                    COUNT(DISTINCT user_id) as unique_users
                FROM activity_logs 
                WHERE created_at >= datetime('now', '-7 days')
                GROUP BY strftime('%H', created_at)
                ORDER BY hour
            `);

            return { success: true, pattern };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getTargetTypeStats(filters = {}) {
        try {
            let whereClause = 'WHERE target_type IS NOT NULL';
            const params = [];

            if (filters.user_id) {
                whereClause += ' AND user_id = ?';
                params.push(filters.user_id);
            }

            if (filters.start_date) {
                whereClause += ' AND DATE(created_at) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereClause += ' AND DATE(created_at) <= ?';
                params.push(filters.end_date);
            }

            const targetStats = await mainDb.all(`
                SELECT 
                    target_type,
                    COUNT(*) as count,
                    COUNT(DISTINCT target_id) as unique_targets,
                    COUNT(DISTINCT user_id) as unique_users
                FROM activity_logs 
                ${whereClause}
                GROUP BY target_type
                ORDER BY count DESC
            `, params);

            return { success: true, target_stats: targetStats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getIPAddressStats(filters = {}) {
        try {
            let whereClause = 'WHERE ip_address IS NOT NULL';
            const params = [];

            if (filters.user_id) {
                whereClause += ' AND user_id = ?';
                params.push(filters.user_id);
            }

            if (filters.start_date) {
                whereClause += ' AND DATE(created_at) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereClause += ' AND DATE(created_at) <= ?';
                params.push(filters.end_date);
            }

            const ipStats = await mainDb.all(`
                SELECT 
                    ip_address,
                    COUNT(*) as activity_count,
                    COUNT(DISTINCT user_id) as unique_users,
                    MIN(created_at) as first_seen,
                    MAX(created_at) as last_seen
                FROM activity_logs 
                ${whereClause}
                GROUP BY ip_address
                ORDER BY activity_count DESC
                LIMIT 50
            `, params);

            return { success: true, ip_stats: ipStats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async searchLogs(searchTerm, filters = {}) {
        try {
            let query = `
                SELECT al.*, u.name as user_name, u.email as user_email
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE (
                    al.description LIKE ? OR 
                    al.action_type LIKE ? OR 
                    u.name LIKE ? OR 
                    u.email LIKE ?
                )
            `;
            
            const searchPattern = `%${searchTerm}%`;
            const params = [searchPattern, searchPattern, searchPattern, searchPattern];

            // Apply additional filters
            if (filters.user_id) {
                query += ' AND al.user_id = ?';
                params.push(filters.user_id);
            }

            if (filters.action_type) {
                query += ' AND al.action_type = ?';
                params.push(filters.action_type);
            }

            if (filters.start_date) {
                query += ' AND DATE(al.created_at) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                query += ' AND DATE(al.created_at) <= ?';
                params.push(filters.end_date);
            }

            query += ' ORDER BY al.created_at DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
            }

            const logs = await mainDb.all(query, params);

            return { success: true, logs };
        } catch (error) {
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

            return { 
                success: true, 
                message: `${result.changes} old activity logs cleaned up`,
                deleted_count: result.changes
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async exportLogs(filters = {}) {
        try {
            let query = `
                SELECT 
                    al.id,
                    u.name as user_name,
                    u.email as user_email,
                    al.action_type,
                    al.target_type,
                    al.target_id,
                    al.description,
                    al.ip_address,
                    al.created_at
                FROM activity_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE 1=1
            `;
            const params = [];

            // Apply filters (same as findAll method)
            if (filters.user_id) {
                query += ' AND al.user_id = ?';
                params.push(filters.user_id);
            }

            if (filters.action_type) {
                query += ' AND al.action_type = ?';
                params.push(filters.action_type);
            }

            if (filters.start_date) {
                query += ' AND DATE(al.created_at) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                query += ' AND DATE(al.created_at) <= ?';
                params.push(filters.end_date);
            }

            query += ' ORDER BY al.created_at DESC';

            const logs = await mainDb.all(query, params);

            return { success: true, logs };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Helper method to get action type constants
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
}

module.exports = ActivityLog;