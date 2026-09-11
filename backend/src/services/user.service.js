import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';
import { sanitizePermissions } from '../utils/permissions.js';

class UserService {
    /**
     * List all users with profile info.
     */
    async getAllUsers(filters = {}) {
        try {
                       let query = supabase
                .from('users')
                .select('id, email, full_name, username, phone, role, permissions, is_active, branch_id, last_login, created_at, updated_at')
                .order('role', { ascending: true })
                .order('full_name', { ascending: true });

            if (filters.role) {
                query = query.eq('role', filters.role);
            }
            if (filters.is_active !== undefined) {
                query = query.eq('is_active', filters.is_active);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (err) {
            logger.error(`getAllUsers error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Get a single user by ID.
     */
    async getUserById(id) {
        try {
                        const { data, error } = await supabase
                .from('users')
                .select('id, email, full_name, username, phone, role, permissions, is_active, branch_id, last_login, created_at, updated_at')
                .eq('id', id)
                .single();
            if (error) {
                if (error.code === 'PGRST116') return null;
                throw error;
            }
            return data;
        } catch (err) {
            logger.error(`getUserById error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Count users by role.
     */
    async countByRole(role) {
        try {
            const { count, error } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .eq('role', role)
                .eq('is_active', true);
            if (error) throw error;
            return count || 0;
        } catch (err) {
            logger.error(`countByRole error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Update a user's role.
     * Safety:
     *   - Cannot demote the last active owner
     *   - Cannot change own role (self-lockout prevention)
     */
    async updateRole(userId, newRole, actorId) {
        try {
            const validRoles = ['owner', 'manager', 'employee'];
            if (!validRoles.includes(newRole)) {
                throw new Error(`Invalid role: ${newRole}`);
            }

            const target = await this.getUserById(userId);
            if (!target) throw new Error('User not found');

            // Self-lockout protection
            if (userId === actorId) {
                throw new Error('You cannot change your own role');
            }

            // Last-owner protection
            if (target.role === 'owner' && newRole !== 'owner') {
                const ownerCount = await this.countByRole('owner');
                if (ownerCount <= 1) {
                    throw new Error('Cannot demote the last active owner');
                }
            }

            // Build update
            const updates = { role: newRole, updated_at: new Date().toISOString() };

            // If promoting to owner, force ["all"]
            if (newRole === 'owner') {
                updates.permissions = ['all'];
            }

            // If demoting from owner to something else, clear "all" and reset to []
            if (target.role === 'owner' && newRole !== 'owner') {
                updates.permissions = [];
            }

            const { data, error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            logger.error(`updateRole error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Update a user's permissions array.
     * Safety:
     *   - Owners always have ["all"] — cannot be edited
     *   - Cannot remove own users.edit_role / users.edit_perms
     */
    async updatePermissions(userId, permissions, actorId) {
        try {
            const target = await this.getUserById(userId);
            if (!target) throw new Error('User not found');

            // Owners always have ["all"]
            if (target.role === 'owner') {
                throw new Error('Owners always have all permissions — cannot edit');
            }

            const cleaned = sanitizePermissions(permissions);

            // Self-lockout: actor cannot strip their own user-management permissions
            if (userId === actorId) {
                const critical = ['users.edit_role', 'users.edit_perms'];
                const missingCritical = critical.filter(p => !cleaned.includes(p));
                if (missingCritical.length > 0) {
                    throw new Error(
                        'You cannot remove your own user-management permissions. ' +
                        'Ask another user with users.edit_perms to do it.'
                    );
                }
            }

            const { data, error } = await supabase
                .from('users')
                .update({ permissions: cleaned, updated_at: new Date().toISOString() })
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            logger.error(`updatePermissions error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Update profile fields (name, email, branch).
     */
        async updateProfile(userId, updates) {
        try {
            const allowed = {};
            if (typeof updates.full_name === 'string') {
                allowed.full_name = updates.full_name.trim();
            }
            if (typeof updates.branch_id === 'string' || updates.branch_id === null) {
                allowed.branch_id = updates.branch_id;
            }
            if (typeof updates.phone === 'string' || updates.phone === null) {
                allowed.phone = updates.phone ? updates.phone.trim() : null;
            }
            if (typeof updates.username === 'string' || updates.username === null) {
                const uname = updates.username ? updates.username.trim() : null;
                if (uname) {
                    // Uniqueness check (excluding current user)
                    const { data: clash } = await supabase
                        .from('users')
                        .select('id')
                        .ilike('username', uname)
                        .neq('id', userId)
                        .maybeSingle();
                    if (clash) throw new Error(`Username "${uname}" is already taken`);
                }
                allowed.username = uname;
            }

            if (Object.keys(allowed).length === 0) {
                throw new Error('No valid fields to update');
            }
            allowed.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('users')
                .update(allowed)
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            logger.error(`updateProfile error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Deactivate a user (soft).
     * Safety: cannot deactivate self, cannot deactivate the last owner.
     */
    async deactivateUser(userId, actorId) {
        try {
            if (userId === actorId) {
                throw new Error('You cannot deactivate your own account');
            }
            const target = await this.getUserById(userId);
            if (!target) throw new Error('User not found');

            if (target.role === 'owner') {
                const ownerCount = await this.countByRole('owner');
                if (ownerCount <= 1) {
                    throw new Error('Cannot deactivate the last active owner');
                }
            }

            const { data, error } = await supabase
                .from('users')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            logger.error(`deactivateUser error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Reactivate a user.
     */
    async reactivateUser(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update({ is_active: true, updated_at: new Date().toISOString() })
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            logger.error(`reactivateUser error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Create a user via Supabase Admin API + insert into public.users.
     * Requires SUPABASE_SERVICE_ROLE_KEY (which you have).
     */
        /**
     * Auto-generate a username from an email prefix, appending a number
     * if the base is taken. Returns a unique username string.
     */
    async generateUniqueUsername(email) {
        const base = String(email || '').split('@')[0]
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '')
            .slice(0, 30) || 'user';

        // Try base, then base2, base3... up to base50
        for (let i = 0; i < 50; i++) {
            const candidate = i === 0 ? base : `${base}${i + 1}`;
            const { data } = await supabase
                .from('users')
                .select('id')
                .ilike('username', candidate)
                .maybeSingle();
            if (!data) return candidate;
        }
        // Fallback: base + timestamp suffix
        return `${base}${Date.now().toString().slice(-5)}`;
    }

    async createUser({ email, password, full_name, username, phone, role = 'employee' }) {
        try {
            // Validate/resolve username
            let finalUsername = (username || '').trim();
            if (!finalUsername) {
                finalUsername = await this.generateUniqueUsername(email);
            } else {
                // Reject if taken (case-insensitive)
                const { data: existing } = await supabase
                    .from('users')
                    .select('id')
                    .ilike('username', finalUsername)
                    .maybeSingle();
                if (existing) {
                    throw new Error(`Username "${finalUsername}" is already taken`);
                }
            }

            // 1. Create in Supabase Auth
            const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name, username: finalUsername }
            });
            if (authErr) throw new Error(`Auth create failed: ${authErr.message}`);

            const authUser = authData.user;

            // 2. Insert into public.users
            const { data: pubUser, error: pubErr } = await supabase
                .from('users')
                .insert([{
                    id: authUser.id,
                    email,
                    full_name,
                    username: finalUsername,
                    phone: (phone || '').trim() || null,
                    role,
                    permissions: role === 'owner' ? ['all'] : [],
                    is_active: true
                }])
                .select()
                .single();

            if (pubErr) {
                // Roll back auth user if public insert failed
                await supabase.auth.admin.deleteUser(authUser.id).catch(() => {});
                throw new Error(`Profile create failed: ${pubErr.message}`);
            }

            return pubUser;
        } catch (err) {
            logger.error(`createUser error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Update last_login timestamp.
     */
    async touchLastLogin(userId) {
        try {
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', userId);
        } catch (err) {
            logger.warn(`touchLastLogin error: ${err.message}`);
        }
    }
}

export default new UserService();