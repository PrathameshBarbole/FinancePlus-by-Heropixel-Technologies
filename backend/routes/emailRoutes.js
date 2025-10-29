const express = require('express');
const router = express.Router();
const EmailQueue = require('../models/EmailQueue');
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { auditLog } = require('../utils/auditService');
const { sendEmail, processEmailQueue } = require('../utils/emailService');

// Get all queued emails
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    const filters = {};
    if (status) filters.status = status;

    const emails = await EmailQueue.getAll(filters, parseInt(page), parseInt(limit));
    const total = await EmailQueue.getCount(filters);

    res.json({ 
      success: true, 
      data: emails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching email queue:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch email queue' });
  }
});

// Get email by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const email = await EmailQueue.getById(req.params.id);
    if (!email) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }
    res.json({ success: true, data: email });
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch email' });
  }
});

// Queue new email
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { to, subject, body, type = 'general', priority = 'normal' } = req.body;

    // Validate required fields
    if (!to || !subject || !body) {
      return res.status(400).json({ 
        success: false, 
        message: 'To, subject, and body are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Validate priority
    if (!['low', 'normal', 'high'].includes(priority)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid priority. Must be low, normal, or high' 
      });
    }

    const emailData = {
      to,
      subject,
      body,
      type,
      priority,
      queuedBy: req.user.id,
      status: 'pending'
    };

    const emailId = await EmailQueue.create(emailData);
    const newEmail = await EmailQueue.getById(emailId);

    // Try to send immediately if online
    try {
      await processEmailQueue();
    } catch (error) {
      console.log('Email queued for later sending (offline)');
    }

    // Log the action
    await auditLog(req.user.id, 'QUEUE', 'EMAIL', `Queued email to ${to} - Subject: ${subject}`);

    res.status(201).json({ 
      success: true, 
      message: 'Email queued successfully', 
      data: newEmail 
    });
  } catch (error) {
    console.error('Error queuing email:', error);
    res.status(500).json({ success: false, message: 'Failed to queue email' });
  }
});

// Send specific email immediately
router.post('/:id/send', authMiddleware, async (req, res) => {
  try {
    const emailId = req.params.id;
    
    const email = await EmailQueue.getById(emailId);
    if (!email) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }

    if (email.status === 'sent') {
      return res.status(400).json({ success: false, message: 'Email already sent' });
    }

    if (email.status === 'failed' && email.retryCount >= 3) {
      return res.status(400).json({ success: false, message: 'Email has exceeded retry limit' });
    }

    try {
      await sendEmail(email.to, email.subject, email.body);
      
      // Update email status
      await EmailQueue.update(emailId, {
        status: 'sent',
        sentAt: new Date().toISOString(),
        error: null
      });

      const updatedEmail = await EmailQueue.getById(emailId);

      // Log the action
      await auditLog(req.user.id, 'SEND', 'EMAIL', `Manually sent email ${emailId} to ${email.to}`);

      res.json({ 
        success: true, 
        message: 'Email sent successfully', 
        data: updatedEmail 
      });
    } catch (error) {
      // Update email with error
      await EmailQueue.update(emailId, {
        status: 'failed',
        error: error.message,
        retryCount: (email.retryCount || 0) + 1,
        lastAttempt: new Date().toISOString()
      });

      res.status(500).json({ 
        success: false, 
        message: 'Failed to send email', 
        error: error.message 
      });
    }
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});

// Retry failed email
router.post('/:id/retry', authMiddleware, async (req, res) => {
  try {
    const emailId = req.params.id;
    
    const email = await EmailQueue.getById(emailId);
    if (!email) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }

    if (email.status !== 'failed') {
      return res.status(400).json({ success: false, message: 'Only failed emails can be retried' });
    }

    if (email.retryCount >= 3) {
      return res.status(400).json({ success: false, message: 'Email has exceeded retry limit' });
    }

    // Reset status to pending for retry
    await EmailQueue.update(emailId, {
      status: 'pending',
      error: null
    });

    // Try to send immediately
    try {
      await sendEmail(email.to, email.subject, email.body);
      
      await EmailQueue.update(emailId, {
        status: 'sent',
        sentAt: new Date().toISOString(),
        error: null
      });

      const updatedEmail = await EmailQueue.getById(emailId);

      // Log the action
      await auditLog(req.user.id, 'RETRY', 'EMAIL', `Retried and sent email ${emailId} to ${email.to}`);

      res.json({ 
        success: true, 
        message: 'Email retried and sent successfully', 
        data: updatedEmail 
      });
    } catch (error) {
      await EmailQueue.update(emailId, {
        status: 'failed',
        error: error.message,
        retryCount: (email.retryCount || 0) + 1,
        lastAttempt: new Date().toISOString()
      });

      res.status(500).json({ 
        success: false, 
        message: 'Failed to retry email', 
        error: error.message 
      });
    }
  } catch (error) {
    console.error('Error retrying email:', error);
    res.status(500).json({ success: false, message: 'Failed to retry email' });
  }
});

// Process entire email queue
router.post('/process', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const result = await processEmailQueue();
    
    // Log the action
    await auditLog(req.user.id, 'PROCESS', 'EMAIL_QUEUE', `Processed email queue - Sent: ${result.sent}, Failed: ${result.failed}`);

    res.json({ 
      success: true, 
      message: 'Email queue processed', 
      data: result 
    });
  } catch (error) {
    console.error('Error processing email queue:', error);
    res.status(500).json({ success: false, message: 'Failed to process email queue' });
  }
});

// Delete email from queue (Admin only)
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const emailId = req.params.id;
    
    const email = await EmailQueue.getById(emailId);
    if (!email) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }

    await EmailQueue.delete(emailId);

    // Log the action
    await auditLog(req.user.id, 'DELETE', 'EMAIL', `Deleted email ${emailId} from queue`);

    res.json({ success: true, message: 'Email deleted from queue' });
  } catch (error) {
    console.error('Error deleting email:', error);
    res.status(500).json({ success: false, message: 'Failed to delete email' });
  }
});

// Clear all sent emails (Admin only)
router.delete('/sent/clear', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const deletedCount = await EmailQueue.clearSent();

    // Log the action
    await auditLog(req.user.id, 'CLEAR', 'EMAIL_QUEUE', `Cleared ${deletedCount} sent emails from queue`);

    res.json({ 
      success: true, 
      message: `Cleared ${deletedCount} sent emails from queue` 
    });
  } catch (error) {
    console.error('Error clearing sent emails:', error);
    res.status(500).json({ success: false, message: 'Failed to clear sent emails' });
  }
});

// Get email queue statistics
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const stats = await EmailQueue.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch email statistics' });
  }
});

// Send test email
router.post('/test', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient email is required' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    const testSubject = 'FinancePlus - Test Email';
    const testBody = `
      <h2>FinancePlus Test Email</h2>
      <p>This is a test email from FinancePlus system.</p>
      <p>If you received this email, the email configuration is working correctly.</p>
      <p>Sent at: ${new Date().toLocaleString()}</p>
      <hr>
      <p><small>FinancePlus by Heropixel Technologies</small></p>
    `;

    await sendEmail(to, testSubject, testBody);

    // Log the action
    await auditLog(req.user.id, 'TEST', 'EMAIL', `Sent test email to ${to}`);

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

module.exports = router;