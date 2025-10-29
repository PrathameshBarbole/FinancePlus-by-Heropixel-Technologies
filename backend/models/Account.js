const mainDb = require('../config/db_main');
const txnDb = require('../config/db_txn');

class Account {
    static async create(accountData, createdBy) {
        try {
            const { customer_id, account_type = 'savings', initial_balance = 0, interest_rate = 4.00 } = accountData;

            // Validate required fields
            if (!customer_id) {
                throw new Error('Customer ID is required');
            }

            // Validate customer exists
            const customer = await mainDb.get('SELECT id FROM customers WHERE id = ? AND is_active = 1', [customer_id]);
            if (!customer) {
                throw new Error('Customer not found or inactive');
            }

            // Validate account type
            const validAccountTypes = ['savings', 'current', 'salary'];
            if (!validAccountTypes.includes(account_type)) {
                throw new Error('Invalid account type');
            }

            // Validate initial balance
            if (initial_balance < 0) {
                throw new Error('Initial balance cannot be negative');
            }

            // Generate unique account number
            const account_number = await this.generateAccountNumber();

            // Insert account
            const result = await mainDb.run(
                `INSERT INTO accounts (account_number, customer_id, account_type, balance, interest_rate, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [account_number, customer_id, account_type, initial_balance, interest_rate, createdBy]
            );

            // If initial balance > 0, create initial deposit transaction
            if (initial_balance > 0) {
                await this.createTransaction({
                    account_id: result.id,
                    customer_id,
                    transaction_type: 'deposit',
                    amount: initial_balance,
                    balance_before: 0,
                    balance_after: initial_balance,
                    description: 'Initial deposit',
                    processed_by: createdBy
                });
            }

            return {
                success: true,
                account: {
                    id: result.id,
                    account_number,
                    customer_id,
                    account_type,
                    balance: initial_balance,
                    interest_rate,
                    is_active: true,
                    created_by: createdBy
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async generateAccountNumber() {
        const prefix = 'FP';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const accountNumber = `${prefix}${timestamp}${random}`;

        // Check if account number already exists
        const existing = await mainDb.get('SELECT id FROM accounts WHERE account_number = ?', [accountNumber]);
        if (existing) {
            // Recursively generate new number if collision occurs
            return await this.generateAccountNumber();
        }

        return accountNumber;
    }

    static async findById(id) {
        try {
            const account = await mainDb.get(`
                SELECT a.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM accounts a
                JOIN customers c ON a.customer_id = c.id
                LEFT JOIN users u ON a.created_by = u.id
                WHERE a.id = ?
            `, [id]);

            if (!account) {
                return { success: false, error: 'Account not found' };
            }

            return { success: true, account };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findByAccountNumber(accountNumber) {
        try {
            const account = await mainDb.get(`
                SELECT a.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM accounts a
                JOIN customers c ON a.customer_id = c.id
                LEFT JOIN users u ON a.created_by = u.id
                WHERE a.account_number = ?
            `, [accountNumber]);

            if (!account) {
                return { success: false, error: 'Account not found' };
            }

            return { success: true, account };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT a.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM accounts a
                JOIN customers c ON a.customer_id = c.id
                LEFT JOIN users u ON a.created_by = u.id
                WHERE a.is_active = 1
            `;
            const params = [];

            // Apply filters
            if (filters.customer_id) {
                query += ' AND a.customer_id = ?';
                params.push(filters.customer_id);
            }

            if (filters.account_type) {
                query += ' AND a.account_type = ?';
                params.push(filters.account_type);
            }

            if (filters.search) {
                query += ' AND (a.account_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            if (filters.min_balance !== undefined) {
                query += ' AND a.balance >= ?';
                params.push(filters.min_balance);
            }

            if (filters.max_balance !== undefined) {
                query += ' AND a.balance <= ?';
                params.push(filters.max_balance);
            }

            query += ' ORDER BY a.created_at DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
                
                if (filters.offset) {
                    query += ' OFFSET ?';
                    params.push(filters.offset);
                }
            }

            const accounts = await mainDb.all(query, params);

            return { success: true, accounts };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async deposit(accountId, amount, description, processedBy) {
        try {
            // Validate amount
            if (amount <= 0) {
                throw new Error('Deposit amount must be positive');
            }

            // Get current account details
            const accountResult = await this.findById(accountId);
            if (!accountResult.success) {
                return accountResult;
            }

            const account = accountResult.account;
            const balanceBefore = parseFloat(account.balance);
            const balanceAfter = balanceBefore + amount;

            // Update account balance
            await mainDb.run(
                'UPDATE accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [balanceAfter, accountId]
            );

            // Create transaction record
            const transaction = await this.createTransaction({
                account_id: accountId,
                customer_id: account.customer_id,
                transaction_type: 'deposit',
                amount,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                description: description || 'Cash deposit',
                processed_by: processedBy
            });

            return {
                success: true,
                transaction,
                new_balance: balanceAfter
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async withdraw(accountId, amount, description, processedBy) {
        try {
            // Validate amount
            if (amount <= 0) {
                throw new Error('Withdrawal amount must be positive');
            }

            // Get current account details
            const accountResult = await this.findById(accountId);
            if (!accountResult.success) {
                return accountResult;
            }

            const account = accountResult.account;
            const balanceBefore = parseFloat(account.balance);

            // Check sufficient balance
            if (balanceBefore < amount) {
                throw new Error('Insufficient balance');
            }

            const balanceAfter = balanceBefore - amount;

            // Update account balance
            await mainDb.run(
                'UPDATE accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [balanceAfter, accountId]
            );

            // Create transaction record
            const transaction = await this.createTransaction({
                account_id: accountId,
                customer_id: account.customer_id,
                transaction_type: 'withdrawal',
                amount,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                description: description || 'Cash withdrawal',
                processed_by: processedBy
            });

            return {
                success: true,
                transaction,
                new_balance: balanceAfter
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async transfer(fromAccountId, toAccountId, amount, description, processedBy) {
        try {
            // Validate amount
            if (amount <= 0) {
                throw new Error('Transfer amount must be positive');
            }

            // Get both account details
            const fromAccountResult = await this.findById(fromAccountId);
            const toAccountResult = await this.findById(toAccountId);

            if (!fromAccountResult.success) {
                return { success: false, error: 'Source account not found' };
            }
            if (!toAccountResult.success) {
                return { success: false, error: 'Destination account not found' };
            }

            const fromAccount = fromAccountResult.account;
            const toAccount = toAccountResult.account;

            // Check sufficient balance
            const fromBalanceBefore = parseFloat(fromAccount.balance);
            if (fromBalanceBefore < amount) {
                throw new Error('Insufficient balance in source account');
            }

            const fromBalanceAfter = fromBalanceBefore - amount;
            const toBalanceBefore = parseFloat(toAccount.balance);
            const toBalanceAfter = toBalanceBefore + amount;

            // Update both account balances
            await mainDb.run(
                'UPDATE accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [fromBalanceAfter, fromAccountId]
            );

            await mainDb.run(
                'UPDATE accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [toBalanceAfter, toAccountId]
            );

            // Create transaction records for both accounts
            const transferRef = `TXF${Date.now()}`;

            const fromTransaction = await this.createTransaction({
                account_id: fromAccountId,
                customer_id: fromAccount.customer_id,
                transaction_type: 'transfer_out',
                amount,
                balance_before: fromBalanceBefore,
                balance_after: fromBalanceAfter,
                description: description || `Transfer to ${toAccount.account_number}`,
                reference_number: transferRef,
                reference_type: 'transfer',
                reference_id: toAccountId,
                processed_by: processedBy
            });

            const toTransaction = await this.createTransaction({
                account_id: toAccountId,
                customer_id: toAccount.customer_id,
                transaction_type: 'transfer_in',
                amount,
                balance_before: toBalanceBefore,
                balance_after: toBalanceAfter,
                description: description || `Transfer from ${fromAccount.account_number}`,
                reference_number: transferRef,
                reference_type: 'transfer',
                reference_id: fromAccountId,
                processed_by: processedBy
            });

            return {
                success: true,
                from_transaction: fromTransaction,
                to_transaction: toTransaction,
                from_new_balance: fromBalanceAfter,
                to_new_balance: toBalanceAfter
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async createTransaction(transactionData) {
        const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        const result = await txnDb.run(
            `INSERT INTO transactions (
                transaction_id, account_id, customer_id, transaction_type, amount,
                balance_before, balance_after, description, reference_number,
                reference_type, reference_id, processed_by, transaction_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                transactionId,
                transactionData.account_id,
                transactionData.customer_id,
                transactionData.transaction_type,
                transactionData.amount,
                transactionData.balance_before,
                transactionData.balance_after,
                transactionData.description,
                transactionData.reference_number || null,
                transactionData.reference_type || null,
                transactionData.reference_id || null,
                transactionData.processed_by
            ]
        );

        return {
            id: result.id,
            transaction_id: transactionId,
            ...transactionData
        };
    }

    static async getTransactionHistory(accountId, filters = {}) {
        try {
            let query = `
                SELECT t.*, u.name as processed_by_name
                FROM transactions t
                LEFT JOIN users u ON t.processed_by = u.id
                WHERE t.account_id = ?
            `;
            const params = [accountId];

            // Apply filters
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

            return { success: true, transactions };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async applyInterest(accountId, processedBy) {
        try {
            // Get account details
            const accountResult = await this.findById(accountId);
            if (!accountResult.success) {
                return accountResult;
            }

            const account = accountResult.account;
            const currentBalance = parseFloat(account.balance);
            const interestRate = parseFloat(account.interest_rate);

            // Calculate daily interest (assuming annual rate)
            const dailyInterestRate = interestRate / 365 / 100;
            const interestAmount = currentBalance * dailyInterestRate;

            if (interestAmount <= 0) {
                return { success: false, error: 'No interest to apply' };
            }

            const newBalance = currentBalance + interestAmount;

            // Update account balance
            await mainDb.run(
                'UPDATE accounts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newBalance, accountId]
            );

            // Create interest transaction
            const transaction = await this.createTransaction({
                account_id: accountId,
                customer_id: account.customer_id,
                transaction_type: 'interest_credit',
                amount: interestAmount,
                balance_before: currentBalance,
                balance_after: newBalance,
                description: `Interest credit @ ${interestRate}% p.a.`,
                processed_by: processedBy
            });

            // Record interest calculation
            await txnDb.run(
                `INSERT INTO interest_calculations (
                    account_id, customer_id, calculation_date, opening_balance,
                    closing_balance, interest_rate, interest_amount, days_count, processed_by
                ) VALUES (?, ?, DATE('now'), ?, ?, ?, ?, 1, ?)`,
                [accountId, account.customer_id, currentBalance, newBalance, interestRate, interestAmount, processedBy]
            );

            return {
                success: true,
                transaction,
                interest_amount: interestAmount,
                new_balance: newBalance
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getStats() {
        try {
            const stats = await mainDb.get(`
                SELECT 
                    COUNT(*) as total_accounts,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_accounts,
                    SUM(CASE WHEN is_active = 1 THEN balance ELSE 0 END) as total_balance,
                    AVG(CASE WHEN is_active = 1 THEN balance ELSE NULL END) as average_balance,
                    COUNT(CASE WHEN account_type = 'savings' AND is_active = 1 THEN 1 END) as savings_accounts,
                    COUNT(CASE WHEN account_type = 'current' AND is_active = 1 THEN 1 END) as current_accounts
                FROM accounts
            `);

            return { success: true, stats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async delete(id) {
        try {
            // Check if account exists
            const existingAccount = await this.findById(id);
            if (!existingAccount.success) {
                return existingAccount;
            }

            const account = existingAccount.account;

            // Check if account has balance
            if (parseFloat(account.balance) > 0) {
                throw new Error('Cannot delete account with positive balance');
            }

            // Soft delete - set is_active to false
            await mainDb.run(
                'UPDATE accounts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [id]
            );

            return { success: true, message: 'Account deleted successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = Account;