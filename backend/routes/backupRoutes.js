const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { auditLog } = require('../utils/auditService');
const { createBackup, restoreBackup, listBackups, deleteBackup } = require('../utils/backupService');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for backup file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../backups/'));
  },
  filename: function (req, file, cb) {
    cb(null, `restore_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Get all backups
router.get('/', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({ success: true, data: backups });
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ success: false, message: 'Failed to list backups' });
  }
});

// Create new backup
router.post('/create', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { description, includeTransactions = true } = req.body;

    const backupInfo = await createBackup({
      description: description || 'Manual backup',
      includeTransactions: includeTransactions === true || includeTransactions === 'true',
      createdBy: req.user.id
    });

    // Log the action
    await auditLog(req.user.id, 'CREATE', 'BACKUP', `Created backup: ${backupInfo.filename}`);

    res.status(201).json({ 
      success: true, 
      message: 'Backup created successfully', 
      data: backupInfo 
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create backup',
      error: error.message 
    });
  }
});

// Download backup file
router.get('/download/:filename', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { filename } = req.params;
    const backupPath = path.join(__dirname, '../backups/', filename);

    // Verify file exists and is a backup file
    try {
      await fs.access(backupPath);
    } catch (error) {
      return res.status(404).json({ success: false, message: 'Backup file not found' });
    }

    // Verify filename is safe (no directory traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    }

    // Log the action
    await auditLog(req.user.id, 'DOWNLOAD', 'BACKUP', `Downloaded backup: ${filename}`);

    res.download(backupPath, filename, (err) => {
      if (err) {
        console.error('Error downloading backup:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Failed to download backup' });
        }
      }
    });
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ success: false, message: 'Failed to download backup' });
  }
});

// Upload and restore backup
router.post('/restore', authMiddleware, roleMiddleware(['admin']), upload.single('backupFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Backup file is required' });
    }

    const { replaceExisting = false } = req.body;
    const backupPath = req.file.path;

    try {
      // Validate backup file
      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      
      if (!backupData.metadata || !backupData.data) {
        throw new Error('Invalid backup file format');
      }

      // Restore backup
      const restoreInfo = await restoreBackup(backupPath, {
        replaceExisting: replaceExisting === true || replaceExisting === 'true',
        restoredBy: req.user.id
      });

      // Clean up uploaded file
      await fs.unlink(backupPath);

      // Log the action
      await auditLog(req.user.id, 'RESTORE', 'BACKUP', `Restored backup: ${req.file.originalname}`);

      res.json({ 
        success: true, 
        message: 'Backup restored successfully', 
        data: restoreInfo 
      });
    } catch (error) {
      // Clean up uploaded file on error
      try {
        await fs.unlink(backupPath);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restore backup',
      error: error.message 
    });
  }
});

// Restore from existing backup file
router.post('/restore/:filename', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { filename } = req.params;
    const { replaceExisting = false } = req.body;
    
    // Verify filename is safe
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    }

    const backupPath = path.join(__dirname, '../backups/', filename);

    // Verify file exists
    try {
      await fs.access(backupPath);
    } catch (error) {
      return res.status(404).json({ success: false, message: 'Backup file not found' });
    }

    const restoreInfo = await restoreBackup(backupPath, {
      replaceExisting: replaceExisting === true || replaceExisting === 'true',
      restoredBy: req.user.id
    });

    // Log the action
    await auditLog(req.user.id, 'RESTORE', 'BACKUP', `Restored backup: ${filename}`);

    res.json({ 
      success: true, 
      message: 'Backup restored successfully', 
      data: restoreInfo 
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restore backup',
      error: error.message 
    });
  }
});

// Delete backup
router.delete('/:filename', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Verify filename is safe
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    }

    await deleteBackup(filename);

    // Log the action
    await auditLog(req.user.id, 'DELETE', 'BACKUP', `Deleted backup: ${filename}`);

    res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete backup',
      error: error.message 
    });
  }
});

// Get backup information
router.get('/info/:filename', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Verify filename is safe
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    }

    const backupPath = path.join(__dirname, '../backups/', filename);

    // Verify file exists
    try {
      await fs.access(backupPath);
    } catch (error) {
      return res.status(404).json({ success: false, message: 'Backup file not found' });
    }

    // Read backup metadata
    const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
    const stats = await fs.stat(backupPath);

    const backupInfo = {
      filename,
      metadata: backupData.metadata,
      fileSize: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      recordCounts: {}
    };

    // Count records in each table
    if (backupData.data) {
      Object.keys(backupData.data).forEach(table => {
        if (Array.isArray(backupData.data[table])) {
          backupInfo.recordCounts[table] = backupData.data[table].length;
        }
      });
    }

    res.json({ success: true, data: backupInfo });
  } catch (error) {
    console.error('Error getting backup info:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get backup information',
      error: error.message 
    });
  }
});

// Schedule automatic backup
router.post('/schedule', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { frequency = 'weekly', time = '02:00', enabled = true } = req.body;

    // Validate frequency
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid frequency. Must be daily, weekly, or monthly' 
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid time format. Use HH:MM format' 
      });
    }

    // Save schedule settings (this would typically be saved to settings)
    const scheduleConfig = {
      frequency,
      time,
      enabled: enabled === true || enabled === 'true',
      lastRun: null,
      nextRun: null // This would be calculated based on frequency and time
    };

    // Log the action
    await auditLog(req.user.id, 'SCHEDULE', 'BACKUP', `Configured automatic backup: ${frequency} at ${time}`);

    res.json({ 
      success: true, 
      message: 'Backup schedule configured successfully', 
      data: scheduleConfig 
    });
  } catch (error) {
    console.error('Error scheduling backup:', error);
    res.status(500).json({ success: false, message: 'Failed to schedule backup' });
  }
});

// Get backup statistics
router.get('/stats/overview', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const backups = await listBackups();
    
    const stats = {
      total_backups: backups.length,
      total_size: backups.reduce((sum, backup) => sum + backup.size, 0),
      oldest_backup: backups.length > 0 ? backups[backups.length - 1].created : null,
      newest_backup: backups.length > 0 ? backups[0].created : null,
      backup_types: {
        manual: backups.filter(b => b.type === 'manual').length,
        automatic: backups.filter(b => b.type === 'automatic').length
      }
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching backup stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch backup statistics' });
  }
});

// Cleanup old backups
router.post('/cleanup', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { keepCount = 10 } = req.body;

    if (keepCount < 1) {
      return res.status(400).json({ 
        success: false, 
        message: 'Keep count must be at least 1' 
      });
    }

    const backups = await listBackups();
    
    if (backups.length <= keepCount) {
      return res.json({ 
        success: true, 
        message: 'No cleanup needed', 
        data: { deleted: 0, remaining: backups.length } 
      });
    }

    // Delete oldest backups beyond keepCount
    const toDelete = backups.slice(keepCount);
    let deletedCount = 0;

    for (const backup of toDelete) {
      try {
        await deleteBackup(backup.filename);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting backup ${backup.filename}:`, error);
      }
    }

    // Log the action
    await auditLog(req.user.id, 'CLEANUP', 'BACKUP', `Cleaned up ${deletedCount} old backups`);

    res.json({ 
      success: true, 
      message: `Cleanup completed. Deleted ${deletedCount} old backups`, 
      data: { deleted: deletedCount, remaining: backups.length - deletedCount } 
    });
  } catch (error) {
    console.error('Error cleaning up backups:', error);
    res.status(500).json({ success: false, message: 'Failed to cleanup backups' });
  }
});

module.exports = router;