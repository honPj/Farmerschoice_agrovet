import jwt from 'jsonwebtoken';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';
import { supabase } from '../config/database.js';
import { hasPermission, hasAnyPermission } from '../utils/permissions.js';

// ============================================
// VERIFY TOKEN + LOAD FRESH PERMISSIONS
// ============================================
/**
 * Verifies the JWT and then loads fresh role + permissions
 * from the DB on every request. This ensures permission changes
 * take effect immediately without requiring re-login.
 */
export async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: { message: 'No token provided. Please login first.' }
            });
        }

        const token = authHeader.split(' ')[1];

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    success: false,
                    error: { message: 'Token expired. Please login again.' }
                });
            }
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: { message: 'Invalid token. Please login again.' }
            });
        }

        // ─── Load fresh user state from DB ───
        const { data: dbUser, error: dbErr } = await supabase
            .from('users')
            .select('id, email, full_name, role, permissions, is_active, branch_id')
            .eq('id', decoded.id)
            .single();

        if (dbErr || !dbUser) {
            logger.warn(`verifyToken: user ${decoded.id} not found in DB`);
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: { message: 'User account not found. Please login again.' }
            });
        }

        if (dbUser.is_active === false) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: { message: 'Your account has been deactivated. Contact the owner.' }
            });
        }

        // Merge JWT identity with fresh DB state
        req.user = {
            id: dbUser.id,
            email: dbUser.email,
            full_name: dbUser.full_name,
            role: dbUser.role,
            branch_id: dbUser.branch_id,
            permissions: Array.isArray(dbUser.permissions) ? dbUser.permissions : []
        };

        next();
    } catch (error) {
        logger.error(`Auth middleware error: ${error.message}`);
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: { message: 'Authentication failed. Please login again.' }
        });
    }
}

// ============================================
// ROLE-BASED ACCESS
// ============================================
/**
 * Require one of the given roles. Kept for backward-compat
 * with existing routes. New routes should prefer requirePermission.
 */
export function requireRoles(allowedRoles) {
    return function (req, res, next) {
        if (!req.user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: { message: 'Authentication required' }
            });
        }

        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (!roles.includes(req.user.role)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: {
                    message: 'You do not have permission to perform this action',
                    requiredRoles: roles,
                    yourRole: req.user.role
                }
            });
        }

        next();
    };
}

export function isOwner(req, res, next) {
    if (!req.user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            success: false,
            error: { message: 'Authentication required' }
        });
    }
    if (req.user.role !== 'owner') {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            error: { message: 'Only the owner can perform this action' }
        });
    }
    next();
}

// ============================================
// PERMISSION-BASED ACCESS
// ============================================
/**
 * Require a specific permission.
 * Owners with "all" always pass.
 */
export function requirePermission(permission) {
    return function (req, res, next) {
        if (!req.user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: { message: 'Authentication required' }
            });
        }

        if (!hasPermission(req.user, permission)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: {
                    message: `You do not have permission to perform this action`,
                    required: permission,
                    yourPermissions: req.user.permissions || []
                }
            });
        }

        next();
    };
}

/**
 * Require at least one of the given permissions.
 */
export function requireAnyPermission(permissions) {
    const list = Array.isArray(permissions) ? permissions : [permissions];
    return function (req, res, next) {
        if (!req.user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: { message: 'Authentication required' }
            });
        }

        if (!hasAnyPermission(req.user, list)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: {
                    message: `You do not have permission to perform this action`,
                    requiredAny: list,
                    yourPermissions: req.user.permissions || []
                }
            });
        }

        next();
    };
}