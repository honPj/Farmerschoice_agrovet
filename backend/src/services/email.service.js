import { transporter } from '../config/email.js';
import logger from '../utils/logger.js';

class EmailService {
    /**
     * Send email
     */
    async sendEmail(to, subject, text, html = null) {
        try {
            const mailOptions = {
                from: process.env.SMTP_FROM || `"FarmersChoice Agrovet" <${process.env.SMTP_USER}>`,
                to: to,
                subject: subject,
                text: text,
                html: html || text.replace(/\n/g, '<br>')
            };

            const info = await transporter.sendMail(mailOptions);
            logger.info(`📧 Email sent to ${to}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error(`❌ Email error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send Low Stock Alert
     */
    async sendLowStockAlert(products, recipient) {
        const outOfStock = products.filter(p => p.current_stock === 0);
        const lowStock = products.filter(p => p.current_stock > 0 && p.current_stock <= 5);

        if (outOfStock.length === 0 && lowStock.length === 0) {
            return { success: false, message: 'No low stock items' };
        }

        const now = new Date().toLocaleString('en-KE', {
            timeZone: 'Africa/Nairobi',
            dateStyle: 'full',
            timeStyle: 'medium'
        });

        let text = `
🏪 FARMERSCHOICE AGROVET - STOCK ALERT
═══════════════════════════════════════════
📅 ${now}
═══════════════════════════════════════════

`;

        if (outOfStock.length > 0) {
            text += `🚫 OUT OF STOCK (${outOfStock.length} items)
───────────────────────────────────────────
`;
            outOfStock.forEach((p, i) => {
                text += `
  ${i + 1}. ❌ ${p.product_name}
     ─────────────────
     SKU:        ${p.sku || 'N/A'}
     Remaining:  0 units
     Buy Price:  KSh ${Number(p.cost_price || 0).toLocaleString()}
     Sell Price: KSh ${Number(p.selling_price || 0).toLocaleString()}
     Profit:     KSh ${Number((p.selling_price || 0) - (p.cost_price || 0)).toLocaleString()}
`;
            });
            text += `\n`;
        }

        if (lowStock.length > 0) {
            text += `⚠️ LOW STOCK (${lowStock.length} items)
───────────────────────────────────────────
`;
            lowStock.forEach((p, i) => {
                text += `
  ${i + 1}. ⚠️ ${p.product_name}
     ─────────────────
     SKU:        ${p.sku || 'N/A'}
     Remaining:  ${p.current_stock} units
     Buy Price:  KSh ${Number(p.cost_price || 0).toLocaleString()}
     Sell Price: KSh ${Number(p.selling_price || 0).toLocaleString()}
     Profit:     KSh ${Number((p.selling_price || 0) - (p.cost_price || 0)).toLocaleString()}
`;
            });
            text += `\n`;
        }

        const urgency = outOfStock.length > 0
            ? `🔴 URGENT: ${outOfStock.length} product(s) are OUT OF STOCK! Restock immediately.`
            : `🟡 ${lowStock.length} product(s) are running LOW on stock. Restock soon.`;

        text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${urgency}

📋 Action Required:
  1. Go to Inventory Management
  2. Restock the affected products
  3. Update stock levels

───────────────────────────────────────────
FarmersChoice Agrovet · Kenya Edition
📧 This is an automated notification.
`;

        const subject = outOfStock.length > 0
            ? `🚨 URGENT: ${outOfStock.length} Product(s) OUT OF STOCK!`
            : `⚠️ ${lowStock.length} Product(s) LOW STOCK - Please Restock`;

        return await this.sendEmail(recipient, subject, text);
    }

    /**
     * Send New Purchase Notification
     */
    async sendPurchaseNotification(sale, saleItems, recipient) {
        const now = new Date().toLocaleString('en-KE', {
            timeZone: 'Africa/Nairobi',
            dateStyle: 'full',
            timeStyle: 'medium'
        });

        let itemsList = '';
        saleItems.forEach((item, i) => {
            itemsList += `
  ${i + 1}. ${item.product_name}
     Quantity:   ${item.quantity}
     Unit Price: KSh ${Number(item.unit_price).toLocaleString()}
     Total:      KSh ${Number(item.total_price).toLocaleString()}
`;
        });

        const totalCost = saleItems.reduce((sum, item) => sum + (item.cost_price * item.quantity || 0), 0);
        const totalProfit = saleItems.reduce((sum, item) => sum + (item.profit || 0), 0);

        const text = `
🛒 NEW SALE - RECEIPT #${sale.receipt_number}
═══════════════════════════════════════════
📅 ${now}
───────────────────────────────────────────

🧑 Customer:    ${sale.customer_name || 'Walk-in'}
📱 Phone:       ${sale.customer_phone || 'N/A'}
💰 Payment:     ${sale.payment_method}
📍 Branch:      ${sale.branch?.name || 'Main Branch'}

📦 ITEMS:
${itemsList}
───────────────────────────────────────────

📊 SUMMARY:
  Subtotal:     KSh ${Number(sale.subtotal).toLocaleString()}
  Discount:     KSh ${Number(sale.discount || 0).toLocaleString()}
  Tax:          KSh ${Number(sale.tax || 0).toLocaleString()}
  TOTAL:        KSh ${Number(sale.total).toLocaleString()}
───────────────────────────────────────────

📈 PROFIT:
  Total Cost:   KSh ${Number(totalCost).toLocaleString()}
  Total Profit: KSh ${Number(totalProfit).toLocaleString()}
  Margin:       ${totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(1) : 0}%

───────────────────────────────────────────
FarmersChoice Agrovet · Kenya Edition
📧 This is an automated notification.
`;

        const subject = `🛒 New Sale: ${sale.receipt_number} - KSh ${Number(sale.total).toLocaleString()}`;

        return await this.sendEmail(recipient, subject, text);
    }

    /**
     * Send Daily Summary Report
     */
    async sendDailySummary(summary, recipient) {
        const date = new Date().toLocaleDateString('en-KE', {
            timeZone: 'Africa/Nairobi',
            dateStyle: 'full'
        });

        let text = `
📊 DAILY SALES SUMMARY
═══════════════════════════════════════════
📅 ${date}
───────────────────────────────────────────

📈 OVERVIEW:
  Total Sales:     ${summary.total_sales}
  Total Revenue:   KSh ${Number(summary.total_revenue).toLocaleString()}
  Total Discount:  KSh ${Number(summary.total_discount || 0).toLocaleString()}
  Total Tax:       KSh ${Number(summary.total_tax || 0).toLocaleString()}
  Avg Transaction: KSh ${Number(summary.average_transaction || 0).toLocaleString()}

───────────────────────────────────────────

💳 PAYMENT BREAKDOWN:
`;
        Object.entries(summary.payment_breakdown || {}).forEach(([method, amount]) => {
            const percentage = summary.total_revenue > 0
                ? ((amount / summary.total_revenue) * 100).toFixed(1)
                : 0;
            text += `  ${method.padEnd(10)} KSh ${Number(amount).toLocaleString()}  (${percentage}%)\n`;
        });

        if (summary.top_products && summary.top_products.length > 0) {
            text += `
───────────────────────────────────────────

🏆 TOP PRODUCTS:
`;
            summary.top_products.slice(0, 5).forEach((p, i) => {
                text += `  ${i + 1}. ${p.product_name.padEnd(30)} ${p.total_quantity} units  KSh ${Number(p.total_revenue).toLocaleString()}\n`;
            });
        }

        if (summary.employee_performance && summary.employee_performance.length > 0) {
            text += `
───────────────────────────────────────────

👤 EMPLOYEE PERFORMANCE:
`;
            summary.employee_performance.forEach((emp) => {
                text += `  ${emp.user_name.padEnd(20)} ${emp.sales_count} sales  KSh ${Number(emp.total_revenue).toLocaleString()}\n`;
            });
        }

        text += `
───────────────────────────────────────────
FarmersChoice Agrovet · Kenya Edition
📧 This is an automated daily report.
`;

        const subject = `📊 Daily Sales Summary - ${date}`;

        return await this.sendEmail(recipient, subject, text);
    }
        /**
     * Notify owner that a single product was added
     */
    async sendStockAddedNotification(product, user) {
        const now = new Date().toLocaleString('en-KE', {
            timeZone: 'Africa/Nairobi',
            dateStyle: 'full',
            timeStyle: 'medium'
        });

        const margin = (Number(product.selling_price) || 0) - (Number(product.cost_price) || 0);
        const marginPct = product.cost_price > 0
            ? ((margin / product.cost_price) * 100).toFixed(1)
            : (margin > 0 ? '100.0' : '0.0');

        const text = `
📦 NEW PRODUCT ADDED
═══════════════════════════════════════════
📅 ${now}
───────────────────────────────────────────

  Name:        ${product.name}
  SKU:         ${product.sku || 'N/A'}
  Category:    ${product.categories?.name || 'Uncategorized'}
  Unit:        ${product.unit_of_measure || 'piece'}

  Cost Price:  KSh ${Number(product.cost_price || 0).toLocaleString()}
  Sell Price:  KSh ${Number(product.selling_price || 0).toLocaleString()}
  Margin:      KSh ${margin.toLocaleString()} (${marginPct}%)

  Quantity:    ${product.quantity || 0} units
  Cost Value:  KSh ${((Number(product.cost_price) || 0) * (Number(product.quantity) || 0)).toLocaleString()}
  Retail Value: KSh ${((Number(product.selling_price) || 0) * (Number(product.quantity) || 0)).toLocaleString()}

───────────────────────────────────────────
Added by: ${user?.full_name || 'Unknown'} (${user?.email || 'N/A'})
───────────────────────────────────────────
FarmersChoice Agrovet · Kenya Edition
📧 This is an automated notification.
`;

        const subject = `📦 New Product: ${product.name}`;
        const recipient = process.env.OWNER_EMAIL || process.env.SMTP_USER;
        if (!recipient) return { success: false, error: 'No recipient configured' };

        return await this.sendEmail(recipient, subject, text);
    }

    /**
     * Notify owner of a bulk import summary
     */
    async sendBulkImportSummary(products, user, totals) {
        const now = new Date().toLocaleString('en-KE', {
            timeZone: 'Africa/Nairobi',
            dateStyle: 'full',
            timeStyle: 'medium'
        });

        let itemsList = '';
        products.forEach((p, i) => {
            const margin = (Number(p.selling_price) || 0) - (Number(p.cost_price) || 0);
            const marginPct = p.cost_price > 0 ? ((margin / p.cost_price) * 100).toFixed(1) : '0.0';
            itemsList += `
  ${i + 1}. ${p.name} (${p.sku || 'no SKU'})
     Category:    ${p.categories?.name || 'Uncategorized'} · Unit: ${p.unit_of_measure || 'piece'}
     Cost:        KSh ${Number(p.cost_price || 0).toLocaleString()} · Sell: KSh ${Number(p.selling_price || 0).toLocaleString()}
     Margin:      KSh ${margin.toLocaleString()} (${marginPct}%)
     Quantity:    ${p.quantity || 0} units
     Cost value:  KSh ${((Number(p.cost_price) || 0) * (Number(p.quantity) || 0)).toLocaleString()} · Retail: KSh ${((Number(p.selling_price) || 0) * (Number(p.quantity) || 0)).toLocaleString()}
`;
        });

        const text = `
📦 BULK STOCK IMPORT COMPLETED
═══════════════════════════════════════════
📅 ${now}
───────────────────────────────────────────

The following products were just added to stock:

${itemsList}
───────────────────────────────────────────
SUMMARY
───────────────────────────────────────────
  Products added:    ${totals.products_created}
  Categories created: ${totals.categories_created || 0}
  Total units:       ${totals.total_units.toLocaleString()}
  Total cost value:  KSh ${Number(totals.total_cost_value).toLocaleString()}
  Total retail value: KSh ${Number(totals.total_retail_value).toLocaleString()}
  Potential profit:  KSh ${Number(totals.total_potential_profit).toLocaleString()}

───────────────────────────────────────────
Added by: ${user?.full_name || 'Unknown'} (${user?.email || 'N/A'})
───────────────────────────────────────────
FarmersChoice Agrovet · Kenya Edition
📧 This is an automated notification.
`;

        const subject = `📦 ${totals.products_created} new products added`;
        const recipient = process.env.OWNER_EMAIL || process.env.SMTP_USER;
        if (!recipient) return { success: false, error: 'No recipient configured' };

        return await this.sendEmail(recipient, subject, text);
    }
}

export default new EmailService();