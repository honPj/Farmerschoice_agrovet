import Joi from 'joi';

/**
 * Inventory validation schemas
 */

// Update stock validation - FIXED (added product_id)
export const updateStockSchema = Joi.object({
    branch_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.empty': 'Branch ID is required',
            'string.uuid': 'Invalid branch ID format'
        }),
    product_id: Joi.string()  // ← THIS WAS MISSING!
        .uuid()
        .required()
        .messages({
            'string.empty': 'Product ID is required',
            'string.uuid': 'Invalid product ID format'
        }),
    quantity: Joi.number()
        .integer()
        .required()
        .messages({
            'number.base': 'Quantity must be a number',
            'number.required': 'Quantity is required'
        }),
    movement_type: Joi.string()
        .valid('PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN')
        .required()
        .messages({
            'string.empty': 'Movement type is required',
            'any.only': 'Invalid movement type'
        }),
    notes: Joi.string()
        .max(500)
        .optional()
});

// Transfer stock validation
export const transferStockSchema = Joi.object({
    from_branch_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.empty': 'Source branch ID is required',
            'string.uuid': 'Invalid branch ID format'
        }),
    to_branch_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.empty': 'Destination branch ID is required',
            'string.uuid': 'Invalid branch ID format'
        }),
    items: Joi.array()
        .items(Joi.object({
            product_id: Joi.string()
                .uuid()
                .required(),
            quantity: Joi.number()
                .integer()
                .min(1)
                .required()
        }))
        .min(1)
        .required(),
    notes: Joi.string()
        .max(500)
        .optional()
});

// Stock adjustment validation
export const adjustStockSchema = Joi.object({
    branch_id: Joi.string()
        .uuid()
        .required(),
    product_id: Joi.string()
        .uuid()
        .required(),
    quantity: Joi.number()
        .integer()
        .required()
        .messages({
            'number.base': 'Quantity must be a number',
            'number.required': 'Quantity is required'
        }),
    reason: Joi.string()
        .max(500)
        .required()
        .messages({
            'string.empty': 'Reason is required'
        })
});

// Filter validation
export const inventoryFilterSchema = Joi.object({
    branch_id: Joi.string()
        .uuid()
        .optional(),
    min_stock: Joi.number()
        .integer()
        .min(0)
        .optional(),
    max_stock: Joi.number()
        .integer()
        .min(0)
        .optional(),
    search: Joi.string()
        .max(100)
        .optional(),
    limit: Joi.number()
        .integer()
        .min(1)
        .max(1000)
        .default(100)
});