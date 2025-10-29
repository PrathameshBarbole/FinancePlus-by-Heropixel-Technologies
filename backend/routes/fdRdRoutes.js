const express = require('express');
const router = express.Router();
const FD = require('../models/FD');
const RD = require('../models/RD');
const Customer = require('../models/Customer');
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { auditLog } = require('../utils/auditService');

// FD Routes

// Get all FDs
router.get('/fd', authMiddleware, async (req, res) => {
  try {
    const fds = await FD.getAll();
    res.json({ success: true, data: fds });
  } catch (error) {
    console.error('Error fetching FDs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch FDs' });
  }
});

// Get FD by ID
router.get('/fd/:id', authMiddleware, async (req, res) => {
  try {
    const fd = await FD.getById(req.params.id);
    if (!fd) {
      return res.status(404).json({ success: false, message: 'FD not found' });
    }
    res.json({ success: true, data: fd });
  } catch (error) {
    console.error('Error fetching FD:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch FD' });
  }
});

// Get FDs by customer ID
router.get('/fd/customer/:customerId', authMiddleware, async (req, res) => {
  try {
    const fds = await FD.getByCustomerId(req.params.customerId);
    res.json({ success: true, data: fds });
  } catch (error) {
    console.error('Error fetching customer FDs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customer FDs' });
  }
});

// Create new FD
router.post('/fd', authMiddleware, async (req, res) => {
  try {
    const { customerId, amount, interestRate, tenure, maturityDate } = req.body;

    // Validate required fields
    if (!customerId || !amount || !interestRate || !tenure) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer ID, amount, interest rate, and tenure are required' 
      });
    }

    // Verify customer exists
    const customer = await Customer.getById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Calculate maturity date if not provided
    let calculatedMaturityDate = maturityDate;
    if (!calculatedMaturityDate) {
      const startDate = new Date();
      calculatedMaturityDate = new Date(startDate.setFullYear(startDate.getFullYear() + tenure));
    }

    // Calculate maturity amount (compound interest)
    const maturityAmount = amount * Math.pow(1 + (interestRate / 100), tenure);

    const fdData = {
      customerId,
      amount: parseFloat(amount),
      interestRate: parseFloat(interestRate),
      tenure: parseInt(tenure),
      maturityDate: calculatedMaturityDate,
      maturityAmount: parseFloat(maturityAmount.toFixed(2)),
      status: 'active'
    };

    const fdId = await FD.create(fdData);
    const newFd = await FD.getById(fdId);

    // Log the action
    await auditLog(req.user.id, 'CREATE', 'FD', `Created FD ${fdId} for customer ${customerId}`);

    res.status(201).json({ 
      success: true, 
      message: 'FD created successfully', 
      data: newFd 
    });
  } catch (error) {
    console.error('Error creating FD:', error);
    res.status(500).json({ success: false, message: 'Failed to create FD' });
  }
});

// Update FD
router.put('/fd/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const fdId = req.params.id;
    const updates = req.body;

    const existingFd = await FD.getById(fdId);
    if (!existingFd) {
      return res.status(404).json({ success: false, message: 'FD not found' });
    }

    // Recalculate maturity amount if amount, rate, or tenure changed
    if (updates.amount || updates.interestRate || updates.tenure) {
      const amount = updates.amount || existingFd.amount;
      const rate = updates.interestRate || existingFd.interestRate;
      const tenure = updates.tenure || existingFd.tenure;
      updates.maturityAmount = amount * Math.pow(1 + (rate / 100), tenure);
    }

    await FD.update(fdId, updates);
    const updatedFd = await FD.getById(fdId);

    // Log the action
    await auditLog(req.user.id, 'UPDATE', 'FD', `Updated FD ${fdId}`);

    res.json({ 
      success: true, 
      message: 'FD updated successfully', 
      data: updatedFd 
    });
  } catch (error) {
    console.error('Error updating FD:', error);
    res.status(500).json({ success: false, message: 'Failed to update FD' });
  }
});

// Close/Mature FD
router.post('/fd/:id/close', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const fdId = req.params.id;
    const { prematureClosing = false, closingAmount } = req.body;

    const fd = await FD.getById(fdId);
    if (!fd) {
      return res.status(404).json({ success: false, message: 'FD not found' });
    }

    if (fd.status !== 'active') {
      return res.status(400).json({ success: false, message: 'FD is not active' });
    }

    const updates = {
      status: prematureClosing ? 'closed_premature' : 'matured',
      closingDate: new Date().toISOString(),
      actualAmount: closingAmount || fd.maturityAmount
    };

    await FD.update(fdId, updates);
    const closedFd = await FD.getById(fdId);

    // Log the action
    await auditLog(req.user.id, 'CLOSE', 'FD', `Closed FD ${fdId} - ${prematureClosing ? 'Premature' : 'Matured'}`);

    res.json({ 
      success: true, 
      message: `FD ${prematureClosing ? 'closed prematurely' : 'matured'} successfully`, 
      data: closedFd 
    });
  } catch (error) {
    console.error('Error closing FD:', error);
    res.status(500).json({ success: false, message: 'Failed to close FD' });
  }
});

// RD Routes

// Get all RDs
router.get('/rd', authMiddleware, async (req, res) => {
  try {
    const rds = await RD.getAll();
    res.json({ success: true, data: rds });
  } catch (error) {
    console.error('Error fetching RDs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch RDs' });
  }
});

// Get RD by ID
router.get('/rd/:id', authMiddleware, async (req, res) => {
  try {
    const rd = await RD.getById(req.params.id);
    if (!rd) {
      return res.status(404).json({ success: false, message: 'RD not found' });
    }
    res.json({ success: true, data: rd });
  } catch (error) {
    console.error('Error fetching RD:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch RD' });
  }
});

// Get RDs by customer ID
router.get('/rd/customer/:customerId', authMiddleware, async (req, res) => {
  try {
    const rds = await RD.getByCustomerId(req.params.customerId);
    res.json({ success: true, data: rds });
  } catch (error) {
    console.error('Error fetching customer RDs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customer RDs' });
  }
});

// Create new RD
router.post('/rd', authMiddleware, async (req, res) => {
  try {
    const { customerId, monthlyAmount, interestRate, tenure } = req.body;

    // Validate required fields
    if (!customerId || !monthlyAmount || !interestRate || !tenure) {
      return res.status(400).json({ 
        success: false, 
        message: 'Customer ID, monthly amount, interest rate, and tenure are required' 
      });
    }

    // Verify customer exists
    const customer = await Customer.getById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Calculate maturity date and amount
    const startDate = new Date();
    const maturityDate = new Date(startDate.setMonth(startDate.getMonth() + tenure));
    
    // RD maturity calculation: P * n + (P * n * (n + 1) * r) / (2 * 12 * 100)
    const P = parseFloat(monthlyAmount);
    const n = parseInt(tenure);
    const r = parseFloat(interestRate);
    const maturityAmount = P * n + (P * n * (n + 1) * r) / (2 * 12 * 100);

    const rdData = {
      customerId,
      monthlyAmount: P,
      interestRate: r,
      tenure: n,
      maturityDate: maturityDate.toISOString(),
      maturityAmount: parseFloat(maturityAmount.toFixed(2)),
      totalDeposited: 0,
      installmentsPaid: 0,
      status: 'active'
    };

    const rdId = await RD.create(rdData);
    const newRd = await RD.getById(rdId);

    // Log the action
    await auditLog(req.user.id, 'CREATE', 'RD', `Created RD ${rdId} for customer ${customerId}`);

    res.status(201).json({ 
      success: true, 
      message: 'RD created successfully', 
      data: newRd 
    });
  } catch (error) {
    console.error('Error creating RD:', error);
    res.status(500).json({ success: false, message: 'Failed to create RD' });
  }
});

// Make RD installment payment
router.post('/rd/:id/payment', authMiddleware, async (req, res) => {
  try {
    const rdId = req.params.id;
    const { amount, paymentDate } = req.body;

    const rd = await RD.getById(rdId);
    if (!rd) {
      return res.status(404).json({ success: false, message: 'RD not found' });
    }

    if (rd.status !== 'active') {
      return res.status(400).json({ success: false, message: 'RD is not active' });
    }

    const paymentAmount = parseFloat(amount) || rd.monthlyAmount;
    const newTotalDeposited = rd.totalDeposited + paymentAmount;
    const newInstallmentsPaid = rd.installmentsPaid + 1;

    const updates = {
      totalDeposited: newTotalDeposited,
      installmentsPaid: newInstallmentsPaid,
      lastPaymentDate: paymentDate || new Date().toISOString()
    };

    // Check if RD is completed
    if (newInstallmentsPaid >= rd.tenure) {
      updates.status = 'completed';
      updates.completionDate = new Date().toISOString();
    }

    await RD.update(rdId, updates);
    const updatedRd = await RD.getById(rdId);

    // Log the action
    await auditLog(req.user.id, 'PAYMENT', 'RD', `RD payment of ${paymentAmount} for RD ${rdId}`);

    res.json({ 
      success: true, 
      message: 'RD payment recorded successfully', 
      data: updatedRd 
    });
  } catch (error) {
    console.error('Error recording RD payment:', error);
    res.status(500).json({ success: false, message: 'Failed to record RD payment' });
  }
});

// Close RD
router.post('/rd/:id/close', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const rdId = req.params.id;
    const { prematureClosing = false, closingAmount } = req.body;

    const rd = await RD.getById(rdId);
    if (!rd) {
      return res.status(404).json({ success: false, message: 'RD not found' });
    }

    if (rd.status !== 'active') {
      return res.status(400).json({ success: false, message: 'RD is not active' });
    }

    const updates = {
      status: prematureClosing ? 'closed_premature' : 'completed',
      closingDate: new Date().toISOString(),
      actualAmount: closingAmount || rd.totalDeposited
    };

    await RD.update(rdId, updates);
    const closedRd = await RD.getById(rdId);

    // Log the action
    await auditLog(req.user.id, 'CLOSE', 'RD', `Closed RD ${rdId} - ${prematureClosing ? 'Premature' : 'Completed'}`);

    res.json({ 
      success: true, 
      message: `RD ${prematureClosing ? 'closed prematurely' : 'completed'} successfully`, 
      data: closedRd 
    });
  } catch (error) {
    console.error('Error closing RD:', error);
    res.status(500).json({ success: false, message: 'Failed to close RD' });
  }
});

// Delete FD (Admin only)
router.delete('/fd/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const fdId = req.params.id;
    
    const fd = await FD.getById(fdId);
    if (!fd) {
      return res.status(404).json({ success: false, message: 'FD not found' });
    }

    await FD.delete(fdId);

    // Log the action
    await auditLog(req.user.id, 'DELETE', 'FD', `Deleted FD ${fdId}`);

    res.json({ success: true, message: 'FD deleted successfully' });
  } catch (error) {
    console.error('Error deleting FD:', error);
    res.status(500).json({ success: false, message: 'Failed to delete FD' });
  }
});

// Delete RD (Admin only)
router.delete('/rd/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const rdId = req.params.id;
    
    const rd = await RD.getById(rdId);
    if (!rd) {
      return res.status(404).json({ success: false, message: 'RD not found' });
    }

    await RD.delete(rdId);

    // Log the action
    await auditLog(req.user.id, 'DELETE', 'RD', `Deleted RD ${rdId}`);

    res.json({ success: true, message: 'RD deleted successfully' });
  } catch (error) {
    console.error('Error deleting RD:', error);
    res.status(500).json({ success: false, message: 'Failed to delete RD' });
  }
});

module.exports = router;