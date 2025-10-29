#!/usr/bin/env node

require('dotenv').config();
const mainDb = require('../config/db_main');
const User = require('../models/User');

async function initializeAdmin() {
    try {
        console.log('🏢 FinancePlus - Auto Admin Initialization');
        console.log('📝 Developed by Heropixel Technologies');
        console.log('=' .repeat(50));
        
        // Connect to database
        console.log('📊 Connecting to database...');
        await mainDb.connect();
        console.log('✅ Database connected successfully');
        
        // Check if admin already exists
        const existingAdmins = await mainDb.all('SELECT * FROM users WHERE role = "admin"');
        
        if (existingAdmins.length > 0) {
            console.log('\n⚠️  Admin user already exists!');
            console.log('Existing admin(s):');
            existingAdmins.forEach((admin, index) => {
                console.log(`${index + 1}. ${admin.name} (${admin.email})`);
            });
            await mainDb.close();
            return;
        }
        
        console.log('\n🔄 Creating default admin user...');
        
        // Create default admin user
        const result = await User.create({
            name: 'Admin User',
            email: 'admin@financeplus.com',
            password: 'Admin@123',
            role: 'admin'
        });
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        console.log('✅ Admin user created successfully!');
        console.log('\n📋 Admin Details:');
        console.log(`👤 Name: ${result.user.name}`);
        console.log(`📧 Email: ${result.user.email}`);
        console.log(`🔑 Password: Admin@123`);
        console.log(`🔑 Role: ${result.user.role}`);
        console.log(`🆔 ID: ${result.user.id}`);
        
        // Create a demo employee user
        console.log('\n🔄 Creating demo employee user...');
        const employeeResult = await User.create({
            name: 'Employee Demo',
            email: 'employee@financeplus.com',
            password: 'Employee@123',
            role: 'employee'
        });
        
        if (employeeResult.success) {
            console.log('✅ Employee user created successfully!');
            console.log(`👤 Name: ${employeeResult.user.name}`);
            console.log(`📧 Email: ${employeeResult.user.email}`);
            console.log(`🔑 Password: Employee@123`);
            console.log(`🔑 Role: ${employeeResult.user.role}`);
        }
        
        console.log('\n🎉 Initialization completed!');
        console.log('🚀 You can now start the FinancePlus server and login with these credentials.');
        
    } catch (error) {
        console.error('\n❌ Error during initialization:', error.message);
        process.exit(1);
    } finally {
        await mainDb.close();
    }
}

// Run the initialization
initializeAdmin().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});

module.exports = initializeAdmin;