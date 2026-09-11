import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';

class InventoryService {
    /**
     * Get all inventory with optional filters
     */
    async getAllInventory(filters = {}) {
        try {
            console.log('📂📂📂 getAllInventory called 📂📂📂');
            console.log('📂 filters:', filters);

            let query = supabase
                .from('inventory_with_details')
                .select('*');

            if (filters.branch_id) {
                query = query.eq('branch_id', filters.branch_id);
            }

            if (filters.search) {
                query = query.or(`product_name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
            }

            if (filters.min_stock !== undefined) {
                query = query.gte('current_stock', filters.min_stock);
            }

            if (filters.max_stock !== undefined) {
                query = query.lte('current_stock', filters.max_stock);
            }

            const { data, error } = await query
                .order('product_name', { ascending: true })
                .limit(filters.limit || 100);

            if (error) {
                console.error('❌ getAllInventory error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} inventory items`);
            return data || [];
        } catch (error) {
            console.error('🔥 getAllInventory error:', error);
            logger.error(`Get all inventory error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get inventory for a specific product
     */
    async getProductInventory(productId, branchId = null) {
        try {
            console.log(`📂📂📂 getProductInventory called for: ${productId}`);
            
            let query = supabase
                .from('inventory_with_details')
                .select('*')
                .eq('product_id', productId);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ getProductInventory error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} inventory records for product`);
            return data || [];
        } catch (error) {
            console.error('🔥 getProductInventory error:', error);
            logger.error(`Get product inventory error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update stock for a product (using the update_stock function)
     */
    async updateStock(branchId, productId, quantity, movementType, userId, notes = null) {
        try {
            console.log(`📂📂📂 updateStock called 📂📂📂`);
            console.log(`📂 branchId: ${branchId}, productId: ${productId}`);
            console.log(`📂 quantity: ${quantity}, movementType: ${movementType}`);
            console.log(`📂 userId: ${userId}`);

            // Call the update_stock function from your schema
            const { data, error } = await supabase.rpc('update_stock', {
                p_branch_id: branchId,
                p_product_id: productId,
                p_quantity: quantity,
                p_movement_type: movementType,
                p_performed_by: userId,
                p_reference_id: notes || null
            });

            if (error) {
                console.error('❌ updateStock error:', error);
                throw error;
            }

            console.log(`✅ Stock updated successfully. New stock: ${data}`);
            return data;
        } catch (error) {
            console.error('🔥 updateStock error:', error);
            logger.error(`Update stock error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Transfer stock between branches
     */
    async transferStock(transferData, userId) {
        try {
            console.log('📂📂📂 transferStock called 📂📂📂');
            console.log('📂 transferData:', transferData);
            console.log('📂 userId:', userId);

            const { from_branch_id, to_branch_id, items, notes } = transferData;

            // Create transfer record
            const { data: transfer, error: transferError } = await supabase
                .from('transfers')
                .insert([{
                    from_branch_id,
                    to_branch_id,
                    requested_by: userId,
                    status: 'pending',
                    notes: notes || null,
                    transfer_date: new Date().toISOString()
                }])
                .select()
                .single();

            if (transferError) {
                console.error('❌ transferError:', transferError);
                throw new Error('Failed to create transfer: ' + transferError.message);
            }

            console.log(`✅ Transfer created: ${transfer.id}`);

            // Create transfer items
            const transferItems = items.map(item => ({
                transfer_id: transfer.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_cost: 0 // Will be populated from inventory
            }));

            const { error: itemsError } = await supabase
                .from('transfer_items')
                .insert(transferItems);

            if (itemsError) {
                console.error('❌ transferItems error:', itemsError);
                throw new Error('Failed to create transfer items: ' + itemsError.message);
            }

            console.log(`✅ Transfer items created: ${transferItems.length}`);

            // Process the transfer (deduct from source, add to destination)
            for (const item of items) {
                // Deduct from source branch
                await supabase.rpc('update_stock', {
                    p_branch_id: from_branch_id,
                    p_product_id: item.product_id,
                    p_quantity: -item.quantity,
                    p_movement_type: 'TRANSFER_OUT',
                    p_performed_by: userId,
                    p_reference_id: transfer.id
                });

                // Add to destination branch
                await supabase.rpc('update_stock', {
                    p_branch_id: to_branch_id,
                    p_product_id: item.product_id,
                    p_quantity: item.quantity,
                    p_movement_type: 'TRANSFER_IN',
                    p_performed_by: userId,
                    p_reference_id: transfer.id
                });
            }

            // Update transfer status to completed
            const { data: updatedTransfer, error: updateError } = await supabase
                .from('transfers')
                .update({
                    status: 'completed',
                    approved_by: userId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', transfer.id)
                .select()
                .single();

            if (updateError) {
                console.error('❌ updateError:', updateError);
                // Log but don't fail - the transfer was already processed
            }

            return {
                transfer: updatedTransfer || transfer,
                items: transferItems
            };
        } catch (error) {
            console.error('🔥 transferStock error:', error);
            logger.error(`Transfer stock error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get inventory movements with filters
     */
    async getInventoryMovements(filters = {}) {
        try {
            console.log('📂📂📂 getInventoryMovements called 📂📂📂');
            console.log('📂 filters:', filters);

            let query = supabase
                .from('inventory_movements')
                .select(`
                    *,
                    branch:branch_id (
                        id,
                        name,
                        location
                    ),
                    product:product_id (
                        id,
                        name,
                        sku
                    ),
                    performed_by:performed_by (
                        id,
                        full_name
                    )
                `)
                .order('created_at', { ascending: false });

            if (filters.branch_id) {
                query = query.eq('branch_id', filters.branch_id);
            }

            if (filters.product_id) {
                query = query.eq('product_id', filters.product_id);
            }

            if (filters.movement_type) {
                query = query.eq('movement_type', filters.movement_type);
            }

            if (filters.start_date) {
                query = query.gte('created_at', filters.start_date);
            }

            if (filters.end_date) {
                query = query.lte('created_at', filters.end_date);
            }

            const { data, error } = await query.limit(filters.limit || 100);

            if (error) {
                console.error('❌ getInventoryMovements error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} movements`);
            return data || [];
        } catch (error) {
            console.error('🔥 getInventoryMovements error:', error);
            logger.error(`Get inventory movements error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get low stock products
     */
    async getLowStockProducts(threshold = 5, branchId = null) {
        try {
            console.log(`📂📂📂 getLowStockProducts called 📂📂📂`);
            console.log(`📂 threshold: ${threshold}, branchId: ${branchId}`);

            let query = supabase
                .from('branch_inventory')
                .select(`
                    id,
                    branch_id,
                    product_id,
                    current_stock,
                    min_stock_level,
                    max_stock_level,
                    cost_price,
                    selling_price,
                    product:product_id (
                        id,
                        name,
                        sku,
                        description,
                        unit_of_measure,
                        is_active
                    ),
                    branch:branch_id (
                        id,
                        name,
                        location
                    )
                `)
                .lt('current_stock', threshold)
                .order('current_stock', { ascending: true });

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ getLowStockProducts error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} low stock items`);
            return data || [];
        } catch (error) {
            console.error('🔥 getLowStockProducts error:', error);
            logger.error(`Get low stock products error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get stock value summary
     */
    async getStockValueSummary(branchId = null) {
        try {
            console.log(`📂📂📂 getStockValueSummary called 📂📂📂`);
            console.log(`📂 branchId: ${branchId}`);

            let query = supabase
                .from('branch_inventory')
                .select(`
                    current_stock,
                    cost_price,
                    selling_price,
                    branch_id
                `);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ getStockValueSummary error:', error);
                throw error;
            }

            const totalCost = data.reduce((sum, item) => sum + (item.current_stock * (item.cost_price || 0)), 0);
            const totalValue = data.reduce((sum, item) => sum + (item.current_stock * (item.selling_price || 0)), 0);
            const totalItems = data.length;
            const totalUnits = data.reduce((sum, item) => sum + (item.current_stock || 0), 0);

            return {
                total_cost: totalCost,
                total_value: totalValue,
                total_items: totalItems,
                total_units: totalUnits,
                potential_profit: totalValue - totalCost
            };
        } catch (error) {
            console.error('🔥 getStockValueSummary error:', error);
            logger.error(`Get stock value summary error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get branch inventory summary
     */
    async getBranchInventorySummary(branchId) {
        try {
            console.log(`📂📂📂 getBranchInventorySummary called for branch: ${branchId}`);

            const { data, error } = await supabase
                .from('inventory_with_details')
                .select('*')
                .eq('branch_id', branchId);

            if (error) {
                console.error('❌ getBranchInventorySummary error:', error);
                throw error;
            }

            const totalProducts = data.length;
            const totalStock = data.reduce((sum, item) => sum + (item.current_stock || 0), 0);
            const lowStock = data.filter(item => item.current_stock <= (item.min_stock_level || 5));
            const outOfStock = data.filter(item => item.current_stock === 0);
            const totalValue = data.reduce((sum, item) => sum + (item.current_stock * (item.selling_price || 0)), 0);
            const totalCost = data.reduce((sum, item) => sum + (item.current_stock * (item.cost_price || 0)), 0);

            return {
                branch_id: branchId,
                total_products: totalProducts,
                total_stock: totalStock,
                low_stock_count: lowStock.length,
                out_of_stock_count: outOfStock.length,
                total_value: totalValue,
                total_cost: totalCost,
                potential_profit: totalValue - totalCost,
                low_stock_items: lowStock,
                out_of_stock_items: outOfStock
            };
        } catch (error) {
            console.error('🔥 getBranchInventorySummary error:', error);
            logger.error(`Get branch inventory summary error: ${error.message}`);
            throw error;
        }
    }
}

export default new InventoryService();