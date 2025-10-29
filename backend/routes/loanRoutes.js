const express = require('express');
const router = express.Router();
const Loan = require('../models/Loan');
const Customer = require('../models/Customer');
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { auditLog } = require('../utils/auditService');

// Get all loans
router.get('/', authMiddleware, async (req, res) => {
  try {
    const loans = await Loan.getAll();
    res.json({ success: true, data: loans });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loans' });
  }
});

// Get loan by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const loan = await Loan.getById(req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    res.json({ success: true, data: loan });
  } catch (error) {
    console.error('Error fetching loan:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch loan' });
  }
});

// Get loans by customer ID
router.get('/customer/:customerId', authMiddleware, async (req, res) => {
  try {
    const loans = await Loan.getByCustomerId(req.params.customerId);
    res.json({ success: true, data: loans });
  } catch (error) {
    console.error('Error fetching customer loans:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customer loans' });
  }
});

// Create new loan
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      customerId, 
      amount, 
      interestRate, 
      tenure, 
      loanType, 
      purpose,
      guarantorName,
      guarantorContact,
      collateral 
    } = req.body;

    // Validate required fields
    if (!customerId || !amount || !interestRate || !tenure || !loanType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer ID, amount, interest rate, tenure, and loan type are required' 
      });
    }

    // Verify customer exists
    const customer = await Customer.getById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Calculate EMI using compound interest formula
    const principal = parseFloat(amount);
    const monthlyRate = parseFloat(interestRate) / (12 * 100);
    const numberOfPayments = parseInt(tenure);
    
    let emi;
    if (monthlyRate === 0) {
      emi = principal / numberOfPayments;
    } else {
      emi = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
            (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }

    const totalAmount = emi * numberOfPayments;
    const totalInterest = totalAmount - principal;

    const loanData = {
      customerId,
      amount: principal,
      interestRate: parseFloat(interestRate),
      tenure: numberOfPayments,
      loanType,
      purpose: purpose || '',
      guarantorName: guarantorName || '',
      guarantorContact: guarantorContact || '',
      collateral: collateral || '',
      emi: parseFloat(emi.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      totalInterest: parseFloat(totalInterest.toFixed(2)),
      amountPaid: 0,
      installmentsPaid: 0,
      remainingAmount: principal,
      status: 'active',
      disbursementDate: new Date().toISOString()
    };

    const loanId = await Loan.create(loanData);
    const newLoan = await Loan.getById(loanId);

    // Log the action
    await auditLog(req.user.id, 'CREATE', 'LOAN', `Created loan ${loanId} for customer ${customerId} - Amount: ${principal}`);

    res.status(201).json({ 
      success: true, 
      message: 'Loan created successfully', 
      data: newLoan 
    });
  } catch (error) {
    console.error('Error creating loan:', error);
    res.status(500).json({ success: false, message: 'Failed to create loan' });
  }
});

// Make loan payment/EMI
router.post('/:id/payment', authMiddleware, async (req, res) => {
  try {
    const loanId = req.params.id;
    const { amount, paymentDate, paymentType = 'emi' } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, message: 'Payment amount is required' });
    }

    const loan = await Loan.getById(loanId);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    if (loan.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Loan is not active' });
    }

    const paymentAmount = parseFloat(amount);
    const newAmountPaid = loan.amountPaid + paymentAmount;
    const newRemainingAmount = Math.max(0, loan.totalAmount - newAmountPaid);
    
    let newInstallmentsPaid = loan.installmentsPaid;
    if (paymentType === 'emi') {
      newInstallmentsPaid += 1;
    }

    const updates = {
      amountPaid: newAmountPaid,
      remainingAmount: newRemainingAmount,
      installmentsPaid: newInstallmentsPaid,
      lastPaymentDate: paymentDate || new Date().toISOString()
    };

    // Check if loan is fully paid
    if (newRemainingAmount <= 0) {
      updates.status = 'closed';
      updates.closingDate = new Date().toISOString();
    }

    await Loan.update(loanId, updates);
    const updatedLoan = await Loan.getById(loanId);

    // Log the action
    await auditLog(req.user.id, 'PAYMENT', 'LOAN', `Loan payment of ${paymentAmount} for loan ${loanId}`);

    res.json({ 
      success: true, 
      message: 'Loan payment recorded successfully', 
      data: updatedLoan 
    });
  } catch (error) {
    console.error('Error recording loan payment:', error);
    res.status(500).json({ success: false, message: 'Failed to record loan payment' });
  }
});

// Update loan details
router.put('/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const loanId = req.params.id;
    const updates = req.body;

    const existingLoan = await Loan.getById(loanId);
    if (!existingLoan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    // Recalculate EMI if amount, rate, or tenure changed
    if (updates.amount || updates.interestRate || updates.tenure) {
      const principal = updates.amount || existingLoan.amount;
      const rate = updates.interestRate || existingLoan.interestRate;
      const tenure = updates.tenure || existingLoan.tenure;
      
      const monthlyRate = rate / (12 * 100);
      let emi;
      
      if (monthlyRate === 0) {
        emi = principal / tenure;
      } else {
        emi = principal * (monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
              (Math.pow(1 + monthlyRate, tenure) - 1);
      }
      
      const totalAmount = emi * tenure;
      const totalInterest = totalAmount - principal;
      
      updates.emi = parseFloat(emi.toFixed(2));
      updates.totalAmount = parseFloat(totalAmount.toFixed(2));
      updates.totalInterest = parseFloat(totalInterest.toFixed(2));
      updates.remainingAmount = totalAmount - (existingLoan.amountPaid || 0);
    }

    await Loan.update(loanId, updates);
    const updatedLoan = await Loan.getById(loanId);

    // Log the action
    await auditLog(req.user.id, 'UPDATE', 'LOAN', `Updated loan ${loanId}`);

    res.json({ 
      success: true, 
      message: 'Loan updated successfully', 
      data: updatedLoan 
    });
  } catch (error) {
    console.error('Error updating loan:', error);
    res.status(500).json({ success: false, message: 'Failed to update loan' });
  }
});

// Close loan
router.post('/:id/close', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const loanId = req.params.id;
    const { reason, closingAmount } = req.body;

    const loan = await Loan.getById(loanId);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    if (loan.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Loan is not active' });
    }

    const updates = {
      status: 'closed',
      closingDate: new Date().toISOString(),
      closingReason: reason || 'Manual closure',
      remainingAmount: 0
    };

    if (closingAmount !== undefined) {
      updates.amountPaid = loan.amountPaid + parseFloat(closingAmount);
    }

    await Loan.update(loanId, updates);
    const closedLoan = await Loan.getById(loanId);

    // Log the action
    await auditLog(req.user.id, 'CLOSE', 'LOAN', `Closed loan ${loanId} - Reason: ${reason || 'Manual closure'}`);

    res.json({ 
      success: true, 
      message: 'Loan closed successfully', 
      data: closedLoan 
    });
  } catch (error) {
    console.error('Error closing loan:', error);
    res.status(500).json({ success: false, message: 'Failed to close loan' });
  }
});

// Get loan payment schedule
router.get('/:id/schedule', authMiddleware, async (req, res) => {
  try {
    const loan = await Loan.getById(req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

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

    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error generating loan schedule:', error);
    res.status(500).json({ success: false, message: 'Failed to generate loan schedule' });
  }
});

// Delete loan (Admin only)
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const loanId = req.params.id;
    
    const loan = await Loan.getById(loanId);
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }

    await Loan.delete(loanId);

    // Log the action
    await auditLog(req.user.id, 'DELETE', 'LOAN', `Deleted loan ${loanId}`);

    res.json({ success: true, message: 'Loan deleted successfully' });
  } catch (error) {
    console.error('Error deleting loan:', error);
    res.status(500).json({ success: false, message: 'Failed to delete loan' });
  }
});

module.exports = router;