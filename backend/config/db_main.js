const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_MAIN_PATH || path.join(__dirname, '../data/financeplus_main.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

class MainDatabase {
    constructor() {
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('Error connecting to main database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to main SQLite database');
                    this.initializeTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async initializeTables() {
        const tables = [
            // Users table (Admin and Employees)
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'employee',
                profile_photo TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Customers table
            `CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT,
                dob DATE,
                aadhaar TEXT UNIQUE,
                pan TEXT,
                address TEXT,
                inheritor_name TEXT,
                inheritor_relation TEXT,
                inheritor_contact TEXT,
                profile_photo TEXT,
                aadhaar_doc TEXT,
                pan_doc TEXT,
                address_proof TEXT,
                signature TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users (id)
            )`,

            // Accounts table
            `CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_number TEXT UNIQUE NOT NULL,
                customer_id INTEGER NOT NULL,
                account_type TEXT NOT NULL DEFAULT 'savings',
                balance DECIMAL(15,2) DEFAULT 0.00,
                interest_rate DECIMAL(5,2) DEFAULT 4.00,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id),
                FOREIGN KEY (created_by) REFERENCES users (id)
            )`,

            // Fixed Deposits table
            `CREATE TABLE IF NOT EXISTS fixed_deposits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fd_number TEXT UNIQUE NOT NULL,
                customer_id INTEGER NOT NULL,
                principal_amount DECIMAL(15,2) NOT NULL,
                interest_rate DECIMAL(5,2) NOT NULL,
                tenure_months INTEGER NOT NULL,
                maturity_amount DECIMAL(15,2) NOT NULL,
                start_date DATE NOT NULL,
                maturity_date DATE NOT NULL,
                status TEXT DEFAULT 'active',
                is_premature BOOLEAN DEFAULT 0,
                premature_date DATE,
                premature_amount DECIMAL(15,2),
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id),
                FOREIGN KEY (created_by) REFERENCES users (id)
            )`,

            // Recurring Deposits table
            `CREATE TABLE IF NOT EXISTS recurring_deposits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rd_number TEXT UNIQUE NOT NULL,
                customer_id INTEGER NOT NULL,
                monthly_amount DECIMAL(15,2) NOT NULL,
                interest_rate DECIMAL(5,2) NOT NULL,
                tenure_months INTEGER NOT NULL,
                maturity_amount DECIMAL(15,2) NOT NULL,
                start_date DATE NOT NULL,
                maturity_date DATE NOT NULL,
                total_paid DECIMAL(15,2) DEFAULT 0.00,
                status TEXT DEFAULT 'active',
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id),
                FOREIGN KEY (created_by) REFERENCES users (id)
            )`,

            // Loans table
            `CREATE TABLE IF NOT EXISTS loans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                loan_number TEXT UNIQUE NOT NULL,
                customer_id INTEGER NOT NULL,
                loan_type TEXT NOT NULL,
                principal_amount DECIMAL(15,2) NOT NULL,
                interest_rate DECIMAL(5,2) NOT NULL,
                tenure_months INTEGER NOT NULL,
                emi_amount DECIMAL(15,2) NOT NULL,
                total_amount DECIMAL(15,2) NOT NULL,
                outstanding_amount DECIMAL(15,2) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status TEXT DEFAULT 'active',
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id),
                FOREIGN KEY (created_by) REFERENCES users (id)
            )`,

            // Email Queue table
            `CREATE TABLE IF NOT EXISTS email_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                to_email TEXT NOT NULL,
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                attempts INTEGER DEFAULT 0,
                max_attempts INTEGER DEFAULT 3,
                error_message TEXT,
                scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sent_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Activity Log table
            `CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                target_type TEXT,
                target_id INTEGER,
                description TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`,

            // Settings table
            `CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                description TEXT,
                updated_by INTEGER,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (updated_by) REFERENCES users (id)
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        // Insert default settings
        await this.insertDefaultSettings();
    }

    async insertDefaultSettings() {
        const defaultSettings = [
            ['institute_name', 'FinancePlus Institute', 'Institute name'],
            ['institute_address', 'Your Institute Address', 'Institute address'],
            ['institute_email', 'admin@financeplus.com', 'Institute email'],
            ['institute_phone', '+91-1234567890', 'Institute phone'],
            ['savings_interest_rate', '4.00', 'Savings account interest rate'],
            ['fd_interest_rate', '6.50', 'Fixed deposit interest rate'],
            ['rd_interest_rate', '6.00', 'Recurring deposit interest rate'],
            ['loan_interest_rate', '12.00', 'Loan interest rate'],
            ['auto_backup_enabled', '1', 'Enable automatic backups'],
            ['backup_interval', 'weekly', 'Backup interval'],
            ['session_timeout', '86400000', 'Session timeout in milliseconds']
        ];

        for (const [key, value, description] of defaultSettings) {
            await this.run(
                'INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)',
                [key, value, description]
            );
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
                        console.log('Main database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = new MainDatabase();