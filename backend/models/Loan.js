const mainDb = require('../config/db_main');
const txnDb = require('../config/db_txn');

class Loan {
    static async create(loanData, createdBy) {
        try {
            const {
                customer_id,
                loan_type,
                principal_amount,
                interest_rate,
                tenure_months
            } = loanData;

            // Validate required fields
            if (!customer_id || !loan_type || !principal_amount || !interest_rate || !tenure_months) {
                throw new Error('All loan details are required');
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

            // Validate loan type
            const validLoanTypes = ['personal', 'home', 'vehicle', 'business', 'education', 'gold'];
            if (!validLoanTypes.includes(loan_type)) {
                throw new Error('Invalid loan type');
            }

            // Generate unique loan number
            const loan_number = await this.generateLoanNumber();

            // Calculate EMI and total amount
            const emi_amount = this.calculateEMI(principal_amount, interest_rate, tenure_months);
            const total_amount = emi_amount * tenure_months;

            // Calculate dates
            const start_date = new Date();
            const end_date = new Date(start_date);
            end_date.setMonth(end_date.getMonth() + tenure_months);

            // Insert loan
            const result = await mainDb.run(
                `INSERT INTO loans (
                    loan_number, customer_id, loan_type, principal_amount, interest_rate,
                    tenure_months, emi_amount, total_amount, outstanding_amount,
                    start_date, end_date, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    loan_number, customer_id, loan_type, principal_amount, interest_rate,
                    tenure_months, emi_amount, total_amount, total_amount,
                    start_date.toISOString().split('T')[0], 
                    end_date.toISOString().split('T')[0], createdBy
                ]
            );

            // Create loan disbursement transaction
            await this.createLoanTransaction({
                loan_id: result.id,
                customer_id,
                transaction_type: 'loan_disbursement',
                amount: principal_amount,
                principal_amount: principal_amount,
                interest_amount: 0,
                outstanding_before: 0,
                outstanding_after: total_amount,
                description: `Loan disbursed - ${loan_number}`,
                processed_by: createdBy
            });

            return {
                success: true,
                loan: {
                    id: result.id,
                    loan_number,
                    customer_id,
                    loan_type,
                    principal_amount,
                    interest_rate,
                    tenure_months,
                    emi_amount,
                    total_amount,
                    outstanding_amount: total_amount,
                    start_date: start_date.toISOString().split('T')[0],
                    end_date: end_date.toISOString().split('T')[0],
                    status: 'active',
                    created_by: createdBy
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async generateLoanNumber() {
        const prefix = 'LN';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const loanNumber = `${prefix}${timestamp}${random}`;

        // Check if loan number already exists
        const existing = await mainDb.get('SELECT id FROM loans WHERE loan_number = ?', [loanNumber]);
        if (existing) {
            return await this.generateLoanNumber();
        }

        return loanNumber;
    }

    static calculateEMI(principal, rate, months) {
        // EMI calculation: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
        // Where P = principal, r = monthly interest rate, n = number of months
        const monthlyRate = rate / 100 / 12;
        const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
        return Math.round(emi * 100) / 100; // Round to 2 decimal places
    }

    static async findById(id) {
        try {
            const loan = await mainDb.get(`
                SELECT l.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM loans l
                JOIN customers c ON l.customer_id = c.id
                LEFT JOIN users u ON l.created_by = u.id
                WHERE l.id = ?
            `, [id]);

            if (!loan) {
                return { success: false, error: 'Loan not found' };
            }

            return { success: true, loan };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findByLoanNumber(loanNumber) {
        try {
            const loan = await mainDb.get(`
                SELECT l.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM loans l
                JOIN customers c ON l.customer_id = c.id
                LEFT JOIN users u ON l.created_by = u.id
                WHERE l.loan_number = ?
            `, [loanNumber]);

            if (!loan) {
                return { success: false, error: 'Loan not found' };
            }

            return { success: true, loan };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT l.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
                FROM loans l
                JOIN customers c ON l.customer_id = c.id
                LEFT JOIN users u ON l.created_by = u.id
                WHERE 1=1
            `;
            const params = [];

            // Apply filters
            if (filters.customer_id) {
                query += ' AND l.customer_id = ?';
                params.push(filters.customer_id);
            }

            if (filters.loan_type) {
                query += ' AND l.loan_type = ?';
                params.push(filters.loan_type);
            }

            if (filters.status) {
                query += ' AND l.status = ?';
                params.push(filters.status);
            }

            if (filters.search) {
                query += ' AND (l.loan_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            if (filters.min_amount !== undefined) {
                query += ' AND l.principal_amount >= ?';
                params.push(filters.min_amount);
            }

            if (filters.max_amount !== undefined) {
                query += ' AND l.principal_amount <= ?';
                params.push(filters.max_amount);
            }

            query += ' ORDER BY l.created_at DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
                
                if (filters.offset) {
                    query += ' OFFSET ?';
                    params.push(filters.offset);
                }
            }

            const loans = await mainDb.all(query, params);

            return { success: true, loans };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async makePayment(id, amount, processedBy, emiNumber = null) {
        try {
            // Get loan details
            const loanResult = await this.findById(id);
            if (!loanResult.success) {
                return loanResult;
            }

            const loan = loanResult.loan;

            if (loan.status !== 'active') {
                throw new Error('Loan is not active');
            }

            // Validate amount
            if (amount <= 0) {
                throw new Error('Payment amount must be positive');
            }

            const outstandingBefore = parseFloat(loan.outstanding_amount);

            if (amount > outstandingBefore) {
                throw new Error('Payment amount cannot exceed outstanding amount');
            }

            // Calculate principal and interest components
            const monthlyRate = loan.interest_rate / 100 / 12;
            const interestAmount = outstandingBefore * monthlyRate;
            const principalAmount = Math.max(0, amount - interestAmount);

            const outstandingAfter = outstandingBefore - amount;

            // Update loan outstanding amount
            await mainDb.run(
                'UPDATE loans SET outstanding_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [outstandingAfter, id]
            );

            // Calculate EMI number if not provided
            if (!emiNumber) {
                const paidEMIs = await txnDb.get(
                    'SELECT COUNT(*) as count FROM loan_transactions WHERE loan_id = ? AND transaction_type = "loan_payment"',
                    [id]
                );
                emiNumber = paidEMIs.count + 1;
            }

            // Create loan transaction record
            const transaction = await this.createLoanTransaction({
                loan_id: id,
                customer_id: loan.customer_id,
                transaction_type: 'loan_payment',
                amount,
                principal_amount: principalAmount,
                interest_amount: interestAmount,
                outstanding_before: outstandingBefore,
                outstanding_after: outstandingAfter,
                emi_number: emiNumber,
                description: `Loan payment EMI #${emiNumber} - ${loan.loan_number}`,
                processed_by: processedBy
            });

            // Check if loan is fully paid
            if (outstandingAfter <= 0.01) { // Allow for small rounding differences
                await mainDb.run(
                    'UPDATE loans SET status = ?, outstanding_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    ['closed', id]
                );
            }

            return {
                success: true,
                transaction,
                outstanding_amount: outstandingAfter,
                principal_paid: principalAmount,
                interest_paid: interestAmount,
                emi_number: emiNumber,
                loan_closed: outstandingAfter <= 0.01
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async foreclose(id, processedBy) {
        try {
            // Get loan details
            const loanResult = await this.findById(id);
            if (!loanResult.success) {
                return loanResult;
            }

            const loan = loanResult.loan;

            if (loan.status !== 'active') {
                throw new Error('Loan is not active');
            }

            const outstandingAmount = parseFloat(loan.outstanding_amount);

            if (outstandingAmount <= 0) {
                throw new Error('Loan is already fully paid');
            }

            // Calculate foreclosure amount (may include penalty)
            const foreclosureAmount = outstandingAmount; // Can add penalty logic here

            // Update loan status
            await mainDb.run(
                'UPDATE loans SET status = ?, outstanding_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['foreclosed', id]
            );

            // Create foreclosure transaction
            const transaction = await this.createLoanTransaction({
                loan_id: id,
                customer_id: loan.customer_id,
                transaction_type: 'loan_foreclose',
                amount: foreclosureAmount,
                principal_amount: foreclosureAmount,
                interest_amount: 0,
                outstanding_before: outstandingAmount,
                outstanding_after: 0,
                description: `Loan foreclosed - ${loan.loan_number}`,
                processed_by: processedBy
            });

            return {
                success: true,
                transaction,
                foreclosure_amount: foreclosureAmount
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async createLoanTransaction(transactionData) {
        const transactionId = `LNTXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
        
        const result = await txnDb.run(
            `INSERT INTO loan_transactions (
                transaction_id, loan_id, customer_id, transaction_type, amount,
                principal_amount, interest_amount, outstanding_before, outstanding_after,
                emi_number, description, processed_by, transaction_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
                transactionId,
                transactionData.loan_id,
                transactionData.customer_id,
                transactionData.transaction_type,
                transactionData.amount,
                transactionData.principal_amount,
                transactionData.interest_amount,
                transactionData.outstanding_before,
                transactionData.outstanding_after,
                transactionData.emi_number || null,
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

    static async getTransactionHistory(loanId, filters = {}) {
        try {
            let query = `
                SELECT lt.*, u.name as processed_by_name
                FROM loan_transactions lt
                LEFT JOIN users u ON lt.processed_by = u.id
                WHERE lt.loan_id = ?
            `;
            const params = [loanId];

            if (filters.transaction_type) {
                query += ' AND lt.transaction_type = ?';
                params.push(filters.transaction_type);
            }

            query += ' ORDER BY lt.transaction_date DESC';

            const transactions = await txnDb.all(query, params);

            return { success: true, transactions };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getEMISchedule(id) {
        try {
            const loanResult = await this.findById(id);
            if (!loanResult.success) {
                return loanResult;
            }

            const loan = loanResult.loan;
            const schedule = [];
            const startDate = new Date(loan.start_date);
            let outstandingBalance = parseFloat(loan.total_amount);
            const monthlyRate = loan.interest_rate / 100 / 12;

            for (let i = 1; i <= loan.tenure_months; i++) {
                const dueDate = new Date(startDate);
                dueDate.setMonth(dueDate.getMonth() + i - 1);

                const interestAmount = outstandingBalance * monthlyRate;
                const principalAmount = loan.emi_amount - interestAmount;
                outstandingBalance -= principalAmount;

                // Check if EMI is paid
                const payment = await txnDb.get(
                    'SELECT * FROM loan_transactions WHERE loan_id = ? AND emi_number = ? AND transaction_type = "loan_payment"',
                    [id, i]
                );

                schedule.push({
                    emi_number: i,
                    due_date: dueDate.toISOString().split('T')[0],
                    emi_amount: loan.emi_amount,
                    principal_amount: Math.round(principalAmount * 100) / 100,
                    interest_amount: Math.round(interestAmount * 100) / 100,
                    outstanding_balance: Math.max(0, Math.round(outstandingBalance * 100) / 100),
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

    static async getDueEMIs(daysAhead = 7) {
        try {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);

            // Get all active loans
            const activeLoans = await mainDb.all(`
                SELECT l.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
                FROM loans l
                JOIN customers c ON l.customer_id = c.id
                WHERE l.status = 'active'
            `);

            const dueEMIs = [];

            for (const loan of activeLoans) {
                // Get last paid EMI
                const lastPayment = await txnDb.get(
                    'SELECT MAX(emi_number) as last_emi FROM loan_transactions WHERE loan_id = ? AND transaction_type = "loan_payment"',
                    [loan.id]
                );

                const nextEMINumber = (lastPayment.last_emi || 0) + 1;

                if (nextEMINumber <= loan.tenure_months) {
                    const startDate = new Date(loan.start_date);
                    const dueDate = new Date(startDate);
                    dueDate.setMonth(dueDate.getMonth() + nextEMINumber - 1);

                    if (dueDate <= futureDate) {
                        dueEMIs.push({
                            ...loan,
                            next_emi_number: nextEMINumber,
                            due_date: dueDate.toISOString().split('T')[0],
                            due_amount: loan.emi_amount
                        });
                    }
                }
            }

            return { success: true, due_emis: dueEMIs };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getStats() {
        try {
            const stats = await mainDb.get(`
                SELECT 
                    COUNT(*) as total_loans,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_loans,
                    COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_loans,
                    COUNT(CASE WHEN status = 'foreclosed' THEN 1 END) as foreclosed_loans,
                    SUM(CASE WHEN status = 'active' THEN principal_amount ELSE 0 END) as total_disbursed,
                    SUM(CASE WHEN status = 'active' THEN outstanding_amount ELSE 0 END) as total_outstanding,
                    AVG(CASE WHEN status = 'active' THEN interest_rate ELSE NULL END) as avg_interest_rate
                FROM loans
            `);

            // Get loan type distribution
            const loanTypes = await mainDb.all(`
                SELECT loan_type, COUNT(*) as count, SUM(principal_amount) as total_amount
                FROM loans 
                WHERE status = 'active'
                GROUP BY loan_type
            `);

            return { 
                success: true, 
                stats: {
                    ...stats,
                    loan_types: loanTypes
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async update(id, updateData) {
        try {
            const { interest_rate, emi_amount } = updateData;

            // Check if loan exists and is active
            const loanResult = await this.findById(id);
            if (!loanResult.success) {
                return loanResult;
            }

            const loan = loanResult.loan;
            if (loan.status !== 'active') {
                throw new Error('Can only update active loans');
            }

            const updateFields = [];
            const params = [];

            if (interest_rate !== undefined) {
                if (interest_rate <= 0) {
                    throw new Error('Interest rate must be positive');
                }
                updateFields.push('interest_rate = ?');
                params.push(interest_rate);

                // Recalculate EMI if interest rate changes
                const newEMI = this.calculateEMI(loan.principal_amount, interest_rate, loan.tenure_months);
                updateFields.push('emi_amount = ?');
                params.push(newEMI);

                // Recalculate total amount
                const newTotalAmount = newEMI * loan.tenure_months;
                updateFields.push('total_amount = ?');
                params.push(newTotalAmount);

                // Update outstanding amount proportionally
                const paidAmount = loan.total_amount - loan.outstanding_amount;
                const newOutstanding = newTotalAmount - paidAmount;
                updateFields.push('outstanding_amount = ?');
                params.push(Math.max(0, newOutstanding));
            }

            if (emi_amount !== undefined && interest_rate === undefined) {
                if (emi_amount <= 0) {
                    throw new Error('EMI amount must be positive');
                }
                updateFields.push('emi_amount = ?');
                params.push(emi_amount);

                // Recalculate total amount
                const newTotalAmount = emi_amount * loan.tenure_months;
                updateFields.push('total_amount = ?');
                params.push(newTotalAmount);

                // Update outstanding amount proportionally
                const paidAmount = loan.total_amount - loan.outstanding_amount;
                const newOutstanding = newTotalAmount - paidAmount;
                updateFields.push('outstanding_amount = ?');
                params.push(Math.max(0, newOutstanding));
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            const query = `UPDATE loans SET ${updateFields.join(', ')} WHERE id = ?`;
            await mainDb.run(query, params);

            return await this.findById(id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = Loan;