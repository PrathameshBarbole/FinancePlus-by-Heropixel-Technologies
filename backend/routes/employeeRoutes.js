const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { auditLog } = require('../utils/auditService');
const bcrypt = require('bcrypt');

// Get all employees (Admin only)
router.get('/', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const employees = await User.getAll();
    // Remove password from response
    const safeEmployees = employees.map(emp => {
      const { password, ...safeEmp } = emp;
      return safeEmp;
    });
    res.json({ success: true, data: safeEmployees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

// Get employee by ID (Admin only or own profile)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.params.id;
    
    // Allow users to view their own profile or admin to view any profile
    if (req.user.role !== 'admin' && req.user.id !== parseInt(employeeId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const employee = await User.getById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Remove password from response
    const { password, ...safeEmployee } = employee;
    res.json({ success: true, data: safeEmployee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employee' });
  }
});

// Create new employee (Admin only)
router.post('/', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { name, email, password, role = 'employee', phone, address } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and password are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Check if email already exists
    const existingUser = await User.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already exists' 
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Validate role
    if (!['admin', 'employee'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid role. Must be admin or employee' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const employeeData = {
      name,
      email,
      password: hashedPassword,
      role,
      phone: phone || '',
      address: address || '',
      isActive: true
    };

    const employeeId = await User.create(employeeData);
    const newEmployee = await User.getById(employeeId);

    // Remove password from response
    const { password: _, ...safeEmployee } = newEmployee;

    // Log the action
    await auditLog(req.user.id, 'CREATE', 'EMPLOYEE', `Created employee ${employeeId} - ${name} (${email})`);

    res.status(201).json({ 
      success: true, 
      message: 'Employee created successfully', 
      data: safeEmployee 
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ success: false, message: 'Failed to create employee' });
  }
});

// Update employee (Admin only or own profile)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const updates = req.body;

    // Allow users to update their own profile or admin to update any profile
    if (req.user.role !== 'admin' && req.user.id !== parseInt(employeeId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const existingEmployee = await User.getById(employeeId);
    if (!existingEmployee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Prevent non-admin users from changing role or admin status
    if (req.user.role !== 'admin') {
      delete updates.role;
      delete updates.isActive;
    }

    // Prevent admin from downgrading their own role
    if (req.user.id === parseInt(employeeId) && updates.role && updates.role !== 'admin') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot downgrade your own admin role' 
      });
    }

    // Handle email update
    if (updates.email && updates.email !== existingEmployee.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid email format' 
        });
      }

      const existingUser = await User.getByEmail(updates.email);
      if (existingUser && existingUser.id !== parseInt(employeeId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email already exists' 
        });
      }
    }

    // Handle password update
    if (updates.password) {
      if (updates.password.length < 6) {
        return res.status(400).json({ 
          success: false, 
          message: 'Password must be at least 6 characters long' 
        });
      }
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    // Validate role if being updated
    if (updates.role && !['admin', 'employee'].includes(updates.role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid role. Must be admin or employee' 
      });
    }

    await User.update(employeeId, updates);
    const updatedEmployee = await User.getById(employeeId);

    // Remove password from response
    const { password, ...safeEmployee } = updatedEmployee;

    // Log the action
    await auditLog(req.user.id, 'UPDATE', 'EMPLOYEE', `Updated employee ${employeeId} - ${updatedEmployee.name}`);

    res.json({ 
      success: true, 
      message: 'Employee updated successfully', 
      data: safeEmployee 
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ success: false, message: 'Failed to update employee' });
  }
});

// Change password
router.post('/:id/change-password', authMiddleware, async (req, res) => {
  try {
    const employeeId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    // Allow users to change their own password or admin to change any password
    if (req.user.role !== 'admin' && req.user.id !== parseInt(employeeId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password is required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    const employee = await User.getById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Verify current password if not admin changing someone else's password
    if (req.user.id === parseInt(employeeId) || req.user.role !== 'admin') {
      if (!currentPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Current password is required' 
        });
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, employee.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Current password is incorrect' 
        });
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.update(employeeId, { password: hashedPassword });

    // Log the action
    await auditLog(req.user.id, 'PASSWORD_CHANGE', 'EMPLOYEE', `Changed password for employee ${employeeId}`);

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// Toggle employee active status (Admin only)
router.post('/:id/toggle-status', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const employeeId = req.params.id;

    // Prevent admin from deactivating their own account
    if (req.user.id === parseInt(employeeId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot deactivate your own account' 
      });
    }

    const employee = await User.getById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const newStatus = !employee.isActive;
    await User.update(employeeId, { isActive: newStatus });

    const updatedEmployee = await User.getById(employeeId);
    const { password, ...safeEmployee } = updatedEmployee;

    // Log the action
    await auditLog(req.user.id, 'STATUS_CHANGE', 'EMPLOYEE', `${newStatus ? 'Activated' : 'Deactivated'} employee ${employeeId} - ${employee.name}`);

    res.json({ 
      success: true, 
      message: `Employee ${newStatus ? 'activated' : 'deactivated'} successfully`, 
      data: safeEmployee 
    });
  } catch (error) {
    console.error('Error toggling employee status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle employee status' });
  }
});

// Delete employee (Admin only)
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const employeeId = req.params.id;

    // Prevent admin from deleting their own account
    if (req.user.id === parseInt(employeeId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete your own account' 
      });
    }

    const employee = await User.getById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    await User.delete(employeeId);

    // Log the action
    await auditLog(req.user.id, 'DELETE', 'EMPLOYEE', `Deleted employee ${employeeId} - ${employee.name} (${employee.email})`);

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ success: false, message: 'Failed to delete employee' });
  }
});

// Get employee statistics (Admin only)
router.get('/stats/overview', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const stats = await User.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employee statistics' });
  }
});

module.exports = router;