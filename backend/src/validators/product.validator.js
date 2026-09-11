import Joi from 'joi';

/**
 * Product validation schemas matching your database schema
 */

export const productSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(255)
        .required()
        .messages({
            'string.empty': 'Product name is required',
            'string.min': 'Product name must be at least 2 characters'
        }),
    sku: Joi.string()
        .max(100)
        .optional(),
    barcode: Joi.string()
        .max(100)
        .optional(),
    description: Joi.string()
        .max(1000)
        .optional(),
    category_id: Joi.string()
        .uuid()
        .optional(),
    cost_price: Joi.number()
        .min(0)
        .required()
        .messages({
            'number.base': 'Cost price must be a number',
            'number.min': 'Cost price cannot be negative'
        }),
    selling_price: Joi.number()
        .min(0)
        .required()
        .messages({
            'number.base': 'Selling price must be a number',
            'number.min': 'Selling price cannot be negative'
        }),
    quantity: Joi.number()
        .integer()
        .min(0)
        .default(0)
        .messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity cannot be negative'
        }),
    unit_of_measure: Joi.string()
        .default('piece'),
    is_active: Joi.boolean()
        .default(true)
});

export const searchSchema = Joi.object({
    q: Joi.string()
        .min(1)
        .required()
        .messages({
            'string.empty': 'Search query is required'
        }),
    category_id: Joi.string()
        .uuid()
        .optional(),
    is_active: Joi.boolean()
        .optional()
});

export const restockSchema = Joi.object({
    quantity: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({
            'number.base': 'Quantity must be a number',
            'number.min': 'Quantity must be at least 1'
        }),
    branch_id: Joi.string()
        .uuid()
        .optional()
});