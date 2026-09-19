import express from 'express';
import exportService from '../services/export.service.js';
import { verifyToken, requireRoles } from '../middleware/auth.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';
import { supabase } from '../config/database.js';

const router = express.Router();

/**
 * @route   GET /api/v1/exports/sales
 * @desc    Export sales report
 * @access  Private (Manager+)
 */
router.get('/sales', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const format = req.query.format || 'excel';
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        let query = supabase
            .from('sales')
            .select(`
                *,
                user:user_id (
                    full_name
                ),
                sale_items (
                    id
                )
            `)
            .order('created_at', { ascending: false });

        if (startDate) {
            query = query.gte('sale_date', startDate);
        }

        if (endDate) {
            query = query.lte('sale_date', endDate);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Sales query error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: { message: error.message }
            });
        }

        const result = await exportService.exportSalesReport(data, format);

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        if (format === 'csv') {
            res.send(result.data);
        } else {
            res.send(Buffer.from(result.data));
        }
    } catch (error) {
        logger.error(`Export sales error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/exports/inventory
 * @desc    Export inventory report
 * @access  Private (Manager+)
 */
router.get('/inventory', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const format = req.query.format || 'excel';
        const branchId = req.query.branch_id;

        let query = supabase
            .from('inventory_with_details')
            .select('*');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Inventory query error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: { message: error.message }
            });
        }

        const result = await exportService.exportInventoryReport(data, format);

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        if (format === 'csv') {
            res.send(result.data);
        } else {
            res.send(Buffer.from(result.data));
        }
    } catch (error) {
        logger.error(`Export inventory error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/exports/products
 * @desc    Export products report
 * @access  Private (Manager+)
 */
router.get('/products', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const format = req.query.format || 'excel';

        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                categories:category_id (
                    name
                )
            `)
            .order('name', { ascending: true });

        if (error) {
            logger.error('Products query error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: { message: error.message }
            });
        }

        const result = await exportService.exportProductsReport(data, format);

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        if (format === 'csv') {
            res.send(result.data);
        } else {
            res.send(Buffer.from(result.data));
        }
    } catch (error) {
        logger.error(`Export products error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/exports/top-products
 * @desc    Export top products report
 * @access  Private (Manager+)
 */
router.get('/top-products', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const format = req.query.format || 'excel';
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        let query = supabase
            .from('sale_items')
            .select(`
                product_name,
                quantity,
                total_price,
                profit
            `);

        if (startDate) {
            query = query.gte('created_at', startDate);
        }

        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Top products query error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: { message: error.message }
            });
        }

        // Aggregate products
        const productMap = {};
        data.forEach(item => {
            const key = item.product_name || 'Unknown';
            if (!productMap[key]) {
                productMap[key] = {
                    product_name: key,
                    total_quantity: 0,
                    total_revenue: 0,
                    total_profit: 0,
                    transaction_count: 0
                };
            }
            productMap[key].total_quantity += item.quantity || 0;
            productMap[key].total_revenue += item.total_price || 0;
            productMap[key].total_profit += item.profit || 0;
            productMap[key].transaction_count++;
        });

        const topProducts = Object.values(productMap)
            .sort((a, b) => b.total_revenue - a.total_revenue)
            .slice(0, limit);

        const result = await exportService.exportTopProductsReport(topProducts, format);

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        if (format === 'csv') {
            res.send(result.data);
        } else {
            res.send(Buffer.from(result.data));
        }
    } catch (error) {
        logger.error(`Export top products error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/exports/employee-performance
 * @desc    Export employee performance report
 * @access  Private (Manager+)
 */
router.get('/employee-performance', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const format = req.query.format || 'excel';
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        let query = supabase
            .from('sales')
            .select(`
                user_id,
                user:user_id (
                    full_name,
                    role
                ),
                total,
                discount
            `);

        if (startDate) {
            query = query.gte('sale_date', startDate);
        }

        if (endDate) {
            query = query.lte('sale_date', endDate);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Employee performance query error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: { message: error.message }
            });
        }

        // Aggregate by user
        const userMap = {};
        data.forEach(sale => {
            const userId = sale.user_id;
            if (!userMap[userId]) {
                userMap[userId] = {
                    user_name: sale.user?.full_name || 'Unknown',
                    role: sale.user?.role || 'Employee',
                    sales_count: 0,
                    total_revenue: 0,
                    total_discount: 0
                };
            }
            userMap[userId].sales_count++;
            userMap[userId].total_revenue += sale.total || 0;
            userMap[userId].total_discount += sale.discount || 0;
        });

        const performance = Object.values(userMap);
        performance.forEach(user => {
            user.average_transaction = user.sales_count > 0 ? user.total_revenue / user.sales_count : 0;
        });

        const result = await exportService.exportEmployeePerformanceReport(performance, format);

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        if (format === 'csv') {
            res.send(result.data);
        } else {
            res.send(Buffer.from(result.data));
        }
    } catch (error) {
        logger.error(`Export employee performance error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/exports/payment-breakdown
 * @desc    Export payment breakdown report
 * @access  Private (Manager+)
 */
router.get('/payment-breakdown', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const format = req.query.format || 'excel';
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        let query = supabase
            .from('sales')
            .select('payment_method, total')
            .eq('payment_status', 'completed');

        if (startDate) {
            query = query.gte('sale_date', startDate);
        }

        if (endDate) {
            query = query.lte('sale_date', endDate);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Payment breakdown query error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: { message: error.message }
            });
        }

        // Breakdown by payment method
        const breakdown = {};
        data.forEach(sale => {
            const method = sale.payment_method || 'Unknown';
            if (!breakdown[method]) {
                breakdown[method] = { count: 0, total: 0 };
            }
            breakdown[method].count++;
            breakdown[method].total += sale.total || 0;
        });

        const result = await exportService.exportPaymentBreakdownReport(breakdown, format);

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        
        if (format === 'csv') {
            res.send(result.data);
        } else {
            res.send(Buffer.from(result.data));
        }
    } catch (error) {
        logger.error(`Export payment breakdown error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/exports/report
 * @desc    Generic report export — any report type as CSV or Excel
 * @access  Private (Manager+)
 * Query:   type=<report-type>&format=<csv|excel>&...filters
 */
router.get('/report', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const type = req.query.type;
        const format = req.query.format || 'excel';

        if (!type) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'type query param is required' }
            });
        }

        const startDate = req.query.start_date ? new Date(req.query.start_date) : null;
        const endDate = req.query.end_date ? new Date(req.query.end_date) : null;
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;

        let rows = [];
        let headers = [];
        let filename = `Report_${type}`;

        // Import report service lazily to avoid circular imports
        const reportService = (await import('../services/report.service.js')).default;

        switch (type) {
            case 'daily': {
                const date = req.query.date || new Date().toISOString().split('T')[0];
                const r = await reportService.getDailyReport(date, req.query.branch_id);
                headers = [
                    { key: 'receipt_number', label: 'Receipt #' },
                    { key: 'sale_date', label: 'Date' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'payment_method', label: 'Payment' },
                    { key: 'cashier', label: 'Cashier' },
                    { key: 'items', label: 'Items' },
                    { key: 'total', label: 'Total' }
                ];
                rows = r.sales.map(s => ({
                    receipt_number: s.receipt_number,
                    sale_date: new Date(s.sale_date).toLocaleString('en-KE'),
                    customer_name: s.customer_name || 'Walk-in',
                    payment_method: s.payment_method || '',
                    cashier: s.user?.full_name || '',
                    items: s.sale_items?.length || 0,
                    total: s.total || 0
                }));
                filename = `Daily_Report_${date}`;
                break;
            }

            case 'custom':
            case 'weekly':
            case 'monthly':
            case 'yearly': {
                if (!startDate || !endDate) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).json({
                        success: false,
                        error: { message: 'start_date and end_date required' }
                    });
                }
                const r = await reportService.getCustomReport(startDate, endDate, req.query.branch_id);
                headers = [
                    { key: 'receipt_number', label: 'Receipt #' },
                    { key: 'sale_date', label: 'Date' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'payment_method', label: 'Payment' },
                    { key: 'cashier', label: 'Cashier' },
                    { key: 'items', label: 'Items' },
                    { key: 'total', label: 'Total' },
                    { key: 'discount', label: 'Discount' },
                    { key: 'tax', label: 'Tax' }
                ];
                rows = r.sales.map(s => ({
                    receipt_number: s.receipt_number,
                    sale_date: new Date(s.sale_date).toLocaleString('en-KE'),
                    customer_name: s.customer_name || 'Walk-in',
                    payment_method: s.payment_method || '',
                    cashier: s.user?.full_name || '',
                    items: s.sale_items?.length || 0,
                    total: s.total || 0,
                    discount: s.discount || 0,
                    tax: s.tax || 0
                }));
                filename = `Report_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}`;
                break;
            }

            case 'products-list': {
                const { data, error } = await supabase
                    .from('products')
                    .select(`
                        *,
                        categories:category_id ( name ),
                        inventory:branch_inventory ( current_stock, cost_price, selling_price )
                    `)
                    .eq('is_active', true)
                    .order('name', { ascending: true });
                if (error) throw error;

                headers = [
                    { key: 'sku', label: 'SKU' },
                    { key: 'name', label: 'Product' },
                    { key: 'category_name', label: 'Category' },
                    { key: 'unit_of_measure', label: 'Unit' },
                    { key: 'current_stock', label: 'Stock' },
                    { key: 'cost_price', label: 'Cost Price' },
                    { key: 'selling_price', label: 'Sale Price' },
                    { key: 'cost_value', label: 'Cost Value' },
                    { key: 'sale_value', label: 'Sale Value' },
                    { key: 'margin', label: 'Margin' }
                ];
                rows = (data || []).map(p => {
                    const inv = Array.isArray(p.inventory) && p.inventory.length ? p.inventory[0] : null;
                    const stock = (p.inventory || []).reduce((s, i) => s + (i.current_stock || 0), 0);
                    const cost = inv?.cost_price ?? p.cost_price ?? 0;
                    const sell = inv?.selling_price ?? p.selling_price ?? 0;
                    return {
                        sku: p.sku || '',
                        name: p.name,
                        category_name: p.categories?.name || 'Uncategorized',
                        unit_of_measure: p.unit_of_measure || 'piece',
                        current_stock: stock,
                        cost_price: cost,
                        selling_price: sell,
                        cost_value: stock * cost,
                        sale_value: stock * sell,
                        margin: stock * (sell - cost)
                    };
                });
                filename = 'Products_List';
                break;
            }

            case 'top-products': {
                const r = await reportService.getTopProducts(limit, startDate, endDate, req.query.branch_id);
                headers = [
                    { key: 'product_name', label: 'Product' },
                    { key: 'total_quantity', label: 'Units Sold' },
                    { key: 'total_revenue', label: 'Revenue' },
                    { key: 'total_profit', label: 'Profit' },
                    { key: 'transaction_count', label: 'Transactions' }
                ];
                rows = r;
                filename = 'Top_Products';
                break;
            }

            case 'category-report': {
                if (!startDate || !endDate) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).json({
                        success: false,
                        error: { message: 'start_date and end_date required' }
                    });
                }
                const r = await reportService.getCategoryReport(startDate, endDate, req.query.branch_id);
                headers = [
                    { key: 'category_name', label: 'Category' },
                    { key: 'products_count', label: 'Products' },
                    { key: 'unique_products_sold', label: 'Products Sold' },
                    { key: 'total_quantity_sold', label: 'Units Sold' },
                    { key: 'total_revenue', label: 'Revenue' },
                    { key: 'total_profit', label: 'Profit' },
                    { key: 'transaction_count', label: 'Transactions' }
                ];
                rows = r.data;
                filename = 'Product_Categories';
                break;
            }

            case 'stock-movement': {
                if (!startDate || !endDate) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).json({
                        success: false,
                        error: { message: 'start_date and end_date required' }
                    });
                }
                const r = await reportService.getStockMovementReport(startDate, endDate, limit, req.query.branch_id);
                headers = [
                    { key: 'sku', label: 'SKU' },
                    { key: 'product_name', label: 'Product' },
                    { key: 'total_quantity_sold', label: 'Units Sold' },
                    { key: 'avg_daily_units', label: 'Avg/Day' },
                    { key: 'current_stock', label: 'Stock on Hand' },
                    { key: 'days_of_stock_left', label: 'Days Left' },
                    { key: 'total_revenue', label: 'Revenue' },
                    { key: 'total_profit', label: 'Profit' }
                ];
                rows = r.data;
                filename = 'Stock_Movement';
                break;
            }

            case 'stock-value': {
                const r = await reportService.getStockValueReport(req.query.branch_id);
                headers = [
                    { key: 'product_name', label: 'Product' },
                    { key: 'sku', label: 'SKU' },
                    { key: 'current_stock', label: 'Stock' },
                    { key: 'cost_price', label: 'Cost Price' },
                    { key: 'selling_price', label: 'Sale Price' },
                    { key: 'cost_value', label: 'Cost Value' },
                    { key: 'sale_value', label: 'Sale Value' },
                    { key: 'margin', label: 'Margin' }
                ];
                rows = r.items.map(i => ({
                    product_name: i.product?.name || 'Unknown',
                    sku: i.product?.sku || '',
                    current_stock: i.current_stock || 0,
                    cost_price: i.cost_price || 0,
                    selling_price: i.selling_price || 0,
                    cost_value: (i.current_stock || 0) * (i.cost_price || 0),
                    sale_value: (i.current_stock || 0) * (i.selling_price || 0),
                    margin: (i.current_stock || 0) * ((i.selling_price || 0) - (i.cost_price || 0))
                }));
                filename = 'Stock_Value';
                break;
            }

            case 'employee-performance': {
                if (!startDate || !endDate) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).json({
                        success: false,
                        error: { message: 'start_date and end_date required' }
                    });
                }
                const r = await reportService.getEmployeePerformanceReport(startDate, endDate, req.query.branch_id);
                headers = [
                    { key: 'user_name', label: 'Employee' },
                    { key: 'role', label: 'Role' },
                    { key: 'sales_count', label: 'Sales' },
                    { key: 'total_revenue', label: 'Revenue' },
                    { key: 'total_profit', label: 'Profit' },
                    { key: 'average_transaction', label: 'Avg Sale' },
                    { key: 'total_discount', label: 'Discount' }
                ];
                rows = r;
                filename = 'Employee_Performance';
                break;
            }

            case 'users-report': {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, full_name, username, email, phone, role, permissions, is_active, last_login')
                    .order('role', { ascending: true })
                    .order('full_name', { ascending: true });
                if (error) throw error;
                headers = [
                    { key: 'full_name', label: 'Name' },
                    { key: 'username', label: 'Username' },
                    { key: 'email', label: 'Email' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'role', label: 'Role' },
                    { key: 'permissions_label', label: 'Permissions' },
                    { key: 'status', label: 'Status' },
                    { key: 'last_login', label: 'Last Login' }
                ];
                rows = (data || []).map(u => {
                    const perms = Array.isArray(u.permissions) ? u.permissions : [];
                    const permLabel = perms.includes('all')
                        ? 'ALL'
                        : perms.length === 0
                            ? 'None'
                            : `${perms.length} granted`;
                    return {
                        full_name: u.full_name || 'Unnamed',
                        username: u.username ? '@' + u.username : '',
                        email: u.email || '',
                        phone: u.phone || '',
                        role: (u.role || '').toUpperCase(),
                        permissions_label: permLabel,
                        status: u.is_active === false ? 'Deactivated' : 'Active',
                        last_login: u.last_login
                            ? new Date(u.last_login).toLocaleDateString('en-KE')
                            : ''
                    };
                });
                filename = 'Users_Report';
                break;
            }

            case 'payment-breakdown': {
                if (!startDate || !endDate) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).json({
                        success: false,
                        error: { message: 'start_date and end_date required' }
                    });
                }
                const r = await reportService.getPaymentBreakdownReport(startDate, endDate, req.query.branch_id);
                headers = [
                    { key: 'payment_method', label: 'Payment Method' },
                    { key: 'count', label: 'Transactions' },
                    { key: 'total', label: 'Total Amount' },
                    { key: 'discount', label: 'Discount' },
                    { key: 'tax', label: 'Tax' }
                ];
                rows = Object.entries(r.breakdown).map(([method, d]) => ({
                    payment_method: method,
                    count: d.count,
                    total: d.total,
                    discount: d.discount,
                    tax: d.tax
                }));
                filename = 'Payment_Breakdown';
                break;
            }

            case 'profit-loss': {
                if (!startDate || !endDate) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).json({
                        success: false,
                        error: { message: 'start_date and end_date are required' }
                    });
                }
                const r = await reportService.getProfitLossReport(startDate, endDate, req.query.branch_id);
                headers = [
                    { key: 'metric', label: 'Metric' },
                    { key: 'value', label: 'Value' }
                ];
                rows = [
                    { metric: 'Total Revenue', value: r.revenue.total_revenue },
                    { metric: 'Cost of Goods Sold', value: r.revenue.total_cost_of_goods },
                    { metric: 'Gross Profit', value: r.revenue.gross_profit },
                    { metric: 'Gross Margin %', value: r.revenue.gross_margin_percentage.toFixed(2) + '%' },
                    { metric: 'Total Discount', value: r.deductions.total_discount },
                    { metric: 'Total Tax', value: r.deductions.total_tax },
                    { metric: 'Net Profit', value: r.profit.net_profit },
                    { metric: 'Net Margin %', value: r.profit.net_margin_percentage.toFixed(2) + '%' }
                ];
                filename = 'Profit_Loss';
                break;
            }

            case 'price-increase-sales': {
                if (!startDate || !endDate) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).json({
                        success: false,
                        error: { message: 'start_date and end_date required' }
                    });
                }
                const r = await reportService.getCustomReport(startDate, endDate, req.query.branch_id);
                const allSales = r.sales || [];

                const productIds = [...new Set(
                    allSales.flatMap(s => (s.sale_items || []).map(it => it.product_id)).filter(Boolean)
                )];

                let productsById = {};
                if (productIds.length > 0) {
                    const { data: prods, error: pErr } = await supabase
                        .from('products')
                        .select('id, name, selling_price')
                        .in('id', productIds);
                    if (!pErr && prods) {
                        prods.forEach(p => {
                            productsById[p.id] = {
                                name: p.name,
                                selling_price: Number(p.selling_price) || 0
                            };
                        });
                    }
                }

                headers = [
                    { key: 'receipt_number', label: 'Receipt' },
                    { key: 'sale_date', label: 'Date' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'cashier_name', label: 'Cashier' },
                    { key: 'payment_method', label: 'Payment' },
                    { key: 'subtotal', label: 'Subtotal' },
                    { key: 'increase_total', label: 'Increase' },
                    { key: 'total', label: 'Total' }
                ];

                rows = [];
                allSales.forEach(s => {
                    const items = s.sale_items || [];
                    let increaseTotal = 0;
                    items.forEach(it => {
                        const base = productsById[it.product_id]?.selling_price;
                        const unit = Number(it.unit_price) || 0;
                        const qty = Number(it.quantity) || 0;
                        if (base !== undefined && unit > base) {
                            increaseTotal += (unit - base) * qty;
                        }
                    });
                    if (increaseTotal > 0) {
                        rows.push({
                            receipt_number: s.receipt_number,
                            sale_date: new Date(s.sale_date).toLocaleString('en-KE'),
                            customer_name: s.customer_name || 'Walk-in',
                            cashier_name: s.user?.full_name || '',
                            payment_method: s.payment_method || '',
                            subtotal: s.subtotal || 0,
                            increase_total: increaseTotal,
                            total: s.total || 0
                        });
                    }
                });

                filename = 'Price_Increase_Sales';
                break;
            }

            case 'discounted-sales': {
                if (!startDate || !endDate) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).json({
                        success: false,
                        error: { message: 'start_date and end_date required' }
                    });
                }
                const r = await reportService.getCustomReport(startDate, endDate, req.query.branch_id);
                headers = [
                    { key: 'receipt_number', label: 'Receipt' },
                    { key: 'sale_date', label: 'Date' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'cashier', label: 'Cashier' },
                    { key: 'payment_method', label: 'Payment' },
                    { key: 'subtotal', label: 'Subtotal' },
                    { key: 'discount', label: 'Discount' },
                    { key: 'total', label: 'Total' }
                ];
                rows = (r.sales || [])
                    .filter(s => (Number(s.discount) || 0) > 0)
                    .map(s => ({
                        receipt_number: s.receipt_number,
                        sale_date: new Date(s.sale_date).toLocaleString('en-KE'),
                        customer_name: s.customer_name || 'Walk-in',
                        cashier: s.user?.full_name || '',
                        payment_method: s.payment_method || '',
                        subtotal: s.subtotal || 0,
                        discount: s.discount || 0,
                        total: s.total || 0
                    }));
                filename = 'Discounted_Sales';
                break;
            }

            case 'active-discounts': {
                const today = new Date().toISOString().split('T')[0];
                const { data, error } = await supabase
                    .from('discounts')
                    .select('*')
                    .eq('is_active', true)
                    .lte('start_date', today)
                    .gte('end_date', today);
                if (error) throw error;
                headers = [
                    { key: 'name', label: 'Name' },
                    { key: 'discount_type', label: 'Type' },
                    { key: 'discount_value', label: 'Value' },
                    { key: 'min_purchase', label: 'Min Purchase' },
                    { key: 'max_discount', label: 'Max Discount' },
                    { key: 'start_date', label: 'Start' },
                    { key: 'end_date', label: 'End' }
                ];
                rows = data || [];
                filename = 'Active_Discounts';
                break;
            }

            case 'discount-usage': {
                if (!startDate || !endDate) {
                    return res.status(HTTP_STATUS.BAD_REQUEST).json({
                        success: false,
                        error: { message: 'start_date and end_date required' }
                    });
                }
                const discountService = (await import('../services/discount.service.js')).default;
                const r = await discountService.getDiscountUsageReport(startDate, endDate);
                headers = [
                    { key: 'discount_name', label: 'Discount' },
                    { key: 'usage_count', label: 'Times Used' },
                    { key: 'total_discount_amount', label: 'Total Discount' }
                ];
                rows = r.discount_breakdown;
                filename = 'Discount_Usage';
                break;
            }

            case 'credit': {
                const status = req.query.status || 'all';
                let query = supabase
                    .from('sales')
                    .select(`
                        receipt_number, sale_date, customer_name, total, paid_amount, payment_status,
                        user:user_id (full_name)
                    `)
                    .eq('payment_method', 'Credit')
                    .order('created_at', { ascending: false });
                if (status !== 'all') query = query.eq('payment_status', status);
                if (startDate) query = query.gte('sale_date', startDate.toISOString());
                if (endDate) query = query.lte('sale_date', endDate.toISOString());
                const { data, error } = await query;
                if (error) throw error;
                headers = [
                    { key: 'receipt_number', label: 'Receipt #' },
                    { key: 'sale_date', label: 'Date' },
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'total', label: 'Total' },
                    { key: 'paid_amount', label: 'Paid' },
                    { key: 'balance', label: 'Balance' },
                    { key: 'payment_status', label: 'Status' },
                    { key: 'cashier', label: 'Cashier' }
                ];
                rows = (data || []).map(s => ({
                    receipt_number: s.receipt_number,
                    sale_date: new Date(s.sale_date).toLocaleString('en-KE'),
                    customer_name: s.customer_name || 'Walk-in',
                    total: s.total || 0,
                    paid_amount: s.paid_amount || 0,
                    balance: (s.total || 0) - (s.paid_amount || 0),
                    payment_status: s.payment_status,
                    cashier: s.user?.full_name || ''
                }));
                filename = 'Credit_Report';
                break;
            }

            default:
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: { message: `Unknown report type: ${type}` }
                });
        }

        const result = await exportService.exportGenericReport(rows, headers, filename, format);

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

        if (format === 'csv') {
            res.send(result.data);
        } else {
            res.send(Buffer.from(result.data));
        }
    } catch (error) {
        console.error('🔥 GET /exports/report error:', error);
        logger.error(`GET /exports/report error: ${error.message}`);
        next(error);
    }
});

export default router;