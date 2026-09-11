import express from 'express';
import discountService from '../services/discount.service.js';
import { verifyToken, requireRoles } from '../middleware/auth.js';
import {
    createDiscountSchema,
    updateDiscountSchema,
    applyDiscountSchema,
    creditPaymentSchema,
    creditFilterSchema
} from '../validators/discount.validator.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';
import { supabase } from '../config/database.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// 📂 DISCOUNT ROUTES - SPECIFIC ROUTES FIRST!
// ═══════════════════════════════════════════════════════════════

/**
 * @route   POST /api/v1/discounts
 * @desc    Create a new discount
 * @access  Private (Manager+)
 */
router.post('/', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 POST /discounts called 📂📂📂');

        const { error, value } = createDiscountSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const discount = await discountService.createDiscount(value);

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: 'Discount created successfully',
            data: discount
        });
    } catch (error) {
        console.error('🔥 POST /discounts error:', error);
        logger.error(`POST /discounts error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/discounts
 * @desc    Get all discounts
 * @access  Private
 */
router.get('/', verifyToken, async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /discounts called 📂📂📂');

        const filters = {
            is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        };

        const discounts = await discountService.getAllDiscounts(filters);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: discounts.length,
            data: discounts
        });
    } catch (error) {
        console.error('🔥 GET /discounts error:', error);
        logger.error(`GET /discounts error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/discounts/active
 * @desc    Get active discounts
 * @access  Private
 */
router.get('/active', verifyToken, async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /discounts/active called 📂📂📂');

        const discounts = await discountService.getActiveDiscounts();

        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: discounts.length,
            data: discounts
        });
    } catch (error) {
        console.error('🔥 GET /discounts/active error:', error);
        logger.error(`GET /discounts/active error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   POST /api/v1/discounts/apply
 * @desc    Apply discount to a sale
 * @access  Private
 */
router.post('/apply', verifyToken, async (req, res, next) => {
    try {
        console.log('📂📂📂 POST /discounts/apply called 📂📂📂');

        const { error, value } = applyDiscountSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const result = await discountService.applyDiscount(value.sale_id, value.discount_code);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('🔥 POST /discounts/apply error:', error);
        logger.error(`POST /discounts/apply error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   POST /api/v1/discounts/credit/pay
 * @desc    Process credit payment
 * @access  Private (Manager+)
 */
router.post('/credit/pay', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 POST /discounts/credit/pay called 📂📂📂');

        const { error, value } = creditPaymentSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const { sale_id, amount, payment_method, notes } = value;

        // Get the credit sale
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .select('*')
            .eq('id', sale_id)
            .eq('payment_method', 'Credit')
            .single();

        if (saleError || !sale) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: {
                    message: 'Credit sale not found'
                }
            });
        }

        if (sale.payment_status === 'paid') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'This credit sale has already been paid'
                }
            });
        }

        // Calculate remaining balance
        const remaining = sale.total - (sale.paid_amount || 0);

        if (amount > remaining) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: `Payment exceeds remaining balance. Remaining: ${remaining}`
                }
            });
        }

        // Update the sale
        const newPaidAmount = (sale.paid_amount || 0) + amount;
        const newStatus = newPaidAmount >= sale.total ? 'paid' : 'partial';

                const { data: updatedSale, error: updateError } = await supabase
            .from('sales')
            .update({
                paid_amount: newPaidAmount,
                payment_status: newStatus,
                due_date: newStatus === 'paid' ? null : sale.due_date,
                updated_at: new Date().toISOString()
            })
            .eq('id', sale_id)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Update error:', updateError);
            throw new Error('Failed to update credit sale');
        }

        // Create payment record
        const { error: paymentError } = await supabase
            .from('credit_payments')
            .insert([{
                sale_id,
                amount,
                payment_method,
                notes: notes || null,
                payment_date: new Date().toISOString()
            }]);

        if (paymentError) {
            console.error('❌ Payment record error:', paymentError);
            // Continue - sale was updated
        }

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: `Credit payment of ${amount} processed successfully`,
            data: {
                sale: updatedSale,
                paid_amount: newPaidAmount,
                remaining_balance: sale.total - newPaidAmount,
                status: newStatus
            }
        });
    } catch (error) {
        console.error('🔥 POST /discounts/credit/pay error:', error);
        logger.error(`POST /discounts/credit/pay error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/discounts/credit
 * @desc    Get all credit sales with filters
 * @access  Private (Manager+)
 */
router.get('/credit', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /discounts/credit called 📂📂📂');

        const filters = {
            status: req.query.status || 'all',
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            customer_name: req.query.customer_name,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        };

        let query = supabase
            .from('sales')
            .select(`
                *,
                user:user_id (
                    id,
                    full_name,
                    email
                ),
                sale_items (
                    id,
                    product_name,
                    quantity,
                    unit_price,
                    total_price
                ),
                credit_payments (
                    id,
                    amount,
                    payment_method,
                    payment_date,
                    notes
                )
            `)
            .eq('payment_method', 'Credit')
            .order('created_at', { ascending: false });

        if (filters.status === 'pending') {
            query = query.eq('payment_status', 'pending');
        } else if (filters.status === 'partial') {
            query = query.eq('payment_status', 'partial');
        } else if (filters.status === 'paid') {
            query = query.eq('payment_status', 'paid');
        }

        if (filters.start_date) {
            query = query.gte('sale_date', filters.start_date);
        }

        if (filters.end_date) {
            query = query.lte('sale_date', filters.end_date);
        }

        if (filters.customer_name) {
            query = query.ilike('customer_name', `%${filters.customer_name}%`);
        }

        const { data, error } = await query.limit(filters.limit);

        if (error) {
            console.error('❌ Get credit sales error:', error);
            throw error;
        }

        // Calculate totals
        const totalOutstanding = data.reduce((sum, sale) => {
            const paid = sale.paid_amount || 0;
            return sum + (sale.total - paid);
        }, 0);

        const totalPaid = data.reduce((sum, sale) => sum + (sale.paid_amount || 0), 0);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: data.length,
            total_outstanding: totalOutstanding,
            total_paid: totalPaid,
            data: data
        });
    } catch (error) {
        console.error('🔥 GET /discounts/credit error:', error);
        logger.error(`GET /discounts/credit error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/discounts/usage-report
 * @desc    Get discount usage report
 * @access  Private (Manager+)
 */
router.get('/usage-report', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /discounts/usage-report called 📂📂📂');

        const startDate = req.query.start_date ? new Date(req.query.start_date) : new Date();
        const endDate = req.query.end_date ? new Date(req.query.end_date) : new Date();

        const report = await discountService.getDiscountUsageReport(startDate, endDate);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /discounts/usage-report error:', error);
        logger.error(`GET /discounts/usage-report error: ${error.message}`);
        next(error);
    }
});

export default router;