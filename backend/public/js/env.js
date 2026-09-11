// ============================================
// ENVIRONMENT - FarmersChoice Agrovet
// Auto-detects environment and loads config
// ============================================

const ENV = {
    // ==========================================
    // ENVIRONMENT DETECTION
    // ==========================================
    
    /**
     * Detect current environment
     * Returns: 'development', 'production', or 'test'
     */
    getEnvironment() {
        const hostname = window.location.hostname;
        const port = window.location.port;
        
        // Check if running on localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        }
        
        // Check if running on test server
        if (hostname.includes('test') || hostname.includes('staging')) {
            return 'test';
        }
        
        // Default to production
        return 'production';
    },

    /**
     * Check if running in development mode
     */
    isDevelopment() {
        return this.getEnvironment() === 'development';
    },

    /**
     * Check if running in production mode
     */
    isProduction() {
        return this.getEnvironment() === 'production';
    },

    /**
     * Check if running in test mode
     */
    isTest() {
        return this.getEnvironment() === 'test';
    },

    /**
     * Get the API base URL for current environment
     */
    getApiUrl() {
        const env = this.getEnvironment();
        
        // Use config if available
        if (window.CONFIG && window.CONFIG.API) {
            if (env === 'development') {
                return window.CONFIG.API.DEV_URL;
            } else if (env === 'production') {
                return window.CONFIG.API.PROD_URL;
            }
        }
        
        // Fallback to hardcoded values
        if (env === 'development') {
            return 'http://localhost:5001/api/v1';
        } else {
            return 'https://your-api-domain.com/api/v1';
        }
    },

    /**
     * Get full app URL for current environment
     */
    getAppUrl() {
        return window.location.origin;
    },

    /**
     * Get environment-specific settings
     */
    getSettings() {
        const env = this.getEnvironment();
        
        return {
            environment: env,
            apiUrl: this.getApiUrl(),
            appUrl: this.getAppUrl(),
            isDevelopment: this.isDevelopment(),
            isProduction: this.isProduction(),
            isTest: this.isTest(),
            debug: env === 'development' || env === 'test'
        };
    },

    /**
     * Log environment information for debugging
     */
    logInfo() {
        const settings = this.getSettings();
        console.log('='.repeat(50));
        console.log('🌍 ENVIRONMENT INFORMATION');
        console.log('='.repeat(50));
        console.log('📍 Environment:', settings.environment);
        console.log('📍 API URL:', settings.apiUrl);
        console.log('📍 App URL:', settings.appUrl);
        console.log('📍 Debug Mode:', settings.debug);
        console.log('📍 Development:', settings.isDevelopment);
        console.log('📍 Production:', settings.isProduction);
        console.log('='.repeat(50));
        return settings;
    }
};

// Load config if available and merge settings
if (window.CONFIG) {
    window.CONFIG.ENV = ENV.getSettings();
}

// Expose to global scope
window.ENV = ENV;

// Auto-log environment info on load
if (ENV.isDevelopment()) {
    ENV.logInfo();
}

console.log('✅ Environment loaded successfully!');
console.log('🌍 Current environment:', ENV.getEnvironment());
console.log('🔗 API URL:', ENV.getApiUrl());