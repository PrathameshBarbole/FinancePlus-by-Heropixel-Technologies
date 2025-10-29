const mainDb = require('../config/db_main');

class Customer {
    static async create(customerData, createdBy) {
        try {
            const {
                name, phone, email, dob, aadhaar, pan, address,
                inheritor_name, inheritor_relation, inheritor_contact,
                profile_photo, aadhaar_doc, pan_doc, address_proof, signature
            } = customerData;

            // Validate required fields
            if (!name || !phone) {
                throw new Error('Name and phone are required');
            }

            // Validate phone number
            const phoneRegex = /^[6-9]\d{9}$/;
            if (!phoneRegex.test(phone)) {
                throw new Error('Invalid phone number format');
            }

            // Validate email if provided
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new Error('Invalid email format');
                }
            }

            // Validate Aadhaar if provided
            if (aadhaar) {
                const aadhaarRegex = /^\d{12}$/;
                if (!aadhaarRegex.test(aadhaar)) {
                    throw new Error('Invalid Aadhaar number format');
                }

                // Check if Aadhaar already exists
                const existingAadhaar = await mainDb.get('SELECT id FROM customers WHERE aadhaar = ? AND is_active = 1', [aadhaar]);
                if (existingAadhaar) {
                    throw new Error('Aadhaar number already exists');
                }
            }

            // Validate PAN if provided
            if (pan) {
                const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
                if (!panRegex.test(pan)) {
                    throw new Error('Invalid PAN format');
                }

                // Check if PAN already exists
                const existingPan = await mainDb.get('SELECT id FROM customers WHERE pan = ? AND is_active = 1', [pan]);
                if (existingPan) {
                    throw new Error('PAN already exists');
                }
            }

            // Check if phone already exists
            const existingPhone = await mainDb.get('SELECT id FROM customers WHERE phone = ? AND is_active = 1', [phone]);
            if (existingPhone) {
                throw new Error('Phone number already exists');
            }

            // Insert customer
            const result = await mainDb.run(
                `INSERT INTO customers (
                    name, phone, email, dob, aadhaar, pan, address,
                    inheritor_name, inheritor_relation, inheritor_contact,
                    profile_photo, aadhaar_doc, pan_doc, address_proof, signature,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    name, phone, email, dob, aadhaar, pan, address,
                    inheritor_name, inheritor_relation, inheritor_contact,
                    profile_photo, aadhaar_doc, pan_doc, address_proof, signature,
                    createdBy
                ]
            );

            return {
                success: true,
                customer: {
                    id: result.id,
                    name, phone, email, dob, aadhaar, pan, address,
                    inheritor_name, inheritor_relation, inheritor_contact,
                    profile_photo, aadhaar_doc, pan_doc, address_proof, signature,
                    is_active: true,
                    created_by: createdBy
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findById(id) {
        try {
            const customer = await mainDb.get(
                `SELECT c.*, u.name as created_by_name 
                 FROM customers c 
                 LEFT JOIN users u ON c.created_by = u.id 
                 WHERE c.id = ?`,
                [id]
            );

            if (!customer) {
                return { success: false, error: 'Customer not found' };
            }

            return { success: true, customer };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findAll(filters = {}) {
        try {
            let query = `
                SELECT c.*, u.name as created_by_name 
                FROM customers c 
                LEFT JOIN users u ON c.created_by = u.id 
                WHERE c.is_active = 1
            `;
            const params = [];

            // Apply filters
            if (filters.search) {
                query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.aadhaar LIKE ?)`;
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            if (filters.created_by) {
                query += ' AND c.created_by = ?';
                params.push(filters.created_by);
            }

            query += ' ORDER BY c.created_at DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
                
                if (filters.offset) {
                    query += ' OFFSET ?';
                    params.push(filters.offset);
                }
            }

            const customers = await mainDb.all(query, params);

            // Get total count for pagination
            let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE is_active = 1';
            const countParams = [];

            if (filters.search) {
                countQuery += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR aadhaar LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            if (filters.created_by) {
                countQuery += ' AND created_by = ?';
                countParams.push(filters.created_by);
            }

            const countResult = await mainDb.get(countQuery, countParams);

            return { 
                success: true, 
                customers,
                total: countResult.total,
                limit: filters.limit || customers.length,
                offset: filters.offset || 0
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async update(id, updateData) {
        try {
            const {
                name, phone, email, dob, aadhaar, pan, address,
                inheritor_name, inheritor_relation, inheritor_contact,
                profile_photo, aadhaar_doc, pan_doc, address_proof, signature
            } = updateData;

            // Check if customer exists
            const existingCustomer = await this.findById(id);
            if (!existingCustomer.success) {
                return existingCustomer;
            }

            // Validate phone if provided
            if (phone) {
                const phoneRegex = /^[6-9]\d{9}$/;
                if (!phoneRegex.test(phone)) {
                    throw new Error('Invalid phone number format');
                }

                // Check if phone is already taken by another customer
                const phoneCheck = await mainDb.get('SELECT id FROM customers WHERE phone = ? AND id != ? AND is_active = 1', [phone, id]);
                if (phoneCheck) {
                    throw new Error('Phone number already exists');
                }
            }

            // Validate email if provided
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new Error('Invalid email format');
                }
            }

            // Validate Aadhaar if provided
            if (aadhaar) {
                const aadhaarRegex = /^\d{12}$/;
                if (!aadhaarRegex.test(aadhaar)) {
                    throw new Error('Invalid Aadhaar number format');
                }

                const aadhaarCheck = await mainDb.get('SELECT id FROM customers WHERE aadhaar = ? AND id != ? AND is_active = 1', [aadhaar, id]);
                if (aadhaarCheck) {
                    throw new Error('Aadhaar number already exists');
                }
            }

            // Validate PAN if provided
            if (pan) {
                const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
                if (!panRegex.test(pan)) {
                    throw new Error('Invalid PAN format');
                }

                const panCheck = await mainDb.get('SELECT id FROM customers WHERE pan = ? AND id != ? AND is_active = 1', [pan, id]);
                if (panCheck) {
                    throw new Error('PAN already exists');
                }
            }

            // Build update query dynamically
            const updateFields = [];
            const params = [];

            if (name !== undefined) {
                updateFields.push('name = ?');
                params.push(name);
            }

            if (phone !== undefined) {
                updateFields.push('phone = ?');
                params.push(phone);
            }

            if (email !== undefined) {
                updateFields.push('email = ?');
                params.push(email);
            }

            if (dob !== undefined) {
                updateFields.push('dob = ?');
                params.push(dob);
            }

            if (aadhaar !== undefined) {
                updateFields.push('aadhaar = ?');
                params.push(aadhaar);
            }

            if (pan !== undefined) {
                updateFields.push('pan = ?');
                params.push(pan);
            }

            if (address !== undefined) {
                updateFields.push('address = ?');
                params.push(address);
            }

            if (inheritor_name !== undefined) {
                updateFields.push('inheritor_name = ?');
                params.push(inheritor_name);
            }

            if (inheritor_relation !== undefined) {
                updateFields.push('inheritor_relation = ?');
                params.push(inheritor_relation);
            }

            if (inheritor_contact !== undefined) {
                updateFields.push('inheritor_contact = ?');
                params.push(inheritor_contact);
            }

            if (profile_photo !== undefined) {
                updateFields.push('profile_photo = ?');
                params.push(profile_photo);
            }

            if (aadhaar_doc !== undefined) {
                updateFields.push('aadhaar_doc = ?');
                params.push(aadhaar_doc);
            }

            if (pan_doc !== undefined) {
                updateFields.push('pan_doc = ?');
                params.push(pan_doc);
            }

            if (address_proof !== undefined) {
                updateFields.push('address_proof = ?');
                params.push(address_proof);
            }

            if (signature !== undefined) {
                updateFields.push('signature = ?');
                params.push(signature);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            const query = `UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`;
            await mainDb.run(query, params);

            // Return updated customer
            return await this.findById(id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async delete(id) {
        try {
            // Check if customer exists
            const existingCustomer = await this.findById(id);
            if (!existingCustomer.success) {
                return existingCustomer;
            }

            // Check if customer has active accounts, FDs, RDs, or loans
            const activeAccounts = await mainDb.get('SELECT COUNT(*) as count FROM accounts WHERE customer_id = ? AND is_active = 1', [id]);
            const activeFDs = await mainDb.get('SELECT COUNT(*) as count FROM fixed_deposits WHERE customer_id = ? AND status = "active"', [id]);
            const activeRDs = await mainDb.get('SELECT COUNT(*) as count FROM recurring_deposits WHERE customer_id = ? AND status = "active"', [id]);
            const activeLoans = await mainDb.get('SELECT COUNT(*) as count FROM loans WHERE customer_id = ? AND status = "active"', [id]);

            if (activeAccounts.count > 0 || activeFDs.count > 0 || activeRDs.count > 0 || activeLoans.count > 0) {
                throw new Error('Cannot delete customer with active accounts, FDs, RDs, or loans');
            }

            // Soft delete - set is_active to false
            await mainDb.run(
                'UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [id]
            );

            return { success: true, message: 'Customer deleted successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getStats() {
        try {
            const stats = await mainDb.get(`
                SELECT 
                    COUNT(*) as total_customers,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_customers,
                    COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_customers,
                    COUNT(CASE WHEN created_at >= date('now', '-30 days') THEN 1 END) as new_this_month
                FROM customers
            `);

            return { success: true, stats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async searchByAccountNumber(accountNumber) {
        try {
            const customer = await mainDb.get(`
                SELECT c.*, a.account_number, a.balance, u.name as created_by_name
                FROM customers c
                JOIN accounts a ON c.id = a.customer_id
                LEFT JOIN users u ON c.created_by = u.id
                WHERE a.account_number = ? AND c.is_active = 1 AND a.is_active = 1
            `, [accountNumber]);

            if (!customer) {
                return { success: false, error: 'Customer not found with this account number' };
            }

            return { success: true, customer };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getCustomerSummary(id) {
        try {
            const customer = await this.findById(id);
            if (!customer.success) {
                return customer;
            }

            // Get accounts summary
            const accounts = await mainDb.all(`
                SELECT account_number, account_type, balance, is_active
                FROM accounts 
                WHERE customer_id = ?
            `, [id]);

            // Get FDs summary
            const fds = await mainDb.all(`
                SELECT fd_number, principal_amount, interest_rate, maturity_amount, status, maturity_date
                FROM fixed_deposits 
                WHERE customer_id = ?
            `, [id]);

            // Get RDs summary
            const rds = await mainDb.all(`
                SELECT rd_number, monthly_amount, interest_rate, maturity_amount, status, maturity_date, total_paid
                FROM recurring_deposits 
                WHERE customer_id = ?
            `, [id]);

            // Get Loans summary
            const loans = await mainDb.all(`
                SELECT loan_number, loan_type, principal_amount, interest_rate, emi_amount, outstanding_amount, status
                FROM loans 
                WHERE customer_id = ?
            `, [id]);

            return {
                success: true,
                summary: {
                    customer: customer.customer,
                    accounts,
                    fixed_deposits: fds,
                    recurring_deposits: rds,
                    loans
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = Customer;