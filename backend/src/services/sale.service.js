import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';
import { generateReceiptNumber } from '../utils/helpers.js';

class SaleService {
    /**
     * Create a new sale
     */
    async createSale(saleData, userId) {
        try {
            console.log('📂📂📂 createSale called 📂📂📂');
            console.log('📂 saleData:', JSON.stringify(saleData, null, 2));
            console.log('📂 userId:', userId);

            const {
                branch_id,
                customer_name = 'Walk-in',
                customer_phone,
                customer_email,
                items,
                discount = 0,
                tax = 0,
                payment_method,
                payment_status = 'completed',
                paid_amount = 0,
                due_date = null,
                notes,
                metadata = {}
            } = saleData;

            // Get branch ID (use provided or get default)
            let branchId = branch_id;
            if (!branchId) {
                const { data: branch, error: branchError } = await supabase
                    .from('branches')
                    .select('id')
                    .limit(1)
                    .single();

                if (branchError) {
                    logger.error('Failed to get default branch:', branchError);
                    throw new Error('No branch available');
                }
                branchId = branch.id;
            }

            console.log('📂 branchId:', branchId);

            // ═══════════════════════════════════════════════════════════
            // BATCHED: 2 queries total instead of 2 × items
            // ═══════════════════════════════════════════════════════════
            const productIds = items.map(i => i.product_id);

            const { data: productsData, error: prodErr } = await supabase
                .from('products')
                .select('id, name, cost_price, selling_price, quantity')
                .in('id', productIds);

            if (prodErr) throw prodErr;

            const productMap = {};
            (productsData || []).forEach(p => { productMap[p.id] = p; });

            const { data: inventoriesData, error: invErr } = await supabase
                .from('branch_inventory')
                .select('product_id, current_stock')
                .eq('branch_id', branchId)
                .in('product_id', productIds);

            if (invErr) throw invErr;

            const invMap = {};
            (inventoriesData || []).forEach(i => { invMap[i.product_id] = i; });

            // Validate + build processed items
            let subtotal = 0;
            let totalCost = 0;
            const processedItems = [];

            for (const item of items) {
                const product = productMap[item.product_id];
                if (!product) {
                    throw new Error(`Product not found: ${item.product_id}`);
                }

                const currentStock = invMap[item.product_id]?.current_stock || 0;
                if (currentStock < item.quantity) {
                    throw new Error(`Insufficient stock for ${product.name}. Available: ${currentStock}, Requested: ${item.quantity}`);
                }

                const unitPrice = item.unit_price || product.selling_price;
                const totalPrice = unitPrice * item.quantity;
                const costPrice = product.cost_price || 0;
                const profit = totalPrice - (costPrice * item.quantity);

                processedItems.push({
                    product_id: item.product_id,
                    product_name: product.name,
                    quantity: item.quantity,
                    unit_price: unitPrice,
                    total_price: totalPrice,
                    cost_price: costPrice,
                    profit: profit,
                    discount_applied: 0
                });

                subtotal += totalPrice;
                totalCost += costPrice * item.quantity;
            }

            const total = subtotal - discount + tax;
            console.log(`📂 Subtotal: ${subtotal}, Discount: ${discount}, Tax: ${tax}, Total: ${total}`);

            // Generate receipt number
            const receiptNumber = generateReceiptNumber();
            console.log(`📂 Receipt number: ${receiptNumber}`);

            // Create sale record
            console.log('📂 Creating sale record...');
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert([{
                    receipt_number: receiptNumber,
                    branch_id: branchId,
                    user_id: userId,
                    customer_name,
                    customer_phone,
                    customer_email,
                    subtotal,
                    discount,
                    tax,
                    total,
                    payment_method,
                    payment_status,
                    paid_amount,
                    due_date,
                    notes,
                    metadata,
                    sale_date: new Date().toISOString()
                }])
                .select()
                .single();

            if (saleError) {
                console.error('❌ Sale creation error:', saleError);
                logger.error('Sale creation error:', saleError);
                throw new Error('Failed to create sale: ' + saleError.message);
            }

            console.log('✅ Sale created:', sale.id);

            // Create sale items
            const saleItems = processedItems.map(item => ({
                ...item,
                sale_id: sale.id
            }));

            console.log(`📂 Creating ${saleItems.length} sale items...`);
            const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(saleItems);

            if (itemsError) {
                console.error('❌ Sale items creation error:', itemsError);
                logger.error('Sale items creation error:', itemsError);
                throw new Error('Failed to create sale items: ' + itemsError.message);
            }

            console.log('✅ Sale items created');

            // Update stock for each item
            for (const item of processedItems) {
                try {
                    console.log(`📂 Updating stock for product ${item.product_id}...`);
                    const { data: stockResult, error: stockError } = await supabase.rpc('update_stock', {
                        p_branch_id: branchId,
                        p_product_id: item.product_id,
                        p_quantity: -item.quantity,
                        p_movement_type: 'SALE',
                        p_performed_by: userId,
                        p_reference_id: sale.id
                    });

                    if (stockError) {
                        console.error(`❌ Stock update error for product ${item.product_id}:`, stockError);
                    } else {
                        console.log(`✅ Stock updated for product ${item.product_id}: ${stockResult}`);
                    }
                } catch (error) {
                    console.error(`❌ Failed to update stock for product ${item.product_id}:`, error);
                }
            }

            // Update daily sales summary
            console.log('📂 Updating daily summary...');
            await this.updateDailySummary(branchId);

            console.log('✅ Sale completed successfully!');
            return {
                sale,
                items: saleItems,
                receipt_number: receiptNumber
            };

        } catch (error) {
            console.error('🔥 createSale error:', error);
            console.error('🔥 Stack:', error.stack);
            logger.error(`Create sale error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all sales with optional filters
     */
    async getAllSales(filters = {}) {
        try {
            console.log('📂📂📂 getAllSales called 📂📂📂');

            let query = supabase
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
                        full_name,
                        email,
                        role
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
                .order('created_at', { ascending: false });

            if (filters.start_date) {
                query = query.gte('sale_date', filters.start_date);
            }
            if (filters.end_date) {
                query = query.lte('sale_date', filters.end_date);
            }
            if (filters.payment_method) {
                query = query.eq('payment_method', filters.payment_method);
            }
            if (filters.payment_status) {
                query = query.eq('payment_status', filters.payment_status);
            }
            if (filters.branch_id) {
                query = query.eq('branch_id', filters.branch_id);
            }
            if (filters.user_id) {
                query = query.eq('user_id', filters.user_id);
            }

            const { data, error } = await query.limit(filters.limit || 100);

            if (error) {
                console.error('❌ getAllSales error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} sales`);
            return data;
        } catch (error) {
            console.error('🔥 getAllSales error:', error);
            logger.error(`Get all sales error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get sale by ID
     */
    async getSaleById(saleId) {
        try {
            console.log(`📂📂📂 getSaleById called for: ${saleId}`);

            const { data: sale, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    branch:branch_id (
                        id,
                        name,
                        location,
                        phone
                    ),
                    user:user_id (
                        id,
                        full_name,
                        email,
                        role
                    ),
                    sale_items (
                        id,
                        product_id,
                        product_name,
                        quantity,
                        unit_price,
                        total_price,
                        cost_price,
                        profit,
                        discount_applied
                    )
                `)
                .eq('id', saleId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('📂 Sale not found');
                    return null;
                }
                console.error('❌ getSaleById error:', error);
                throw error;
            }

            console.log(`✅ Sale found: ${sale.receipt_number}`);
            return sale;
        } catch (error) {
            console.error('🔥 getSaleById error:', error);
            logger.error(`Get sale by ID error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get sale by receipt number
     */
    async getSaleByReceipt(receiptNumber) {
        try {
            console.log(`📂📂📂 getSaleByReceipt called for: ${receiptNumber}`);

            const { data: sale, error } = await supabase
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
                        total_price
                    )
                `)
                .eq('receipt_number', receiptNumber)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('📂 Sale not found');
                    return null;
                }
                console.error('❌ getSaleByReceipt error:', error);
                throw error;
            }

            console.log(`✅ Sale found for receipt: ${receiptNumber}`);
            return sale;
        } catch (error) {
            console.error('🔥 getSaleByReceipt error:', error);
            logger.error(`Get sale by receipt error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get today's sales
     */
    async getTodaySales(branchId = null) {
        try {
            console.log('📂📂📂 getTodaySales called 📂📂📂');
            console.log('📂 branchId:', branchId);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString();
            console.log('📂 today:', todayStr);

            let query = supabase
                .from('sales')
                .select(`
                    *,
                    user:user_id (
                        id,
                        full_name,
                        role
                    ),
                    sale_items (
                        id,
                        product_name,
                        quantity,
                        unit_price,
                        total_price
                    )
                `)
                .gte('sale_date', todayStr);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            console.log('📂 Executing query...');
            const { data, error } = await query
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ getTodaySales error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} sales today`);

            const totalRevenue = data.reduce((sum, sale) => sum + (sale.total || 0), 0);
            const totalTransactions = data.length;

            return {
                sales: data,
                total_revenue: totalRevenue,
                total_transactions: totalTransactions,
                average_transaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0
            };
        } catch (error) {
            console.error('🔥 getTodaySales error:', error);
            logger.error(`Get today's sales error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get sales by payment method
     */
    async getSalesByPaymentMethod(paymentMethod, filters = {}) {
        try {
            console.log(`📂📂📂 getSalesByPaymentMethod called for: ${paymentMethod}`);

            let query = supabase
                .from('sales')
                .select('*')
                .eq('payment_method', paymentMethod)
                .order('created_at', { ascending: false });

            if (filters.start_date) {
                query = query.gte('sale_date', filters.start_date);
            }
            if (filters.end_date) {
                query = query.lte('sale_date', filters.end_date);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ getSalesByPaymentMethod error:', error);
                throw error;
            }

            const totalRevenue = data.reduce((sum, sale) => sum + sale.total, 0);

            console.log(`📂 Found ${data.length} sales for ${paymentMethod}`);
            return {
                sales: data,
                total_revenue: totalRevenue,
                count: data.length
            };
        } catch (error) {
            console.error('🔥 getSalesByPaymentMethod error:', error);
            logger.error(`Get sales by payment method error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get credit sales
     */
    async getCreditSales() {
        try {
            console.log('📂📂📂 getCreditSales called 📂📂📂');

            const { data, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    user:user_id (
                        id,
                        full_name
                    ),
                    sale_items (
                        id,
                        product_name,
                        quantity,
                        total_price
                    )
                `)
                .eq('payment_method', 'Credit')
                .in('payment_status', ['pending', 'partial'])
                .order('due_date', { ascending: true, nullsFirst: false });

            if (error) {
                console.error('❌ getCreditSales error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} credit sales`);

            const totalOutstanding = data.reduce((sum, sale) => sum + (sale.total || 0), 0);

            return {
                credit_sales: data,
                total_outstanding: totalOutstanding,
                count: data.length
            };
        } catch (error) {
            console.error('🔥 getCreditSales error:', error);
            logger.error(`Get credit sales error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process a return/refund
     */
    async processReturn(saleId, returnData, userId) {
        try {
            console.log(`📂📂📂 processReturn called for: ${saleId}`);

            const { items, reason } = returnData;

            const sale = await this.getSaleById(saleId);
            if (!sale) {
                throw new Error('Sale not found');
            }

            if (sale.payment_status === 'refunded') {
                throw new Error('This sale has already been refunded');
            }

            let totalRefund = 0;
            const refundedItems = [];

            for (const returnItem of items) {
                const saleItem = sale.sale_items.find(
                    item => item.id === returnItem.sale_item_id
                );

                if (!saleItem) {
                    throw new Error(`Sale item not found: ${returnItem.sale_item_id}`);
                }

                if (returnItem.quantity > saleItem.quantity) {
                    throw new Error(`Cannot return more than was purchased for ${saleItem.product_name}`);
                }

                const refundAmount = saleItem.unit_price * returnItem.quantity;
                totalRefund += refundAmount;

                refundedItems.push({
                    sale_item_id: returnItem.sale_item_id,
                    product_id: saleItem.product_id,
                    product_name: saleItem.product_name,
                    quantity: returnItem.quantity,
                    refund_amount: refundAmount
                });

                await supabase.rpc('update_stock', {
                    p_branch_id: sale.branch_id,
                    p_product_id: saleItem.product_id,
                    p_quantity: returnItem.quantity,
                    p_movement_type: 'RETURN',
                    p_performed_by: userId,
                    p_reference_id: sale.id
                });
            }

            const { data: updatedSale, error: updateError } = await supabase
                .from('sales')
                .update({
                    payment_status: 'refunded',
                    notes: sale.notes ? `${sale.notes}\nReturn: ${reason || 'No reason provided'}` : `Return: ${reason || 'No reason provided'}`
                })
                .eq('id', saleId)
                .select()
                .single();

            if (updateError) {
                logger.error('Sale update error:', updateError);
                throw new Error('Failed to update sale status');
            }

            console.log(`✅ Return processed for sale: ${saleId}`);
            return {
                sale: updatedSale,
                refunded_items: refundedItems,
                total_refund: totalRefund,
                reason: reason || 'No reason provided'
            };
        } catch (error) {
            console.error('🔥 processReturn error:', error);
            logger.error(`Process return error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update daily sales summary
     */
    async updateDailySummary(branchId) {
        try {
            console.log(`📂 updateDailySummary called for branch: ${branchId}`);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];

            const { data: sales, error } = await supabase
                .from('sales')
                .select('total, subtotal, discount, tax')
                .eq('branch_id', branchId)
                .gte('sale_date', today.toISOString())
                .eq('payment_status', 'completed');

            if (error) {
                console.error('❌ updateDailySummary error:', error);
                throw error;
            }

            const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
            const totalTransactions = sales.length;

            const { error: upsertError } = await supabase
                .from('daily_sales_summary')
                .upsert({
                    branch_id: branchId,
                    sale_date: todayStr,
                    total_revenue: totalRevenue,
                    total_transactions: totalTransactions,
                    avg_transaction_value: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'branch_id, sale_date'
                });

            if (upsertError) {
                console.error('❌ Daily summary update error:', upsertError);
                logger.error('Daily summary update error:', upsertError);
            } else {
                console.log(`✅ Daily summary updated for ${todayStr}`);
            }
        } catch (error) {
            console.error('🔥 updateDailySummary error:', error);
            logger.error(`Update daily summary error: ${error.message}`);
        }
    }

    /**
     * Get sales summary
     */
    async getSalesSummary(filters = {}) {
        try {
            console.log('📂📂📂 getSalesSummary called 📂📂📂');
            console.log('📂 filters:', filters);

            let query = supabase
                .from('sales')
                .select('*')
                .eq('payment_status', 'completed');

            if (filters.start_date) {
                query = query.gte('sale_date', filters.start_date);
            }
            if (filters.end_date) {
                query = query.lte('sale_date', filters.end_date);
            }
            if (filters.branch_id) {
                query = query.eq('branch_id', filters.branch_id);
            }

            console.log('📂 Executing summary query...');
            const { data, error } = await query;

            if (error) {
                console.error('❌ getSalesSummary error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} sales for summary`);

            const totalRevenue = data.reduce((sum, sale) => sum + (sale.total || 0), 0);
            const totalDiscount = data.reduce((sum, sale) => sum + (sale.discount || 0), 0);
            const totalTax = data.reduce((sum, sale) => sum + (sale.tax || 0), 0);

            return {
                total_sales: data.length,
                total_revenue: totalRevenue,
                total_discount: totalDiscount,
                total_tax: totalTax,
                average_transaction: data.length > 0 ? totalRevenue / data.length : 0
            };
        } catch (error) {
            console.error('🔥 getSalesSummary error:', error);
            logger.error(`Get sales summary error: ${error.message}`);
            throw error;
        }
    }
}

export default new SaleService();