import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our modules (note the .js extension in imports)
import logger from './utils/logger.js';
import { supabase, testConnection } from './config/database.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { HTTP_STATUS } from './utils/constants.js';

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import saleRoutes from './routes/sales.js';
import inventoryRoutes from './routes/inventory.js';
import reportRoutes from './routes/reports.js';
import discountRoutes from './routes/discounts.js';
import exportRoutes from './routes/exports.js';
import notificationRoutes from './routes/notifications.js';
import userRoutes from './routes/users.js';

// Import services for scheduling
import cron from 'node-cron';
import notificationService from './services/notification.service.js';

// Load environment variables
dotenv.config();

// Initialize express app
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================

// ────────────────────────────────────────────
// CORS CONFIGURATION
// ────────────────────────────────────────────
// Dev: allow any localhost / 127.0.0.1 port (Live Server uses random ports)
// Prod: set ALLOWED_ORIGINS in .env as comma-separated list
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PROD_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (Postman, curl, mobile apps)
        if (!origin) return callback(null, true);

        // Development: allow any localhost / 127.0.0.1 port
        if (process.env.NODE_ENV !== 'production') {
            if (LOCAL_ORIGIN_PATTERN.test(origin)) {
                return callback(null, true);
            }
            logger.warn(`CORS blocked (dev): ${origin}`);
            return callback(new Error(`CORS blocked: ${origin}`));
        }

        // Production: check explicit allowlist
        if (PROD_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        logger.warn(`CORS blocked (prod): ${origin}`);
        return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Parse JSON requests
app.use(express.json({ limit: '10mb' }));
// User routes
app.use('/api/v1/users', userRoutes);

// Parse URL-encoded requests
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl} - ${req.ip}`);
    next();
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

/**
 * GET /api/health
 * Check if the API is running and database is connected
 */
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
        const dbConnected = await testConnection();
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            app: process.env.APP_NAME || 'FarmersChoice Agrovet',
            version: process.env.API_VERSION || 'v1',
            environment: process.env.NODE_ENV || 'development',
            database: {
                connected: dbConnected,
                url: process.env.SUPABASE_URL ? 'Configured' : 'Missing'
            }
        });
    } catch (error) {
        logger.error(`Health check failed: ${error.message}`);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
});

/**
 * GET /api
 * API information
 */
app.get('/api', (req, res) => {
    res.status(HTTP_STATUS.OK).json({
        name: process.env.APP_NAME || 'FarmersChoice Agrovet API',
        version: process.env.API_VERSION || 'v1',
        description: 'Point of Sale Backend API for FarmersChoice Agrovet',
        endpoints: {
            health: '/api/health',
            api: '/api/v1',
            auth: '/api/v1/auth',
            products: '/api/v1/products',
            sales: '/api/v1/sales',
            inventory: '/api/v1/inventory',
            reports: '/api/v1/reports',
            discounts: '/api/v1/discounts',
            exports: '/api/v1/exports',
            notifications: '/api/v1/notifications',
            docs: 'Coming soon...'
        }
    });
});

/**
 * GET /api/v1
 * API version information
 */
app.get('/api/v1', (req, res) => {
    res.status(HTTP_STATUS.OK).json({
        name: process.env.APP_NAME || 'FarmersChoice Agrovet API',
        version: process.env.API_VERSION || 'v1',
        description: 'Point of Sale Backend API for FarmersChoice Agrovet',
        endpoints: {
            auth: {
                register: 'POST /api/v1/auth/register',
                login: 'POST /api/v1/auth/login',
                me: 'GET /api/v1/auth/me',
                logout: 'POST /api/v1/auth/logout'
            },
            products: {
                list: 'GET /api/v1/products',
                create: 'POST /api/v1/products',
                get: 'GET /api/v1/products/:id',
                update: 'PUT /api/v1/products/:id',
                delete: 'DELETE /api/v1/products/:id',
                search: 'GET /api/v1/products/search?q=term',
                lowStock: 'GET /api/v1/products/low-stock',
                categories: 'GET /api/v1/products/get-categories',
                restock: 'POST /api/v1/products/:id/restock'
            },
            sales: {
                create: 'POST /api/v1/sales',
                list: 'GET /api/v1/sales',
                get: 'GET /api/v1/sales/:id',
                receipt: 'GET /api/v1/sales/receipt/:number',
                today: 'GET /api/v1/sales/today',
                byPayment: 'GET /api/v1/sales/by-payment/:method',
                credit: 'GET /api/v1/sales/credit',
                return: 'POST /api/v1/sales/:id/return',
                summary: 'GET /api/v1/sales/summary'
            },
            inventory: {
                list: 'GET /api/v1/inventory',
                product: 'GET /api/v1/inventory/product/:productId',
                updateStock: 'POST /api/v1/inventory/update-stock',
                transfer: 'POST /api/v1/inventory/transfer',
                movements: 'GET /api/v1/inventory/movements',
                lowStock: 'GET /api/v1/inventory/low-stock',
                summary: 'GET /api/v1/inventory/summary',
                branchSummary: 'GET /api/v1/inventory/branch/:branchId/summary'
            },
            reports: {
                daily: 'GET /api/v1/reports/daily?date=YYYY-MM-DD',
                weekly: 'GET /api/v1/reports/weekly?year=YYYY&week=WW',
                monthly: 'GET /api/v1/reports/monthly?year=YYYY&month=MM',
                yearly: 'GET /api/v1/reports/yearly?year=YYYY',
                custom: 'GET /api/v1/reports/custom?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD',
                paymentBreakdown: 'GET /api/v1/reports/payment-breakdown?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD',
                topProducts: 'GET /api/v1/reports/top-products?limit=10&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD',
                employeePerformance: 'GET /api/v1/reports/employee-performance?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD',
                stockValue: 'GET /api/v1/reports/stock-value',
                profitLoss: 'GET /api/v1/reports/profit-loss?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD'
            },
            discounts: {
                create: 'POST /api/v1/discounts',
                list: 'GET /api/v1/discounts',
                active: 'GET /api/v1/discounts/active',
                apply: 'POST /api/v1/discounts/apply',
                creditPay: 'POST /api/v1/discounts/credit/pay',
                creditList: 'GET /api/v1/discounts/credit',
                usageReport: 'GET /api/v1/discounts/usage-report'
            },
            exports: {
                sales: 'GET /api/v1/exports/sales?format=csv|excel&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD',
                inventory: 'GET /api/v1/exports/inventory?format=csv|excel&branch_id=UUID',
                products: 'GET /api/v1/exports/products?format=csv|excel',
                topProducts: 'GET /api/v1/exports/top-products?format=csv|excel&limit=10&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD',
                employeePerformance: 'GET /api/v1/exports/employee-performance?format=csv|excel&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD',
                paymentBreakdown: 'GET /api/v1/exports/payment-breakdown?format=csv|excel&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD'
            },
            notifications: {
                lowStock: 'POST /api/v1/notifications/low-stock',
                dailySummary: 'POST /api/v1/notifications/daily-summary'
            }
        }
    });
});

// ============================================
// API ROUTES
// ============================================

// Authentication routes
app.use('/api/v1/auth', authRoutes);

// Product routes
app.use('/api/v1/products', productRoutes);

// Sales routes
app.use('/api/v1/sales', saleRoutes);

// Inventory routes
app.use('/api/v1/inventory', inventoryRoutes);

// Reports routes
app.use('/api/v1/reports', reportRoutes);

// Discounts routes
app.use('/api/v1/discounts', discountRoutes);

// Exports routes
app.use('/api/v1/exports', exportRoutes);

// Notifications routes
app.use('/api/v1/notifications', notificationRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler - catch all unmatched routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

async function startServer() {
    try {
        // Test database connection
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            logger.warn('⚠️ Database connection failed - some features may not work');
        }
        
        // Start the server
        app.listen(PORT, () => {
            logger.info('='.repeat(50));
            logger.info(`🚀 ${process.env.APP_NAME || 'FarmersChoice Agrovet'} API`);
            logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`📍 Port: ${PORT}`);
            logger.info(`📍 Health: http://localhost:${PORT}/api/health`);
            logger.info(`📍 API: http://localhost:${PORT}/api/v1`);
            logger.info(`📍 Auth: http://localhost:${PORT}/api/v1/auth`);
            logger.info(`📍 Products: http://localhost:${PORT}/api/v1/products`);
            logger.info(`📍 Sales: http://localhost:${PORT}/api/v1/sales`);
            logger.info(`📍 Inventory: http://localhost:${PORT}/api/v1/inventory`);
            logger.info(`📍 Reports: http://localhost:${PORT}/api/v1/reports`);
            logger.info(`📍 Discounts: http://localhost:${PORT}/api/v1/discounts`);
            logger.info(`📍 Exports: http://localhost:${PORT}/api/v1/exports`);
            logger.info(`📍 Notifications: http://localhost:${PORT}/api/v1/notifications`);
            logger.info(`📍 Database: ${dbConnected ? 'Connected ✅' : 'Disconnected ❌'}`);
            logger.info('='.repeat(50));
        });
        
    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
}

// ────────────────────────────────────────────────
// 📧 NOTIFICATION SCHEDULER
// ────────────────────────────────────────────────

// Run low stock check every hour (at minute 0)
cron.schedule('0 * * * *', async () => {
    try {
        console.log('⏰ Running scheduled low stock check...');
        await notificationService.checkLowStockAndNotify();
    } catch (error) {
        console.error('❌ Scheduled low stock check failed:', error);
    }
});

// Run daily summary at 8:00 PM every day
cron.schedule('0 20 * * *', async () => {
    try {
        console.log('⏰ Running scheduled daily summary...');
        await notificationService.sendDailySummary();
    } catch (error) {
        console.error('❌ Scheduled daily summary failed:', error);
    }
});

// Run low stock check on startup (after 10 seconds)
setTimeout(async () => {
    try {
        console.log('🚀 Running startup low stock check...');
        await notificationService.checkLowStockAndNotify();
    } catch (error) {
        console.error('❌ Startup low stock check failed:', error);
    }
}, 10000);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the server
startServer();

export default app;