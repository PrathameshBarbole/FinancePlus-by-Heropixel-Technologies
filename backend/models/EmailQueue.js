const mainDb = require('../config/db_main');

class EmailQueue {
    static async findAll(filters = {}) {
        try {
            let query = 'SELECT * FROM email_queue WHERE 1=1';
            const params = [];

            // Apply filters
            if (filters.status) {
                query += ' AND status = ?';
                params.push(filters.status);
            }

            if (filters.to_email) {
                query += ' AND to_email LIKE ?';
                params.push(`%${filters.to_email}%`);
            }

            if (filters.start_date) {
                query += ' AND DATE(created_at) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                query += ' AND DATE(created_at) <= ?';
                params.push(filters.end_date);
            }

            if (filters.search) {
                query += ' AND (to_email LIKE ? OR subject LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm);
            }

            query += ' ORDER BY created_at DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
                
                if (filters.offset) {
                    query += ' OFFSET ?';
                    params.push(filters.offset);
                }
            }

            const emails = await mainDb.all(query, params);

            // Get total count for pagination
            let countQuery = 'SELECT COUNT(*) as total FROM email_queue WHERE 1=1';
            const countParams = [];

            if (filters.status) {
                countQuery += ' AND status = ?';
                countParams.push(filters.status);
            }

            if (filters.to_email) {
                countQuery += ' AND to_email LIKE ?';
                countParams.push(`%${filters.to_email}%`);
            }

            if (filters.start_date) {
                countQuery += ' AND DATE(created_at) >= ?';
                countParams.push(filters.start_date);
            }

            if (filters.end_date) {
                countQuery += ' AND DATE(created_at) <= ?';
                countParams.push(filters.end_date);
            }

            if (filters.search) {
                countQuery += ' AND (to_email LIKE ? OR subject LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                countParams.push(searchTerm, searchTerm);
            }

            const countResult = await mainDb.get(countQuery, countParams);

            return { 
                success: true, 
                emails,
                total: countResult.total,
                limit: filters.limit || emails.length,
                offset: filters.offset || 0
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findById(id) {
        try {
            const email = await mainDb.get('SELECT * FROM email_queue WHERE id = ?', [id]);

            if (!email) {
                return { success: false, error: 'Email not found' };
            }

            return { success: true, email };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async create(emailData) {
        try {
            const { to_email, subject, body, scheduled_at = null, max_attempts = 3 } = emailData;

            // Validate required fields
            if (!to_email || !subject || !body) {
                throw new Error('To email, subject, and body are required');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(to_email)) {
                throw new Error('Invalid email format');
            }

            const result = await mainDb.run(
                `INSERT INTO email_queue (to_email, subject, body, scheduled_at, max_attempts, created_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [to_email, subject, body, scheduled_at, max_attempts]
            );

            return {
                success: true,
                email: {
                    id: result.id,
                    to_email,
                    subject,
                    body,
                    status: 'pending',
                    attempts: 0,
                    max_attempts,
                    scheduled_at,
                    created_at: new Date().toISOString()
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async updateStatus(id, status, errorMessage = null) {
        try {
            const validStatuses = ['pending', 'sent', 'failed'];
            if (!validStatuses.includes(status)) {
                throw new Error('Invalid status');
            }

            let query = 'UPDATE email_queue SET status = ?';
            const params = [status];

            if (status === 'sent') {
                query += ', sent_at = CURRENT_TIMESTAMP';
            }

            if (errorMessage) {
                query += ', error_message = ?';
                params.push(errorMessage);
            }

            query += ' WHERE id = ?';
            params.push(id);

            const result = await mainDb.run(query, params);

            if (result.changes === 0) {
                return { success: false, error: 'Email not found' };
            }

            return { success: true, message: 'Email status updated successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async incrementAttempts(id) {
        try {
            const result = await mainDb.run(
                'UPDATE email_queue SET attempts = attempts + 1 WHERE id = ?',
                [id]
            );

            if (result.changes === 0) {
                return { success: false, error: 'Email not found' };
            }

            return { success: true, message: 'Attempt count incremented' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getPendingEmails(limit = 10) {
        try {
            const emails = await mainDb.all(
                `SELECT * FROM email_queue 
                 WHERE status = 'pending' 
                 AND attempts < max_attempts 
                 AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
                 ORDER BY scheduled_at ASC, created_at ASC 
                 LIMIT ?`,
                [limit]
            );

            return { success: true, emails };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getFailedEmails() {
        try {
            const emails = await mainDb.all(
                'SELECT * FROM email_queue WHERE status = \'failed\' ORDER BY created_at DESC'
            );

            return { success: true, emails };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async retryEmail(id) {
        try {
            const result = await mainDb.run(
                `UPDATE email_queue 
                 SET status = 'pending', attempts = 0, error_message = NULL 
                 WHERE id = ?`,
                [id]
            );

            if (result.changes === 0) {
                return { success: false, error: 'Email not found' };
            }

            return { success: true, message: 'Email queued for retry' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async retryAllFailed() {
        try {
            const result = await mainDb.run(
                `UPDATE email_queue 
                 SET status = 'pending', attempts = 0, error_message = NULL 
                 WHERE status = 'failed'`
            );

            return { 
                success: true, 
                message: `${result.changes} failed emails queued for retry` 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async deleteEmail(id) {
        try {
            const result = await mainDb.run('DELETE FROM email_queue WHERE id = ?', [id]);

            if (result.changes === 0) {
                return { success: false, error: 'Email not found' };
            }

            return { success: true, message: 'Email deleted successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async clearOldEmails(daysOld = 30, statusesToClear = ['sent', 'failed']) {
        try {
            const statusPlaceholders = statusesToClear.map(() => '?').join(',');
            const params = [...statusesToClear, daysOld];

            const result = await mainDb.run(
                `DELETE FROM email_queue 
                 WHERE status IN (${statusPlaceholders}) 
                 AND created_at < datetime('now', '-' || ? || ' days')`,
                params
            );

            return { 
                success: true, 
                message: `${result.changes} old emails cleared`,
                deleted_count: result.changes
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getStats() {
        try {
            const stats = await mainDb.get(`
                SELECT 
                    COUNT(*) as total_emails,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_emails,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_emails,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
                    COUNT(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 END) as emails_last_24h,
                    COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as emails_last_week
                FROM email_queue
            `);

            // Get retry statistics
            const retryStats = await mainDb.get(`
                SELECT 
                    AVG(attempts) as avg_attempts,
                    MAX(attempts) as max_attempts,
                    COUNT(CASE WHEN attempts > 1 THEN 1 END) as emails_with_retries
                FROM email_queue
                WHERE status IN ('sent', 'failed')
            `);

            return { 
                success: true, 
                stats: {
                    ...stats,
                    ...retryStats
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getEmailsByStatus(status) {
        try {
            const validStatuses = ['pending', 'sent', 'failed'];
            if (!validStatuses.includes(status)) {
                throw new Error('Invalid status');
            }

            const emails = await mainDb.all(
                'SELECT * FROM email_queue WHERE status = ? ORDER BY created_at DESC',
                [status]
            );

            return { success: true, emails };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getRecentActivity(hours = 24) {
        try {
            const activity = await mainDb.all(`
                SELECT 
                    DATE(created_at) as date,
                    strftime('%H', created_at) as hour,
                    status,
                    COUNT(*) as count
                FROM email_queue 
                WHERE created_at >= datetime('now', '-${hours} hours')
                GROUP BY DATE(created_at), strftime('%H', created_at), status
                ORDER BY date DESC, hour DESC
            `);

            return { success: true, activity };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async scheduleEmail(emailData, scheduleTime) {
        try {
            const { to_email, subject, body, max_attempts = 3 } = emailData;

            // Validate required fields
            if (!to_email || !subject || !body) {
                throw new Error('To email, subject, and body are required');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(to_email)) {
                throw new Error('Invalid email format');
            }

            // Validate schedule time
            const scheduleDate = new Date(scheduleTime);
            if (scheduleDate <= new Date()) {
                throw new Error('Schedule time must be in the future');
            }

            const result = await mainDb.run(
                `INSERT INTO email_queue (to_email, subject, body, scheduled_at, max_attempts, created_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [to_email, subject, body, scheduleTime, max_attempts]
            );

            return {
                success: true,
                email: {
                    id: result.id,
                    to_email,
                    subject,
                    body,
                    status: 'pending',
                    attempts: 0,
                    max_attempts,
                    scheduled_at: scheduleTime,
                    created_at: new Date().toISOString()
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getScheduledEmails() {
        try {
            const emails = await mainDb.all(
                `SELECT * FROM email_queue 
                 WHERE status = 'pending' 
                 AND scheduled_at IS NOT NULL 
                 AND scheduled_at > CURRENT_TIMESTAMP
                 ORDER BY scheduled_at ASC`
            );

            return { success: true, emails };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getDailyEmailReport(days = 7) {
        try {
            const report = await mainDb.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_emails,
                    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_emails,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_emails,
                    ROUND(
                        (COUNT(CASE WHEN status = 'sent' THEN 1 END) * 100.0 / COUNT(*)), 2
                    ) as success_rate
                FROM email_queue 
                WHERE created_at >= datetime('now', '-${days} days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `);

            return { success: true, report };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async bulkDelete(ids) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('Invalid IDs array');
            }

            const placeholders = ids.map(() => '?').join(',');
            const result = await mainDb.run(
                `DELETE FROM email_queue WHERE id IN (${placeholders})`,
                ids
            );

            return { 
                success: true, 
                message: `${result.changes} emails deleted`,
                deleted_count: result.changes
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailQueue;