const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const AuditService = require('../utils/auditService');
const emailService = require('../utils/emailService');
const { authMiddleware } = require('../middleware/authMiddleware');
const { adminOrEmployee } = require('../middleware/roleMiddleware');

// Get all customers
router.get('/', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const {
            search,
            limit = 50,
            offset = 0,
            created_by
        } = req.query;

        const filters = {
            search,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        // Employees can only see customers they created (unless admin)
        if (req.user.role === 'employee' && !created_by) {
            filters.created_by = req.user.id;
        } else if (created_by) {
            filters.created_by = parseInt(created_by);
        }

        const result = await Customer.findAll(filters);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            customers: result.customers,
            total: result.total,
            limit: result.limit,
            offset: result.offset
        });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get customer by ID
router.get('/:id', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Customer.findById(parseInt(id));

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.error
            });
        }

        // Check if employee can access this customer
        if (req.user.role === 'employee' && result.customer.created_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view customers you created.'
            });
        }

        // Log customer view
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.CUSTOMER_VIEW,
            'customer',
            parseInt(id),
            `Viewed customer: ${result.customer.name}`,
            req
        );

        res.json({
            success: true,
            customer: result.customer
        });
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Create new customer
router.post('/', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const customerData = req.body;
        const result = await Customer.create(customerData, req.user.id);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Log customer creation
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.CUSTOMER_CREATE,
            'customer',
            result.customer.id,
            `Created customer: ${result.customer.name}`,
            req
        );

        // Send welcome email if email is provided
        if (result.customer.email) {
            await emailService.sendWelcomeEmail(result.customer.email, result.customer.name);
        }

        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            customer: result.customer
        });
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Update customer
router.put('/:id', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Check if customer exists and user has permission
        const existingCustomer = await Customer.findById(parseInt(id));
        if (!existingCustomer.success) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Check if employee can modify this customer
        if (req.user.role === 'employee' && existingCustomer.customer.created_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only modify customers you created.'
            });
        }

        const result = await Customer.update(parseInt(id), updateData);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Log customer update
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.CUSTOMER_UPDATE,
            'customer',
            parseInt(id),
            `Updated customer: ${result.customer.name}`,
            req
        );

        res.json({
            success: true,
            message: 'Customer updated successfully',
            customer: result.customer
        });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Delete customer (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Only admin can delete customers
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can delete customers'
            });
        }

        // Get customer details for logging
        const existingCustomer = await Customer.findById(parseInt(id));
        if (!existingCustomer.success) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const result = await Customer.delete(parseInt(id));

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        // Log customer deletion
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.CUSTOMER_DELETE,
            'customer',
            parseInt(id),
            `Deleted customer: ${existingCustomer.customer.name}`,
            req
        );

        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Search customer by account number
router.get('/search/account/:accountNumber', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { accountNumber } = req.params;
        const result = await Customer.searchByAccountNumber(accountNumber);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.error
            });
        }

        // Check if employee can access this customer
        if (req.user.role === 'employee' && result.customer.created_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view customers you created.'
            });
        }

        res.json({
            success: true,
            customer: result.customer
        });
    } catch (error) {
        console.error('Search customer by account error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get customer summary (accounts, FDs, RDs, loans)
router.get('/:id/summary', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Customer.getCustomerSummary(parseInt(id));

        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.error
            });
        }

        // Check if employee can access this customer
        if (req.user.role === 'employee' && result.summary.customer.created_by !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view customers you created.'
            });
        }

        res.json({
            success: true,
            summary: result.summary
        });
    } catch (error) {
        console.error('Get customer summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Get customer statistics
router.get('/stats/overview', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const result = await Customer.getStats();

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
        console.error('Get customer stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Bulk operations (admin only)
router.post('/bulk/export', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can export customer data'
            });
        }

        const { filters = {} } = req.body;
        const result = await Customer.findAll(filters);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        // Log data export
        await AuditService.logActivity(
            req.user.id,
            AuditService.ACTION_TYPES.DATA_EXPORT,
            'customer',
            null,
            `Exported ${result.customers.length} customer records`,
            req
        );

        res.json({
            success: true,
            customers: result.customers,
            total: result.total,
            exported_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Export customers error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Advanced search
router.post('/search', authMiddleware, adminOrEmployee, async (req, res) => {
    try {
        const {
            name,
            phone,
            email,
            aadhaar,
            pan,
            created_by,
            limit = 50,
            offset = 0
        } = req.body;

        let searchTerm = '';
        if (name) searchTerm += name + ' ';
        if (phone) searchTerm += phone + ' ';
        if (email) searchTerm += email + ' ';
        if (aadhaar) searchTerm += aadhaar + ' ';
        if (pan) searchTerm += pan + ' ';

        const filters = {
            search: searchTerm.trim(),
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

        // Employees can only see customers they created (unless admin)
        if (req.user.role === 'employee' && !created_by) {
            filters.created_by = req.user.id;
        } else if (created_by) {
            filters.created_by = parseInt(created_by);
        }

        const result = await Customer.findAll(filters);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error
            });
        }

        res.json({
            success: true,
            customers: result.customers,
            total: result.total,
            limit: result.limit,
            offset: result.offset
        });
    } catch (error) {
        console.error('Advanced search error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;