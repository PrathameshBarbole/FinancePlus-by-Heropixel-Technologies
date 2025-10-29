const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_TXN_PATH || path.join(__dirname, '../data/transactions.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

class TransactionDatabase {
    constructor() {
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('Error connecting to transaction database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to transaction SQLite database');
                    this.initializeTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async initializeTables() {
        const tables = [
            // Transactions table
            `CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT UNIQUE NOT NULL,
                account_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                transaction_type TEXT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                balance_before DECIMAL(15,2) NOT NULL,
                balance_after DECIMAL(15,2) NOT NULL,
                description TEXT,
                reference_number TEXT,
                reference_type TEXT,
                reference_id INTEGER,
                processed_by INTEGER NOT NULL,
                transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // FD Transactions table
            `CREATE TABLE IF NOT EXISTS fd_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT UNIQUE NOT NULL,
                fd_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                transaction_type TEXT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                description TEXT,
                processed_by INTEGER NOT NULL,
                transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // RD Transactions table
            `CREATE TABLE IF NOT EXISTS rd_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT UNIQUE NOT NULL,
                rd_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                transaction_type TEXT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                installment_number INTEGER,
                description TEXT,
                processed_by INTEGER NOT NULL,
                transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Loan Transactions table
            `CREATE TABLE IF NOT EXISTS loan_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id TEXT UNIQUE NOT NULL,
                loan_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                transaction_type TEXT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                principal_amount DECIMAL(15,2) DEFAULT 0.00,
                interest_amount DECIMAL(15,2) DEFAULT 0.00,
                outstanding_before DECIMAL(15,2) NOT NULL,
                outstanding_after DECIMAL(15,2) NOT NULL,
                emi_number INTEGER,
                description TEXT,
                processed_by INTEGER NOT NULL,
                transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Interest Calculations table
            `CREATE TABLE IF NOT EXISTS interest_calculations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                calculation_date DATE NOT NULL,
                opening_balance DECIMAL(15,2) NOT NULL,
                closing_balance DECIMAL(15,2) NOT NULL,
                interest_rate DECIMAL(5,2) NOT NULL,
                interest_amount DECIMAL(15,2) NOT NULL,
                days_count INTEGER NOT NULL,
                processed_by INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        // Create indexes for better performance
        await this.createIndexes();
    }

    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type)',
            'CREATE INDEX IF NOT EXISTS idx_fd_transactions_fd_id ON fd_transactions(fd_id)',
            'CREATE INDEX IF NOT EXISTS idx_rd_transactions_rd_id ON rd_transactions(rd_id)',
            'CREATE INDEX IF NOT EXISTS idx_loan_transactions_loan_id ON loan_transactions(loan_id)',
            'CREATE INDEX IF NOT EXISTS idx_interest_calculations_account_id ON interest_calculations(account_id)',
            'CREATE INDEX IF NOT EXISTS idx_interest_calculations_date ON interest_calculations(calculation_date)'
        ];

        for (const index of indexes) {
            await this.run(index);
        }
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Transaction database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = new TransactionDatabase();