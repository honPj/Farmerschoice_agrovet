import express from 'express';
import authService from '../services/auth.service.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import { verifyToken } from '../middleware/auth.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public (first user becomes owner)
 */
router.post('/register', async (req, res, next) => {
    try {
        // Validate input
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const result = await authService.register(value);
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: result.isFirstUser ? 
                'First user created! You are the owner.' : 
                'User registered successfully',
            data: {
                user: result.user,
                token: result.token,
                isFirstUser: result.isFirstUser
            }
        });

    } catch (error) {
        logger.error(`Register route error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', async (req, res, next) => {
    try {
        // Validate input
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const result = await authService.login(value.email, value.password);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Login successful',
            data: {
                user: result.user,
                token: result.token
            }
        });

    } catch (error) {
        logger.error(`Login route error: ${error.message}`);
        
        if (error.message === 'Invalid email or password') {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                error: {
                    message: error.message
                }
            });
        }
        
        next(error);
    }
});

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', verifyToken, async (req, res, next) => {
    try {
        const user = await authService.getUserById(req.user.id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: user
        });

    } catch (error) {
        logger.error(`Get me route error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', verifyToken, (req, res) => {
    res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Logged out successfully'
    });
});

export default router;