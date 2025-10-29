const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { auditLog } = require('../utils/auditService');
const fs = require('fs').promises;
const path = require('path');

// Settings storage file
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

// Default settings
const DEFAULT_SETTINGS = {
  institute: {
    name: 'FinancePlus Institute',
    address: '',
    phone: '',
    email: '',
    logo: '',
    registrationNumber: '',
    establishedYear: new Date().getFullYear()
  },
  email: {
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    fromName: 'FinancePlus',
    fromEmail: ''
  },
  interest: {
    savingsRate: 4.0,
    fdRates: {
      '1': 6.0,
      '2': 6.5,
      '3': 7.0,
      '5': 7.5
    },
    rdRate: 6.5,
    loanRates: {
      personal: 12.0,
      business: 10.0,
      agriculture: 8.0,
      education: 9.0
    }
  },
  system: {
    autoBackup: true,
    backupFrequency: 'weekly',
    maxBackups: 10,
    sessionTimeout: 86400000, // 24 hours in milliseconds
    passwordMinLength: 6,
    enableEmailNotifications: true,
    defaultLanguage: 'en'
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 300000, // 5 minutes in milliseconds
    requirePasswordChange: false,
    passwordExpiryDays: 90
  }
};

// Helper function to read settings
async function readSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (error) {
    // If file doesn't exist, return default settings
    return DEFAULT_SETTINGS;
  }
}

// Helper function to write settings
async function writeSettings(settings) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(SETTINGS_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing settings:', error);
    return false;
  }
}

// Get all settings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const settings = await readSettings();
    
    // Remove sensitive information for non-admin users
    if (req.user.role !== 'admin') {
      delete settings.email.smtpPassword;
      delete settings.security;
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// Get specific setting category
router.get('/:category', authMiddleware, async (req, res) => {
  try {
    const { category } = req.params;
    const settings = await readSettings();

    if (!settings[category]) {
      return res.status(404).json({ success: false, message: 'Setting category not found' });
    }

    let categorySettings = settings[category];

    // Remove sensitive information for non-admin users
    if (req.user.role !== 'admin') {
      if (category === 'email') {
        delete categorySettings.smtpPassword;
      }
      if (category === 'security') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, data: categorySettings });
  } catch (error) {
    console.error('Error fetching setting category:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch setting category' });
  }
});

// Update settings (Admin only)
router.put('/', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const updates = req.body;
    const currentSettings = await readSettings();

    // Merge updates with current settings
    const newSettings = { ...currentSettings };
    
    Object.keys(updates).forEach(category => {
      if (newSettings[category]) {
        newSettings[category] = { ...newSettings[category], ...updates[category] };
      } else {
        newSettings[category] = updates[category];
      }
    });

    // Validate critical settings
    if (newSettings.system.sessionTimeout < 300000) { // Minimum 5 minutes
      return res.status(400).json({ 
        success: false, 
        message: 'Session timeout must be at least 5 minutes' 
      });
    }

    if (newSettings.system.passwordMinLength < 4) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password minimum length must be at least 4 characters' 
      });
    }

    const success = await writeSettings(newSettings);
    if (!success) {
      return res.status(500).json({ success: false, message: 'Failed to save settings' });
    }

    // Log the action
    await auditLog(req.user.id, 'UPDATE', 'SETTINGS', `Updated system settings`);

    res.json({ 
      success: true, 
      message: 'Settings updated successfully', 
      data: newSettings 
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// Update specific setting category (Admin only)
router.put('/:category', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { category } = req.params;
    const updates = req.body;
    const currentSettings = await readSettings();

    if (!currentSettings[category]) {
      return res.status(404).json({ success: false, message: 'Setting category not found' });
    }

    // Update the specific category
    currentSettings[category] = { ...currentSettings[category], ...updates };

    // Validate specific category updates
    if (category === 'system') {
      if (updates.sessionTimeout && updates.sessionTimeout < 300000) {
        return res.status(400).json({ 
          success: false, 
          message: 'Session timeout must be at least 5 minutes' 
        });
      }
      if (updates.passwordMinLength && updates.passwordMinLength < 4) {
        return res.status(400).json({ 
          success: false, 
          message: 'Password minimum length must be at least 4 characters' 
        });
      }
    }

    if (category === 'email' && updates.smtpPort) {
      if (updates.smtpPort < 1 || updates.smtpPort > 65535) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid SMTP port number' 
        });
      }
    }

    const success = await writeSettings(currentSettings);
    if (!success) {
      return res.status(500).json({ success: false, message: 'Failed to save settings' });
    }

    // Log the action
    await auditLog(req.user.id, 'UPDATE', 'SETTINGS', `Updated ${category} settings`);

    res.json({ 
      success: true, 
      message: `${category} settings updated successfully`, 
      data: currentSettings[category] 
    });
  } catch (error) {
    console.error('Error updating setting category:', error);
    res.status(500).json({ success: false, message: 'Failed to update setting category' });
  }
});

// Test email configuration (Admin only)
router.post('/email/test', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Test email address is required' 
      });
    }

    const settings = await readSettings();
    const emailConfig = settings.email;

    if (!emailConfig.smtpHost || !emailConfig.smtpUser || !emailConfig.smtpPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email configuration is incomplete' 
      });
    }

    // Import email service and test
    const { sendEmail } = require('../utils/emailService');
    
    const testSubject = 'FinancePlus - Email Configuration Test';
    const testBody = `
      <h2>Email Configuration Test</h2>
      <p>This is a test email to verify your SMTP configuration.</p>
      <p>If you received this email, your email settings are working correctly.</p>
      <p>Sent at: ${new Date().toLocaleString()}</p>
      <hr>
      <p><small>FinancePlus by Heropixel Technologies</small></p>
    `;

    await sendEmail(testEmail, testSubject, testBody);

    // Log the action
    await auditLog(req.user.id, 'TEST', 'EMAIL_CONFIG', `Sent test email to ${testEmail}`);

    res.json({ 
      success: true, 
      message: 'Test email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email', 
      error: error.message 
    });
  }
});

// Reset settings to default (Admin only)
router.post('/reset', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { category } = req.body;

    let newSettings;
    if (category && DEFAULT_SETTINGS[category]) {
      // Reset specific category
      const currentSettings = await readSettings();
      currentSettings[category] = DEFAULT_SETTINGS[category];
      newSettings = currentSettings;
    } else {
      // Reset all settings
      newSettings = DEFAULT_SETTINGS;
    }

    const success = await writeSettings(newSettings);
    if (!success) {
      return res.status(500).json({ success: false, message: 'Failed to reset settings' });
    }

    // Log the action
    await auditLog(req.user.id, 'RESET', 'SETTINGS', `Reset ${category || 'all'} settings to default`);

    res.json({ 
      success: true, 
      message: `Settings ${category ? `(${category})` : ''} reset to default successfully`, 
      data: newSettings 
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ success: false, message: 'Failed to reset settings' });
  }
});

// Get system information
router.get('/system/info', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const os = require('os');
    const { version } = require('../../package.json');

    const systemInfo = {
      application: {
        name: 'FinancePlus',
        version: version || '1.0.0',
        developer: 'Heropixel Technologies'
      },
      system: {
        platform: os.platform(),
        architecture: os.arch(),
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: process.memoryUsage()
        }
      },
      database: {
        type: 'SQLite',
        location: path.join(__dirname, '../data/')
      }
    };

    res.json({ success: true, data: systemInfo });
  } catch (error) {
    console.error('Error fetching system info:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch system information' });
  }
});

module.exports = router;