import jwt from 'jsonwebtoken';
import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';

class AuthService {
    /**
     * Register a new user using Supabase Auth
     */
    async register(userData) {
        try {
            const { email, password, full_name, role = 'employee' } = userData;

            // Check if user already exists in our users table
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('email')
                .eq('email', email)
                .single();

            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            // Check if this is the first user (should be owner)
            const { count, error: countError } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true });

            const isFirstUser = count === 0;
            const finalRole = isFirstUser ? 'owner' : role;

            // First user (owner) gets ["all"], everyone else gets []
            const finalPermissions = finalRole === 'owner' ? ['all'] : [];

            // Get the first branch (if exists)
            const { data: branch, error: branchError } = await supabase
                .from('branches')
                .select('id')
                .limit(1)
                .single();

            // Create user using Supabase Auth signUp
            // This will create the user in auth.users and trigger your handle_new_user function
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: full_name,
                        role: finalRole
                    }
                }
            });

            if (authError) {
                logger.error('Auth creation error:', authError);

                // Check if user already exists in auth
                if (authError.message.includes('User already registered')) {
                    throw new Error('User with this email already exists');
                }

                throw new Error('Failed to create user: ' + authError.message);
            }

            if (!authData.user) {
                throw new Error('Failed to create user - no user returned');
            }

            // The handle_new_user trigger should create the user in our users table
            // But let's wait a moment and check if the user was created
            let user = null;
            let attempts = 0;
            const maxAttempts = 5;

            while (attempts < maxAttempts && !user) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', authData.user.id)
                    .single();

                if (!userError && userData) {
                    user = userData;
                    break;
                }
                attempts++;
            }

            // If user wasn't created by the trigger, create them manually
            if (!user) {
                logger.warn('User not created by trigger, creating manually...');

                const { data: newUser, error: createError } = await supabase
                    .from('users')
                    .insert([{
                        id: authData.user.id,
                        email: email,
                        full_name: full_name,
                        role: finalRole,
                        permissions: finalPermissions,
                        branch_id: branch?.id || null,
                        is_active: true
                    }])
                    .select()
                    .single();

                if (createError) {
                    logger.error('Manual user creation error:', createError);
                    throw new Error('Failed to create user record: ' + createError.message);
                }

                user = newUser;
            } else {
                // Trigger created the user, but the trigger doesn't know about permissions.
                // Backfill permissions if they're missing or wrong.
                const existingPerms = Array.isArray(user.permissions) ? user.permissions : null;

                if (existingPerms === null || existingPerms.length === 0) {
                    const { data: updated } = await supabase
                        .from('users')
                        .update({ permissions: finalPermissions })
                        .eq('id', user.id)
                        .select()
                        .single();
                    if (updated) user = updated;
                }
            }

            // Defensive: ensure user.permissions is always an array in the response
            if (!Array.isArray(user.permissions)) {
                user.permissions = [];
            }

            // Generate JWT token
            const token = this.generateToken({
                id: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name
            });

            return {
                user,
                token,
                isFirstUser
            };

        } catch (error) {
            logger.error(`Register service error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Login user using Supabase Auth
     */
    async login(email, password) {
        try {
            // Use Supabase Auth signIn
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                logger.warn(`Auth sign in failed: ${authError.message}`);
                throw new Error('Invalid email or password');
            }

            if (!authData.user) {
                throw new Error('Invalid email or password');
            }

            // Get user from our users table
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (userError || !user) {
                logger.error('User not found in users table:', userError);
                throw new Error('User account not properly set up');
            }

            if (!user.is_active) {
                throw new Error('Account is deactivated. Please contact admin.');
            }

            // Defensive: ensure permissions is always an array
            if (!Array.isArray(user.permissions)) {
                user.permissions = user.role === 'owner' ? ['all'] : [];
            }

            // Update last login
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', user.id);

            // Generate JWT token
            const token = this.generateToken({
                id: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name
            });

            return {
                user,
                token
            };

        } catch (error) {
            logger.error(`Login service error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate JWT token
     */
    generateToken(payload) {
        return jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(userId) {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            // Defensive: ensure permissions is always an array
            if (user && !Array.isArray(user.permissions)) {
                user.permissions = user.role === 'owner' ? ['all'] : [];
            }

            return user;
        } catch (error) {
            logger.error(`Get user error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update user
     */
    async updateUser(userId, updates) {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;
            return user;
        } catch (error) {
            logger.error(`Update user error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all users
     */
    async getAllUsers() {
        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return users;
        } catch (error) {
            logger.error(`Get all users error: ${error.message}`);
            throw error;
        }
    }
}

export default new AuthService();