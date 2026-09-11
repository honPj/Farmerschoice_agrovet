import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';
import emailService from './email.service.js';

class NotificationService {
    /**
     * Check low stock and send alerts
     */
    async checkLowStockAndNotify() {
        try {
            console.log('🔍 Checking low stock...');

            const threshold = 5;
            const { data, error } = await supabase
                .from('inventory_with_details')
                .select('*')
                .lte('current_stock', threshold);

            if (error) {
                console.error('❌ Low stock check error:', error);
                return;
            }

            const outOfStock = data.filter(p => p.current_stock === 0);
            const lowStock = data.filter(p => p.current_stock > 0 && p.current_stock <= threshold);

            if (outOfStock.length === 0 && lowStock.length === 0) {
                console.log('✅ All products in stock');
                return { success: true, message: 'All products in stock' };
            }

            console.log(`📊 Found ${outOfStock.length} out of stock, ${lowStock.length} low stock items`);

            // Get owner email
            const { data: owner, error: ownerError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('role', 'owner')
                .single();

            if (ownerError || !owner) {
                console.error('❌ Owner not found:', ownerError);
                return;
            }

            // Send email
            const result = await emailService.sendLowStockAlert(data, owner.email);

            if (result.success) {
                console.log('📧 Low stock alert sent to owner');
            } else {
                console.error('❌ Failed to send low stock alert:', result.error);
            }

            return {
                out_of_stock: outOfStock,
                low_stock: lowStock,
                email_sent: result.success
            };
        } catch (error) {
            console.error('🔥 checkLowStockAndNotify error:', error);
            logger.error(`Check low stock error: ${error.message}`);
            return { error: error.message };
        }
    }

    /**
     * Send purchase notification
     */
    async sendPurchaseNotification(saleId) {
        try {
            console.log(`📧 Sending purchase notification for sale: ${saleId}`);

            // Get sale details
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .select(`
                    *,
                    branch:branch_id (
                        id,
                        name,
                        location
                    ),
                    user:user_id (
                        id,
                        full_name
                    ),
                    sale_items (
                        id,
                        product_name,
                        quantity,
                        unit_price,
                        total_price,
                        cost_price,
                        profit
                    )
                `)
                .eq('id', saleId)
                .single();

            if (saleError || !sale) {
                console.error('❌ Sale not found:', saleError);
                return;
            }

            // Get owner email
            const { data: owner, error: ownerError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('role', 'owner')
                .single();

            if (ownerError || !owner) {
                console.error('❌ Owner not found:', ownerError);
                return;
            }

            // Send email
            const result = await emailService.sendPurchaseNotification(
                sale,
                sale.sale_items || [],
                owner.email
            );

            if (result.success) {
                console.log(`📧 Purchase notification sent for ${sale.receipt_number}`);
            } else {
                console.error('❌ Failed to send purchase notification:', result.error);
            }

            return result;
        } catch (error) {
            console.error('🔥 sendPurchaseNotification error:', error);
            logger.error(`Send purchase notification error: ${error.message}`);
            return { error: error.message };
        }
    }

    /**
     * Send daily summary
     */
    async sendDailySummary() {
        try {
            console.log('📊 Generating daily summary...');

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Get sales for today
            const { data: sales, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    sale_items (
                        profit
                    )
                `)
                .gte('sale_date', today.toISOString())
                .lt('sale_date', tomorrow.toISOString());

            if (error) {
                console.error('❌ Daily summary error:', error);
                return;
            }

            // Calculate summary
            const summary = {
                total_sales: sales.length,
                total_revenue: sales.reduce((sum, s) => sum + (s.total || 0), 0),
                total_discount: sales.reduce((sum, s) => sum + (s.discount || 0), 0),
                total_tax: sales.reduce((sum, s) => sum + (s.tax || 0), 0),
                average_transaction: sales.length > 0 ? sales.reduce((sum, s) => sum + (s.total || 0), 0) / sales.length : 0,
                payment_breakdown: {},
                top_products: [],
                employee_performance: []
            };

            // Payment breakdown
            sales.forEach(sale => {
                const method = sale.payment_method || 'Unknown';
                summary.payment_breakdown[method] = (summary.payment_breakdown[method] || 0) + sale.total;
            });

            // Get top products
            const { data: topProducts, error: topError } = await supabase
                .from('sale_items')
                .select(`
                    product_name,
                    quantity,
                    total_price
                `)
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString())
                .order('total_price', { ascending: false })
                .limit(5);

            if (!topError) {
                summary.top_products = topProducts.reduce((acc, item) => {
                    const existing = acc.find(p => p.product_name === item.product_name);
                    if (existing) {
                        existing.total_quantity += item.quantity;
                        existing.total_revenue += item.total_price;
                    } else {
                        acc.push({
                            product_name: item.product_name,
                            total_quantity: item.quantity,
                            total_revenue: item.total_price
                        });
                    }
                    return acc;
                }, []);
            }

            // Employee performance
            const { data: employees, error: empError } = await supabase
                .from('sales')
                .select(`
                    user_id,
                    user:user_id (
                        full_name
                    ),
                    total
                `)
                .gte('sale_date', today.toISOString())
                .lt('sale_date', tomorrow.toISOString());

            if (!empError) {
                const empMap = {};
                employees.forEach(sale => {
                    const id = sale.user_id;
                    if (!empMap[id]) {
                        empMap[id] = {
                            user_name: sale.user?.full_name || 'Unknown',
                            sales_count: 0,
                            total_revenue: 0
                        };
                    }
                    empMap[id].sales_count++;
                    empMap[id].total_revenue += sale.total || 0;
                });
                summary.employee_performance = Object.values(empMap);
            }

            // Get owner email
            const { data: owner, error: ownerError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('role', 'owner')
                .single();

            if (ownerError || !owner) {
                console.error('❌ Owner not found:', ownerError);
                return;
            }

            // Send email
            const result = await emailService.sendDailySummary(summary, owner.email);

            if (result.success) {
                console.log('📧 Daily summary sent');
            } else {
                console.error('❌ Failed to send daily summary:', result.error);
            }

            return result;
        } catch (error) {
            console.error('🔥 sendDailySummary error:', error);
            logger.error(`Send daily summary error: ${error.message}`);
            return { error: error.message };
        }
    }
}

export default new NotificationService();