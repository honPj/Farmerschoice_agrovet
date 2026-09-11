import Joi from 'joi';

/**
 * Validation schemas for authentication
 */

// Register validation
export const registerSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.empty': 'Email is required',
            'string.email': 'Please provide a valid email'
        }),
    password: Joi.string()
        .min(6)
        .required()
        .messages({
            'string.empty': 'Password is required',
            'string.min': 'Password must be at least 6 characters'
        }),
    full_name: Joi.string()
        .min(2)
        .required()
        .messages({
            'string.empty': 'Full name is required',
            'string.min': 'Name must be at least 2 characters'
        }),
    role: Joi.string()
        .valid('owner', 'manager', 'employee', 'supervisor')
        .default('employee')
});

// Login validation
export const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.empty': 'Email is required',
            'string.email': 'Please provide a valid email'
        }),
    password: Joi.string()
        .required()
        .messages({
            'string.empty': 'Password is required'
        })
});

// Update user validation
export const updateUserSchema = Joi.object({
    full_name: Joi.string().min(2),
    email: Joi.string().email(),
    role: Joi.string().valid('owner', 'manager', 'employee', 'supervisor'),
    is_active: Joi.boolean()
});