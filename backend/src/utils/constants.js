/**
 * Application Constants
 * These are values that don't change throughout the app
 */

// User roles
const ROLES = {
    OWNER: 'owner',
    MANAGER: 'manager',
    SUPERVISOR: 'supervisor',
    EMPLOYEE: 'employee'
};

// Payment methods
const PAYMENT_METHODS = {
    CASH: 'Cash',
    MPESA: 'M-Pesa',
    BANK: 'Bank',
    CREDIT: 'Credit'
};

// Payment statuses
const PAYMENT_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
};

// Movement types
const MOVEMENT_TYPES = {
    PURCHASE: 'PURCHASE',
    SALE: 'SALE',
    ADJUSTMENT: 'ADJUSTMENT',
    TRANSFER_IN: 'TRANSFER_IN',
    TRANSFER_OUT: 'TRANSFER_OUT',
    RETURN: 'RETURN'
};

// Stock statuses
const STOCK_STATUS = {
    OUT_OF_STOCK: 'out',
    LOW_STOCK: 'low',
    IN_STOCK: 'ok'
};

// Low stock threshold
const LOW_STOCK_THRESHOLD = 5;

// HTTP status codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500
};

// Success/Error messages
const MESSAGES = {
    // Success
    SUCCESS: 'Operation successful',
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    
    // Errors
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'You do not have permission to perform this action',
    INVALID_DATA: 'Invalid data provided',
    DUPLICATE: 'Resource already exists',
    SERVER_ERROR: 'Internal server error'
};

export {
    ROLES,
    PAYMENT_METHODS,
    PAYMENT_STATUS,
    MOVEMENT_TYPES,
    STOCK_STATUS,
    LOW_STOCK_THRESHOLD,
    HTTP_STATUS,
    MESSAGES
};