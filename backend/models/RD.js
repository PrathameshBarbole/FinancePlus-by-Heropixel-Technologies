const mainDb = require('../config/db_main');
const txnDb = require('../config/db_txn');

class RD {
    static async create(rdData, createdBy) {
        try {
            const {
                customer_id,
                monthly_amount,
                interest_rate,
                tenure_months
            } = rdData;

            // Validate required fields
            if (!customer_id || !monthly_amount || !interest_rate || !tenure_months) {
                throw new Error('Customer ID, monthly amount, interest rate, and tenure are required');
            }

            // Validate customer exists
            const customer = await mainDb.get('SELECT id FROM customers WHERE id = ? AND is_active = 1', [customer_id]);
            if (!customer) {
                throw new Error('Customer not found or inactive');
            }

            // Validate amounts and rates
            if (monthly_amount <= 0) {
                throw new Error('Monthly amount must be positive');
            }
            if (interest_rate <= 0) {
                throw new Error('Interest rate must be positive');
            }
            if (tenure_months <= 0) {
                throw new Error('Tenure must be positive');
            }

            // Generate unique RD number
            const rd_number = await this.generateRDNumber();

            // Calculate maturity details
            const start_date = new Date();
            const maturity_date = new Date(start_date);
            maturity_date.setMonth(maturity_date.getMonth() + tenure_months);

            // Calculate maturity amount for RD
            const maturity_amount = this.calculateRDMaturityAmount(monthly_amount, interest_rate, tenure_months);

            // Insert RD
            const result = await mainDb.run(
                `INSERT INTO recurring_deposits (
                    rd_number, customer_id, monthly_amount, interest_rate, tenure_months,
                    maturity_amount, start_date, maturity_date, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    rd_number, customer_id, monthly_amount, interest_rate, tenure_months,
                    maturity_amount, start_date.toISOString().split('T')[0], 
                    maturity_date.toISOString().split('T')[0], createdBy
                ]
            );

            // Create RD transaction record
            await this.createRDTransaction({
                rd_id: result.id,
                customer_id,
                transaction_type: 'rd_create',
                amount: 0,
                description: `RD created - ${rd_number}`,
                processed_by: createdBy
            });

            return {
                success: true,
                rd: {
                    id: result.id,
                    rd_number,
                    customer_id,
                    monthly_amount,
                    interest_rate,
                    tenure_months,
                    maturity_amount,
                    start_date: start_date.toISOString().split('T')[0],
                    maturity_date: maturity_date.toISOString().split('T')[0],
                    total_paid: 0,
                    status: 'active',
                    created_by: createdBy
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async generateRDNumber() {
        const prefix = 'RD';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const rdNumber = `${prefix}${timestamp}${random}`;

        // Check if RD number already exists
        const existing = await mainDb.get('SELECT id FROM recurring_deposits WHERE rd_number = ?', [rdNumber]);
        if (existing) {
            return await this.generateRDNumber();
        }

        return rdNumber;
    }

    static calculateRDMaturityAmount(monthlyAmount, rate, months) {
        // RD maturity calculation: M = P * [((1 + r)^n - 1) / r] * (1 + r)
        // Where P = monthly amount, r = monthly interest rate, n = number of months
        const monthlyRate = rate / 100 / 12;
        const maturityAmount = monthlyAmount * (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate));
        return Math.round(maturityAmount * 100) / 100; // Round to 2 decimal places
    }

    static async findById(id) {
        try {
            const rd = await mainDb.get(`
                SELECT rd.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM recurring_deposits rd
                JOIN customers c ON rd.customer_id = c.id
                LEFT JOIN users u ON rd.created_by = u.id
                WHERE rd.id = ?
            `, [id]);

            if (!rd) {
                return { success: false, error: 'Recurring deposit not found' };
            }

            return { success: true, rd };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findByRDNumber(rdNumber) {
        try {
            const rd = await mainDb.get(`
                SELECT rd.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM recurring_deposits rd
                JOIN customers c ON rd.customer_id = c.id
                LEFT JOIN users u ON rd.created_by = u.id
                WHERE rd.rd_number = ?
            `, [rdNumber]);

            if (!rd) {
                return { success: false, error: 'Recurring deposit not found' };
            }

            return { success: true, rd };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT rd.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM recurring_deposits rd
                JOIN customers c ON rd.customer_id = c.id
                LEFT JOIN users u ON rd.created_by = u.id
                WHERE 1=1
            `;
            const params = [];

            // Apply filters
            if (filters.customer_id) {
                query += ' AND rd.customer_id = ?';
                params.push(filters.customer_id);
            }

            if (filters.status) {
                query += ' AND rd.status = ?';
                params.push(filters.status);
            }

            if (filters.search) {
                query += ' AND (rd.rd_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            if (filters.maturity_from) {
                query += ' AND rd.maturity_date >= ?';
                params.push(filters.maturity_from);
            }

            if (filters.maturity_to) {
                query += ' AND rd.maturity_date <= ?';
                params.push(filters.maturity_to);
            }

            query += ' ORDER BY rd.created_at DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
                
                if (filters.offset) {
                    query += ' OFFSET ?';
                    params.push(filters.offset);
                }
            }

            const rds = await mainDb.all(query, params);

            return { success: true, rds };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async payInstallment(id, amount, processedBy, installmentNumber = null) {
        try {
            // Get RD details
            const rdResult = await this.findById(id);
            if (!rdResult.success) {
                return rdResult;
            }

            const rd = rdResult.rd;

            if (rd.status !== 'active') {
                throw new Error('RD is not active');
            }

            // Validate amount
            if (amount <= 0) {
                throw new Error('Installment amount must be positive');
            }

            // Calculate next installment number if not provided
            if (!installmentNumber) {
                const lastInstallment = await txnDb.get(
                    'SELECT MAX(installment_number) as last_installment FROM rd_transactions WHERE rd_id = ? AND transaction_type = "rd_installment"',
                    [id]
                );
                installmentNumber = (lastInstallment.last_installment || 0) + 1;
            }

            // Update total paid amount
            const newTotalPaid = parseFloat(rd.total_paid) + amount;

            await mainDb.run(
                'UPDATE recurring_deposits SET total_paid = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newTotalPaid, id]
            );

            // Create RD transaction record
            const transaction = await this.createRDTransaction({
                rd_id: id,
                customer_id: rd.customer_id,
                transaction_type: 'rd_installment',
                amount,
                installment_number: installmentNumber,
                description: `RD installment #${installmentNumber} - ${rd.rd_number}`,
                processed_by: processedBy
            });

            // Check if RD is fully paid
            const expectedTotalAmount = rd.monthly_amount * rd.tenure_months;
            if (newTotalPaid >= expectedTotalAmount) {
                await mainDb.run(
                    'UPDATE recurring_deposits SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    ['completed', id]
                );
            }

            return {
                success: true,
                transaction,
                new_total_paid: newTotalPaid,
                installment_number: installmentNumber,
                remaining_amount: Math.max(0, expectedTotalAmount - newTotalPaid)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async close(id, processedBy, isPremature = false) {
        try {
            // Get RD details
            const rdResult = await this.findById(id);
            if (!rdResult.success) {
                return rdResult;
            }

            const rd = rdResult.rd;

            if (rd.status !== 'active' && rd.status !== 'completed') {
                throw new Error('RD is not active or completed');
            }

            const currentDate = new Date();
            const maturityDate = new Date(rd.maturity_date);
            let closureAmount = rd.maturity_amount;
            let description = `RD matured - ${rd.rd_number}`;

            // Handle premature closure
            if (isPremature || (currentDate < maturityDate && rd.status !== 'completed')) {
                // Calculate premature closure amount based on actual payments
                const monthsPaid = Math.floor(rd.total_paid / rd.monthly_amount);
                
                // Apply penalty - reduce interest rate by 1% for premature closure
                const penaltyRate = Math.max(0, rd.interest_rate - 1);
                closureAmount = this.calculateRDMaturityAmount(rd.monthly_amount, penaltyRate, monthsPaid);
                
                // Add any excess amount paid
                const excessAmount = rd.total_paid - (monthsPaid * rd.monthly_amount);
                closureAmount += excessAmount;
                
                description = `RD closed prematurely - ${rd.rd_number}`;
            }

            // Update RD status
            await mainDb.run(
                'UPDATE recurring_deposits SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['closed', id]
            );

            // Create RD transaction record
            const transaction = await this.createRDTransaction({
                rd_id: id,
                customer_id: rd.customer_id,
                transaction_type: isPremature ? 'rd_premature_close' : 'rd_mature',
                amount: closureAmount,
                description,
                processed_by: processedBy
            });

            return {
                success: true,
                transaction,
                closure_amount: closureAmount,
                is_premature: isPremature
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async createRDTransaction(transactionData) {
        const transactionId = `RDTXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        const result = await txnDb.run(
            `INSERT INTO rd_transactions (
                transaction_id, rd_id, customer_id, transaction_type, amount,
                installment_number, description, processed_by, transaction_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                transactionId,
                transactionData.rd_id,
                transactionData.customer_id,
                transactionData.transaction_type,
                transactionData.amount,
                transactionData.installment_number || null,
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

    static async getTransactionHistory(rdId, filters = {}) {
        try {
            let query = `
                SELECT rt.*, u.name as processed_by_name
                FROM rd_transactions rt
                LEFT JOIN users u ON rt.processed_by = u.id
                WHERE rt.rd_id = ?
            `;
            const params = [rdId];

            if (filters.transaction_type) {
                query += ' AND rt.transaction_type = ?';
                params.push(filters.transaction_type);
            }

            query += ' ORDER BY rt.transaction_date DESC';

            const transactions = await txnDb.all(query, params);

            return { success: true, transactions };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getInstallmentSchedule(id) {
        try {
            const rdResult = await this.findById(id);
            if (!rdResult.success) {
                return rdResult;
            }

            const rd = rdResult.rd;
            const schedule = [];
            const startDate = new Date(rd.start_date);

            for (let i = 1; i <= rd.tenure_months; i++) {
                const dueDate = new Date(startDate);
                dueDate.setMonth(dueDate.getMonth() + i - 1);

                // Check if installment is paid
                const payment = await txnDb.get(
                    'SELECT * FROM rd_transactions WHERE rd_id = ? AND installment_number = ? AND transaction_type = "rd_installment"',
                    [id, i]
                );

                schedule.push({
                    installment_number: i,
                    due_date: dueDate.toISOString().split('T')[0],
                    amount: rd.monthly_amount,
                    status: payment ? 'paid' : 'pending',
                    paid_date: payment ? payment.transaction_date : null,
                    paid_amount: payment ? payment.amount : null
                });
            }

            return { success: true, schedule };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getMaturityList(daysAhead = 30) {
        try {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);

            const maturingRDs = await mainDb.all(`
                SELECT rd.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
                FROM recurring_deposits rd
                JOIN customers c ON rd.customer_id = c.id
                WHERE rd.status IN ('active', 'completed') 
                AND rd.maturity_date <= ?
                ORDER BY rd.maturity_date ASC
            `, [futureDate.toISOString().split('T')[0]]);

            return { success: true, maturing_rds: maturingRDs };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getStats() {
        try {
            const stats = await mainDb.get(`
                SELECT 
                    COUNT(*) as total_rds,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_rds,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rds,
                    COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_rds,
                    SUM(CASE WHEN status IN ('active', 'completed') THEN total_paid ELSE 0 END) as total_collected,
                    SUM(CASE WHEN status IN ('active', 'completed') THEN maturity_amount ELSE 0 END) as total_maturity_amount,
                    AVG(CASE WHEN status IN ('active', 'completed') THEN interest_rate ELSE NULL END) as avg_interest_rate
                FROM recurring_deposits
            `);

            return { success: true, stats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getDueInstallments(daysAhead = 7) {
        try {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);

            // Get all active RDs
            const activeRDs = await mainDb.all(`
                SELECT rd.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
                FROM recurring_deposits rd
                JOIN customers c ON rd.customer_id = c.id
                WHERE rd.status = 'active'
            `);

            const dueInstallments = [];

            for (const rd of activeRDs) {
                // Get last paid installment
                const lastPayment = await txnDb.get(
                    'SELECT MAX(installment_number) as last_installment FROM rd_transactions WHERE rd_id = ? AND transaction_type = "rd_installment"',
                    [rd.id]
                );

                const nextInstallmentNumber = (lastPayment.last_installment || 0) + 1;

                if (nextInstallmentNumber <= rd.tenure_months) {
                    const startDate = new Date(rd.start_date);
                    const dueDate = new Date(startDate);
                    dueDate.setMonth(dueDate.getMonth() + nextInstallmentNumber - 1);

                    if (dueDate <= futureDate) {
                        dueInstallments.push({
                            ...rd,
                            next_installment_number: nextInstallmentNumber,
                            due_date: dueDate.toISOString().split('T')[0],
                            due_amount: rd.monthly_amount
                        });
                    }
                }
            }

            return { success: true, due_installments: dueInstallments };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = RD;