const mainDb = require('../config/db_main');
const BcryptHelper = require('../utils/bcryptHelper');

class User {
    static async create(userData) {
        try {
            const { name, email, password, role = 'employee', profile_photo = null } = userData;

            // Validate required fields
            if (!name || !email || !password) {
                throw new Error('Name, email, and password are required');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Invalid email format');
            }

            // Validate role
            if (!['admin', 'employee'].includes(role)) {
                throw new Error('Invalid role. Must be admin or employee');
            }

            // Check if email already exists
            const existingUser = await mainDb.get('SELECT id FROM users WHERE email = ?', [email]);
            if (existingUser) {
                throw new Error('Email already exists');
            }

            // Validate password strength
            const passwordValidation = await BcryptHelper.validatePasswordStrength(password);
            if (!passwordValidation.isValid) {
                throw new Error('Password validation failed: ' + passwordValidation.errors.join(', '));
            }

            // Hash password
            const hashedPassword = await BcryptHelper.hashPassword(password);

            // Insert user
            const result = await mainDb.run(
                `INSERT INTO users (name, email, password, role, profile_photo, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [name, email, hashedPassword, role, profile_photo]
            );

            return {
                success: true,
                user: {
                    id: result.id,
                    name,
                    email,
                    role,
                    profile_photo,
                    is_active: true
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findById(id) {
        try {
            const user = await mainDb.get(
                'SELECT id, name, email, role, profile_photo, is_active, created_at, updated_at FROM users WHERE id = ?',
                [id]
            );

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findByEmail(email) {
        try {
            const user = await mainDb.get(
                'SELECT id, name, email, password, role, profile_photo, is_active, created_at, updated_at FROM users WHERE email = ?',
                [email]
            );

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async findAll(filters = {}) {
        try {
            let query = 'SELECT id, name, email, role, profile_photo, is_active, created_at, updated_at FROM users WHERE 1=1';
            const params = [];

            // Apply filters
            if (filters.role) {
                query += ' AND role = ?';
                params.push(filters.role);
            }

            if (filters.is_active !== undefined) {
                query += ' AND is_active = ?';
                params.push(filters.is_active ? 1 : 0);
            }

            if (filters.search) {
                query += ' AND (name LIKE ? OR email LIKE ?)';
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm);
            }

            query += ' ORDER BY created_at DESC';

            // Pagination
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
                
                if (filters.offset) {
                    query += ' OFFSET ?';
                    params.push(filters.offset);
                }
            }

            const users = await mainDb.all(query, params);

            return { success: true, users };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async update(id, updateData) {
        try {
            const { name, email, role, profile_photo, is_active } = updateData;

            // Check if user exists
            const existingUser = await this.findById(id);
            if (!existingUser.success) {
                return existingUser;
            }

            // Validate email if provided
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new Error('Invalid email format');
                }

                // Check if email is already taken by another user
                const emailCheck = await mainDb.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
                if (emailCheck) {
                    throw new Error('Email already exists');
                }
            }

            // Validate role if provided
            if (role && !['admin', 'employee'].includes(role)) {
                throw new Error('Invalid role. Must be admin or employee');
            }

            // Build update query dynamically
            const updateFields = [];
            const params = [];

            if (name !== undefined) {
                updateFields.push('name = ?');
                params.push(name);
            }

            if (email !== undefined) {
                updateFields.push('email = ?');
                params.push(email);
            }

            if (role !== undefined) {
                updateFields.push('role = ?');
                params.push(role);
            }

            if (profile_photo !== undefined) {
                updateFields.push('profile_photo = ?');
                params.push(profile_photo);
            }

            if (is_active !== undefined) {
                updateFields.push('is_active = ?');
                params.push(is_active ? 1 : 0);
            }

            if (updateFields.length === 0) {
                throw new Error('No fields to update');
            }

            updateFields.push('updated_at = CURRENT_TIMESTAMP');
            params.push(id);

            const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
            await mainDb.run(query, params);

            // Return updated user
            return await this.findById(id);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async updatePassword(id, currentPassword, newPassword) {
        try {
            // Get user with password
            const userResult = await mainDb.get('SELECT password FROM users WHERE id = ?', [id]);
            if (!userResult) {
                throw new Error('User not found');
            }

            // Verify current password
            const isCurrentPasswordValid = await BcryptHelper.comparePassword(currentPassword, userResult.password);
            if (!isCurrentPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            // Validate new password strength
            const passwordValidation = await BcryptHelper.validatePasswordStrength(newPassword);
            if (!passwordValidation.isValid) {
                throw new Error('New password validation failed: ' + passwordValidation.errors.join(', '));
            }

            // Hash new password
            const hashedNewPassword = await BcryptHelper.hashPassword(newPassword);

            // Update password
            await mainDb.run(
                'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [hashedNewPassword, id]
            );

            return { success: true, message: 'Password updated successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async delete(id) {
        try {
            // Check if user exists
            const existingUser = await this.findById(id);
            if (!existingUser.success) {
                return existingUser;
            }

            // Soft delete - set is_active to false instead of actual deletion
            await mainDb.run(
                'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [id]
            );

            return { success: true, message: 'User deactivated successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async activate(id) {
        try {
            // Check if user exists
            const existingUser = await this.findById(id);
            if (!existingUser.success) {
                return existingUser;
            }

            await mainDb.run(
                'UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [id]
            );

            return { success: true, message: 'User activated successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async authenticate(email, password) {
        try {
            // Find user by email
            const userResult = await this.findByEmail(email);
            if (!userResult.success) {
                return { success: false, error: 'Invalid email or password' };
            }

            const user = userResult.user;

            // Check if user is active
            if (!user.is_active) {
                return { success: false, error: 'Account is deactivated' };
            }

            // Verify password
            const isPasswordValid = await BcryptHelper.comparePassword(password, user.password);
            if (!isPasswordValid) {
                return { success: false, error: 'Invalid email or password' };
            }

            // Remove password from user object
            const { password: _, ...userWithoutPassword } = user;

            return { success: true, user: userWithoutPassword };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getStats() {
        try {
            const stats = await mainDb.all(`
                SELECT 
                    role,
                    is_active,
                    COUNT(*) as count
                FROM users 
                GROUP BY role, is_active
            `);

            const result = {
                total: 0,
                active: 0,
                inactive: 0,
                admin: 0,
                employee: 0
            };

            stats.forEach(stat => {
                result.total += stat.count;
                
                if (stat.is_active) {
                    result.active += stat.count;
                } else {
                    result.inactive += stat.count;
                }

                if (stat.role === 'admin') {
                    result.admin += stat.count;
                } else if (stat.role === 'employee') {
                    result.employee += stat.count;
                }
            });

            return { success: true, stats: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = User;