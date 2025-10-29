const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const Customer = require('../models/Customer');
const AuditService = require('../utils/auditService');
const emailService = require('../utils/emailService');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminOrEmployee, canApplyInterest } = require('../middleware/roleMiddleware');

// Get all accounts
router.get('/', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const {
            customer_id,
            account_type,
            search,
            min_balance,
            max_balance,
            limit = 50,
            offset = 0
        } = req.query;

        const filters = {
            customer_id: customer_id ? parseInt(customer_id) : undefined,
            account_type,
            search,
            min_balance: min_balance ? parseFloat(min_balance) : undefined,
            max_balance: max_balance ? parseFloat(max_balance) : undefined,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const result = await Account.findAll(filters);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            accounts: result.accounts
        });
    } catch (error) {
        console.error('Get accounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get account by ID
router.get('/:id', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Account.findById(parseInt(id));

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            account: result.account
        });
    } catch (error) {
        console.error('Get account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get account by account number
router.get('/number/:accountNumber', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { accountNumber } = req.params;
        const result = await Account.findByAccountNumber(accountNumber);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            account: result.account
        });
    } catch (error) {
        console.error('Get account by number error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Create new account
router.post('/', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const accountData = req.body;
        const result = await Account.create(accountData, req.user.id);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Get customer details for logging
        const customerResult = await Customer.findById(result.account.customer_id);
        const customerName = customerResult.success ? customerResult.customer.name : 'Unknown';

        // Log account creation
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.ACCOUNT_CREATE,
            'account',
            result.account.id,
            `Created account ${result.account.account_number} for customer: ${customerName}`,
            req
        );

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            account: result.account
        });
    } catch (error) {
        console.error('Create account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Deposit money
router.post('/:id/deposit', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, description } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid deposit amount is required'
            });
        }

        const result = await Account.deposit(parseInt(id), parseFloat(amount), description, req.user.id);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Get account and customer details for logging and email
        const accountResult = await Account.findById(parseInt(id));
        if (accountResult.success) {
            const account = accountResult.account;
            
            // Log transaction
            await AuditService.logActivity(
                req.user.id,
                AuditService.ACTION_TYPES.DEPOSIT,
                'account',
                parseInt(id),
                `Deposited ₹${amount} to account ${account.account_number}`,
                req
            );

            // Send transaction alert email if customer has email
            const customerResult = await Customer.findById(account.customer_id);
            if (customerResult.success && customerResult.customer.email) {
                await emailService.sendTransactionAlert(
                    customerResult.customer.email,
                    customerResult.customer.name,
                    {
                        type: 'Deposit',
                        amount: amount,
                        date: new Date().toLocaleDateString(),
                        balance: result.new_balance,
                        reference: result.transaction.transaction_id
                    }
                );
            }
        }

        res.json({
            success: true,
            message: 'Deposit successful',
            transaction: result.transaction,
            new_balance: result.new_balance
        });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Withdraw money
router.post('/:id/withdraw', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, description } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid withdrawal amount is required'
            });
        }

        const result = await Account.withdraw(parseInt(id), parseFloat(amount), description, req.user.id);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Get account and customer details for logging and email
        const accountResult = await Account.findById(parseInt(id));
        if (accountResult.success) {
            const account = accountResult.account;
            
            // Log transaction
            await AuditService.logActivity(
                req.user.id,
                AuditService.ACTION_TYPES.WITHDRAWAL,
                'account',
                parseInt(id),
                `Withdrew ₹${amount} from account ${account.account_number}`,
                req
            );

            // Send transaction alert email if customer has email
            const customerResult = await Customer.findById(account.customer_id);
            if (customerResult.success && customerResult.customer.email) {
                await emailService.sendTransactionAlert(
                    customerResult.customer.email,
                    customerResult.customer.name,
                    {
                        type: 'Withdrawal',
                        amount: amount,
                        date: new Date().toLocaleDateString(),
                        balance: result.new_balance,
                        reference: result.transaction.transaction_id
                    }
                );
            }
        }

        res.json({
            success: true,
            message: 'Withdrawal successful',
            transaction: result.transaction,
            new_balance: result.new_balance
        });
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Transfer money between accounts
router.post('/transfer', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { from_account_id, to_account_id, amount, description } = req.body;

        if (!from_account_id || !to_account_id || !amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid from account, to account, and amount are required'
            });
        }

        if (from_account_id === to_account_id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot transfer to the same account'
            });
        }

        const result = await Account.transfer(
            parseInt(from_account_id),
            parseInt(to_account_id),
            parseFloat(amount),
            description,
            req.user.id
        );

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Log transfer
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.TRANSFER,
            'account',
            parseInt(from_account_id),
            `Transferred ₹${amount} from account ${from_account_id} to account ${to_account_id}`,
            req
        );

        res.json({
            success: true,
            message: 'Transfer successful',
            from_transaction: result.from_transaction,
            to_transaction: result.to_transaction,
            from_new_balance: result.from_new_balance,
            to_new_balance: result.to_new_balance
        });
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Apply interest (admin only)
router.post('/:id/apply-interest', authMiddleware, canApplyInterest, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Account.applyInterest(parseInt(id), req.user.id);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Get account details for logging
        const accountResult = await Account.findById(parseInt(id));
        if (accountResult.success) {
            const account = accountResult.account;
            
            // Log interest application
            await AuditService.logActivity(
                req.user.id,
                AuditService.ACTION_TYPES.INTEREST_APPLY,
                'account',
                parseInt(id),
                `Applied interest ₹${result.interest_amount} to account ${account.account_number}`,
                req
            );
        }

        res.json({
            success: true,
            message: 'Interest applied successfully',
            transaction: result.transaction,
            interest_amount: result.interest_amount,
            new_balance: result.new_balance
        });
    } catch (error) {
        console.error('Apply interest error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get transaction history
router.get('/:id/transactions', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            transaction_type,
            start_date,
            end_date,
            min_amount,
            max_amount,
            limit = 50,
            offset = 0
        } = req.query;

        const filters = {
            transaction_type,
            start_date,
            end_date,
            min_amount: min_amount ? parseFloat(min_amount) : undefined,
            max_amount: max_amount ? parseFloat(max_amount) : undefined,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        const result = await Account.getTransactionHistory(parseInt(id), filters);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            transactions: result.transactions
        });
    } catch (error) {
        console.error('Get transaction history error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get account statement
router.get('/:id/statement', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { id } = req.params;
        const { start_date, end_date } = req.query;

        const filters = {
            start_date,
            end_date
        };

        const Transaction = require('../models/Transaction');
        const result = await Transaction.getAccountStatement(parseInt(id), filters);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.error
            });
        }

        // Log statement generation
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.REPORT_GENERATE,
            'account',
            parseInt(id),
            `Generated account statement for account ${result.account.account_number}`,
            req
        );

        res.json({
            success: true,
            statement: {
                account: result.account,
                transactions: result.transactions,
                opening_balance: result.opening_balance,
                closing_balance: result.closing_balance,
                period: {
                    start_date: start_date || 'Beginning',
                    end_date: end_date || 'Current'
                },
                generated_at: new Date().toISOString(),
                generated_by: req.user.name
            }
        });
    } catch (error) {
        console.error('Get account statement error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Delete account (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Only admin can delete accounts
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can delete accounts'
            });
        }

        // Get account details for logging
        const existingAccount = await Account.findById(parseInt(id));
        if (!existingAccount.success) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }

        const result = await Account.delete(parseInt(id));

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Log account deletion
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.ACCOUNT_DELETE,
            'account',
            parseInt(id),
            `Deleted account: ${existingAccount.account.account_number}`,
            req
        );

        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get account statistics
router.get('/stats/overview', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const result = await Account.getStats();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            stats: result.stats
        });
    } catch (error) {
        console.error('Get account stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Bulk interest application (admin only)
router.post('/bulk/apply-interest', authMiddleware, canApplyInterest, async (req, res) => {
    try {
        const { account_ids } = req.body;

        if (!Array.isArray(account_ids) || account_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid account IDs array is required'
            });
        }

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        for (const accountId of account_ids) {
            try {
                const result = await Account.applyInterest(parseInt(accountId), req.user.id);
                if (result.success) {
                    successCount++;
                    results.push({
                        account_id: accountId,
                        success: true,
                        interest_amount: result.interest_amount,
                        new_balance: result.new_balance
                    });
                } else {
                    failureCount++;
                    results.push({
                        account_id: accountId,
                        success: false,
                        error: result.error
                    });
                }
            } catch (error) {
                failureCount++;
                results.push({
                    account_id: accountId,
                    success: false,
                    error: error.message
                });
            }
        }

        // Log bulk interest application
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.INTEREST_APPLY,
            'system',
            null,
            `Bulk interest application: ${successCount} successful, ${failureCount} failed`,
            req
        );

        res.json({
            success: true,
            message: `Bulk interest application completed: ${successCount} successful, ${failureCount} failed`,
            results,
            summary: {
                total_accounts: account_ids.length,
                successful: successCount,
                failed: failureCount
            }
        });
    } catch (error) {
        console.error('Bulk apply interest error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;