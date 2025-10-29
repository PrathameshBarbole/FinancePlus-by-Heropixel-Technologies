const nodemailer = require('nodemailer');
const mainDb = require('../config/db_main');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.initializeTransporter();
    }

    async initializeTransporter() {
        try {
            const smtpConfig = {
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true' || false,
                auth: {
                    user: process.env.SMTP_EMAIL,
                    pass: process.env.SMTP_PASSWORD
                }
            };

            if (smtpConfig.auth.user && smtpConfig.auth.pass) {
                this.transporter = nodemailer.createTransporter(smtpConfig);
                
                // Verify connection
                await this.transporter.verify();
                this.isConfigured = true;
                console.log('✅ Email service configured successfully');
            } else {
                console.log('⚠️ Email service not configured - missing SMTP credentials');
            }
        } catch (error) {
            console.error('❌ Email service configuration failed:', error.message);
            this.isConfigured = false;
        }
    }

    async queueEmail(to, subject, body, priority = 'normal') {
        try {
            const result = await mainDb.run(
                `INSERT INTO email_queue (to_email, subject, body, status, scheduled_at) 
                 VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
                [to, subject, body]
            );

            console.log(`📧 Email queued for ${to}: ${subject}`);
            return { success: true, queueId: result.id };
        } catch (error) {
            console.error('Error queueing email:', error);
            return { success: false, error: error.message };
        }
    }

    async sendEmail(to, subject, body) {
        if (!this.isConfigured) {
            throw new Error('Email service not configured');
        }

        const mailOptions = {
            from: `"FinancePlus" <${process.env.SMTP_EMAIL}>`,
            to: to,
            subject: subject,
            html: body
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent successfully to ${to}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error(`❌ Failed to send email to ${to}:`, error.message);
            throw error;
        }
    }

    async processQueue() {
        if (!this.isConfigured) {
            console.log('⚠️ Email service not configured, skipping queue processing');
            return;
        }

        try {
            // Get pending emails
            const pendingEmails = await mainDb.all(
                `SELECT * FROM email_queue 
                 WHERE status = 'pending' AND attempts < max_attempts 
                 ORDER BY scheduled_at ASC LIMIT 10`
            );

            if (pendingEmails.length === 0) {
                return;
            }

            console.log(`📬 Processing ${pendingEmails.length} queued emails`);

            for (const email of pendingEmails) {
                try {
                    // Increment attempt count
                    await mainDb.run(
                        'UPDATE email_queue SET attempts = attempts + 1 WHERE id = ?',
                        [email.id]
                    );

                    // Try to send email
                    await this.sendEmail(email.to_email, email.subject, email.body);

                    // Mark as sent
                    await mainDb.run(
                        'UPDATE email_queue SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?',
                        ['sent', email.id]
                    );

                } catch (error) {
                    console.error(`Failed to send queued email ${email.id}:`, error.message);

                    // Check if max attempts reached
                    if (email.attempts + 1 >= email.max_attempts) {
                        await mainDb.run(
                            'UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?',
                            ['failed', error.message, email.id]
                        );
                    } else {
                        await mainDb.run(
                            'UPDATE email_queue SET error_message = ? WHERE id = ?',
                            [error.message, email.id]
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Error processing email queue:', error);
        }
    }

    async getQueueStatus() {
        try {
            const stats = await mainDb.all(`
                SELECT status, COUNT(*) as count 
                FROM email_queue 
                GROUP BY status
            `);

            const result = {
                pending: 0,
                sent: 0,
                failed: 0,
                total: 0
            };

            stats.forEach(stat => {
                result[stat.status] = stat.count;
                result.total += stat.count;
            });

            return result;
        } catch (error) {
            console.error('Error getting queue status:', error);
            return { pending: 0, sent: 0, failed: 0, total: 0 };
        }
    }

    async retryFailedEmails() {
        try {
            const result = await mainDb.run(
                `UPDATE email_queue 
                 SET status = 'pending', attempts = 0, error_message = NULL 
                 WHERE status = 'failed'`
            );

            console.log(`🔄 Reset ${result.changes} failed emails for retry`);
            return { success: true, count: result.changes };
        } catch (error) {
            console.error('Error retrying failed emails:', error);
            return { success: false, error: error.message };
        }
    }

    async clearOldEmails(daysOld = 30) {
        try {
            const result = await mainDb.run(
                `DELETE FROM email_queue 
                 WHERE status IN ('sent', 'failed') 
                 AND created_at < datetime('now', '-${daysOld} days')`
            );

            console.log(`🗑️ Cleaned up ${result.changes} old emails`);
            return { success: true, count: result.changes };
        } catch (error) {
            console.error('Error cleaning up old emails:', error);
            return { success: false, error: error.message };
        }
    }

    // Template methods for common emails
    async sendWelcomeEmail(customerEmail, customerName) {
        const subject = 'Welcome to FinancePlus';
        const body = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Welcome to FinancePlus!</h2>
                <p>Dear ${customerName},</p>
                <p>Welcome to our financial services. We're excited to have you as our customer.</p>
                <p>Your account has been successfully created and is ready to use.</p>
                <p>If you have any questions, please don't hesitate to contact us.</p>
                <br>
                <p>Best regards,<br>FinancePlus Team</p>
                <hr>
                <p style="font-size: 12px; color: #666;">
                    This is an automated message from FinancePlus by Heropixel Technologies.
                </p>
            </div>
        `;

        return await this.queueEmail(customerEmail, subject, body);
    }

    async sendTransactionAlert(customerEmail, customerName, transactionDetails) {
        const subject = `Transaction Alert - ${transactionDetails.type}`;
        const body = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Transaction Alert</h2>
                <p>Dear ${customerName},</p>
                <p>A transaction has been processed on your account:</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Transaction Type:</strong> ${transactionDetails.type}</p>
                    <p><strong>Amount:</strong> ₹${transactionDetails.amount}</p>
                    <p><strong>Date:</strong> ${transactionDetails.date}</p>
                    <p><strong>Balance:</strong> ₹${transactionDetails.balance}</p>
                    <p><strong>Reference:</strong> ${transactionDetails.reference}</p>
                </div>
                <p>If you have any questions about this transaction, please contact us immediately.</p>
                <br>
                <p>Best regards,<br>FinancePlus Team</p>
                <hr>
                <p style="font-size: 12px; color: #666;">
                    This is an automated message from FinancePlus by Heropixel Technologies.
                </p>
            </div>
        `;

        return await this.queueEmail(customerEmail, subject, body);
    }

    async sendMaturityAlert(customerEmail, customerName, maturityDetails) {
        const subject = `Maturity Alert - ${maturityDetails.type}`;
        const body = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Maturity Alert</h2>
                <p>Dear ${customerName},</p>
                <p>Your ${maturityDetails.type} is maturing soon:</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Product:</strong> ${maturityDetails.type}</p>
                    <p><strong>Number:</strong> ${maturityDetails.number}</p>
                    <p><strong>Maturity Date:</strong> ${maturityDetails.maturityDate}</p>
                    <p><strong>Maturity Amount:</strong> ₹${maturityDetails.maturityAmount}</p>
                </div>
                <p>Please visit our office to complete the maturity process.</p>
                <br>
                <p>Best regards,<br>FinancePlus Team</p>
                <hr>
                <p style="font-size: 12px; color: #666;">
                    This is an automated message from FinancePlus by Heropixel Technologies.
                </p>
            </div>
        `;

        return await this.queueEmail(customerEmail, subject, body);
    }
}

module.exports = new EmailService();