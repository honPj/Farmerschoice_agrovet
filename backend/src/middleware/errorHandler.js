import logger from '../utils/logger.js';
import { HTTP_STATUS, MESSAGES } from '../utils/constants.js';

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
    const error = new ApiError(
        HTTP_STATUS.NOT_FOUND,
        `Route not found: ${req.method} ${req.originalUrl}`
    );
    next(error);
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
    // Log the error
    logger.error(`Error: ${err.message}`);
    logger.error(`Stack: ${err.stack}`);
    logger.error(`Request: ${req.method} ${req.originalUrl}`);
    logger.error(`IP: ${req.ip}`);
    
    // Default error values
    let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let message = err.message || MESSAGES.SERVER_ERROR;
    let details = err.details || null;
    
    // If it's not an operational error, we don't want to expose details
    if (!err.isOperational) {
        statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
        message = MESSAGES.SERVER_ERROR;
        details = null;
    }
    
    // Send error response
    res.status(statusCode).json({
        success: false,
        error: {
            message,
            ...(details && { details }),
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack
            })
        }
    });
}

export {
    ApiError,
    notFoundHandler,
    errorHandler
};