# FinancePlus - Offline-First Finance Management Software

**Developed by Heropixel Technologies**

FinancePlus is a comprehensive, offline-first finance management software designed specifically for cooperative institutions like Gramin Patsanstha. Built with modern web technologies, it provides a complete banking-style system that works entirely offline while maintaining professional-grade security and functionality.

## 🌟 Key Features

### 🔒 **Offline-First Architecture**
- Complete functionality without internet connection
- Local SQLite databases for all data storage
- Automatic email queue that sends when connectivity is restored
- Real-time connection monitoring and status indicators

### 👥 **User Management**
- Role-based access control (Admin & Employee)
- Secure authentication with JWT tokens
- Password hashing with bcrypt
- Session management with configurable timeouts

### 🏦 **Core Banking Features**
- **Customer Management**: Complete customer profiles with documents
- **Account Management**: Savings accounts with deposit/withdrawal operations
- **Fixed Deposits (FD)**: Interest calculation and maturity tracking
- **Recurring Deposits (RD)**: Monthly installment management
- **Loans**: EMI calculation, payment tracking, and schedules
- **Transactions**: Complete transaction history and passbook generation

### 📊 **Reports & Analytics**
- Dashboard with real-time statistics
- Customer statements and account passbooks
- FD maturity reports and loan schedules
- Daily cash reports and monthly summaries
- Custom date range reports

### 📧 **Email System**
- Offline email queue with automatic retry
- SMTP configuration for notifications
- Email templates for various operations
- Connection-aware email processing

### 🔐 **Security & Backup**
- AES-encrypted backup system
- Automated weekly backups with retention policy
- Complete audit trail for all operations
- Database integrity checks on startup

### 🎨 **Modern UI/UX**
- Clay morphism design with soft shadows
- Light/Dark theme toggle
- Responsive design for desktop and tablet
- Bilingual support (English/Marathi)
- Live clock and notification system

## 🛠 Technology Stack

### Backend
- **Node.js** with Express.js framework
- **SQLite** databases (main + transactions)
- **JWT** for authentication
- **bcrypt** for password hashing
- **Nodemailer** for email functionality
- **Multer** for file uploads

### Frontend
- **React** with Vite build tool
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Axios** for API communication
- **React Router** for navigation

### Database
- **SQLite** - Two separate databases:
  - `financeplus_main.db` - Core application data
  - `transactions.db` - Transaction records for performance

## 📁 Project Structure

```
FinancePlus/
├── backend/
│   ├── server.js                 # Main server file
│   ├── config/                   # Database configurations
│   ├── data/                     # SQLite database files
│   ├── models/                   # Database models
│   ├── routes/                   # API route handlers
│   ├── middleware/               # Authentication & authorization
│   ├── utils/                    # Utility services
│   ├── scripts/                  # Initialization scripts
│   └── backups/                  # Backup storage
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable UI components
│   │   ├── pages/                # Application pages
│   │   ├── context/              # React context providers
│   │   └── api/                  # API configuration
│   └── public/                   # Static assets
└── README.md
```

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FinancePlus-by-Heropixel-Technologies
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cd ../backend
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-here
   
   # Email Configuration (Optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   
   # Backup Encryption Key
   BACKUP_KEY=your-backup-encryption-key
   
   # Server Configuration
   PORT=12001
   NODE_ENV=production
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm start
   ```

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the application**
   - Frontend: http://localhost:12000
   - Backend API: http://localhost:12001

### First-Time Setup

1. **Create Admin User**
   On first startup, the system will prompt you to create an admin user:
   ```bash
   cd backend
   node scripts/initAdmin.js
   ```

2. **Login to the System**
   Use the admin credentials you created to log into the web interface.

## 📖 User Guide

### Admin Functions
- **Employee Management**: Add, edit, and manage employee accounts
- **System Settings**: Configure institute details, email settings, and interest rates
- **Backup Management**: Create, restore, and manage system backups
- **Reports**: Access all reports and analytics
- **Audit Logs**: View complete system activity logs

### Employee Functions
- **Customer Management**: Add and manage customer profiles
- **Account Operations**: Handle deposits, withdrawals, and transfers
- **FD/RD Management**: Create and manage fixed and recurring deposits
- **Loan Processing**: Process loan applications and payments
- **Transaction Processing**: Handle all financial transactions

### Key Workflows

#### Adding a New Customer
1. Navigate to Customers → Add Customer
2. Fill in customer details and upload documents
3. Save customer profile
4. Create associated accounts as needed

#### Processing a Deposit
1. Go to Transactions → Deposit
2. Select customer account
3. Enter deposit amount and details
4. Confirm transaction
5. Print receipt if needed

#### Creating a Fixed Deposit
1. Navigate to FD → New FD
2. Select customer and enter FD details
3. System calculates maturity amount automatically
4. Confirm FD creation

## 🔧 Configuration

### Email Settings
Configure SMTP settings in the Settings page:
- SMTP Host, Port, and Security
- Email credentials
- From name and email address

### Interest Rates
Set interest rates for:
- Savings accounts
- Fixed deposits (by tenure)
- Recurring deposits
- Loans (by type)

### Backup Configuration
- Automatic backup frequency
- Number of backups to retain
- Backup encryption settings

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Session timeout management
- Password strength requirements

### Data Protection
- bcrypt password hashing
- AES encryption for backups
- SQL injection prevention
- XSS protection with helmet.js

### Audit Trail
Complete logging of all system activities:
- User login/logout
- All CRUD operations
- Transaction processing
- System configuration changes

## 📊 Database Schema

### Main Database Tables
- **users**: System users (admin/employees)
- **customers**: Customer information
- **accounts**: Bank accounts
- **fds**: Fixed deposits
- **rds**: Recurring deposits
- **loans**: Loan records
- **email_queue**: Email queue for offline processing
- **activity_logs**: Audit trail

### Transaction Database
- **transactions**: All financial transactions
- Separate database for performance optimization

## 🔄 Backup & Recovery

### Automatic Backups
- Weekly automated backups
- Configurable retention policy
- AES encryption for security

### Manual Backup/Restore
- On-demand backup creation
- Encrypted backup files
- Complete system restore capability

### Backup Contents
- All customer and account data
- Transaction history
- System configuration
- User accounts (passwords excluded)

## 🌐 Offline Capabilities

### Core Offline Features
- Complete application functionality
- Local data storage and processing
- Offline transaction processing
- Local report generation

### Online Synchronization
- Email queue processing when online
- Automatic backup uploads (if configured)
- System updates and notifications

## 🎨 Customization

### Branding
- Institute name and logo
- Custom color schemes
- Personalized email templates

### Localization
- English and Marathi language support
- Currency formatting (INR)
- Date and number formats

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**
- Check if SQLite files exist in `/backend/data/`
- Verify file permissions
- Run database health check: `node scripts/dbHealthCheck.js`

**Email Not Sending**
- Verify SMTP configuration
- Check internet connectivity
- Review email queue status

**Login Issues**
- Reset admin password: `node scripts/initAdmin.js`
- Check JWT secret configuration
- Verify user account status

### Log Files
- Backend logs: `backend/server.log`
- Frontend logs: Browser developer console
- Audit logs: Available in the application

## 📞 Support & Maintenance

### Regular Maintenance
- Weekly backup verification
- Database integrity checks
- Log file rotation
- Security updates

### Performance Optimization
- Regular database cleanup
- Transaction log archival
- Cache management

## 🏢 About Heropixel Technologies

FinancePlus is developed by **Heropixel Technologies**, a software development company specializing in financial and business management solutions. We focus on creating robust, user-friendly applications that help organizations manage their operations efficiently.

### Contact Information
- **Developer**: Heropixel Technologies
- **Website**: [Contact for more information]
- **Support**: [Contact for support]

## 📄 License

This software is proprietary and developed by Heropixel Technologies. All rights reserved.

## 🔄 Version History

### Version 1.0.0 (Current)
- Initial release with complete offline-first functionality
- Full banking operations support
- Modern React-based user interface
- Comprehensive reporting system
- Multi-user support with role-based access

---

**Built with ❤️ by Heropixel Technologies © 2025**

*For technical support or feature requests, please contact Heropixel Technologies.*