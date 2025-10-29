const txnDb = require('../config/db_txn');
const mainDb = require('../config/db_main');

class Transaction {
    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT t.*, c.name as customer_name, c.phone as customer_phone, 
                       a.account_number, u.name as processed_by_name
                FROM transactions t
                JOIN customers c ON t.customer_id = c.id
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN users u ON t.processed_by = u.id
                WHERE 1=1
            `;
            const params = [];

            // Apply filters
            if (filters.customer_id) {
                query += ' AND t.customer_id = ?';
                params.push(filters.customer_id);
            }

            if (filters.account_id) {
                query += ' AND t.account_id = ?';
                params.push(filters.account_id);
            }

            if (filters.transaction_type) {
                query += ' AND t.transaction_type = ?';
                params.push(filters.transaction_type);
            }

            if (filters.start_date) {
                query += ' AND DATE(t.transaction_date) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                query += ' AND DATE(t.transaction_date) <= ?';
                params.push(filters.end_date);
            }

            if (filters.min_amount !== undefined) {
                query += ' AND t.amount >= ?';
                params.push(filters.min_amount);
            }

            if (filters.max_amount !== undefined) {
                query += ' AND t.amount <= ?';
                params.push(filters.max_amount);
            }

            if (filters.search) {
                query += ' AND (t.transaction_id LIKE ? OR t.description LIKE ? OR c.name LIKE ? OR a.account_number LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            query += ' ORDER BY t.transaction_date DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
                
                if (filters.offset) {
                    query += ' OFFSET ?';
                    params.push(filters.offset);
                }
            }

            const transactions = await txnDb.all(query, params);

            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(*) as total
                FROM transactions t
                JOIN customers c ON t.customer_id = c.id
                LEFT JOIN accounts a ON t.account_id = a.id
                WHERE 1=1
            `;
            const countParams = [];

            if (filters.customer_id) {
                countQuery += ' AND t.customer_id = ?';
                countParams.push(filters.customer_id);
            }

            if (filters.account_id) {
                countQuery += ' AND t.account_id = ?';
                countParams.push(filters.account_id);
            }

            if (filters.transaction_type) {
                countQuery += ' AND t.transaction_type = ?';
                countParams.push(filters.transaction_type);
            }

            if (filters.start_date) {
                countQuery += ' AND DATE(t.transaction_date) >= ?';
                countParams.push(filters.start_date);
            }

            if (filters.end_date) {
                countQuery += ' AND DATE(t.transaction_date) <= ?';
                countParams.push(filters.end_date);
            }

            if (filters.min_amount !== undefined) {
                countQuery += ' AND t.amount >= ?';
                countParams.push(filters.min_amount);
            }

            if (filters.max_amount !== undefined) {
                countQuery += ' AND t.amount <= ?';
                countParams.push(filters.max_amount);
            }

            if (filters.search) {
                countQuery += ' AND (t.transaction_id LIKE ? OR t.description LIKE ? OR c.name LIKE ? OR a.account_number LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            const countResult = await txnDb.get(countQuery, countParams);

            return { 
                success: true, 
                transactions,
                total: countResult.total,
                limit: filters.limit || transactions.length,
                offset: filters.offset || 0
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findById(id) {
        try {
            const transaction = await txnDb.get(`
                SELECT t.*, c.name as customer_name, c.phone as customer_phone, 
                       a.account_number, u.name as processed_by_name
                FROM transactions t
                JOIN customers c ON t.customer_id = c.id
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN users u ON t.processed_by = u.id
                WHERE t.id = ?
            `, [id]);

            if (!transaction) {
                return { success: false, error: 'Transaction not found' };
            }

            return { success: true, transaction };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findByTransactionId(transactionId) {
        try {
            const transaction = await txnDb.get(`
                SELECT t.*, c.name as customer_name, c.phone as customer_phone, 
                       a.account_number, u.name as processed_by_name
                FROM transactions t
                JOIN customers c ON t.customer_id = c.id
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN users u ON t.processed_by = u.id
                WHERE t.transaction_id = ?
            `, [transactionId]);

            if (!transaction) {
                return { success: false, error: 'Transaction not found' };
            }

            return { success: true, transaction };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getTodaysTransactions() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const transactions = await txnDb.all(`
                SELECT t.*, c.name as customer_name, a.account_number, u.name as processed_by_name
                FROM transactions t
                JOIN customers c ON t.customer_id = c.id
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN users u ON t.processed_by = u.id
                WHERE DATE(t.transaction_date) = ?
                ORDER BY t.transaction_date DESC
            `, [today]);

            return { success: true, transactions };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getTransactionStats(filters = {}) {
        try {
            let whereClause = 'WHERE 1=1';
            const params = [];

            if (filters.start_date) {
                whereClause += ' AND DATE(transaction_date) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereClause += ' AND DATE(transaction_date) <= ?';
                params.push(filters.end_date);
            }

            if (filters.customer_id) {
                whereClause += ' AND customer_id = ?';
                params.push(filters.customer_id);
            }

            if (filters.account_id) {
                whereClause += ' AND account_id = ?';
                params.push(filters.account_id);
            }

            const stats = await txnDb.get(`
                SELECT 
                    COUNT(*) as total_transactions,
                    COUNT(CASE WHEN transaction_type = 'deposit' THEN 1 END) as total_deposits,
                    COUNT(CASE WHEN transaction_type = 'withdrawal' THEN 1 END) as total_withdrawals,
                    COUNT(CASE WHEN transaction_type IN ('transfer_in', 'transfer_out') THEN 1 END) as total_transfers,
                    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as total_deposit_amount,
                    SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END) as total_withdrawal_amount,
                    SUM(CASE WHEN transaction_type = 'transfer_in' THEN amount ELSE 0 END) as total_transfer_in_amount,
                    SUM(CASE WHEN transaction_type = 'transfer_out' THEN amount ELSE 0 END) as total_transfer_out_amount,
                    AVG(amount) as average_transaction_amount
                FROM transactions 
                ${whereClause}
            `, params);

            return { success: true, stats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getDailyTransactionTrend(days = 30) {
        try {
            const trend = await txnDb.all(`
                SELECT 
                    DATE(transaction_date) as date,
                    COUNT(*) as transaction_count,
                    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as deposits,
                    SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END) as withdrawals,
                    SUM(CASE WHEN transaction_type IN ('transfer_in', 'transfer_out') THEN amount ELSE 0 END) as transfers
                FROM transactions 
                WHERE transaction_date >= datetime('now', '-${days} days')
                GROUP BY DATE(transaction_date)
                ORDER BY date DESC
            `);

            return { success: true, trend };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getTransactionsByType(filters = {}) {
        try {
            let whereClause = 'WHERE 1=1';
            const params = [];

            if (filters.start_date) {
                whereClause += ' AND DATE(transaction_date) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereClause += ' AND DATE(transaction_date) <= ?';
                params.push(filters.end_date);
            }

            const typeStats = await txnDb.all(`
                SELECT 
                    transaction_type,
                    COUNT(*) as count,
                    SUM(amount) as total_amount,
                    AVG(amount) as average_amount,
                    MIN(amount) as min_amount,
                    MAX(amount) as max_amount
                FROM transactions 
                ${whereClause}
                GROUP BY transaction_type
                ORDER BY total_amount DESC
            `, params);

            return { success: true, type_stats: typeStats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getCustomerTransactionSummary(customerId, filters = {}) {
        try {
            let whereClause = 'WHERE customer_id = ?';
            const params = [customerId];

            if (filters.start_date) {
                whereClause += ' AND DATE(transaction_date) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereClause += ' AND DATE(transaction_date) <= ?';
                params.push(filters.end_date);
            }

            if (filters.account_id) {
                whereClause += ' AND account_id = ?';
                params.push(filters.account_id);
            }

            const summary = await txnDb.get(`
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
                    SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END) as total_withdrawals,
                    SUM(CASE WHEN transaction_type = 'interest_credit' THEN amount ELSE 0 END) as total_interest,
                    MIN(transaction_date) as first_transaction,
                    MAX(transaction_date) as last_transaction
                FROM transactions 
                ${whereClause}
            `, params);

            return { success: true, summary };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getAccountStatement(accountId, filters = {}) {
        try {
            let whereClause = 'WHERE t.account_id = ?';
            const params = [accountId];

            if (filters.start_date) {
                whereClause += ' AND DATE(t.transaction_date) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                whereClause += ' AND DATE(t.transaction_date) <= ?';
                params.push(filters.end_date);
            }

            // Get account details
            const account = await mainDb.get(`
                SELECT a.*, c.name as customer_name, c.phone as customer_phone, c.address
                FROM accounts a
                JOIN customers c ON a.customer_id = c.id
                WHERE a.id = ?
            `, [accountId]);

            if (!account) {
                return { success: false, error: 'Account not found' };
            }

            // Get transactions
            const transactions = await txnDb.all(`
                SELECT t.*, u.name as processed_by_name
                FROM transactions t
                LEFT JOIN users u ON t.processed_by = u.id
                ${whereClause}
                ORDER BY t.transaction_date ASC
            `, params);

            // Calculate opening balance
            let openingBalance = 0;
            if (filters.start_date) {
                const openingResult = await txnDb.get(`
                    SELECT balance_after 
                    FROM transactions 
                    WHERE account_id = ? AND transaction_date < ?
                    ORDER BY transaction_date DESC 
                    LIMIT 1
                `, [accountId, filters.start_date + ' 00:00:00']);
                
                openingBalance = openingResult ? openingResult.balance_after : 0;
            }

            return { 
                success: true, 
                account,
                transactions,
                opening_balance: openingBalance,
                closing_balance: transactions.length > 0 ? transactions[transactions.length - 1].balance_after : openingBalance
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getMonthlyTransactionReport(year, month) {
        try {
            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

            const report = await txnDb.all(`
                SELECT 
                    DATE(transaction_date) as date,
                    transaction_type,
                    COUNT(*) as count,
                    SUM(amount) as total_amount
                FROM transactions 
                WHERE DATE(transaction_date) BETWEEN ? AND ?
                GROUP BY DATE(transaction_date), transaction_type
                ORDER BY date, transaction_type
            `, [startDate, endDate]);

            // Get summary
            const summary = await txnDb.get(`
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_amount,
                    COUNT(DISTINCT customer_id) as unique_customers,
                    COUNT(DISTINCT account_id) as unique_accounts
                FROM transactions 
                WHERE DATE(transaction_date) BETWEEN ? AND ?
            `, [startDate, endDate]);

            return { 
                success: true, 
                report,
                summary,
                period: { year, month, start_date: startDate, end_date: endDate }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async searchTransactions(searchTerm, filters = {}) {
        try {
            let query = `
                SELECT t.*, c.name as customer_name, c.phone as customer_phone, 
                       a.account_number, u.name as processed_by_name
                FROM transactions t
                JOIN customers c ON t.customer_id = c.id
                LEFT JOIN accounts a ON t.account_id = a.id
                LEFT JOIN users u ON t.processed_by = u.id
                WHERE (
                    t.transaction_id LIKE ? OR 
                    t.description LIKE ? OR 
                    c.name LIKE ? OR 
                    c.phone LIKE ? OR 
                    a.account_number LIKE ?
                )
            `;
            
            const searchPattern = `%${searchTerm}%`;
            const params = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];

            // Apply additional filters
            if (filters.transaction_type) {
                query += ' AND t.transaction_type = ?';
                params.push(filters.transaction_type);
            }

            if (filters.start_date) {
                query += ' AND DATE(t.transaction_date) >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                query += ' AND DATE(t.transaction_date) <= ?';
                params.push(filters.end_date);
            }

            query += ' ORDER BY t.transaction_date DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
            }

            const transactions = await txnDb.all(query, params);

            return { success: true, transactions };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getTransactionVolume(period = 'daily', days = 30) {
        try {
            let groupBy, dateFormat;
            
            switch (period) {
                case 'hourly':
                    groupBy = "strftime('%Y-%m-%d %H', transaction_date)";
                    dateFormat = 'hour';
                    break;
                case 'weekly':
                    groupBy = "strftime('%Y-%W', transaction_date)";
                    dateFormat = 'week';
                    break;
                case 'monthly':
                    groupBy = "strftime('%Y-%m', transaction_date)";
                    dateFormat = 'month';
                    break;
                default:
                    groupBy = "DATE(transaction_date)";
                    dateFormat = 'date';
            }

            const volume = await txnDb.all(`
                SELECT 
                    ${groupBy} as period,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_amount,
                    AVG(amount) as average_amount
                FROM transactions 
                WHERE transaction_date >= datetime('now', '-${days} days')
                GROUP BY ${groupBy}
                ORDER BY period DESC
            `);

            return { 
                success: true, 
                volume,
                period_type: dateFormat,
                days_covered: days
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = Transaction;