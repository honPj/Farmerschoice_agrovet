// ============================================
// CONFIG - FarmersChoice Agrovet
// Central configuration for the entire application
// ============================================

const CONFIG = {
    // ==========================================
    // APP INFORMATION
    // ==========================================
    APP: {
        NAME: 'FarmersChoice Agrovet',
        VERSION: '1.0.0',
        DESCRIPTION: 'Point of Sale System for FarmersChoice Agrovet',
        COMPANY: 'FarmersChoice Agrovet Kenya',
        YEAR: new Date().getFullYear(),
        LOGIN_URL: 'index.html',      // relative — works from /Frontend/
        HOME_URL: 'pos.html'
    },

    // ==========================================
    // API CONFIGURATION
    // ==========================================
    API: {
        DEV_URL: 'http://localhost:5001/api/v1',
        PROD_URL: '/api/v1',
        TIMEOUT: 30000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    },

    // ==========================================
    // STORAGE KEYS
    // ==========================================
    STORAGE: {
        TOKEN: 'fc_token',
        USER: 'fc_currentUser',
        PRODUCTS: 'fc_products',
        SALES: 'fc_sales',
        SETTINGS: 'fc_settings',
        CART: 'fc_cart',
        THEME: 'fc_theme',
        PREFIX: 'fc_'
    },

    // ==========================================
    // UI CONFIGURATION
    // ==========================================
    UI: {
        CURRENCY: {
            SYMBOL: 'KSh',
            LOCALE: 'en-KE',
            MIN_FRACTION: 0,
            MAX_FRACTION: 0
        },
        DATE_FORMAT: {
            SHORT: 'DD/MM/YYYY',
            MEDIUM: 'dd MMM yyyy',
            LONG: 'dddd, MMMM do, yyyy',
            TIME: 'HH:mm'
        },
        PAGINATION: {
            ITEMS_PER_PAGE: 20,
            PAGE_RANGE: 5
        },
        TOAST: {
            DURATION: 3000,
            POSITION: 'top-right'
        },
        DEFAULT_THEME: 'dark',
        THEMES: ['dark', 'light']
    },

    // ==========================================
    // FEATURE FLAGS
    // ==========================================
    FEATURES: {
        ENABLE_CACHE: true,
        ENABLE_OFFLINE: true,
        ENABLE_ANALYTICS: false,
        ENABLE_EXPORT: true,
        ENABLE_NOTIFICATIONS: true,
        ENABLE_AUTO_REFRESH: true,
        ENABLE_RECEIPT_PRINTING: true,
        ENABLE_CREDIT_SALES: true,
        ENABLE_MULTI_BRANCH: false
    },

    // ==========================================
    // DEFAULT VALUES
    // ==========================================
    DEFAULTS: {
        ROLE: 'employee',
        CUSTOMER: 'Walk-in',
        PAYMENT_METHODS: ['Cash', 'M-Pesa', 'Bank', 'Credit'],
        SALE_STATUS: 'completed',
        LOW_STOCK_THRESHOLD: 5,
        UNIT_OF_MEASURE: 'piece'
    },

    // ==========================================
    // UNIT OF MEASURE OPTIONS
    // ==========================================
    UNITS: [
        { value: 'piece', label: 'Piece' },
        { value: 'kg',    label: 'Kilogram (kg)' },
        { value: 'litre', label: 'Litre (L)' },
        { value: 'ml',    label: 'Millilitre (ml)' },
        { value: 'g',     label: 'Gram (g)' },
        { value: 'box',   label: 'Box' },
        { value: 'pack',  label: 'Pack' }
    ],

    // ==========================================
    // ERROR MESSAGES
    // ==========================================
    ERRORS: {
        NETWORK: 'Network error. Please check your connection.',
        UNAUTHORIZED: 'Session expired. Please login again.',
        NOT_FOUND: 'Resource not found.',
        SERVER: 'Server error. Please try again later.',
        TIMEOUT: 'Request timed out. Please try again.',
        VALIDATION: 'Please check your input and try again.',
        OFFLINE: 'You are offline. Please check your internet connection.'
    },

    // ==========================================
    // SUCCESS MESSAGES
    // ==========================================
    MESSAGES: {
        LOGIN_SUCCESS: 'Welcome back!',
        LOGOUT_SUCCESS: 'Logged out successfully.',
        SALE_SUCCESS: 'Sale completed successfully!',
        PRODUCT_ADDED: 'Product added successfully!',
        PRODUCT_UPDATED: 'Product updated successfully!',
        PRODUCT_DELETED: 'Product deleted successfully!',
        PRODUCTS_LOADED: 'Products loaded.',
        RESTOCK_SUCCESS: 'Stock updated successfully!',
        USER_ADDED: 'User added successfully!',
        USER_UPDATED: 'User updated successfully!',
        USER_DELETED: 'User deleted successfully!',
        PROFILE_UPDATED: 'Profile updated successfully!'
    },

    // ==========================================
    // ROLES AND PERMISSIONS
    // ==========================================
    ROLES: {
        owner: {
            level: 3,
            permissions: ['all'],
            label: 'Owner',
            icon: '👑',
            color: '#2e7d32'
        },
        manager: {
            level: 2,
            permissions: ['manage_stock', 'view_all_sales', 'manage_users', 'view_reports', 'manage_live_dashboard'],
            label: 'Manager',
            icon: '🎯',
            color: '#3498db'
        },
        employee: {
            level: 1,
            permissions: ['create_sale', 'view_my_sales', 'view_stock'],
            label: 'Employee',
            icon: '🧑‍💼',
            color: '#2ecc71'
        }
    },

    // ==========================================
    // PAYMENT METHODS
    // ==========================================
    PAYMENT_METHODS: {
        CASH:   { id: 'Cash',   label: 'Cash',          icon: '💰', color: '#27ae60' },
        MPESA:  { id: 'M-Pesa', label: 'M-Pesa',        icon: '📱', color: '#2980b9' },
        BANK:   { id: 'Bank',   label: 'Bank Transfer', icon: '🏦', color: '#8e44ad' },
        CREDIT: { id: 'Credit', label: 'Credit',        icon: '📋', color: '#f39c12' }
    },

    // ==========================================
    // RECEIPT SETTINGS
    // ==========================================
    RECEIPT: {
        HEADER: 'FarmersChoice Agrovet',
        SUBHEADER: 'Nairobi, Kenya',
        FOOTER: 'Thank you for your business!',
        POWERED_BY: 'Powered by FarmersChoice Agrovet',
        PAPER_WIDTH: 42,
        SEPARATOR: '─'.repeat(42)
    },

    // ==========================================
    // DEBUG SETTINGS
    // ==========================================
    DEBUG: {
        ENABLED: true,
        LOG_API: true,
        LOG_STATE: true,
        LOG_ERRORS: true,
        SHOW_TIMESTAMPS: true,
        ALLOW_API_OVERRIDE: false   // set true only if you want localStorage.API_BASE to override
    }
};

Object.freeze(CONFIG);
window.CONFIG = CONFIG;

console.log('✅ Config loaded:', CONFIG.APP.NAME, 'v' + CONFIG.APP.VERSION);