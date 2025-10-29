#!/usr/bin/env node

require('dotenv').config();
const readline = require('readline');
const mainDb = require('../config/db_main');
const User = require('../models/User');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function questionHidden(prompt) {
    return new Promise((resolve) => {
        process.stdout.write(prompt);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        let password = '';
        
        const onData = (char) => {
            switch (char) {
                case '\n':
                case '\r':
                case '\u0004': // Ctrl+D
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    process.stdin.removeListener('data', onData);
                    console.log('');
                    resolve(password);
                    break;
                case '\u0003': // Ctrl+C
                    process.exit();
                    break;
                case '\u007f': // Backspace
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                    break;
                default:
                    password += char;
                    process.stdout.write('*');
                    break;
            }
        };
        
        process.stdin.on('data', onData);
    });
}

async function initializeAdmin() {
    try {
        console.log('🏢 FinancePlus - Admin Initialization');
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
            
            const overwrite = await question('\nDo you want to create another admin? (y/N): ');
            if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
                console.log('👋 Admin initialization cancelled');
                rl.close();
                await mainDb.close();
                return;
            }
        }
        
        console.log('\n📝 Please provide admin details:');
        
        // Get admin details
        const name = await question('👤 Admin Name: ');
        if (!name.trim()) {
            throw new Error('Admin name is required');
        }
        
        const email = await question('📧 Admin Email: ');
        if (!email.trim()) {
            throw new Error('Admin email is required');
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }
        
        // Check if email already exists
        const existingUser = await mainDb.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            throw new Error('Email already exists');
        }
        
        const password = await questionHidden('🔒 Admin Password: ');
        if (!password.trim()) {
            throw new Error('Admin password is required');
        }
        
        const confirmPassword = await questionHidden('🔒 Confirm Password: ');
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }
        
        console.log('\n🔄 Creating admin user...');
        
        // Create admin user
        const result = await User.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: password,
            role: 'admin'
        });
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        console.log('✅ Admin user created successfully!');
        console.log('\n📋 Admin Details:');
        console.log(`👤 Name: ${result.user.name}`);
        console.log(`📧 Email: ${result.user.email}`);
        console.log(`🔑 Role: ${result.user.role}`);
        console.log(`🆔 ID: ${result.user.id}`);
        
        console.log('\n🎉 Admin initialization completed!');
        console.log('🚀 You can now start the FinancePlus server and login with these credentials.');
        
    } catch (error) {
        console.error('\n❌ Error during admin initialization:', error.message);
        process.exit(1);
    } finally {
        rl.close();
        await mainDb.close();
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
    console.log('\n\n👋 Admin initialization cancelled by user');
    rl.close();
    await mainDb.close();
    process.exit(0);
});

// Run the initialization
if (require.main === module) {
    initializeAdmin().catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = initializeAdmin;