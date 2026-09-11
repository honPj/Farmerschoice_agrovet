import express from 'express';
import notificationService from '../services/notification.service.js';
import { verifyToken, requireRoles } from '../middleware/auth.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route   POST /api/v1/notifications/low-stock
 * @desc    Manually trigger low stock check
 * @access  Private (Manager+)
 */
router.post('/low-stock', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const result = await notificationService.checkLowStockAndNotify();
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error(`POST /notifications/low-stock error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   POST /api/v1/notifications/daily-summary
 * @desc    Manually trigger daily summary
 * @access  Private (Manager+)
 */
router.post('/daily-summary', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const result = await notificationService.sendDailySummary();
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error(`POST /notifications/daily-summary error: ${error.message}`);
        next(error);
    }
});

export default router;