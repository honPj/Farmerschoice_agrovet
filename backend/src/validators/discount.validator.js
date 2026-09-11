import Joi from 'joi';

/**
 * Discount validation schemas
 */

// Create discount validation
export const createDiscountSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(255)
        .required()
        .messages({
            'string.empty': 'Discount name is required',
            'string.min': 'Name must be at least 2 characters'
        }),
    description: Joi.string()
        .max(500)
        .optional(),
    discount_type: Joi.string()
        .valid('percentage', 'fixed')
        .required()
        .messages({
            'string.empty': 'Discount type is required',
            'any.only': 'Discount type must be percentage or fixed'
        }),
    discount_value: Joi.number()
        .min(0)
        .required()
        .messages({
            'number.base': 'Discount value must be a number',
            'number.min': 'Discount value cannot be negative'
        }),
    product_ids: Joi.array()
        .items(Joi.string().uuid())
        .optional(),
    category_ids: Joi.array()
        .items(Joi.string().uuid())
        .optional(),
    min_purchase: Joi.number()
        .min(0)
        .default(0)
        .messages({
            'number.base': 'Minimum purchase must be a number',
            'number.min': 'Minimum purchase cannot be negative'
        }),
    max_discount: Joi.number()
        .min(0)
        .optional()
        .messages({
            'number.base': 'Maximum discount must be a number',
            'number.min': 'Maximum discount cannot be negative'
        }),
    start_date: Joi.string()
        .isoDate()
        .required()
        .messages({
            'string.empty': 'Start date is required',
            'string.isoDate': 'Invalid date format'
        }),
    end_date: Joi.string()
        .isoDate()
        .required()
        .messages({
            'string.empty': 'End date is required',
            'string.isoDate': 'Invalid date format'
        }),
    is_active: Joi.boolean()
        .default(true)
});

// Update discount validation
export const updateDiscountSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(255)
        .optional(),
    description: Joi.string()
        .max(500)
        .optional(),
    discount_type: Joi.string()
        .valid('percentage', 'fixed')
        .optional(),
    discount_value: Joi.number()
        .min(0)
        .optional(),
    product_ids: Joi.array()
        .items(Joi.string().uuid())
        .optional(),
    category_ids: Joi.array()
        .items(Joi.string().uuid())
        .optional(),
    min_purchase: Joi.number()
        .min(0)
        .optional(),
    max_discount: Joi.number()
        .min(0)
        .optional(),
    start_date: Joi.string()
        .isoDate()
        .optional(),
    end_date: Joi.string()
        .isoDate()
        .optional(),
    is_active: Joi.boolean()
        .optional()
});

// Apply discount validation
export const applyDiscountSchema = Joi.object({
    sale_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.empty': 'Sale ID is required',
            'string.uuid': 'Invalid sale ID format'
        }),
    discount_code: Joi.string()
        .optional()
});

// Credit payment validation
export const creditPaymentSchema = Joi.object({
    sale_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.empty': 'Sale ID is required',
            'string.uuid': 'Invalid sale ID format'
        }),
    amount: Joi.number()
        .min(0.01)
        .required()
        .messages({
            'number.base': 'Amount must be a number',
            'number.min': 'Amount must be greater than 0'
        }),
    payment_method: Joi.string()
        .valid('Cash', 'M-Pesa', 'Bank')
        .required()
        .messages({
            'string.empty': 'Payment method is required',
            'any.only': 'Invalid payment method'
        }),
    notes: Joi.string()
        .max(500)
        .optional()
});

// Credit filter validation
export const creditFilterSchema = Joi.object({
    status: Joi.string()
        .valid('all', 'pending', 'partial', 'paid', 'overdue')
        .default('all'),
    start_date: Joi.string()
        .isoDate()
        .optional(),
    end_date: Joi.string()
        .isoDate()
        .optional(),
    customer_name: Joi.string()
        .max(100)
        .optional(),
    limit: Joi.number()
        .integer()
        .min(1)
        .max(1000)
        .default(100)
});