import logger from './logger.js';

/**
 * Helper Functions
 * Reusable utility functions
 */

/**
 * Format currency (Kenyan Shillings)
 */
function formatCurrency(amount) {
    return `KSh ${Number(amount).toLocaleString('en-KE', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
    })}`;
}

/**
 * Generate a random receipt number
 */
function generateReceiptNumber() {
    const prefix = 'RCP';
    const timestamp = Date.now().toString().slice(-7);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Check if a string is a valid email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Sanitize data (remove dangerous characters)
 */
function sanitizeData(data) {
    if (typeof data === 'string') {
        return data.trim().replace(/[<>]/g, '');
    }
    return data;
}

/**
 * Calculate profit margin percentage
 */
function calculateMargin(buyPrice, sellPrice) {
    if (!buyPrice || buyPrice === 0) return 0;
    return ((sellPrice - buyPrice) / buyPrice) * 100;
}

/**
 * Paginate results
 */
function paginateData(data, page = 1, limit = 20) {
    const start = (page - 1) * limit;
    const end = page * limit;
    const paginated = data.slice(start, end);
    
    return {
        data: paginated,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: data.length,
            totalPages: Math.ceil(data.length / limit)
        }
    };
}

/**
 * Handle async errors (wrapper for async functions)
 */
function asyncHandler(fn) {
    return function(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            logger.error(`Async handler error: ${error.message}`);
            next(error);
        });
    };
}

/**
 * Format date for reports
 */
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export {
    formatCurrency,
    generateReceiptNumber,
    isValidEmail,
    sanitizeData,
    calculateMargin,
    paginateData,
    asyncHandler,
    formatDate
};