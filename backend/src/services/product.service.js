import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';

class ProductService {
    /**
     * Get all products with inventory (batched — no N+1)
     */
    async getAllProducts(filters = {}) {
        try {
            let query = supabase
                .from('products')
                .select(`
                    *,
                    categories:category_id (
                        id,
                        name,
                        parent_category_id
                    )
                `);

            if (filters.category_id) {
                query = query.eq('category_id', filters.category_id);
            }
            if (filters.is_active !== undefined) {
                query = query.eq('is_active', filters.is_active);
            }
            if (filters.min_price) {
                query = query.gte('selling_price', filters.min_price);
            }
            if (filters.max_price) {
                query = query.lte('selling_price', filters.max_price);
            }

            const { data: products, error } = await query
                .order('name', { ascending: true });

            if (error) throw error;
            if (!products || products.length === 0) return [];

            // ─── ONE batched inventory query for all products ───
            const productIds = products.map(p => p.id);

            const { data: allInventory, error: invError } = await supabase
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
                    location_in_store,
                    last_restock_date,
                    branch:branch_id (
                        id,
                        name,
                        location
                    )
                `)
                .in('product_id', productIds);

            if (invError) {
                logger.warn('Batch inventory fetch failed:', invError);
            }

            // ─── Group inventory by product_id ───
            const invByProduct = {};
            (allInventory || []).forEach(inv => {
                if (!invByProduct[inv.product_id]) invByProduct[inv.product_id] = [];
                invByProduct[inv.product_id].push(inv);
            });

            // ─── Attach inventory + total_stock to each product ───
            return products.map(product => {
                const inventory = invByProduct[product.id] || [];
                const totalStock = inventory.reduce((sum, item) => sum + (item.current_stock || 0), 0);
                return {
                    ...product,
                    inventory,
                    total_stock: totalStock
                };
            });
        } catch (error) {
            logger.error(`Get all products error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get product by ID with inventory
     */
    async getProductById(productId) {
        try {
            const { data: product, error } = await supabase
                .from('products')
                .select(`
                    *,
                    categories:category_id (
                        id,
                        name,
                        parent_category_id
                    )
                `)
                .eq('id', productId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }

            const { data: inventory, error: invError } = await supabase
                .from('branch_inventory')
                .select(`
                    *,
                    branch:branch_id (
                        id,
                        name,
                        location,
                        phone
                    )
                `)
                .eq('product_id', productId);

            if (invError) {
                logger.warn(`Failed to get inventory for product ${productId}:`, invError);
                return {
                    ...product,
                    inventory: [],
                    total_stock: 0
                };
            }

            const totalStock = inventory.reduce((sum, item) => sum + (item.current_stock || 0), 0);

            return {
                ...product,
                inventory: inventory || [],
                total_stock: totalStock
            };
        } catch (error) {
            logger.error(`Get product by ID error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create a new product
     */
    async createProduct(productData) {
        try {
            const {
                name,
                category_id,
                sku,
                barcode,
                description,
                cost_price,
                selling_price,
                quantity = 0,
                unit_of_measure = 'piece',
                is_active = true
            } = productData;

            const finalSku = sku || `SKU-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
            const orgId = '11111111-1111-1111-1111-111111111111';

            const { data: product, error } = await supabase
                .from('products')
                .insert([{
                    organization_id: orgId,
                    name,
                    category_id: category_id || null,
                    sku: finalSku,
                    barcode: barcode || null,
                    description: description || null,
                    cost_price,
                    selling_price,
                    quantity: quantity || 0,
                    unit_of_measure,
                    is_active
                }])
                .select()
                .single();

            if (error) throw error;

            if (quantity > 0) {
                const branchId = '22222222-2222-2222-2222-222222222222';

                await supabase
                    .from('branch_inventory')
                    .insert([{
                        branch_id: branchId,
                        product_id: product.id,
                        current_stock: quantity,
                        min_stock_level: 5,
                        max_stock_level: 100,
                        cost_price: cost_price,
                        selling_price: selling_price
                    }]);
            }

            return product;
        } catch (error) {
            logger.error(`Create product error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update a product
     * Also syncs cost/selling price + quantity to branch_inventory
     */
    async updateProduct(productId, updates) {
        try {
            const { data: product, error } = await supabase
                .from('products')
                .update(updates)
                .eq('id', productId)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }

            // Sync inventory (cost, selling) if provided
            const invUpdates = {};
            if (updates.cost_price !== undefined)    invUpdates.cost_price = updates.cost_price;
            if (updates.selling_price !== undefined) invUpdates.selling_price = updates.selling_price;

            if (Object.keys(invUpdates).length > 0) {
                await supabase
                    .from('branch_inventory')
                    .update(invUpdates)
                    .eq('product_id', productId);
            }

            return product;
        } catch (error) {
            logger.error(`Update product error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Soft delete a product (set is_active to false)
     */
    async deleteProduct(productId) {
        try {
            const { data: product, error } = await supabase
                .from('products')
                .update({ is_active: false })
                .eq('id', productId)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }

            return product;
        } catch (error) {
            logger.error(`Delete product error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Hard delete a product (permanent)
     */
    async hardDeleteProduct(productId) {
        try {
            const { data: product, error: fetchError } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (fetchError) {
                if (fetchError.code === 'PGRST116') return null;
                throw fetchError;
            }

            // Detach sale_items to avoid FK block — sale history is preserved
            const { error: detachError } = await supabase
                .from('sale_items')
                .update({ product_id: null })
                .eq('product_id', productId);

            if (detachError) {
                logger.warn(`Could not detach sale_items for ${productId}: ${detachError.message}`);
            }

            // Delete branch_inventory rows
            const { error: invError } = await supabase
                .from('branch_inventory')
                .delete()
                .eq('product_id', productId);

            if (invError) {
                logger.warn(`Could not delete inventory for ${productId}: ${invError.message}`);
            }

            // Delete inventory_movements rows
            await supabase
                .from('inventory_movements')
                .delete()
                .eq('product_id', productId);

            // Delete the product row
            const { error: deleteError } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

            if (deleteError) throw deleteError;

            return product;
        } catch (error) {
            logger.error(`Hard delete product error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Search products
     */
    async searchProducts(query, filters = {}) {
        try {
            let supabaseQuery = supabase
                .from('products')
                .select(`
                    *,
                    categories:category_id (
                        id,
                        name
                    )
                `)
                .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`);

            if (filters.category_id) {
                supabaseQuery = supabaseQuery.eq('category_id', filters.category_id);
            }
            if (filters.is_active !== undefined) {
                supabaseQuery = supabaseQuery.eq('is_active', filters.is_active);
            }

            const { data, error } = await supabaseQuery
                .order('name', { ascending: true })
                .limit(50);

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`Search products error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get low stock products
     */
    async getLowStockProducts(threshold = 5) {
        try {
            const { data, error } = await supabase
                .from('branch_inventory')
                .select(`
                    id,
                    branch_id,
                    product_id,
                    current_stock,
                    min_stock_level,
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

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`Get low stock products error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update product stock
     */
    async updateStock(branchId, productId, quantity, movementType, userId, referenceId = null) {
        try {
            const { data, error } = await supabase.rpc('update_stock', {
                p_branch_id: branchId,
                p_product_id: productId,
                p_quantity: quantity,
                p_movement_type: movementType,
                p_performed_by: userId,
                p_reference_id: referenceId
            });

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`Update stock error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get product categories
     */
    async getCategories() {
        try {
            logger.info('📂 Fetching product categories from service...');

            const { data, error } = await supabase
                .from('product_categories')
                .select('*')
                .order('name', { ascending: true });

            if (error) {
                logger.error('📂 Categories query error:', error);
                return [];
            }

            logger.info(`📂 Found ${data?.length || 0} categories`);
            return data || [];
        } catch (error) {
            logger.error('📂 Get categories error:', error);
            return [];
        }
    }

    /**
     * Create a single category (with case-insensitive dedupe)
     */
    async createCategory(categoryData) {
        try {
            const { name, parent_category_id = null, description = null } = categoryData;

            if (!name || name.trim().length < 2) {
                throw new Error('Category name must be at least 2 characters');
            }

            const { data: existing } = await supabase
                .from('product_categories')
                .select('id, name')
                .ilike('name', name.trim())
                .maybeSingle();

            if (existing) {
                return existing;
            }

            const { data, error } = await supabase
                .from('product_categories')
                .insert([{
                    name: name.trim(),
                    parent_category_id: parent_category_id || null,
                    description: description || null
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`createCategory error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get inventory movements for a product
     */
    async getProductMovements(productId, limit = 50) {
        try {
            const { data, error } = await supabase
                .from('inventory_movements')
                .select(`
                    *,
                    branch:branch_id (
                        id,
                        name
                    ),
                    performed_by:performed_by (
                        id,
                        full_name
                    )
                `)
                .eq('product_id', productId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`Get product movements error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get product by SKU
     */
    async getProductBySku(sku) {
        try {
            const { data: product, error } = await supabase
                .from('products')
                .select('*')
                .eq('sku', sku)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }

            return product;
        } catch (error) {
            logger.error(`Get product by SKU error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get products by category
     */
    async getProductsByCategory(categoryId) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    categories:category_id (
                        id,
                        name,
                        parent_category_id
                    )
                `)
                .eq('category_id', categoryId)
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`Get products by category error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Bulk create products
     */
    async bulkCreateProducts(products, newCategories = [], userId = null) {
        try {
            const MAIN_BRANCH_ID = '22222222-2222-2222-2222-222222222222';
            const ORG_ID = '11111111-1111-1111-1111-111111111111';

            const createdCategories = {};
            for (const catName of newCategories) {
                if (!catName || !catName.trim()) continue;
                const key = catName.trim().toLowerCase();
                if (createdCategories[key]) continue;

                const { data: existing } = await supabase
                    .from('product_categories')
                    .select('id, name')
                    .ilike('name', catName.trim())
                    .maybeSingle();

                if (existing) {
                    createdCategories[key] = existing;
                    continue;
                }

                const { data: created, error: catErr } = await supabase
                    .from('product_categories')
                    .insert([{ name: catName.trim() }])
                    .select()
                    .single();

                if (catErr) {
                    logger.warn(`Category create failed for "${catName}": ${catErr.message}`);
                    continue;
                }
                createdCategories[key] = created;
            }

            const productRows = products.map(p => {
                let categoryId = null;
                if (p.category_id && String(p.category_id).startsWith('new:')) {
                    const nm = String(p.category_id).slice(4).trim().toLowerCase();
                    categoryId = createdCategories[nm]?.id || null;
                } else if (p.category_id) {
                    categoryId = p.category_id;
                }

                const sku = p.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;

                return {
                    organization_id: ORG_ID,
                    name: p.name,
                    category_id: categoryId,
                    sku,
                    barcode: p.barcode || null,
                    description: p.description || null,
                    cost_price: Number(p.cost_price) || 0,
                    selling_price: Number(p.selling_price) || 0,
                    quantity: Number(p.quantity) || 0,
                    unit_of_measure: p.unit_of_measure || 'piece',
                    is_active: true
                };
            });

            const { data: createdProducts, error: prodErr } = await supabase
                .from('products')
                .insert(productRows)
                .select();

            if (prodErr) throw prodErr;

            const inventoryRows = [];
            products.forEach((p, idx) => {
                const qty = Number(p.quantity) || 0;
                if (qty > 0) {
                    const created = createdProducts[idx];
                    inventoryRows.push({
                        branch_id: MAIN_BRANCH_ID,
                        product_id: created.id,
                        current_stock: qty,
                        min_stock_level: 5,
                        max_stock_level: 100,
                        cost_price: Number(p.cost_price) || 0,
                        selling_price: Number(p.selling_price) || 0
                    });
                }
            });

            if (inventoryRows.length > 0) {
                const { error: invErr } = await supabase
                    .from('branch_inventory')
                    .insert(inventoryRows);
                if (invErr) {
                    logger.warn(`Bulk inventory insert failed: ${invErr.message}`);
                }
            }

            const totals = {
                products_created: createdProducts.length,
                categories_created: Object.keys(createdCategories).length,
                total_units: products.reduce((s, p) => s + (Number(p.quantity) || 0), 0),
                total_cost_value: products.reduce((s, p) => s + (Number(p.cost_price) || 0) * (Number(p.quantity) || 0), 0),
                total_retail_value: products.reduce((s, p) => s + (Number(p.selling_price) || 0) * (Number(p.quantity) || 0), 0),
                total_potential_profit: products.reduce((s, p) => s + ((Number(p.selling_price) || 0) - (Number(p.cost_price) || 0)) * (Number(p.quantity) || 0), 0)
            };

            return {
                products: createdProducts,
                categories: Object.values(createdCategories),
                totals
            };
        } catch (error) {
            logger.error(`bulkCreateProducts error: ${error.message}`);
            throw error;
        }
    }
}

export default new ProductService();