import Joi from 'joi';

/**
 * Report validation schemas
 */

// Date range validation
export const dateRangeSchema = Joi.object({
    start_date: Joi.string()
        .isoDate()
        .required()
        .messages({
            'string.empty': 'Start date is required',
            'string.isoDate': 'Invalid date format. Use YYYY-MM-DD'
        }),
    end_date: Joi.string()
        .isoDate()
        .required()
        .messages({
            'string.empty': 'End date is required',
            'string.isoDate': 'Invalid date format. Use YYYY-MM-DD'
        }),
    branch_id: Joi.string()
        .uuid()
        .optional()
});

// Year validation
export const yearSchema = Joi.object({
    year: Joi.number()
        .integer()
        .min(2000)
        .max(2100)
        .required()
        .messages({
            'number.base': 'Year must be a number',
            'number.min': 'Year must be at least 2000',
            'number.max': 'Year cannot exceed 2100'
        }),
    branch_id: Joi.string()
        .uuid()
        .optional()
});

// Month validation
export const monthSchema = Joi.object({
    year: Joi.number()
        .integer()
        .min(2000)
        .max(2100)
        .required(),
    month: Joi.number()
        .integer()
        .min(1)
        .max(12)
        .required()
        .messages({
            'number.min': 'Month must be between 1 and 12',
            'number.max': 'Month must be between 1 and 12'
        }),
    branch_id: Joi.string()
        .uuid()
        .optional()
});

// Week validation
export const weekSchema = Joi.object({
    year: Joi.number()
        .integer()
        .min(2000)
        .max(2100)
        .required(),
    week: Joi.number()
        .integer()
        .min(1)
        .max(53)
        .required()
        .messages({
            'number.min': 'Week must be between 1 and 53',
            'number.max': 'Week must be between 1 and 53'
        }),
    branch_id: Joi.string()
        .uuid()
        .optional()
});

// Top products validation
export const topProductsSchema = Joi.object({
    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(10),
    start_date: Joi.string()
        .isoDate()
        .optional(),
    end_date: Joi.string()
        .isoDate()
        .optional(),
    branch_id: Joi.string()
        .uuid()
        .optional()
});