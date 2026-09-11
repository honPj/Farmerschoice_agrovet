import express from 'express';
import userService from '../services/user.service.js';
import { verifyToken, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS, PERMISSION_GROUPS } from '../utils/permissions.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// 📂 SPECIFIC ROUTES FIRST (before /:id)
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/users/permissions/catalog
 * @desc    Get the list of all available permissions (for UI checkbox grid)
 * @access  Private (any authenticated user)
 */
router.get('/permissions/catalog', verifyToken, (req, res) => {
    res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
            permissions: PERMISSIONS,
            groups: PERMISSION_GROUPS
        }
    });
});

/**
 * @route   GET /api/v1/users/me/permissions
 * @desc    Get the current user's own permissions
 * @access  Private
 */
router.get('/me/permissions', verifyToken, (req, res) => {
    res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
            id: req.user.id,
            role: req.user.role,
            permissions: req.user.permissions || []
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// 📂 LIST + CREATE
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/users
 * @desc    List all users
 * @access  users.view
 */
router.get('/', verifyToken, requirePermission('users.view'), async (req, res, next) => {
    try {
        const filters = {
            role: req.query.role,
            is_active: req.query.is_active !== undefined
                ? req.query.is_active === 'true'
                : undefined
        };
        const users = await userService.getAllUsers(filters);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (err) {
        logger.error(`GET /users error: ${err.message}`);
        next(err);
    }
});

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user
 * @access  users.create
 */
router.post('/', verifyToken, requirePermission('users.create'), async (req, res, next) => {
    try {
        const { email, password, full_name, username, phone, role } = req.body;
        if (!email || !password || !full_name) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'email, password, and full_name are required' }
            });
        }
        if (password.length < 6) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'Password must be at least 6 characters' }
            });
        }
        const finalRole = ['owner', 'manager', 'employee'].includes(role) ? role : 'employee';
        const user = await userService.createUser({
            email,
            password,
            full_name,
            username: username || undefined,
            phone: phone || undefined,
            role: finalRole
        });
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: 'User created successfully',
            data: user
        });
    } catch (err) {
        logger.error(`POST /users error: ${err.message}`);
        const clientErr = /Auth create failed|already taken|Profile create failed/.test(err.message);
        if (clientErr) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: err.message }
            });
        }
        next(err);
    }
});

// ═══════════════════════════════════════════════════════════════
// 📂 WILDCARD + ID ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get one user
 * @access  users.view OR self
 */
router.get('/:id', verifyToken, async (req, res, next) => {
    try {
        const isSelf = req.user.id === req.params.id;
        const canView = isSelf || (req.user.permissions || []).includes('all')
                     || (req.user.permissions || []).includes('users.view');
        if (!canView) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: { message: 'You do not have permission to view this user' }
            });
        }
        const user = await userService.getUserById(req.params.id);
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: { message: 'User not found' }
            });
        }
        res.status(HTTP_STATUS.OK).json({ success: true, data: user });
    } catch (err) {
        logger.error(`GET /users/:id error: ${err.message}`);
        next(err);
    }
});

/**
 * @route   PUT /api/v1/users/:id/role
 * @desc    Change a user's role
 * @access  users.edit_role
 */
router.put('/:id/role', verifyToken, requirePermission('users.edit_role'), async (req, res, next) => {
    try {
        const { role } = req.body;
        if (!role) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'role is required' }
            });
        }
        const updated = await userService.updateRole(req.params.id, role, req.user.id);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Role updated to ${role}`,
            data: updated
        });
    } catch (err) {
        logger.error(`PUT /users/:id/role error: ${err.message}`);
        // Safety rule violations → 400 (client-caused)
        const isSafety = /Cannot|cannot|last active owner|own role/.test(err.message);
        if (isSafety) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: err.message }
            });
        }
        next(err);
    }
});

/**
 * @route   PUT /api/v1/users/:id/permissions
 * @desc    Replace a user's permission array
 * @access  users.edit_perms
 */
router.put('/:id/permissions', verifyToken, requirePermission('users.edit_perms'), async (req, res, next) => {
    try {
        const { permissions } = req.body;
        if (!Array.isArray(permissions)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'permissions must be an array' }
            });
        }
        const updated = await userService.updatePermissions(req.params.id, permissions, req.user.id);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Permissions updated',
            data: updated
        });
    } catch (err) {
        logger.error(`PUT /users/:id/permissions error: ${err.message}`);
        const isSafety = /Cannot|cannot|Owner/.test(err.message);
        if (isSafety) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: err.message }
            });
        }
        next(err);
    }
});

/**
 * @route   PUT /api/v1/users/:id/profile
 * @desc    Update profile fields (name, branch)
 * @access  users.view OR self
 */
router.put('/:id/profile', verifyToken, async (req, res, next) => {
    try {
        const isSelf = req.user.id === req.params.id;
        const canEdit = isSelf || (req.user.permissions || []).includes('all')
                     || (req.user.permissions || []).includes('users.view');
        if (!canEdit) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                error: { message: 'You do not have permission to edit this user' }
            });
        }
        const updated = await userService.updateProfile(req.params.id, req.body);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Profile updated',
            data: updated
        });
    } catch (err) {
        logger.error(`PUT /users/:id/profile error: ${err.message}`);
        next(err);
    }
});

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Deactivate a user
 * @access  users.deactivate
 */
router.delete('/:id', verifyToken, requirePermission('users.deactivate'), async (req, res, next) => {
    try {
        const updated = await userService.deactivateUser(req.params.id, req.user.id);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'User deactivated',
            data: updated
        });
    } catch (err) {
        logger.error(`DELETE /users/:id error: ${err.message}`);
        const isSafety = /Cannot|cannot|last active owner|own account/.test(err.message);
        if (isSafety) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: err.message }
            });
        }
        next(err);
    }
});

/**
 * @route   POST /api/v1/users/:id/reactivate
 * @desc    Reactivate a user
 * @access  users.deactivate
 */
router.post('/:id/reactivate', verifyToken, requirePermission('users.deactivate'), async (req, res, next) => {
    try {
        const updated = await userService.reactivateUser(req.params.id);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'User reactivated',
            data: updated
        });
    } catch (err) {
        logger.error(`POST /users/:id/reactivate error: ${err.message}`);
        next(err);
    }
});

export default router;