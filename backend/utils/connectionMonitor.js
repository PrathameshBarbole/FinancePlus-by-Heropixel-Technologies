const dns = require('dns');
const { promisify } = require('util');
const emailService = require('./emailService');

const lookup = promisify(dns.lookup);

class ConnectionMonitor {
    constructor() {
        this.isOnline = false;
        this.checkInterval = parseInt(process.env.CONNECTION_CHECK_INTERVAL) || 30000; // 30 seconds
        this.intervalId = null;
        this.listeners = [];
    }

    async checkConnection() {
        try {
            // Try to resolve Google's DNS
            await lookup('google.com');
            const wasOffline = !this.isOnline;
            this.isOnline = true;
            
            if (wasOffline) {
                console.log('✅ Internet connection restored');
                this.notifyListeners('online');
                // Process queued emails when connection is restored
                await emailService.processQueue();
            }
            
            return true;
        } catch (error) {
            const wasOnline = this.isOnline;
            this.isOnline = false;
            
            if (wasOnline) {
                console.log('❌ Internet connection lost');
                this.notifyListeners('offline');
            }
            
            return false;
        }
    }

    startMonitoring() {
        if (this.intervalId) {
            this.stopMonitoring();
        }

        console.log(`🔍 Starting connection monitoring (checking every ${this.checkInterval/1000}s)`);
        
        // Initial check
        this.checkConnection();
        
        // Set up periodic checks
        this.intervalId = setInterval(() => {
            this.checkConnection();
        }, this.checkInterval);
    }

    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏹️ Connection monitoring stopped');
        }
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    notifyListeners(status) {
        this.listeners.forEach(callback => {
            try {
                callback(status, this.isOnline);
            } catch (error) {
                console.error('Error in connection listener:', error);
            }
        });
    }

    getStatus() {
        return {
            isOnline: this.isOnline,
            lastCheck: new Date(),
            checkInterval: this.checkInterval
        };
    }

    async testConnection(host = 'google.com') {
        try {
            await lookup(host);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Method to manually trigger email queue processing
    async processEmailQueue() {
        if (this.isOnline) {
            try {
                await emailService.processQueue();
                return { success: true, message: 'Email queue processed successfully' };
            } catch (error) {
                return { success: false, message: 'Error processing email queue: ' + error.message };
            }
        } else {
            return { success: false, message: 'No internet connection available' };
        }
    }
}

// Create singleton instance
const connectionMonitor = new ConnectionMonitor();

// Graceful shutdown
process.on('SIGINT', () => {
    connectionMonitor.stopMonitoring();
    process.exit(0);
});

process.on('SIGTERM', () => {
    connectionMonitor.stopMonitoring();
    process.exit(0);
});

module.exports = connectionMonitor;