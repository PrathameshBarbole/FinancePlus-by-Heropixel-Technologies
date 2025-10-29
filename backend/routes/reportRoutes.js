const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const FD = require('../models/FD');
const RD = require('../models/RD');
const Loan = require('../models/Loan');
const { authMiddleware } = require('../middleware/authMiddleware');
const { auditLog } = require('../utils/auditService');

// Get dashboard statistics
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const stats = {
      customers: {
        total: await Customer.getCount(),
        active: await Customer.getCount({ isActive: true }),
        new_this_month: await Customer.getCountByDateRange('thisMonth')
      },
      accounts: {
        total: await Account.getCount(),
        active: await Account.getCount({ status: 'active' }),
        total_balance: await Account.getTotalBalance()
      },
      transactions: {
        today: await Transaction.getCountByDate(new Date().toISOString().split('T')[0]),
        this_month: await Transaction.getCountByDateRange('thisMonth'),
        total_deposits_today: await Transaction.getTotalByTypeAndDate('deposit', new Date().toISOString().split('T')[0]),
        total_withdrawals_today: await Transaction.getTotalByTypeAndDate('withdrawal', new Date().toISOString().split('T')[0])
      },
      deposits: {
        fd_count: await FD.getCount({ status: 'active' }),
        rd_count: await RD.getCount({ status: 'active' }),
        fd_total_amount: await FD.getTotalAmount({ status: 'active' }),
        rd_total_amount: await RD.getTotalAmount({ status: 'active' })
      },
      loans: {
        active_count: await Loan.getCount({ status: 'active' }),
        total_disbursed: await Loan.getTotalAmount({ status: 'active' }),
        total_outstanding: await Loan.getTotalOutstanding(),
        overdue_count: await Loan.getOverdueCount()
      }
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics' });
  }
});

// Get customer statement
router.get('/customer/:customerId/statement', authMiddleware, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate, accountId } = req.query;

    // Verify customer exists
    const customer = await Customer.getById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Get customer accounts
    const accounts = await Account.getByCustomerId(customerId);
    
    // Get transactions
    const filters = { customerId };
    if (accountId) filters.accountId = accountId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const transactions = await Transaction.getAll(filters);

    // Get FDs, RDs, and Loans
    const fds = await FD.getByCustomerId(customerId);
    const rds = await RD.getByCustomerId(customerId);
    const loans = await Loan.getByCustomerId(customerId);

    const statement = {
      customer,
      accounts,
      transactions,
      deposits: { fds, rds },
      loans,
      summary: {
        total_balance: accounts.reduce((sum, acc) => sum + acc.balance, 0),
        total_fd_amount: fds.filter(fd => fd.status === 'active').reduce((sum, fd) => sum + fd.amount, 0),
        total_rd_amount: rds.filter(rd => rd.status === 'active').reduce((sum, rd) => sum + rd.totalDeposited, 0),
        total_loan_outstanding: loans.filter(loan => loan.status === 'active').reduce((sum, loan) => sum + loan.remainingAmount, 0)
      },
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || new Date().toISOString().split('T')[0]
      }
    };

    // Log the action
    await auditLog(req.user.id, 'GENERATE', 'REPORT', `Generated customer statement for ${customerId}`);

    res.json({ success: true, data: statement });
  } catch (error) {
    console.error('Error generating customer statement:', error);
    res.status(500).json({ success: false, message: 'Failed to generate customer statement' });
  }
});

// Get account passbook
router.get('/account/:accountId/passbook', authMiddleware, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    // Verify account exists
    const account = await Account.getById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Get customer details
    const customer = await Customer.getById(account.customerId);

    // Get transactions
    const filters = { accountId };
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const transactions = await Transaction.getAll(filters, 1, parseInt(limit));

    const passbook = {
      account,
      customer,
      transactions,
      summary: {
        opening_balance: account.balance - transactions.reduce((sum, txn) => {
          return txn.type === 'deposit' || txn.type === 'transfer_in' || txn.type === 'interest' 
            ? sum + txn.amount 
            : sum - txn.amount;
        }, 0),
        closing_balance: account.balance,
        total_deposits: transactions.filter(t => ['deposit', 'transfer_in', 'interest'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0),
        total_withdrawals: transactions.filter(t => ['withdrawal', 'transfer_out'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0),
        transaction_count: transactions.length
      },
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || new Date().toISOString().split('T')[0]
      }
    };

    // Log the action
    await auditLog(req.user.id, 'GENERATE', 'REPORT', `Generated passbook for account ${accountId}`);

    res.json({ success: true, data: passbook });
  } catch (error) {
    console.error('Error generating passbook:', error);
    res.status(500).json({ success: false, message: 'Failed to generate passbook' });
  }
});

// Get FD maturity report
router.get('/fd/maturity', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, status = 'active' } = req.query;

    const filters = { status };
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const fds = await FD.getAll(filters);
    
    // Filter by maturity date if date range provided
    let filteredFds = fds;
    if (startDate || endDate) {
      filteredFds = fds.filter(fd => {
        const maturityDate = new Date(fd.maturityDate);
        const start = startDate ? new Date(startDate) : new Date('1900-01-01');
        const end = endDate ? new Date(endDate) : new Date('2100-12-31');
        return maturityDate >= start && maturityDate <= end;
      });
    }

    // Sort by maturity date
    filteredFds.sort((a, b) => new Date(a.maturityDate) - new Date(b.maturityDate));

    // Add customer details
    const fdsWithCustomers = await Promise.all(
      filteredFds.map(async (fd) => {
        const customer = await Customer.getById(fd.customerId);
        return { ...fd, customer };
      })
    );

    const report = {
      fds: fdsWithCustomers,
      summary: {
        total_count: fdsWithCustomers.length,
        total_amount: fdsWithCustomers.reduce((sum, fd) => sum + fd.amount, 0),
        total_maturity_amount: fdsWithCustomers.reduce((sum, fd) => sum + fd.maturityAmount, 0),
        maturing_this_month: fdsWithCustomers.filter(fd => {
          const maturityDate = new Date(fd.maturityDate);
          const now = new Date();
          return maturityDate.getMonth() === now.getMonth() && maturityDate.getFullYear() === now.getFullYear();
        }).length
      },
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time'
      }
    };

    // Log the action
    await auditLog(req.user.id, 'GENERATE', 'REPORT', 'Generated FD maturity report');

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating FD maturity report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate FD maturity report' });
  }
});

// Get loan EMI schedule report
router.get('/loan/:loanId/schedule', authMiddleware, async (req, res) => {
  try {
    const { loanId } = req.params;

    const loan = await Loan.getById(loanId);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    const customer = await Customer.getById(loan.customerId);

    // Generate EMI schedule
    const schedule = [];
    const startDate = new Date(loan.disbursementDate);
    let remainingPrincipal = loan.amount;
    const monthlyRate = loan.interestRate / (12 * 100);

    for (let i = 1; i <= loan.tenure; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      let interestAmount, principalAmount;
      
      if (monthlyRate === 0) {
        interestAmount = 0;
        principalAmount = loan.amount / loan.tenure;
      } else {
        interestAmount = remainingPrincipal * monthlyRate;
        principalAmount = loan.emi - interestAmount;
      }

      remainingPrincipal -= principalAmount;

      schedule.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split('T')[0],
        emiAmount: loan.emi,
        principalAmount: parseFloat(principalAmount.toFixed(2)),
        interestAmount: parseFloat(interestAmount.toFixed(2)),
        remainingPrincipal: parseFloat(Math.max(0, remainingPrincipal).toFixed(2)),
        status: i <= loan.installmentsPaid ? 'paid' : 'pending'
      });
    }

    const report = {
      loan,
      customer,
      schedule,
      summary: {
        total_installments: loan.tenure,
        paid_installments: loan.installmentsPaid,
        remaining_installments: loan.tenure - loan.installmentsPaid,
        total_amount: loan.totalAmount,
        amount_paid: loan.amountPaid,
        remaining_amount: loan.remainingAmount
      }
    };

    // Log the action
    await auditLog(req.user.id, 'GENERATE', 'REPORT', `Generated EMI schedule for loan ${loanId}`);

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating loan schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to generate loan schedule' });
  }
});

// Get overdue loans report
router.get('/loans/overdue', authMiddleware, async (req, res) => {
  try {
    const overdueLoans = await Loan.getOverdue();
    
    // Add customer details
    const loansWithCustomers = await Promise.all(
      overdueLoans.map(async (loan) => {
        const customer = await Customer.getById(loan.customerId);
        return { ...loan, customer };
      })
    );

    const report = {
      loans: loansWithCustomers,
      summary: {
        total_count: loansWithCustomers.length,
        total_overdue_amount: loansWithCustomers.reduce((sum, loan) => sum + loan.remainingAmount, 0),
        total_emi_amount: loansWithCustomers.reduce((sum, loan) => sum + loan.emi, 0)
      }
    };

    // Log the action
    await auditLog(req.user.id, 'GENERATE', 'REPORT', 'Generated overdue loans report');

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating overdue loans report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate overdue loans report' });
  }
});

// Get daily cash report
router.get('/cash/daily', authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const summary = await Transaction.getDailySummary(targetDate);
    const transactions = await Transaction.getAll({ 
      startDate: targetDate, 
      endDate: targetDate 
    });

    // Group transactions by type
    const groupedTransactions = {
      deposits: transactions.filter(t => t.type === 'deposit'),
      withdrawals: transactions.filter(t => t.type === 'withdrawal'),
      transfers: transactions.filter(t => ['transfer_in', 'transfer_out'].includes(t.type)),
      interest: transactions.filter(t => t.type === 'interest'),
      others: transactions.filter(t => !['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'interest'].includes(t.type))
    };

    const report = {
      date: targetDate,
      summary,
      transactions: groupedTransactions,
      totals: {
        total_transactions: transactions.length,
        cash_in: summary.totalDeposits + summary.totalTransfersIn,
        cash_out: summary.totalWithdrawals + summary.totalTransfersOut,
        net_cash_flow: (summary.totalDeposits + summary.totalTransfersIn) - (summary.totalWithdrawals + summary.totalTransfersOut)
      }
    };

    // Log the action
    await auditLog(req.user.id, 'GENERATE', 'REPORT', `Generated daily cash report for ${targetDate}`);

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating daily cash report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate daily cash report' });
  }
});

// Get monthly summary report
router.get('/summary/monthly', authMiddleware, async (req, res) => {
  try {
    const { year, month } = req.query;
    const currentDate = new Date();
    const targetYear = parseInt(year) || currentDate.getFullYear();
    const targetMonth = parseInt(month) || (currentDate.getMonth() + 1);

    const summary = await Transaction.getMonthlySummary(targetYear, targetMonth);
    
    // Get additional statistics
    const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

    const newCustomers = await Customer.getCountByDateRange(startDate, endDate);
    const newAccounts = await Account.getCountByDateRange(startDate, endDate);
    const newFDs = await FD.getCountByDateRange(startDate, endDate);
    const newRDs = await RD.getCountByDateRange(startDate, endDate);
    const newLoans = await Loan.getCountByDateRange(startDate, endDate);

    const report = {
      period: {
        year: targetYear,
        month: targetMonth,
        monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
      },
      transactions: summary,
      growth: {
        new_customers: newCustomers,
        new_accounts: newAccounts,
        new_fds: newFDs,
        new_rds: newRDs,
        new_loans: newLoans
      }
    };

    // Log the action
    await auditLog(req.user.id, 'GENERATE', 'REPORT', `Generated monthly summary report for ${targetMonth}/${targetYear}`);

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating monthly summary:', error);
    res.status(500).json({ success: false, message: 'Failed to generate monthly summary' });
  }
});

// Get custom date range report
router.get('/custom', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, includeTransactions = 'true' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Start date and end date are required' 
      });
    }

    const filters = { startDate, endDate };
    
    const summary = {
      customers: await Customer.getCountByDateRange(startDate, endDate),
      accounts: await Account.getCountByDateRange(startDate, endDate),
      fds: await FD.getCountByDateRange(startDate, endDate),
      rds: await RD.getCountByDateRange(startDate, endDate),
      loans: await Loan.getCountByDateRange(startDate, endDate)
    };

    const report = {
      period: { startDate, endDate },
      summary
    };

    if (includeTransactions === 'true') {
      const transactions = await Transaction.getAll(filters);
      report.transactions = {
        total: transactions.length,
        deposits: transactions.filter(t => t.type === 'deposit').length,
        withdrawals: transactions.filter(t => t.type === 'withdrawal').length,
        transfers: transactions.filter(t => ['transfer_in', 'transfer_out'].includes(t.type)).length,
        total_amount: transactions.reduce((sum, t) => sum + t.amount, 0)
      };
    }

    // Log the action
    await auditLog(req.user.id, 'GENERATE', 'REPORT', `Generated custom report for ${startDate} to ${endDate}`);

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating custom report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate custom report' });
  }
});

module.exports = router;