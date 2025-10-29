const mainDb = require('../config/db_main');
const txnDb = require('../config/db_txn');

class FD {
    static async create(fdData, createdBy) {
        try {
            const {
                customer_id,
                principal_amount,
                interest_rate,
                tenure_months
            } = fdData;

            // Validate required fields
            if (!customer_id || !principal_amount || !interest_rate || !tenure_months) {
                throw new Error('Customer ID, principal amount, interest rate, and tenure are required');
            }

            // Validate customer exists
            const customer = await mainDb.get('SELECT id FROM customers WHERE id = ? AND is_active = 1', [customer_id]);
            if (!customer) {
                throw new Error('Customer not found or inactive');
            }

            // Validate amounts and rates
            if (principal_amount <= 0) {
                throw new Error('Principal amount must be positive');
            }
            if (interest_rate <= 0) {
                throw new Error('Interest rate must be positive');
            }
            if (tenure_months <= 0) {
                throw new Error('Tenure must be positive');
            }

            // Generate unique FD number
            const fd_number = await this.generateFDNumber();

            // Calculate maturity details
            const start_date = new Date();
            const maturity_date = new Date(start_date);
            maturity_date.setMonth(maturity_date.getMonth() + tenure_months);

            // Calculate maturity amount using compound interest
            const maturity_amount = this.calculateMaturityAmount(principal_amount, interest_rate, tenure_months);

            // Insert FD
            const result = await mainDb.run(
                `INSERT INTO fixed_deposits (
                    fd_number, customer_id, principal_amount, interest_rate, tenure_months,
                    maturity_amount, start_date, maturity_date, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    fd_number, customer_id, principal_amount, interest_rate, tenure_months,
                    maturity_amount, start_date.toISOString().split('T')[0], 
                    maturity_date.toISOString().split('T')[0], createdBy
                ]
            );

            // Create FD transaction record
            await this.createFDTransaction({
                fd_id: result.id,
                customer_id,
                transaction_type: 'fd_create',
                amount: principal_amount,
                description: `FD created - ${fd_number}`,
                processed_by: createdBy
            });

            return {
                success: true,
                fd: {
                    id: result.id,
                    fd_number,
                    customer_id,
                    principal_amount,
                    interest_rate,
                    tenure_months,
                    maturity_amount,
                    start_date: start_date.toISOString().split('T')[0],
                    maturity_date: maturity_date.toISOString().split('T')[0],
                    status: 'active',
                    created_by: createdBy
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async generateFDNumber() {
        const prefix = 'FD';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const fdNumber = `${prefix}${timestamp}${random}`;

        // Check if FD number already exists
        const existing = await mainDb.get('SELECT id FROM fixed_deposits WHERE fd_number = ?', [fdNumber]);
        if (existing) {
            return await this.generateFDNumber();
        }

        return fdNumber;
    }

    static calculateMaturityAmount(principal, rate, months) {
        // Compound interest calculation: A = P(1 + r/n)^(nt)
        // For monthly compounding: n = 12, t = months/12
        const monthlyRate = rate / 100 / 12;
        const maturityAmount = principal * Math.pow(1 + monthlyRate, months);
        return Math.round(maturityAmount * 100) / 100; // Round to 2 decimal places
    }

    static async findById(id) {
        try {
            const fd = await mainDb.get(`
                SELECT fd.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM fixed_deposits fd
                JOIN customers c ON fd.customer_id = c.id
                LEFT JOIN users u ON fd.created_by = u.id
                WHERE fd.id = ?
            `, [id]);

            if (!fd) {
                return { success: false, error: 'Fixed deposit not found' };
            }

            return { success: true, fd };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findByFDNumber(fdNumber) {
        try {
            const fd = await mainDb.get(`
                SELECT fd.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM fixed_deposits fd
                JOIN customers c ON fd.customer_id = c.id
                LEFT JOIN users u ON fd.created_by = u.id
                WHERE fd.fd_number = ?
            `, [fdNumber]);

            if (!fd) {
                return { success: false, error: 'Fixed deposit not found' };
            }

            return { success: true, fd };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT fd.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM fixed_deposits fd
                JOIN customers c ON fd.customer_id = c.id
                LEFT JOIN users u ON fd.created_by = u.id
                WHERE 1=1
            `;
            const params = [];

            // Apply filters
            if (filters.customer_id) {
                query += ' AND fd.customer_id = ?';
                params.push(filters.customer_id);
            }

            if (filters.status) {
                query += ' AND fd.status = ?';
                params.push(filters.status);
            }

            if (filters.search) {
                query += ' AND (fd.fd_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            if (filters.maturity_from) {
                query += ' AND fd.maturity_date >= ?';
                params.push(filters.maturity_from);
            }

            if (filters.maturity_to) {
                query += ' AND fd.maturity_date <= ?';
                params.push(filters.maturity_to);
            }

            query += ' ORDER BY fd.created_at DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
                
                if (filters.offset) {
                    query += ' OFFSET ?';
                    params.push(filters.offset);
                }
            }

            const fds = await mainDb.all(query, params);

            return { success: true, fds };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async close(id, processedBy, isPremature = false) {
        try {
            // Get FD details
            const fdResult = await this.findById(id);
            if (!fdResult.success) {
                return fdResult;
            }

            const fd = fdResult.fd;

            if (fd.status !== 'active') {
                throw new Error('FD is not active');
            }

            const currentDate = new Date();
            const maturityDate = new Date(fd.maturity_date);
            let closureAmount = fd.maturity_amount;
            let description = `FD matured - ${fd.fd_number}`;

            // Handle premature closure
            if (isPremature || currentDate < maturityDate) {
                // Calculate premature closure amount (reduced interest)
                const daysCompleted = Math.floor((currentDate - new Date(fd.start_date)) / (1000 * 60 * 60 * 24));
                const totalDays = Math.floor((maturityDate - new Date(fd.start_date)) / (1000 * 60 * 60 * 24));
                
                // Apply penalty - reduce interest rate by 1% for premature closure
                const penaltyRate = Math.max(0, fd.interest_rate - 1);
                const monthsCompleted = daysCompleted / 30.44; // Average days per month
                
                closureAmount = this.calculateMaturityAmount(fd.principal_amount, penaltyRate, monthsCompleted);
                description = `FD closed prematurely - ${fd.fd_number}`;

                // Update FD with premature closure details
                await mainDb.run(
                    `UPDATE fixed_deposits SET 
                     status = 'closed', is_premature = 1, premature_date = ?, 
                     premature_amount = ?, updated_at = CURRENT_TIMESTAMP 
                     WHERE id = ?`,
                    [currentDate.toISOString().split('T')[0], closureAmount, id]
                );
            } else {
                // Normal maturity
                await mainDb.run(
                    'UPDATE fixed_deposits SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    ['matured', id]
                );
            }

            // Create FD transaction record
            const transaction = await this.createFDTransaction({
                fd_id: id,
                customer_id: fd.customer_id,
                transaction_type: isPremature ? 'fd_premature_close' : 'fd_mature',
                amount: closureAmount,
                description,
                processed_by: processedBy
            });

            return {
                success: true,
                transaction,
                closure_amount: closureAmount,
                is_premature: isPremature || currentDate < maturityDate
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async createFDTransaction(transactionData) {
        const transactionId = `FDTXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        const result = await txnDb.run(
            `INSERT INTO fd_transactions (
                transaction_id, fd_id, customer_id, transaction_type, amount,
                description, processed_by, transaction_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                transactionId,
                transactionData.fd_id,
                transactionData.customer_id,
                transactionData.transaction_type,
                transactionData.amount,
                transactionData.description,
                transactionData.processed_by
            ]
        );

        return {
            id: result.id,
            transaction_id: transactionId,
            ...transactionData
        };
    }

    static async getTransactionHistory(fdId, filters = {}) {
        try {
            let query = `
                SELECT ft.*, u.name as processed_by_name
                FROM fd_transactions ft
                LEFT JOIN users u ON ft.processed_by = u.id
                WHERE ft.fd_id = ?
            `;
            const params = [fdId];

            if (filters.transaction_type) {
                query += ' AND ft.transaction_type = ?';
                params.push(filters.transaction_type);
            }

            query += ' ORDER BY ft.transaction_date DESC';

            const transactions = await txnDb.all(query, params);

            return { success: true, transactions };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getMaturityList(daysAhead = 30) {
        try {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);

            const maturingFDs = await mainDb.all(`
                SELECT fd.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
                FROM fixed_deposits fd
                JOIN customers c ON fd.customer_id = c.id
                WHERE fd.status = 'active' 
                AND fd.maturity_date <= ?
                ORDER BY fd.maturity_date ASC
            `, [futureDate.toISOString().split('T')[0]]);

            return { success: true, maturing_fds: maturingFDs };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getStats() {
        try {
            const stats = await mainDb.get(`
                SELECT 
                    COUNT(*) as total_fds,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_fds,
                    COUNT(CASE WHEN status = 'matured' THEN 1 END) as matured_fds,
                    COUNT(CASE WHEN status = 'closed' AND is_premature = 1 THEN 1 END) as premature_closed,
                    SUM(CASE WHEN status = 'active' THEN principal_amount ELSE 0 END) as total_active_amount,
                    SUM(CASE WHEN status = 'active' THEN maturity_amount ELSE 0 END) as total_maturity_amount,
                    AVG(CASE WHEN status = 'active' THEN interest_rate ELSE NULL END) as avg_interest_rate
                FROM fixed_deposits
            `);

            return { success: true, stats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async update(id, updateData) {
        try {
            const { interest_rate, tenure_months } = updateData;

            // Check if FD exists and is active
            const fdResult = await this.findById(id);
            if (!fdResult.success) {
                return fdResult;
            }

            const fd = fdResult.fd;
            if (fd.status !== 'active') {
                throw new Error('Can only update active FDs');
            }

            const updateFields = [];
            const params = [];

            if (interest_rate !== undefined) {
                if (interest_rate <= 0) {
                    throw new Error('Interest rate must be positive');
                }
                updateFields.push('interest_rate = ?');
                params.push(interest_rate);

                // Recalculate maturity amount if interest rate changes
                const newMaturityAmount = this.calculateMaturityAmount(fd.principal_amount, interest_rate, fd.tenure_months);
                updateFields.push('maturity_amount = ?');
                params.push(newMaturityAmount);
            }

            if (tenure_months !== undefined) {
                if (tenure_months <= 0) {
                    throw new Error('Tenure must be positive');
                }
                updateFields.push('tenure_months = ?');
                params.push(tenure_months);

                // Recalculate maturity date and amount
                const newMaturityDate = new Date(fd.start_date);
                newMaturityDate.setMonth(newMaturityDate.getMonth() + tenure_months);
                updateFields.push('maturity_date = ?');
                params.push(newMaturityDate.toISOString().split('T')[0]);

                const currentRate = interest_rate || fd.interest_rate;
                const newMaturityAmount = this.calculateMaturityAmount(fd.principal_amount, currentRate, tenure_months);
                updateFields.push('maturity_amount = ?');
                params.push(newMaturityAmount);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            const query = `UPDATE fixed_deposits SET ${updateFields.join(', ')} WHERE id = ?`;
            await mainDb.run(query, params);

            return await this.findById(id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = FD;