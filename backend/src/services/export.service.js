import ExcelJS from 'exceljs';
import { Parser } from 'json2csv';
import logger from '../utils/logger.js';

class ExportService {
    async exportToCSV(data, headers, filename) {
        try {
            const fields = headers.map(h => h.key);
            const parser = new Parser({ fields, header: true });
            const csv = parser.parse(data);

            return {
                success: true,
                data: csv,
                filename: `${filename}_${new Date().toISOString().slice(0,10)}.csv`,
                contentType: 'text/csv'
            };
        } catch (error) {
            logger.error(`Export to CSV error: ${error.message}`);
            throw error;
        }
    }

    async exportToExcel(data, headers, filename, sheetName = 'Report') {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(sheetName);

            const headerRow = worksheet.addRow(headers.map(h => h.label));
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4CAF50' }
            };

            data.forEach(item => {
                const row = headers.map(h => {
                    const value = item[h.key];
                    if (typeof value === 'number' && (h.key.includes('price') || h.key.includes('profit') || h.key.includes('revenue') || h.key.includes('total'))) {
                        return `KSh ${value.toLocaleString()}`;
                    }
                    if (typeof value === 'number') {
                        return value;
                    }
                    return value || '';
                });
                worksheet.addRow(row);
            });

            worksheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const cellValue = cell.value ? cell.value.toString() : '';
                    if (cellValue.length > maxLength) {
                        maxLength = cellValue.length;
                    }
                });
                column.width = Math.min(Math.max(maxLength + 2, 12), 50);
            });

            const buffer = await workbook.xlsx.writeBuffer();

            return {
                success: true,
                data: buffer,
                filename: `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };
        } catch (error) {
            logger.error(`Export to Excel error: ${error.message}`);
            throw error;
        }
    }

    async exportSalesReport(sales, format = 'excel') {
        const headers = [
            { key: 'receipt_number', label: 'Receipt #' },
            { key: 'sale_date', label: 'Date' },
            { key: 'customer_name', label: 'Customer' },
            { key: 'payment_method', label: 'Payment' },
            { key: 'user_name', label: 'Cashier' },
            { key: 'item_count', label: 'Items' },
            { key: 'subtotal', label: 'Subtotal' },
            { key: 'discount', label: 'Discount' },
            { key: 'tax', label: 'Tax' },
            { key: 'total', label: 'Total' }
        ];

        const formattedData = sales.map(sale => ({
            receipt_number: sale.receipt_number,
            sale_date: new Date(sale.sale_date).toLocaleDateString(),
            customer_name: sale.customer_name || 'Walk-in',
            payment_method: sale.payment_method || 'Cash',
            user_name: sale.user?.full_name || 'Unknown',
            item_count: sale.sale_items?.length || 0,
            subtotal: sale.subtotal || 0,
            discount: sale.discount || 0,
            tax: sale.tax || 0,
            total: sale.total || 0
        }));

        const filename = 'Sales_Report';

        if (format === 'csv') {
            return await this.exportToCSV(formattedData, headers, filename);
        } else {
            return await this.exportToExcel(formattedData, headers, filename, 'Sales');
        }
    }

    async exportInventoryReport(inventory, format = 'excel') {
        const headers = [
            { key: 'product_name', label: 'Product' },
            { key: 'sku', label: 'SKU' },
            { key: 'category_name', label: 'Category' },
            { key: 'current_stock', label: 'Stock' },
            { key: 'cost_price', label: 'Cost Price' },
            { key: 'selling_price', label: 'Selling Price' },
            { key: 'profit_per_unit', label: 'Profit/Unit' },
            { key: 'total_value', label: 'Total Value' },
            { key: 'stock_status', label: 'Status' }
        ];

        const formattedData = inventory.map(item => ({
            product_name: item.product_name || 'Unknown',
            sku: item.sku || 'N/A',
            category_name: item.category_name || 'Uncategorized',
            current_stock: item.current_stock || 0,
            cost_price: item.cost_price || 0,
            selling_price: item.selling_price || 0,
            profit_per_unit: (item.selling_price || 0) - (item.cost_price || 0),
            total_value: (item.current_stock || 0) * (item.selling_price || 0),
            stock_status: item.current_stock <= 0 ? 'Out of Stock' : 
                          item.current_stock <= 5 ? 'Low Stock' : 'In Stock'
        }));

        const filename = 'Inventory_Report';

        if (format === 'csv') {
            return await this.exportToCSV(formattedData, headers, filename);
        } else {
            return await this.exportToExcel(formattedData, headers, filename, 'Inventory');
        }
    }

    async exportProductsReport(products, format = 'excel') {
        const headers = [
            { key: 'name', label: 'Product Name' },
            { key: 'sku', label: 'SKU' },
            { key: 'category_name', label: 'Category' },
            { key: 'cost_price', label: 'Cost Price' },
            { key: 'selling_price', label: 'Selling Price' },
            { key: 'profit_per_unit', label: 'Profit' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'is_active', label: 'Active' }
        ];

        const formattedData = products.map(product => ({
            name: product.name,
            sku: product.sku || 'N/A',
            category_name: product.categories?.name || 'Uncategorized',
            cost_price: product.cost_price || 0,
            selling_price: product.selling_price || 0,
            profit_per_unit: (product.selling_price || 0) - (product.cost_price || 0),
            quantity: product.quantity || 0,
            is_active: product.is_active ? 'Yes' : 'No'
        }));

        const filename = 'Products_Report';

        if (format === 'csv') {
            return await this.exportToCSV(formattedData, headers, filename);
        } else {
            return await this.exportToExcel(formattedData, headers, filename, 'Products');
        }
    }

    async exportTopProductsReport(topProducts, format = 'excel') {
        const headers = [
            { key: 'product_name', label: 'Product' },
            { key: 'total_quantity', label: 'Total Sold' },
            { key: 'total_revenue', label: 'Total Revenue' },
            { key: 'total_profit', label: 'Total Profit' },
            { key: 'transaction_count', label: 'Transactions' }
        ];

        const formattedData = topProducts.map(item => ({
            product_name: item.product_name || 'Unknown',
            total_quantity: item.total_quantity || 0,
            total_revenue: item.total_revenue || 0,
            total_profit: item.total_profit || 0,
            transaction_count: item.transaction_count || 0
        }));

        const filename = 'Top_Products_Report';

        if (format === 'csv') {
            return await this.exportToCSV(formattedData, headers, filename);
        } else {
            return await this.exportToExcel(formattedData, headers, filename, 'Top Products');
        }
    }

    async exportEmployeePerformanceReport(performance, format = 'excel') {
        const headers = [
            { key: 'user_name', label: 'Employee' },
            { key: 'role', label: 'Role' },
            { key: 'sales_count', label: 'Sales Count' },
            { key: 'total_revenue', label: 'Total Revenue' },
            { key: 'total_profit', label: 'Total Profit' },
            { key: 'average_transaction', label: 'Avg Transaction' },
            { key: 'total_discount', label: 'Total Discount' }
        ];

        const formattedData = performance.map(item => ({
            user_name: item.user_name || 'Unknown',
            role: item.role || 'Employee',
            sales_count: item.sales_count || 0,
            total_revenue: item.total_revenue || 0,
            total_profit: item.total_profit || 0,
            average_transaction: item.average_transaction || 0,
            total_discount: item.total_discount || 0
        }));

        const filename = 'Employee_Performance_Report';

        if (format === 'csv') {
            return await this.exportToCSV(formattedData, headers, filename);
        } else {
            return await this.exportToExcel(formattedData, headers, filename, 'Employee Performance');
        }
    }

    async exportPaymentBreakdownReport(breakdown, format = 'excel') {
        const headers = [
            { key: 'payment_method', label: 'Payment Method' },
            { key: 'count', label: 'Transactions' },
            { key: 'total', label: 'Total Amount' },
            { key: 'percentage', label: 'Percentage' }
        ];

        const total = Object.values(breakdown).reduce((sum, item) => sum + item.total, 0);

        const formattedData = Object.entries(breakdown).map(([method, data]) => ({
            payment_method: method,
            count: data.count || 0,
            total: data.total || 0,
            percentage: total > 0 ? ((data.total / total) * 100).toFixed(1) + '%' : '0%'
        }));

        const filename = 'Payment_Breakdown_Report';

        if (format === 'csv') {
            return await this.exportToCSV(formattedData, headers, filename);
        } else {
            return await this.exportToExcel(formattedData, headers, filename, 'Payment Breakdown');
        }
    }
        /**
     * Generic report export — accepts an array of plain objects + header map
     * and produces CSV or real .xlsx output.
     * @param {Array} rows - [{ col1: val1, col2: val2, ... }]
     * @param {Array} headers - [{ key: 'col1', label: 'Column 1' }, ...]
     * @param {String} filename - base filename (no extension)
     * @param {String} format - 'csv' | 'excel'
     */
    async exportGenericReport(rows, headers, filename, format = 'excel') {
        try {
            if (!Array.isArray(rows)) rows = [];
            if (!Array.isArray(headers) || !headers.length) {
                throw new Error('exportGenericReport: headers must be a non-empty array');
            }

            if (format === 'csv') {
                return await this.exportToCSV(rows, headers, filename);
            }
            return await this.exportToExcel(rows, headers, filename, 'Report');
        } catch (error) {
            logger.error(`Generic export error: ${error.message}`);
            throw error;
        }
    }
}

export default new ExportService();