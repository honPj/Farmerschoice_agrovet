import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';

class ReportService {
    /**
     * Get daily sales report
     */
    async getDailyReport(date, branchId = null) {
        try {
            console.log('📂📂📂 getDailyReport called 📂📂📂');
            console.log(`📂 Date: ${date}, Branch: ${branchId || 'All'}`);

            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);

            let query = supabase
                .from('sales')
                .select(`
                    *,
                    user:user_id (
                        id,
                        full_name,
                        role
                    ),
                    branch:branch_id (
                        id,
                        name,
                        location
                    ),
                    sale_items (
                        id,
                        product_name,
                        quantity,
                        unit_price,
                        total_price,
                        profit
                    )
                `)
                .gte('sale_date', startDate.toISOString())
                .lte('sale_date', endDate.toISOString());

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query
                .order('created_at', { ascending: true });

            if (error) {
                console.error('❌ getDailyReport error:', error);
                throw error;
            }

            // Calculate summary
            const totalSales = data.length;
            const totalRevenue = data.reduce((sum, sale) => sum + (sale.total || 0), 0);
            const totalProfit = data.reduce((sum, sale) => {
                const saleProfit = sale.sale_items?.reduce((s, item) => s + (item.profit || 0), 0) || 0;
                return sum + saleProfit;
            }, 0);
            const totalDiscount = data.reduce((sum, sale) => sum + (sale.discount || 0), 0);
            const totalTax = data.reduce((sum, sale) => sum + (sale.tax || 0), 0);

            // Payment method breakdown
            const paymentBreakdown = {};
            data.forEach(sale => {
                const method = sale.payment_method || 'Unknown';
                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + sale.total;
            });

            // Hourly breakdown
            const hourlyBreakdown = {};
            data.forEach(sale => {
                const hour = new Date(sale.sale_date).getHours();
                const hourKey = `${hour}:00`;
                hourlyBreakdown[hourKey] = (hourlyBreakdown[hourKey] || 0) + sale.total;
            });

            return {
                report_type: 'daily',
                date: date,
                summary: {
                    total_sales: totalSales,
                    total_revenue: totalRevenue,
                    total_profit: totalProfit,
                    total_discount: totalDiscount,
                    total_tax: totalTax,
                    average_transaction: totalSales > 0 ? totalRevenue / totalSales : 0
                },
                payment_breakdown: paymentBreakdown,
                hourly_breakdown: hourlyBreakdown,
                sales: data
            };
        } catch (error) {
            console.error('🔥 getDailyReport error:', error);
            logger.error(`Get daily report error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get weekly sales report
     */
    async getWeeklyReport(year, week, branchId = null) {
        try {
            console.log('📂📂📂 getWeeklyReport called 📂📂📂');
            console.log(`📂 Year: ${year}, Week: ${week}, Branch: ${branchId || 'All'}`);

            // Get first day of the week (Monday)
            const firstDayOfYear = new Date(year, 0, 1);
            const daysOffset = (week - 1) * 7;
            const startDate = new Date(firstDayOfYear);
            startDate.setDate(firstDayOfYear.getDate() + daysOffset);
            
            // Adjust to Monday
            const dayOfWeek = startDate.getDay();
            const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate.setDate(startDate.getDate() - mondayOffset);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);

            return await this.getCustomReport(startDate, endDate, branchId);
        } catch (error) {
            console.error('🔥 getWeeklyReport error:', error);
            logger.error(`Get weekly report error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get monthly sales report
     */
    async getMonthlyReport(year, month, branchId = null) {
        try {
            console.log('📂📂📂 getMonthlyReport called 📂📂📂');
            console.log(`📂 Year: ${year}, Month: ${month}, Branch: ${branchId || 'All'}`);

            const startDate = new Date(year, month - 1, 1);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(year, month, 0);
            endDate.setHours(23, 59, 59, 999);

            return await this.getCustomReport(startDate, endDate, branchId);
        } catch (error) {
            console.error('🔥 getMonthlyReport error:', error);
            logger.error(`Get monthly report error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get yearly sales report
     */
    async getYearlyReport(year, branchId = null) {
        try {
            console.log('📂📂📂 getYearlyReport called 📂📂📂');
            console.log(`📂 Year: ${year}, Branch: ${branchId || 'All'}`);

            const startDate = new Date(year, 0, 1);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(year, 11, 31);
            endDate.setHours(23, 59, 59, 999);

            return await this.getCustomReport(startDate, endDate, branchId);
        } catch (error) {
            console.error('🔥 getYearlyReport error:', error);
            logger.error(`Get yearly report error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get custom date range report
     */
    async getCustomReport(startDate, endDate, branchId = null) {
        try {
            console.log('📂📂📂 getCustomReport called 📂📂📂');
            console.log(`📂 Start: ${startDate}, End: ${endDate}, Branch: ${branchId || 'All'}`);

            let query = supabase
                .from('sales')
                .select(`
                    *,
                    user:user_id (
                        id,
                        full_name,
                        role
                    ),
                    branch:branch_id (
                        id,
                        name,
                        location
                    ),
                    sale_items (
                        id,
                        product_name,
                        quantity,
                        unit_price,
                        total_price,
                        profit
                    )
                `)
                .gte('sale_date', startDate.toISOString())
                .lte('sale_date', endDate.toISOString());

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query
                .order('created_at', { ascending: true });

            if (error) {
                console.error('❌ getCustomReport error:', error);
                throw error;
            }

            // Calculate summary
            const totalSales = data.length;
            const totalRevenue = data.reduce((sum, sale) => sum + (sale.total || 0), 0);
            const totalProfit = data.reduce((sum, sale) => {
                const saleProfit = sale.sale_items?.reduce((s, item) => s + (item.profit || 0), 0) || 0;
                return sum + saleProfit;
            }, 0);
            const totalDiscount = data.reduce((sum, sale) => sum + (sale.discount || 0), 0);
            const totalTax = data.reduce((sum, sale) => sum + (sale.tax || 0), 0);

            // Daily breakdown
            const dailyBreakdown = {};
            data.forEach(sale => {
                const date = new Date(sale.sale_date).toISOString().split('T')[0];
                dailyBreakdown[date] = (dailyBreakdown[date] || 0) + sale.total;
            });

            // Payment method breakdown
            const paymentBreakdown = {};
            data.forEach(sale => {
                const method = sale.payment_method || 'Unknown';
                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + sale.total;
            });

            // User performance
            const userPerformance = {};
            data.forEach(sale => {
                const userId = sale.user_id;
                if (!userPerformance[userId]) {
                    userPerformance[userId] = {
                        user_id: userId,
                        user_name: sale.user?.full_name || 'Unknown',
                        role: sale.user?.role || 'Unknown',
                        sales_count: 0,
                        total_revenue: 0,
                        total_profit: 0
                    };
                }
                userPerformance[userId].sales_count++;
                userPerformance[userId].total_revenue += sale.total || 0;
                userPerformance[userId].total_profit += sale.sale_items?.reduce((s, item) => s + (item.profit || 0), 0) || 0;
            });

            return {
                report_type: 'custom',
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                summary: {
                    total_sales: totalSales,
                    total_revenue: totalRevenue,
                    total_profit: totalProfit,
                    total_discount: totalDiscount,
                    total_tax: totalTax,
                    average_transaction: totalSales > 0 ? totalRevenue / totalSales : 0
                },
                daily_breakdown: dailyBreakdown,
                payment_breakdown: paymentBreakdown,
                user_performance: Object.values(userPerformance),
                sales: data
            };
        } catch (error) {
            console.error('🔥 getCustomReport error:', error);
            logger.error(`Get custom report error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get payment breakdown report
     */
    async getPaymentBreakdownReport(startDate, endDate, branchId = null) {
        try {
            console.log('📂📂📂 getPaymentBreakdownReport called 📂📂📂');

            let query = supabase
                .from('sales')
                .select('payment_method, total, discount, tax')
                .gte('sale_date', startDate.toISOString())
                .lte('sale_date', endDate.toISOString());

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ getPaymentBreakdownReport error:', error);
                throw error;
            }

            const breakdown = {};
            data.forEach(sale => {
                const method = sale.payment_method || 'Unknown';
                if (!breakdown[method]) {
                    breakdown[method] = {
                        count: 0,
                        total: 0,
                        discount: 0,
                        tax: 0
                    };
                }
                breakdown[method].count++;
                breakdown[method].total += sale.total || 0;
                breakdown[method].discount += sale.discount || 0;
                breakdown[method].tax += sale.tax || 0;
            });

            const totalRevenue = data.reduce((sum, sale) => sum + (sale.total || 0), 0);
            const totalCount = data.length;

            return {
                breakdown: breakdown,
                total_revenue: totalRevenue,
                total_transactions: totalCount,
                date_range: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                }
            };
        } catch (error) {
            console.error('🔥 getPaymentBreakdownReport error:', error);
            logger.error(`Get payment breakdown report error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get top selling products
     */
    async getTopProducts(limit = 10, startDate = null, endDate = null, branchId = null) {
        try {
            console.log('📂📂📂 getTopProducts called 📂📂📂');

            let query = supabase
                .from('sale_items')
                .select(`
                    product_id,
                    product_name,
                    quantity,
                    total_price,
                    profit,
                    sale:sale_id (
                        sale_date,
                        branch_id
                    )
                `);

            if (startDate) {
                query = query.gte('sale.sale_date', startDate.toISOString());
            }

            if (endDate) {
                query = query.lte('sale.sale_date', endDate.toISOString());
            }

            if (branchId) {
                query = query.eq('sale.branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ getTopProducts error:', error);
                throw error;
            }

            // Aggregate by product
            const productMap = {};
            data.forEach(item => {
                const key = item.product_id || 'unknown';
                if (!productMap[key]) {
                    productMap[key] = {
                        product_id: key,
                        product_name: item.product_name || 'Unknown',
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

            // Sort by revenue
            const sorted = Object.values(productMap)
                .sort((a, b) => b.total_revenue - a.total_revenue)
                .slice(0, limit);

            return sorted;
        } catch (error) {
            console.error('🔥 getTopProducts error:', error);
            logger.error(`Get top products error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get employee performance report
     */
    async getEmployeePerformanceReport(startDate, endDate, branchId = null) {
        try {
            console.log('📂📂📂 getEmployeePerformanceReport called 📂📂📂');

            let query = supabase
                .from('sales')
                .select(`
                    user_id,
                    user:user_id (
                        id,
                        full_name,
                        role,
                        email
                    ),
                    total,
                    discount,
                    tax,
                    sale_items (
                        profit
                    )
                `)
                .gte('sale_date', startDate.toISOString())
                .lte('sale_date', endDate.toISOString());

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ getEmployeePerformanceReport error:', error);
                throw error;
            }

            // Aggregate by user
            const userMap = {};
            data.forEach(sale => {
                const userId = sale.user_id;
                if (!userMap[userId]) {
                    userMap[userId] = {
                        user_id: userId,
                        user_name: sale.user?.full_name || 'Unknown',
                        role: sale.user?.role || 'Unknown',
                        email: sale.user?.email || 'Unknown',
                        sales_count: 0,
                        total_revenue: 0,
                        total_profit: 0,
                        total_discount: 0,
                        total_tax: 0,
                        average_transaction: 0
                    };
                }
                userMap[userId].sales_count++;
                userMap[userId].total_revenue += sale.total || 0;
                userMap[userId].total_profit += sale.sale_items?.reduce((sum, item) => sum + (item.profit || 0), 0) || 0;
                userMap[userId].total_discount += sale.discount || 0;
                userMap[userId].total_tax += sale.tax || 0;
            });

            // Calculate averages
            Object.values(userMap).forEach(user => {
                user.average_transaction = user.sales_count > 0 ? user.total_revenue / user.sales_count : 0;
            });

            // Sort by revenue
            const sorted = Object.values(userMap)
                .sort((a, b) => b.total_revenue - a.total_revenue);

            return sorted;
        } catch (error) {
            console.error('🔥 getEmployeePerformanceReport error:', error);
            logger.error(`Get employee performance report error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get stock value report
     */
    async getStockValueReport(branchId = null) {
        try {
            console.log('📂📂📂 getStockValueReport called 📂📂📂');

            let query = supabase
                .from('branch_inventory')
                .select(`
                    product_id,
                    current_stock,
                    cost_price,
                    selling_price,
                    product:product_id (
                        id,
                        name,
                        sku,
                        category_id
                    ),
                    branch:branch_id (
                        id,
                        name
                    )
                `);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ getStockValueReport error:', error);
                throw error;
            }

            const totalCost = data.reduce((sum, item) => sum + (item.current_stock * (item.cost_price || 0)), 0);
            const totalValue = data.reduce((sum, item) => sum + (item.current_stock * (item.selling_price || 0)), 0);
            const totalItems = data.length;
            const totalUnits = data.reduce((sum, item) => sum + (item.current_stock || 0), 0);

            // Group by category
            const categoryBreakdown = {};
            data.forEach(item => {
                const categoryName = item.product?.category_id || 'Uncategorized';
                if (!categoryBreakdown[categoryName]) {
                    categoryBreakdown[categoryName] = {
                        total_cost: 0,
                        total_value: 0,
                        total_units: 0
                    };
                }
                categoryBreakdown[categoryName].total_cost += item.current_stock * (item.cost_price || 0);
                categoryBreakdown[categoryName].total_value += item.current_stock * (item.selling_price || 0);
                categoryBreakdown[categoryName].total_units += item.current_stock || 0;
            });

            return {
                summary: {
                    total_cost: totalCost,
                    total_value: totalValue,
                    total_items: totalItems,
                    total_units: totalUnits,
                    potential_profit: totalValue - totalCost
                },
                category_breakdown: categoryBreakdown,
                items: data
            };
        } catch (error) {
            console.error('🔥 getStockValueReport error:', error);
            logger.error(`Get stock value report error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get profit & loss report
     */
    async getProfitLossReport(startDate, endDate, branchId = null) {
        try {
            console.log('📂📂📂 getProfitLossReport called 📂📂📂');

            let query = supabase
                .from('sales')
                .select(`
                    total,
                    discount,
                    tax,
                    sale_items (
                        cost_price,
                        quantity,
                        total_price,
                        profit
                    )
                `)
                .gte('sale_date', startDate.toISOString())
                .lte('sale_date', endDate.toISOString());

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ getProfitLossReport error:', error);
                throw error;
            }

            let totalRevenue = 0;
            let totalCost = 0;
            let totalProfit = 0;
            let totalDiscount = 0;
            let totalTax = 0;

            data.forEach(sale => {
                totalRevenue += sale.total || 0;
                totalDiscount += sale.discount || 0;
                totalTax += sale.tax || 0;
                
                const cost = sale.sale_items?.reduce((sum, item) => sum + (item.cost_price * item.quantity || 0), 0) || 0;
                totalCost += cost;
                totalProfit += sale.sale_items?.reduce((sum, item) => sum + (item.profit || 0), 0) || 0;
            });

            const grossProfit = totalRevenue - totalCost;
            const netProfit = totalRevenue - totalCost - totalDiscount - totalTax;

            return {
                date_range: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                },
                revenue: {
                    total_revenue: totalRevenue,
                    total_cost_of_goods: totalCost,
                    gross_profit: grossProfit,
                    gross_margin_percentage: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
                },
                deductions: {
                    total_discount: totalDiscount,
                    total_tax: totalTax,
                    total_deductions: totalDiscount + totalTax
                },
                profit: {
                    net_profit: netProfit,
                    net_margin_percentage: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
                }
            };
        } catch (error) {
            console.error('🔥 getProfitLossReport error:', error);
            logger.error(`Get profit & loss report error: ${error.message}`);
            throw error;
        }
    }
        /**
     * Get stock movement report — fast-moving → slow-moving products
     */
    async getStockMovementReport(startDate, endDate, limit = 100, branchId = null) {
        try {
            console.log('📂📂📂 getStockMovementReport called 📂📂📂');
            console.log(`📂 Start: ${startDate}, End: ${endDate}, Limit: ${limit}`);

            // Fetch sale_items joined with sales for date filtering
            let query = supabase
                .from('sale_items')
                .select(`
                    product_id,
                    product_name,
                    quantity,
                    total_price,
                    profit,
                    cost_price,
                    sale:sale_id (
                        sale_date,
                        branch_id
                    )
                `);

            if (startDate) query = query.gte('sale.sale_date', startDate.toISOString());
            if (endDate)   query = query.lte('sale.sale_date', endDate.toISOString());
            if (branchId)  query = query.eq('sale.branch_id', branchId);

            const { data, error } = await query;
            if (error) throw error;

            // Aggregate by product
            const map = {};
            for (const item of data) {
                const key = item.product_id || 'unknown';
                if (!map[key]) {
                    map[key] = {
                        product_id: key,
                        product_name: item.product_name || 'Unknown',
                        sku: null,
                        total_quantity_sold: 0,
                        total_revenue: 0,
                        total_profit: 0,
                        transaction_count: 0
                    };
                }
                map[key].total_quantity_sold += item.quantity || 0;
                map[key].total_revenue        += item.total_price || 0;
                map[key].total_profit         += item.profit || 0;
                map[key].transaction_count    += 1;
            }

            // Enrich with product SKU + current stock
            const productIds = Object.keys(map).filter(id => id !== 'unknown');
            let productInfo = {};
            if (productIds.length > 0) {
                const { data: prods, error: pErr } = await supabase
                    .from('products')
                    .select('id, sku, name')
                    .in('id', productIds);
                if (!pErr && prods) {
                    prods.forEach(p => { productInfo[p.id] = p; });
                }

                const { data: inv, error: iErr } = await supabase
                    .from('branch_inventory')
                    .select('product_id, current_stock')
                    .in('product_id', productIds);
                if (!iErr && inv) {
                    const stockMap = {};
                    inv.forEach(r => {
                        stockMap[r.product_id] = (stockMap[r.product_id] || 0) + (r.current_stock || 0);
                    });
                    productIds.forEach(id => {
                        if (!map[id]) return;
                        map[id].current_stock = stockMap[id] || 0;
                    });
                }
            }

            // Compute velocity
            const days = Math.max(
                1,
                Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            );

            const rows = Object.values(map).map(r => {
                const sku = productInfo[r.product_id]?.sku || null;
                const avgDaily = r.total_quantity_sold / days;
                const stock = r.current_stock ?? 0;
                const daysLeft = avgDaily > 0 ? Math.round(stock / avgDaily) : null;

                return {
                    ...r,
                    sku,
                    current_stock: stock,
                    avg_daily_units: Number(avgDaily.toFixed(2)),
                    days_of_stock_left: daysLeft
                };
            });

            // Sort: fast-moving first
            rows.sort((a, b) => b.total_quantity_sold - a.total_quantity_sold);
            const limited = rows.slice(0, limit);

            // Summary
            const summary = {
                total_products_moved: rows.length,
                total_units_sold: rows.reduce((s, r) => s + r.total_quantity_sold, 0),
                total_revenue: rows.reduce((s, r) => s + r.total_revenue, 0),
                total_profit: rows.reduce((s, r) => s + r.total_profit, 0),
                days_in_range: days,
                date_range: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                }
            };

            return {
                report_type: 'stock-movement',
                summary,
                data: limited
            };
        } catch (error) {
            console.error('🔥 getStockMovementReport error:', error);
            logger.error(`Get stock movement report error: ${error.message}`);
            throw error;
        }
    }
        /**
     * Get product category report — revenue/profit per category
     */
    async getCategoryReport(startDate, endDate, branchId = null) {
        try {
            console.log('📂📂📂 getCategoryReport called 📂📂📂');

            // Fetch all categories
            const { data: categories, error: catErr } = await supabase
                .from('product_categories')
                .select('id, name, parent_category_id');
            if (catErr) throw catErr;

            // Fetch products with their categories
            const { data: products, error: prodErr } = await supabase
                .from('products')
                .select('id, name, category_id, cost_price, selling_price, quantity');
            if (prodErr) throw prodErr;

            const productMap = {};
            (products || []).forEach(p => { productMap[p.id] = p; });

            // Fetch sale_items within the range
            let query = supabase
                .from('sale_items')
                .select(`
                    product_id,
                    product_name,
                    quantity,
                    total_price,
                    profit,
                    sale:sale_id (
                        sale_date,
                        branch_id
                    )
                `);

            if (startDate) query = query.gte('sale.sale_date', startDate.toISOString());
            if (endDate)   query = query.lte('sale.sale_date', endDate.toISOString());
            if (branchId)  query = query.eq('sale.branch_id', branchId);

            const { data: items, error: itemsErr } = await query;
            if (itemsErr) throw itemsErr;

            // Aggregate per category
            const map = {};
            for (const it of items || []) {
                const prod = productMap[it.product_id];
                const catId = prod?.category_id || '__uncategorized__';
                if (!map[catId]) {
                    map[catId] = {
                        category_id: catId,
                        total_quantity_sold: 0,
                        total_revenue: 0,
                        total_profit: 0,
                        transaction_count: 0,
                        product_ids: new Set()
                    };
                }
                map[catId].total_quantity_sold += it.quantity || 0;
                map[catId].total_revenue       += it.total_price || 0;
                map[catId].total_profit        += it.profit || 0;
                map[catId].transaction_count   += 1;
                map[catId].product_ids.add(it.product_id);
            }

            // Attach category names + product counts
            const catMap = {};
            (categories || []).forEach(c => { catMap[c.id] = c; });

            const rows = Object.values(map).map(r => {
                const c = catMap[r.category_id];
                const productsInCat = (products || []).filter(p => p.category_id === r.category_id).length;
                return {
                    category_id: r.category_id,
                    category_name: c?.name || 'Uncategorized',
                    products_count: productsInCat,
                    unique_products_sold: r.product_ids.size,
                    total_quantity_sold: r.total_quantity_sold,
                    total_revenue: r.total_revenue,
                    total_profit: r.total_profit,
                    transaction_count: r.transaction_count
                };
            });

            // Also include categories with zero sales
            (categories || []).forEach(c => {
                if (!rows.find(r => r.category_id === c.id)) {
                    const productsInCat = (products || []).filter(p => p.category_id === c.id).length;
                    rows.push({
                        category_id: c.id,
                        category_name: c.name,
                        products_count: productsInCat,
                        unique_products_sold: 0,
                        total_quantity_sold: 0,
                        total_revenue: 0,
                        total_profit: 0,
                        transaction_count: 0
                    });
                }
            });

            rows.sort((a, b) => b.total_revenue - a.total_revenue);

            const summary = {
                total_categories: rows.length,
                total_units_sold: rows.reduce((s, r) => s + r.total_quantity_sold, 0),
                total_revenue: rows.reduce((s, r) => s + r.total_revenue, 0),
                total_profit: rows.reduce((s, r) => s + r.total_profit, 0),
                date_range: {
                    start_date: startDate?.toISOString().split('T')[0] || null,
                    end_date: endDate?.toISOString().split('T')[0] || null
                }
            };

            return {
                report_type: 'category-report',
                summary,
                data: rows
            };
        } catch (error) {
            console.error('🔥 getCategoryReport error:', error);
            logger.error(`Get category report error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get stock movement report — INCLUDES all products (zero-movement too)
     * v2: joins full products list so "Slow" filter works properly
     */
    async getStockMovementReportV2(startDate, endDate, limit = 500, branchId = null) {
        try {
            console.log('📂📂📂 getStockMovementReportV2 called 📂📂📂');

            // Fetch all products with inventory
            const { data: products, error: prodErr } = await supabase
                .from('products')
                .select(`
                    id, name, sku, is_active,
                    categories:category_id ( name ),
                    inventory:branch_inventory ( current_stock, branch_id )
                `)
                .eq('is_active', true);
            if (prodErr) throw prodErr;

            // Fetch sale_items in range
            let query = supabase
                .from('sale_items')
                .select(`
                    product_id, quantity, total_price, profit,
                    sale:sale_id ( sale_date, branch_id )
                `);
            if (startDate) query = query.gte('sale.sale_date', startDate.toISOString());
            if (endDate)   query = query.lte('sale.sale_date', endDate.toISOString());
            if (branchId)  query = query.eq('sale.branch_id', branchId);
            const { data: items, error: itemsErr } = await query;
            if (itemsErr) throw itemsErr;

            // Aggregate sales by product
            const salesMap = {};
            for (const it of items || []) {
                const k = it.product_id;
                if (!salesMap[k]) salesMap[k] = { qty: 0, revenue: 0, profit: 0, tx: 0 };
                salesMap[k].qty     += it.quantity || 0;
                salesMap[k].revenue += it.total_price || 0;
                salesMap[k].profit  += it.profit || 0;
                salesMap[k].tx      += 1;
            }

            const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));

            // Build rows for EVERY product
            const rows = (products || []).map(p => {
                const sales = salesMap[p.id] || { qty: 0, revenue: 0, profit: 0, tx: 0 };
                const stock = (p.inventory || []).reduce((s, i) => s + (i.current_stock || 0), 0);
                const avgDaily = sales.qty / days;
                const daysLeft = avgDaily > 0 ? Math.round(stock / avgDaily) : null;
                return {
                    product_id: p.id,
                    product_name: p.name,
                    sku: p.sku || null,
                    category_name: p.categories?.name || 'Uncategorized',
                    total_quantity_sold: sales.qty,
                    total_revenue: sales.revenue,
                    total_profit: sales.profit,
                    transaction_count: sales.tx,
                    current_stock: stock,
                    avg_daily_units: Number(avgDaily.toFixed(2)),
                    days_of_stock_left: daysLeft
                };
            });

            // Sort fast → slow
            rows.sort((a, b) => {
                if (b.total_quantity_sold !== a.total_quantity_sold) {
                    return b.total_quantity_sold - a.total_quantity_sold;
                }
                return a.product_name.localeCompare(b.product_name);
            });

            const limited = rows.slice(0, limit);

            const summary = {
                total_products: rows.length,
                total_products_moved: rows.filter(r => r.total_quantity_sold > 0).length,
                total_products_stalled: rows.filter(r => r.total_quantity_sold === 0).length,
                total_units_sold: rows.reduce((s, r) => s + r.total_quantity_sold, 0),
                total_revenue: rows.reduce((s, r) => s + r.total_revenue, 0),
                total_profit: rows.reduce((s, r) => s + r.total_profit, 0),
                days_in_range: days,
                date_range: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                }
            };

            return { report_type: 'stock-movement', summary, data: limited };
        } catch (error) {
            console.error('🔥 getStockMovementReportV2 error:', error);
            logger.error(`Get stock movement report v2 error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get payment breakdown report — now supports filtering by payment_method
     */
    async getPaymentBreakdownReportFiltered(startDate, endDate, paymentMethod = null, branchId = null) {
        try {
            console.log('📂📂📂 getPaymentBreakdownReportFiltered called 📂📂📂');

            let query = supabase
                .from('sales')
                .select('payment_method, total, discount, tax')
                .gte('sale_date', startDate.toISOString())
                .lte('sale_date', endDate.toISOString());

            if (paymentMethod && paymentMethod !== 'All') {
                query = query.eq('payment_method', paymentMethod);
            }
            if (branchId) query = query.eq('branch_id', branchId);

            const { data, error } = await query;
            if (error) throw error;

            const breakdown = {};
            data.forEach(sale => {
                const method = sale.payment_method || 'Unknown';
                if (!breakdown[method]) breakdown[method] = { count: 0, total: 0, discount: 0, tax: 0 };
                breakdown[method].count++;
                breakdown[method].total    += sale.total || 0;
                breakdown[method].discount += sale.discount || 0;
                breakdown[method].tax      += sale.tax || 0;
            });

            const totalRevenue = data.reduce((sum, sale) => sum + (sale.total || 0), 0);
            const totalCount = data.length;

            return {
                breakdown,
                total_revenue: totalRevenue,
                total_transactions: totalCount,
                payment_method_filter: paymentMethod || 'All',
                date_range: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                }
            };
        } catch (error) {
            console.error('🔥 getPaymentBreakdownReportFiltered error:', error);
            logger.error(`Get payment breakdown (filtered) error: ${error.message}`);
            throw error;
        }
    }
        /**
     * Get comprehensive analytics summary for a period
     * (all-in-one for the Analytics dashboard)
     */
    async getAnalyticsSummary(days = 30, branchId = null) {
        try {
            console.log('📂📂📂 getAnalyticsSummary called 📂📂📂');
            console.log(`📂 days: ${days}, branchId: ${branchId || 'all'}`);

            // ─── Date ranges ───
            const endDate = new Date();
            endDate.setHours(23, 59, 59, 999);

            const startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            startDate.setDate(startDate.getDate() - (days - 1));

            const prevEndDate = new Date(startDate);
            prevEndDate.setMilliseconds(-1);

            const prevStartDate = new Date(prevEndDate);
            prevStartDate.setHours(0, 0, 0, 0);
            prevStartDate.setDate(prevStartDate.getDate() - (days - 1));

            console.log(`📂 Current: ${startDate.toISOString()} → ${endDate.toISOString()}`);
            console.log(`📂 Previous: ${prevStartDate.toISOString()} → ${prevEndDate.toISOString()}`);

            // ─── Fetch sales for both periods ───
            const fetchSales = async (from, to) => {
                let q = supabase
                    .from('sales')
                    .select(`
                        id,
                        receipt_number,
                        sale_date,
                        total,
                        subtotal,
                        discount,
                        tax,
                        payment_method,
                        customer_name,
                        user_id,
                        user:user_id ( id, full_name, role ),
                        sale_items (
                            product_id,
                            product_name,
                            quantity,
                            unit_price,
                            total_price,
                            cost_price,
                            profit
                        )
                    `)
                    .gte('sale_date', from.toISOString())
                    .lte('sale_date', to.toISOString())
                    .order('sale_date', { ascending: true });

                if (branchId) q = q.eq('branch_id', branchId);

                const { data, error } = await q;
                if (error) throw error;
                return data || [];
            };

            const [currentSales, prevSales] = await Promise.all([
                fetchSales(startDate, endDate),
                fetchSales(prevStartDate, prevEndDate)
            ]);

            console.log(`📂 Current period sales: ${currentSales.length}`);
            console.log(`📂 Previous period sales: ${prevSales.length}`);

            // ─── Current period summary ───
            const totalRevenue = currentSales.reduce((s, x) => s + (x.total || 0), 0);
            const totalTransactions = currentSales.length;
            const avgTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

            const prevRevenue = prevSales.reduce((s, x) => s + (x.total || 0), 0);
            const prevTransactions = prevSales.length;
            const prevAvgTicket = prevTransactions > 0 ? prevRevenue / prevTransactions : 0;

            const pctChange = (curr, prev) => {
                if (prev === 0) return curr > 0 ? 100 : 0;
                return ((curr - prev) / prev) * 100;
            };

            const summary = {
                total_revenue: totalRevenue,
                total_transactions: totalTransactions,
                avg_ticket: avgTicket,
                previous_period: {
                    total_revenue: prevRevenue,
                    total_transactions: prevTransactions,
                    avg_ticket: prevAvgTicket
                },
                change_pct: {
                    revenue: Number(pctChange(totalRevenue, prevRevenue).toFixed(1)),
                    transactions: Number(pctChange(totalTransactions, prevTransactions).toFixed(1)),
                    avg_ticket: Number(pctChange(avgTicket, prevAvgTicket).toFixed(1))
                }
            };

            // ─── Daily trend (fill gaps with 0) ───
            const dailyMap = {};
            for (let i = 0; i < days; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const key = d.toISOString().split('T')[0];
                dailyMap[key] = { date: key, revenue: 0, transactions: 0 };
            }
            currentSales.forEach(s => {
                const key = new Date(s.sale_date).toISOString().split('T')[0];
                if (dailyMap[key]) {
                    dailyMap[key].revenue += s.total || 0;
                    dailyMap[key].transactions += 1;
                }
            });
            const daily_trend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

            // ─── Hourly distribution (0-23) ───
            const hourlyMap = {};
            for (let h = 0; h < 24; h++) hourlyMap[h] = { hour: h, revenue: 0, transactions: 0 };
            currentSales.forEach(s => {
                const h = new Date(s.sale_date).getHours();
                hourlyMap[h].revenue += s.total || 0;
                hourlyMap[h].transactions += 1;
            });
            const hourly_distribution = Object.values(hourlyMap);

            // ─── Day-of-week distribution ───
            const days7 = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dowMap = {};
            days7.forEach((name, idx) => dowMap[idx] = { day: name, revenue: 0, transactions: 0 });
            currentSales.forEach(s => {
                const idx = new Date(s.sale_date).getDay();
                dowMap[idx].revenue += s.total || 0;
                dowMap[idx].transactions += 1;
            });
            const day_of_week = Object.values(dowMap);

            // ─── Top products (by revenue) ───
            const productMap = {};
            currentSales.forEach(s => {
                (s.sale_items || []).forEach(it => {
                    const key = it.product_id || it.product_name || 'unknown';
                    if (!productMap[key]) {
                        productMap[key] = {
                            product_id: it.product_id,
                            product_name: it.product_name || 'Unknown',
                            qty: 0,
                            revenue: 0,
                            profit: 0,
                            transactions: 0
                        };
                    }
                    productMap[key].qty += it.quantity || 0;
                    productMap[key].revenue += it.total_price || 0;
                    productMap[key].profit += it.profit || 0;
                    productMap[key].transactions += 1;
                });
            });
            const top_products = Object.values(productMap)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);

            // ─── Category breakdown ───
            // Enrich product revenue with category (needs product lookup)
            const productIds = [...new Set(
                currentSales.flatMap(s => (s.sale_items || []).map(it => it.product_id)).filter(Boolean)
            )];

            let productCategoryMap = {};
            if (productIds.length > 0) {
                const { data: prods, error: pErr } = await supabase
                    .from('products')
                    .select(`
                        id,
                        category_id,
                        categories:category_id ( name )
                    `)
                    .in('id', productIds);

                if (!pErr && prods) {
                    prods.forEach(p => {
                        productCategoryMap[p.id] = {
                            category_id: p.category_id,
                            category_name: p.categories?.name || 'Uncategorized'
                        };
                    });
                }
            }

            const categoryMap = {};
            currentSales.forEach(s => {
                (s.sale_items || []).forEach(it => {
                    const cat = productCategoryMap[it.product_id] || { category_name: 'Uncategorized' };
                    const key = cat.category_name;
                    if (!categoryMap[key]) {
                        categoryMap[key] = {
                            category_name: key,
                            revenue: 0,
                            qty: 0,
                            transactions: 0
                        };
                    }
                    categoryMap[key].revenue += it.total_price || 0;
                    categoryMap[key].qty += it.quantity || 0;
                    categoryMap[key].transactions += 1;
                });
            });
            const category_breakdown = Object.values(categoryMap)
                .sort((a, b) => b.revenue - a.revenue);

            // ─── Payment breakdown ───
            const payMap = {};
            currentSales.forEach(s => {
                const m = s.payment_method || 'Unknown';
                if (!payMap[m]) payMap[m] = { method: m, revenue: 0, count: 0 };
                payMap[m].revenue += s.total || 0;
                payMap[m].count += 1;
            });
            const payment_breakdown = Object.values(payMap).sort((a, b) => b.revenue - a.revenue);

            // ─── Employee performance ───
            const empMap = {};
            currentSales.forEach(s => {
                const uid = s.user_id || '__unknown__';
                if (!empMap[uid]) {
                    empMap[uid] = {
                        user_id: uid,
                        user_name: s.user?.full_name || 'Unknown',
                        role: s.user?.role || 'employee',
                        revenue: 0,
                        count: 0
                    };
                }
                empMap[uid].revenue += s.total || 0;
                empMap[uid].count += 1;
            });
            const employee_performance = Object.values(empMap).sort((a, b) => b.revenue - a.revenue);

            return {
                period: {
                    days,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                },
                summary,
                daily_trend,
                hourly_distribution,
                day_of_week,
                top_products,
                category_breakdown,
                payment_breakdown,
                employee_performance
            };
        } catch (error) {
            console.error('🔥 getAnalyticsSummary error:', error);
            logger.error(`Get analytics summary error: ${error.message}`);
            throw error;
        }
    }
}

export default new ReportService();