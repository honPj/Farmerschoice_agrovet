import express from 'express';
import notificationService from '../services/notification.service.js';
import { verifyToken, requireRoles } from '../middleware/auth.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route   POST /api/v1/notifications/low-stock
 * @desc    Trigger low stock notification to owner
 *          Accepts a payload from the frontend with the current out/low lists.
 *          If no payload is provided, runs a full check on the server.
 * @access  Private (Manager+)
 */
router.post('/low-stock', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const {
            branch_id = null,
            out_of_stock = [],
            low_stock = [],
            triggered_by = null
        } = req.body || {};

        let result;

        // If the frontend sent explicit lists, use them directly
        if (out_of_stock.length > 0 || low_stock.length > 0) {
            result = await notificationService.sendLowStockAlert({
                branch_id,
                out_of_stock,
                low_stock,
                triggered_by
            });
        } else {
            // Otherwise run the full backend check (original behavior)
            result = await notificationService.checkLowStockAndNotify();
        }

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
 * @route   POST /api/v1/notifications/restock
 * @desc    Notify owner when a product is restocked
 * @access  Private (Manager+)
 */
router.post('/restock', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const {
            product_id,
            product_name,
            sku = null,
            quantity_added,
            new_stock = 0,
            branch_id = null,
            performed_by = null
        } = req.body || {};

        if (!product_name || !quantity_added) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'product_name and quantity_added are required' }
            });
        }

        const result = await notificationService.sendRestockNotification({
            product_id,
            product_name,
            sku,
            quantity_added: Number(quantity_added),
            new_stock: Number(new_stock) || 0,
            branch_id,
            performed_by
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error(`POST /notifications/restock error: ${error.message}`);
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