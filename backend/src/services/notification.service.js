import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';
import emailService from './email.service.js';

class NotificationService {
    /**
     * Check low stock and send alerts (server-side full check)
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

            const result = await this.sendLowStockAlert({
                out_of_stock: outOfStock.map(p => ({
                    id: p.product_id || p.id,
                    name: p.product_name || p.name,
                    sku: p.sku || null,
                    stock: p.current_stock,
                    min_level: p.min_stock_level || threshold
                })),
                low_stock: lowStock.map(p => ({
                    id: p.product_id || p.id,
                    name: p.product_name || p.name,
                    sku: p.sku || null,
                    stock: p.current_stock,
                    min_level: p.min_stock_level || threshold
                })),
                triggered_by: { full_name: 'System', role: 'system' }
            });

            return {
                out_of_stock: outOfStock,
                low_stock: lowStock,
                email_sent: result.sent === true
            };
        } catch (error) {
            console.error('🔥 checkLowStockAndNotify error:', error);
            logger.error(`Check low stock error: ${error.message}`);
            return { error: error.message };
        }
    }

    /**
     * Send low-stock alert email to owner.
     * Accepts the out/low lists directly (used by both the manual route
     * and the frontend payload version).
     */
    async sendLowStockAlert({ branch_id = null, out_of_stock = [], low_stock = [], triggered_by = null }) {
        try {
            if (!out_of_stock.length && !low_stock.length) {
                return { sent: false, reason: 'nothing_to_report' };
            }

            // Find active owners (fall back to .single() owner if the multi-row query returns none)
            let owners = [];
            const { data: ownersData, error: ownersErr } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('role', 'owner')
                .eq('is_active', true);

            if (!ownersErr && ownersData && ownersData.length > 0) {
                owners = ownersData;
            } else {
                // Fallback: some schemas don't have is_active on users
                const { data: fallbackOwner, error: fallbackErr } = await supabase
                    .from('users')
                    .select('email, full_name')
                    .eq('role', 'owner')
                    .single();

                if (fallbackErr || !fallbackOwner) {
                    logger.warn('No owner found for low-stock alert');
                    return { sent: false, reason: 'no_owner' };
                }
                owners = [fallbackOwner];
            }

            const tableHeader = `
                <tr style="background:#f5f5f5;">
                    <th style="text-align:left;padding:8px;">Product</th>
                    <th style="text-align:left;padding:8px;">SKU</th>
                    <th style="text-align:right;padding:8px;">Stock</th>
                    <th style="text-align:right;padding:8px;">Min Level</th>
                </tr>
            `;

            const rowsOut = out_of_stock.map(p => `
                <tr>
                    <td style="padding:8px;">${p.name}</td>
                    <td style="padding:8px;"><code>${p.sku || '—'}</code></td>
                    <td style="text-align:right;padding:8px;color:#e74c3c;font-weight:bold;">${p.stock}</td>
                    <td style="text-align:right;padding:8px;">${p.min_level || 5}</td>
                </tr>
            `).join('');

            const rowsLow = low_stock.map(p => `
                <tr>
                    <td style="padding:8px;">${p.name}</td>
                    <td style="padding:8px;"><code>${p.sku || '—'}</code></td>
                    <td style="text-align:right;padding:8px;color:#f39c12;font-weight:bold;">${p.stock}</td>
                    <td style="text-align:right;padding:8px;">${p.min_level || 5}</td>
                </tr>
            `).join('');

            const html = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
                    <h2 style="color:#2e7d32;">⚠️ Stock Alert — FarmersChoice Agrovet</h2>
                    <p style="color:#666;">
                        Triggered by: <strong>${triggered_by?.full_name || 'System'}</strong>
                        (${triggered_by?.role || '—'})<br>
                        Time: ${new Date().toLocaleString('en-KE')}
                    </p>

                    ${out_of_stock.length ? `
                        <h3 style="color:#e74c3c;">Out of Stock (${out_of_stock.length})</h3>
                        <table border="1" cellpadding="0" cellspacing="0"
                               style="border-collapse:collapse;width:100%;font-size:14px;">
                            <thead>${tableHeader}</thead>
                            <tbody>${rowsOut}</tbody>
                        </table>
                    ` : ''}

                    ${low_stock.length ? `
                        <h3 style="color:#f39c12;">Low Stock (${low_stock.length})</h3>
                        <table border="1" cellpadding="0" cellspacing="0"
                               style="border-collapse:collapse;width:100%;font-size:14px;">
                            <thead>${tableHeader}</thead>
                            <tbody>${rowsLow}</tbody>
                        </table>
                    ` : ''}

                    <p style="margin-top:20px;color:#666;font-size:12px;">
                        Log in to the Stock page to restock items.
                    </p>
                </div>
            `;

            const subject = `⚠️ Stock Alert — ${out_of_stock.length} out · ${low_stock.length} low`;

            let sentCount = 0;
            for (const owner of owners) {
                try {
                    // The email service you already have exposes sendLowStockAlert(data, recipientEmail)
                    // We'll adapt the payload shape and call it.
                    const flatList = [
                        ...out_of_stock.map(p => ({ ...p, current_stock: p.stock })),
                        ...low_stock.map(p => ({ ...p, current_stock: p.stock }))
                    ];

                    const result = await emailService.sendLowStockAlert(flatList, owner.email);

                    if (result && result.success !== false) {
                        sentCount++;
                    } else {
                        logger.warn(`Low-stock email reported failure for ${owner.email}: ${result?.error || 'unknown'}`);
                    }
                } catch (e) {
                    logger.warn(`Could not email owner ${owner.email}: ${e.message}`);
                }
            }

            if (sentCount === 0) {
                return { sent: false, reason: 'all_sends_failed' };
            }

            logger.info(`📧 Low-stock alert sent to ${sentCount} owner(s)`);
            return { sent: true, recipients: sentCount };
        } catch (error) {
            logger.error(`sendLowStockAlert error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send restock notification email to owner(s).
     * Called after a successful restock.
     */
    async sendRestockNotification({
        product_id,
        product_name,
        sku = null,
        quantity_added,
        new_stock = 0,
        branch_id = null,
        performed_by = null
    }) {
        try {
            // Find active owners (with fallback)
            let owners = [];
            const { data: ownersData, error: ownersErr } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('role', 'owner')
                .eq('is_active', true);

            if (!ownersErr && ownersData && ownersData.length > 0) {
                owners = ownersData;
            } else {
                const { data: fallbackOwner, error: fallbackErr } = await supabase
                    .from('users')
                    .select('email, full_name')
                    .eq('role', 'owner')
                    .single();

                if (fallbackErr || !fallbackOwner) {
                    logger.warn('No owner found for restock notification');
                    return { sent: false, reason: 'no_owner' };
                }
                owners = [fallbackOwner];
            }

            const html = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
                    <h2 style="color:#2e7d32;">📦 Restock Notification</h2>
                    <p><strong>Product:</strong> ${product_name}</p>
                    ${sku ? `<p><strong>SKU:</strong> <code>${sku}</code></p>` : ''}
                    <p><strong>Quantity Added:</strong>
                        <span style="color:#2e7d32;font-weight:bold;">+${quantity_added}</span>
                    </p>
                    <p><strong>New Stock Level:</strong> ${new_stock}</p>
                    <p><strong>Performed by:</strong>
                        ${performed_by?.full_name || 'Unknown'}
                        (${performed_by?.role || '—'})
                    </p>
                    <p style="color:#666;font-size:12px;">
                        ${new Date().toLocaleString('en-KE')}
                    </p>
                </div>
            `;

            const subject = `📦 Restocked: ${product_name} (+${quantity_added})`;

            let sentCount = 0;
            for (const owner of owners) {
                try {
                    // Use whichever send method your email service exposes.
                    // Your existing email.service.js has specific helpers — if you
                    // have a generic send, use that. Otherwise add a simple
                    // sendRestockNotification helper to email.service.js, or use
                    // one of these fallbacks:
                    let result;
                    if (typeof emailService.sendEmail === 'function') {
                        result = await emailService.sendEmail({ to: owner.email, subject, html });
                    } else if (typeof emailService.sendMail === 'function') {
                        result = await emailService.sendMail({ to: owner.email, subject, html });
                    } else if (typeof emailService.sendRestockNotification === 'function') {
                        result = await emailService.sendRestockNotification(
                            { product_name, sku, quantity_added, new_stock, performed_by },
                            owner.email
                        );
                    } else if (typeof emailService.send === 'function') {
                        result = await emailService.send({ to: owner.email, subject, html });
                    } else {
                        throw new Error('No known send method on emailService');
                    }

                    if (result && result.success !== false) sentCount++;
                    else logger.warn(`Restock email reported failure for ${owner.email}: ${result?.error || 'unknown'}`);
                } catch (e) {
                    logger.warn(`Could not email owner ${owner.email}: ${e.message}`);
                }
            }

            if (sentCount === 0) {
                return { sent: false, reason: 'all_sends_failed' };
            }

            logger.info(`📧 Restock notification sent to ${sentCount} owner(s)`);
            return { sent: true, recipients: sentCount };
        } catch (error) {
            logger.error(`sendRestockNotification error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send purchase notification
     */
    async sendPurchaseNotification(saleId) {
        try {
            console.log(`📧 Sending purchase notification for sale: ${saleId}`);

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

            const { data: owner, error: ownerError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('role', 'owner')
                .single();

            if (ownerError || !owner) {
                console.error('❌ Owner not found:', ownerError);
                return;
            }

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

            sales.forEach(sale => {
                const method = sale.payment_method || 'Unknown';
                summary.payment_breakdown[method] = (summary.payment_breakdown[method] || 0) + sale.total;
            });

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

            const { data: owner, error: ownerError } = await supabase
                .from('users')
                .select('email, full_name')
                .eq('role', 'owner')
                .single();

            if (ownerError || !owner) {
                console.error('❌ Owner not found:', ownerError);
                return;
            }

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