import Joi from 'joi';

/**
 * Sale validation schemas
 */

// Sale item validation
const saleItemSchema = Joi.object({
    product_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.empty': 'Product ID is required',
            'string.uuid': 'Invalid product ID format'
        }),
    quantity: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be at least 1'
        }),
    unit_price: Joi.number()
        .min(0)
        .required()
        .messages({
            'number.base': 'Unit price must be a number',
            'number.min': 'Unit price cannot be negative'
        })
});

// Create sale validation
export const createSaleSchema = Joi.object({
    branch_id: Joi.string()
        .uuid()
        .optional(),
    customer_name: Joi.string()
        .max(255)
        .optional()
        .default('Walk-in'),
    customer_phone: Joi.string()
        .max(20)
        .optional(),
    customer_email: Joi.string()
        .email()
        .optional(),
    items: Joi.array()
        .items(saleItemSchema)
        .min(1)
        .required()
        .messages({
            'array.min': 'At least one item is required'
        }),
    discount: Joi.number()
        .min(0)
        .default(0)
        .messages({
            'number.base': 'Discount must be a number',
            'number.min': 'Discount cannot be negative'
        }),
    tax: Joi.number()
        .min(0)
        .default(0)
        .messages({
            'number.base': 'Tax must be a number',
            'number.min': 'Tax cannot be negative'
        }),
    payment_method: Joi.string()
        .valid('Cash', 'M-Pesa', 'Bank', 'Credit')
        .required()
        .messages({
            'string.empty': 'Payment method is required',
            'any.only': 'Payment method must be Cash, M-Pesa, Bank, or Credit'
        }),
        payment_status: Joi.string()
        .valid('pending', 'partial', 'completed', 'failed', 'refunded', 'paid')
        .default('completed'),
    // Credit sale fields
    due_date: Joi.string()
        .isoDate()
        .optional()
        .allow(null),
    paid_amount: Joi.number()
        .min(0)
        .optional()
        .default(0),
    customer_phone: Joi.string()
        .max(30)
        .optional()
        .allow(null, ''),
    notes: Joi.string()
        .max(500)
        .optional(),
    metadata: Joi.object()
        .optional()
});

// Return/Refund validation
export const returnSaleSchema = Joi.object({
    items: Joi.array()
        .items(Joi.object({
            sale_item_id: Joi.string()
                .uuid()
                .required(),
            quantity: Joi.number()
                .integer()
                .min(1)
                .required()
        }))
        .min(1)
        .required(),
    reason: Joi.string()
        .max(500)
        .optional()
});

// Payment method filter validation
export const paymentFilterSchema = Joi.object({
    method: Joi.string()
        .valid('Cash', 'M-Pesa', 'Bank', 'Credit')
        .required()
});

// Date range filter validation
export const dateRangeSchema = Joi.object({
    start_date: Joi.string()
        .isoDate()
        .optional(),
    end_date: Joi.string()
        .isoDate()
        .optional()
});