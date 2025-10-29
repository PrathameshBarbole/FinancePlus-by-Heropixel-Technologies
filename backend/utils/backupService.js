const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mainDb = require('../config/db_main');
const txnDb = require('../config/db_txn');
const AuditService = require('./auditService');

class BackupService {
    constructor() {
        this.backupDir = path.join(__dirname, '../backups');
        this.maxBackups = parseInt(process.env.MAX_BACKUPS) || 10;
        this.encryptionKey = process.env.BACKUP_KEY || 'default_backup_key_change_this_in_production';
        this.ensureBackupDirectory();
    }

    async ensureBackupDirectory() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
        } catch (error) {
            console.error('Error creating backup directory:', error);
        }
    }

    async createBackup(userId, description = 'Manual backup') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `financeplus_backup_${timestamp}.json`;
            const backupPath = path.join(this.backupDir, backupFileName);

            console.log('🔄 Creating backup...');

            // Get all data from main database
            const mainData = await this.exportMainDatabase();
            
            // Get all data from transaction database
            const txnData = await this.exportTransactionDatabase();

            // Create backup object
            const backupData = {
                metadata: {
                    version: '1.0.0',
                    created_at: new Date().toISOString(),
                    created_by: userId,
                    description: description,
                    app_name: 'FinancePlus',
                    developer: 'Heropixel Technologies'
                },
                main_database: mainData,
                transaction_database: txnData
            };

            // Encrypt and save backup
            const encryptedData = this.encryptData(JSON.stringify(backupData));
            await fs.writeFile(backupPath, encryptedData);

            // Clean up old backups
            await this.cleanupOldBackups();

            // Log the backup creation
            await AuditService.logActivity(
                userId,
                AuditService.ACTION_TYPES.BACKUP_CREATE,
                'system',
                null,
                `Backup created: ${backupFileName}`
            );

            console.log(`✅ Backup created successfully: ${backupFileName}`);
            
            return {
                success: true,
                fileName: backupFileName,
                filePath: backupPath,
                size: (await fs.stat(backupPath)).size
            };
        } catch (error) {
            console.error('❌ Backup creation failed:', error);
            return { success: false, error: error.message };
        }
    }

    async restoreBackup(userId, backupFileName) {
        try {
            const backupPath = path.join(this.backupDir, backupFileName);
            
            // Check if backup file exists
            try {
                await fs.access(backupPath);
            } catch (error) {
                throw new Error('Backup file not found');
            }

            console.log('🔄 Restoring backup...');

            // Read and decrypt backup file
            const encryptedData = await fs.readFile(backupPath, 'utf8');
            const decryptedData = this.decryptData(encryptedData);
            const backupData = JSON.parse(decryptedData);

            // Validate backup structure
            if (!backupData.metadata || !backupData.main_database || !backupData.transaction_database) {
                throw new Error('Invalid backup file structure');
            }

            // Create backup of current data before restore
            await this.createBackup(userId, 'Pre-restore backup');

            // Restore main database
            await this.restoreMainDatabase(backupData.main_database);
            
            // Restore transaction database
            await this.restoreTransactionDatabase(backupData.transaction_database);

            // Log the restore operation
            await AuditService.logActivity(
                userId,
                AuditService.ACTION_TYPES.BACKUP_RESTORE,
                'system',
                null,
                `Backup restored: ${backupFileName}`
            );

            console.log(`✅ Backup restored successfully: ${backupFileName}`);
            
            return {
                success: true,
                fileName: backupFileName,
                restoredAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Backup restore failed:', error);
            return { success: false, error: error.message };
        }
    }

    async exportMainDatabase() {
        const tables = [
            'users', 'customers', 'accounts', 'fixed_deposits', 
            'recurring_deposits', 'loans', 'email_queue', 
            'activity_logs', 'settings'
        ];

        const data = {};

        for (const table of tables) {
            try {
                data[table] = await mainDb.all(`SELECT * FROM ${table}`);
            } catch (error) {
                console.warn(`Warning: Could not export table ${table}:`, error.message);
                data[table] = [];
            }
        }

        return data;
    }

    async exportTransactionDatabase() {
        const tables = [
            'transactions', 'fd_transactions', 'rd_transactions', 
            'loan_transactions', 'interest_calculations'
        ];

        const data = {};

        for (const table of tables) {
            try {
                data[table] = await txnDb.all(`SELECT * FROM ${table}`);
            } catch (error) {
                console.warn(`Warning: Could not export table ${table}:`, error.message);
                data[table] = [];
            }
        }

        return data;
    }

    async restoreMainDatabase(data) {
        // Clear existing data (except users table to prevent lockout)
        const tablesToClear = [
            'activity_logs', 'email_queue', 'loans', 'recurring_deposits', 
            'fixed_deposits', 'accounts', 'customers', 'settings'
        ];

        for (const table of tablesToClear) {
            await mainDb.run(`DELETE FROM ${table}`);
        }

        // Restore data
        for (const [table, rows] of Object.entries(data)) {
            if (table === 'users') {
                // Handle users table carefully to avoid lockout
                continue;
            }

            if (rows && rows.length > 0) {
                const columns = Object.keys(rows[0]);
                const placeholders = columns.map(() => '?').join(', ');
                const columnNames = columns.join(', ');

                for (const row of rows) {
                    const values = columns.map(col => row[col]);
                    await mainDb.run(
                        `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
                        values
                    );
                }
            }
        }
    }

    async restoreTransactionDatabase(data) {
        // Clear existing data
        const tables = [
            'interest_calculations', 'loan_transactions', 'rd_transactions', 
            'fd_transactions', 'transactions'
        ];

        for (const table of tables) {
            await txnDb.run(`DELETE FROM ${table}`);
        }

        // Restore data
        for (const [table, rows] of Object.entries(data)) {
            if (rows && rows.length > 0) {
                const columns = Object.keys(rows[0]);
                const placeholders = columns.map(() => '?').join(', ');
                const columnNames = columns.join(', ');

                for (const row of rows) {
                    const values = columns.map(col => row[col]);
                    await txnDb.run(
                        `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
                        values
                    );
                }
            }
        }
    }

    encryptData(data) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(algorithm, key);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return iv.toString('hex') + ':' + encrypted;
    }

    decryptData(encryptedData) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
        
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        const decipher = crypto.createDecipher(algorithm, key);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    async getBackupList() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = files.filter(file => file.startsWith('financeplus_backup_') && file.endsWith('.json'));
            
            const backups = [];
            for (const file of backupFiles) {
                const filePath = path.join(this.backupDir, file);
                const stats = await fs.stat(filePath);
                
                backups.push({
                    fileName: file,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                });
            }

            // Sort by creation date (newest first)
            backups.sort((a, b) => new Date(b.created) - new Date(a.created));

            return { success: true, backups: backups };
        } catch (error) {
            console.error('Error getting backup list:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteBackup(fileName) {
        try {
            const backupPath = path.join(this.backupDir, fileName);
            await fs.unlink(backupPath);
            
            console.log(`🗑️ Backup deleted: ${fileName}`);
            return { success: true };
        } catch (error) {
            console.error('Error deleting backup:', error);
            return { success: false, error: error.message };
        }
    }

    async cleanupOldBackups() {
        try {
            const { backups } = await this.getBackupList();
            
            if (backups.length > this.maxBackups) {
                const backupsToDelete = backups.slice(this.maxBackups);
                
                for (const backup of backupsToDelete) {
                    await this.deleteBackup(backup.fileName);
                }
                
                console.log(`🗑️ Cleaned up ${backupsToDelete.length} old backups`);
            }
        } catch (error) {
            console.error('Error cleaning up old backups:', error);
        }
    }

    async getBackupInfo(fileName) {
        try {
            const backupPath = path.join(this.backupDir, fileName);
            const encryptedData = await fs.readFile(backupPath, 'utf8');
            const decryptedData = this.decryptData(encryptedData);
            const backupData = JSON.parse(decryptedData);

            return {
                success: true,
                metadata: backupData.metadata,
                stats: {
                    mainTables: Object.keys(backupData.main_database).length,
                    transactionTables: Object.keys(backupData.transaction_database).length,
                    totalRecords: this.countRecords(backupData)
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    countRecords(backupData) {
        let total = 0;
        
        for (const table of Object.values(backupData.main_database)) {
            if (Array.isArray(table)) {
                total += table.length;
            }
        }
        
        for (const table of Object.values(backupData.transaction_database)) {
            if (Array.isArray(table)) {
                total += table.length;
            }
        }
        
        return total;
    }
}

module.exports = new BackupService();