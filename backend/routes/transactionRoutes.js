const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Customer = require('../models/Customer');
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { auditLog } = require('../utils/auditService');

// Get all transactions with pagination
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, customerId, accountId, type, startDate, endDate } = req.query;
    
    const filters = {};
    if (customerId) filters.customerId = customerId;
    if (accountId) filters.accountId = accountId;
    if (type) filters.type = type;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const transactions = await Transaction.getAll(filters, parseInt(page), parseInt(limit));
    const total = await Transaction.getCount(filters);

    res.json({ 
      success: true, 
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
});

// Get transaction by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.getById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transaction' });
  }
});

// Get transactions by customer ID
router.get('/customer/:customerId', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const transactions = await Transaction.getByCustomerId(req.params.customerId, parseInt(page), parseInt(limit));
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching customer transactions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customer transactions' });
  }
});

// Get transactions by account ID (passbook)
router.get('/account/:accountId', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const transactions = await Transaction.getByAccountId(req.params.accountId, parseInt(page), parseInt(limit));
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching account transactions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch account transactions' });
  }
});

// Create deposit transaction
router.post('/deposit', authMiddleware, async (req, res) => {
  try {
    const { accountId, amount, description, referenceNumber } = req.body;

    // Validate required fields
    if (!accountId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account ID and amount are required' 
      });
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Deposit amount must be greater than 0' 
      });
    }

    // Verify account exists
    const account = await Account.getById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Calculate new balance
    const newBalance = account.balance + depositAmount;

    // Create transaction record
    const transactionData = {
      customerId: account.customerId,
      accountId,
      type: 'deposit',
      amount: depositAmount,
      balanceAfter: newBalance,
      description: description || 'Cash deposit',
      referenceNumber: referenceNumber || `DEP${Date.now()}`,
      processedBy: req.user.id
    };

    const transactionId = await Transaction.create(transactionData);

    // Update account balance
    await Account.update(accountId, { 
      balance: newBalance,
      lastTransactionDate: new Date().toISOString()
    });

    const newTransaction = await Transaction.getById(transactionId);

    // Log the action
    await auditLog(req.user.id, 'DEPOSIT', 'TRANSACTION', `Deposit of ${depositAmount} to account ${accountId}`);

    res.status(201).json({ 
      success: true, 
      message: 'Deposit successful', 
      data: newTransaction 
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({ success: false, message: 'Failed to process deposit' });
  }
});

// Create withdrawal transaction
router.post('/withdraw', authMiddleware, async (req, res) => {
  try {
    const { accountId, amount, description, referenceNumber } = req.body;

    // Validate required fields
    if (!accountId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account ID and amount are required' 
      });
    }

    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Withdrawal amount must be greater than 0' 
      });
    }

    // Verify account exists
    const account = await Account.getById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Check sufficient balance
    if (account.balance < withdrawAmount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    // Calculate new balance
    const newBalance = account.balance - withdrawAmount;

    // Create transaction record
    const transactionData = {
      customerId: account.customerId,
      accountId,
      type: 'withdrawal',
      amount: withdrawAmount,
      balanceAfter: newBalance,
      description: description || 'Cash withdrawal',
      referenceNumber: referenceNumber || `WTH${Date.now()}`,
      processedBy: req.user.id
    };

    const transactionId = await Transaction.create(transactionData);

    // Update account balance
    await Account.update(accountId, { 
      balance: newBalance,
      lastTransactionDate: new Date().toISOString()
    });

    const newTransaction = await Transaction.getById(transactionId);

    // Log the action
    await auditLog(req.user.id, 'WITHDRAWAL', 'TRANSACTION', `Withdrawal of ${withdrawAmount} from account ${accountId}`);

    res.status(201).json({ 
      success: true, 
      message: 'Withdrawal successful', 
      data: newTransaction 
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ success: false, message: 'Failed to process withdrawal' });
  }
});

// Transfer between accounts
router.post('/transfer', authMiddleware, async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, description, referenceNumber } = req.body;

    // Validate required fields
    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'From account, to account, and amount are required' 
      });
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transfer amount must be greater than 0' 
      });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot transfer to the same account' 
      });
    }

    // Verify both accounts exist
    const fromAccount = await Account.getById(fromAccountId);
    const toAccount = await Account.getById(toAccountId);

    if (!fromAccount) {
      return res.status(404).json({ success: false, message: 'Source account not found' });
    }
    if (!toAccount) {
      return res.status(404).json({ success: false, message: 'Destination account not found' });
    }

    // Check sufficient balance
    if (fromAccount.balance < transferAmount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance in source account' 
      });
    }

    const transferRef = referenceNumber || `TRF${Date.now()}`;
    const transferDesc = description || 'Account transfer';

    // Calculate new balances
    const newFromBalance = fromAccount.balance - transferAmount;
    const newToBalance = toAccount.balance + transferAmount;

    // Create debit transaction for source account
    const debitTransactionData = {
      customerId: fromAccount.customerId,
      accountId: fromAccountId,
      type: 'transfer_out',
      amount: transferAmount,
      balanceAfter: newFromBalance,
      description: `${transferDesc} to A/C ${toAccount.accountNumber}`,
      referenceNumber: transferRef,
      processedBy: req.user.id
    };

    // Create credit transaction for destination account
    const creditTransactionData = {
      customerId: toAccount.customerId,
      accountId: toAccountId,
      type: 'transfer_in',
      amount: transferAmount,
      balanceAfter: newToBalance,
      description: `${transferDesc} from A/C ${fromAccount.accountNumber}`,
      referenceNumber: transferRef,
      processedBy: req.user.id
    };

    // Create both transactions
    const debitTransactionId = await Transaction.create(debitTransactionData);
    const creditTransactionId = await Transaction.create(creditTransactionData);

    // Update both account balances
    await Account.update(fromAccountId, { 
      balance: newFromBalance,
      lastTransactionDate: new Date().toISOString()
    });
    await Account.update(toAccountId, { 
      balance: newToBalance,
      lastTransactionDate: new Date().toISOString()
    });

    const debitTransaction = await Transaction.getById(debitTransactionId);
    const creditTransaction = await Transaction.getById(creditTransactionId);

    // Log the action
    await auditLog(req.user.id, 'TRANSFER', 'TRANSACTION', `Transfer of ${transferAmount} from ${fromAccountId} to ${toAccountId}`);

    res.status(201).json({ 
      success: true, 
      message: 'Transfer successful', 
      data: {
        debitTransaction,
        creditTransaction,
        transferReference: transferRef
      }
    });
  } catch (error) {
    console.error('Error processing transfer:', error);
    res.status(500).json({ success: false, message: 'Failed to process transfer' });
  }
});

// Apply interest to account (Admin only)
router.post('/interest', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { accountId, interestRate, description } = req.body;

    if (!accountId || !interestRate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account ID and interest rate are required' 
      });
    }

    // Verify account exists
    const account = await Account.getById(accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Calculate interest amount
    const rate = parseFloat(interestRate);
    const interestAmount = (account.balance * rate) / 100;
    const newBalance = account.balance + interestAmount;

    // Create interest transaction
    const transactionData = {
      customerId: account.customerId,
      accountId,
      type: 'interest',
      amount: interestAmount,
      balanceAfter: newBalance,
      description: description || `Interest applied at ${rate}%`,
      referenceNumber: `INT${Date.now()}`,
      processedBy: req.user.id
    };

    const transactionId = await Transaction.create(transactionData);

    // Update account balance
    await Account.update(accountId, { 
      balance: newBalance,
      lastTransactionDate: new Date().toISOString()
    });

    const newTransaction = await Transaction.getById(transactionId);

    // Log the action
    await auditLog(req.user.id, 'INTEREST', 'TRANSACTION', `Interest of ${interestAmount} applied to account ${accountId}`);

    res.status(201).json({ 
      success: true, 
      message: 'Interest applied successfully', 
      data: newTransaction 
    });
  } catch (error) {
    console.error('Error applying interest:', error);
    res.status(500).json({ success: false, message: 'Failed to apply interest' });
  }
});

// Get daily transaction summary
router.get('/summary/daily', authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const summary = await Transaction.getDailySummary(targetDate);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch daily summary' });
  }
});

// Get monthly transaction summary
router.get('/summary/monthly', authMiddleware, async (req, res) => {
  try {
    const { year, month } = req.query;
    const currentDate = new Date();
    const targetYear = year || currentDate.getFullYear();
    const targetMonth = month || (currentDate.getMonth() + 1);
    
    const summary = await Transaction.getMonthlySummary(targetYear, targetMonth);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly summary' });
  }
});

// Reverse/Cancel transaction (Admin only)
router.post('/:id/reverse', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const transactionId = req.params.id;
    const { reason } = req.body;

    const transaction = await Transaction.getById(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status === 'reversed') {
      return res.status(400).json({ success: false, message: 'Transaction already reversed' });
    }

    // Get current account balance
    const account = await Account.getById(transaction.accountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    let newBalance;
    let reversalType;

    // Calculate reversal based on original transaction type
    switch (transaction.type) {
      case 'deposit':
        newBalance = account.balance - transaction.amount;
        reversalType = 'deposit_reversal';
        break;
      case 'withdrawal':
        newBalance = account.balance + transaction.amount;
        reversalType = 'withdrawal_reversal';
        break;
      case 'interest':
        newBalance = account.balance - transaction.amount;
        reversalType = 'interest_reversal';
        break;
      default:
        return res.status(400).json({ success: false, message: 'Cannot reverse this transaction type' });
    }

    // Check if reversal would result in negative balance for deposit reversals
    if (reversalType === 'deposit_reversal' && newBalance < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot reverse: would result in negative balance' 
      });
    }

    // Create reversal transaction
    const reversalData = {
      customerId: transaction.customerId,
      accountId: transaction.accountId,
      type: reversalType,
      amount: transaction.amount,
      balanceAfter: newBalance,
      description: `Reversal of transaction ${transactionId} - ${reason || 'No reason provided'}`,
      referenceNumber: `REV${transactionId}`,
      processedBy: req.user.id,
      originalTransactionId: transactionId
    };

    const reversalId = await Transaction.create(reversalData);

    // Update original transaction status
    await Transaction.update(transactionId, { 
      status: 'reversed',
      reversalTransactionId: reversalId,
      reversalReason: reason || 'No reason provided'
    });

    // Update account balance
    await Account.update(transaction.accountId, { 
      balance: newBalance,
      lastTransactionDate: new Date().toISOString()
    });

    const reversalTransaction = await Transaction.getById(reversalId);

    // Log the action
    await auditLog(req.user.id, 'REVERSE', 'TRANSACTION', `Reversed transaction ${transactionId} - Reason: ${reason || 'No reason provided'}`);

    res.json({ 
      success: true, 
      message: 'Transaction reversed successfully', 
      data: reversalTransaction 
    });
  } catch (error) {
    console.error('Error reversing transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to reverse transaction' });
  }
});

module.exports = router;