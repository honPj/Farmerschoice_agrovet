import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';

class ProductService {
    /**
     * Get all products with inventory
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

            // Apply filters
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

            // Get products
            const { data: products, error } = await query
                .order('name', { ascending: true });

            if (error) throw error;

            // Get inventory for each product
            const productsWithInventory = await Promise.all(
                products.map(async (product) => {
                    const { data: inventory, error: invError } = await supabase
                        .from('branch_inventory')
                        .select(`
                            id,
                            branch_id,
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
                        .eq('product_id', product.id);

                    if (invError) {
                        logger.warn(`Failed to get inventory for product ${product.id}:`, invError);
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
                })
            );

            return productsWithInventory;
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
            // Get product
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
                    return null; // Product not found
                }
                throw error;
            }

            // Get inventory for this product
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

            // Generate SKU if not provided
            const finalSku = sku || `SKU-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;

            // Get organization ID (use the default one from your schema)
            const orgId = '11111111-1111-1111-1111-111111111111';

            // Create product
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

            // If quantity > 0, create initial inventory record
            if (quantity > 0) {
                // Get first branch (Main Branch from your schema)
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
                    return null; // Product not found
                }
                throw error;
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
            // First delete inventory records
            await supabase
                .from('branch_inventory')
                .delete()
                .eq('product_id', productId);

            // Then delete the product
            const { data: product, error } = await supabase
                .from('products')
                .delete()
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
     * Uses the update_stock function from your schema
     */
    async updateStock(branchId, productId, quantity, movementType, userId, referenceId = null) {
        try {
            // Call the update_stock function
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
     * Get product categories - FIXED VERSION
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
                logger.error('📂 Error code:', error.code);
                logger.error('📂 Error message:', error.message);
                logger.error('📂 Error details:', error.details);
                
                // Return empty array instead of throwing
                return [];
            }
            
            logger.info(`📂 Found ${data?.length || 0} categories`);
            return data || [];
        } catch (error) {
            logger.error('📂 Get categories error:', error);
            logger.error('📂 Error stack:', error.stack);
            // Return empty array to prevent crashing
            return [];
        }
    }

    /**
     * Create a category
     */
    async createCategory(categoryData) {
        try {
            const { name, parent_category_id, description } = categoryData;

            const { data, error } = await supabase
                .from('product_categories')
                .insert([{
                    name,
                    parent_category_id: parent_category_id || null,
                    description: description || null
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`Create category error: ${error.message}`);
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
     * Create a single category
     */
    async createCategory(categoryData) {
        try {
            const { name, parent_category_id = null, description = null } = categoryData;

            if (!name || name.trim().length < 2) {
                throw new Error('Category name must be at least 2 characters');
            }

            // Duplicate check (case-insensitive)
            const { data: existing } = await supabase
                .from('product_categories')
                .select('id, name')
                .ilike('name', name.trim())
                .maybeSingle();

            if (existing) {
                return existing; // return existing — not an error
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
     * Bulk create products
     * Order:
     *   1. Create any new categories first (dedupe by name)
     *   2. Map all rows to their resolved category_id
     *   3. Insert products
     *   4. Insert branch_inventory rows
     * Returns summary with created products
     */
    async bulkCreateProducts(products, newCategories = [], userId = null) {
        try {
            const MAIN_BRANCH_ID = '22222222-2222-2222-2222-222222222222';
            const ORG_ID = '11111111-1111-1111-1111-111111111111';

            // ─── Step 1: Create new categories (dedupe by name) ───
            const createdCategories = {};
            for (const catName of newCategories) {
                if (!catName || !catName.trim()) continue;
                const key = catName.trim().toLowerCase();
                if (createdCategories[key]) continue;

                // Check if it already exists first (case-insensitive)
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

            // ─── Step 2: Insert products ───
            const productRows = products.map(p => {
                // Resolve category: either an existing UUID, a "new:" prefixed name, or null
                let categoryId = null;
                if (p.category_id && String(p.category_id).startsWith('new:')) {
                    const nm = String(p.category_id).slice(4).trim().toLowerCase();
                    categoryId = createdCategories[nm]?.id || null;
                } else if (p.category_id) {
                    categoryId = p.category_id;
                }

                // Fallback SKU if none provided
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

            // ─── Step 3: Create branch_inventory rows for products with qty > 0 ───
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

            // ─── Step 4: Build summary ───
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