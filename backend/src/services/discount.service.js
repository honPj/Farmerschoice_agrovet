import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';

class DiscountService {
    /**
     * Create a new discount
     */
    async createDiscount(discountData) {
        try {
            console.log('📂📂📂 createDiscount called 📂📂📂');
            console.log('📂 discountData:', discountData);

            const {
                name,
                description,
                discount_type,
                discount_value,
                product_ids = [],
                category_ids = [],
                min_purchase = 0,
                max_discount,
                start_date,
                end_date,
                is_active = true
            } = discountData;

            // Validate dates
            const start = new Date(start_date);
            const end = new Date(end_date);

            if (end < start) {
                throw new Error('End date must be after start date');
            }

            // Check for overlapping discounts
            const { data: existing, error: checkError } = await supabase
                .from('discounts')
                .select('*')
                .eq('is_active', true)
                .gte('end_date', start_date)
                .lte('start_date', end_date);

            if (checkError) {
                console.error('❌ Check error:', checkError);
                throw checkError;
            }

            // Create discount
            const { data: discount, error } = await supabase
                .from('discounts')
                .insert([{
                    name,
                    description,
                    discount_type,
                    discount_value,
                    min_purchase,
                    max_discount,
                    start_date,
                    end_date,
                    is_active,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) {
                console.error('❌ Create discount error:', error);
                throw error;
            }

            // Add product associations
            if (product_ids.length > 0) {
                const productAssociations = product_ids.map(product_id => ({
                    discount_id: discount.id,
                    product_id,
                    category_id: null
                }));

                const { error: productError } = await supabase
                    .from('discount_products')
                    .insert(productAssociations);

                if (productError) {
                    console.error('❌ Product association error:', productError);
                    // Continue - don't fail the whole operation
                }
            }

            // Add category associations
            if (category_ids.length > 0) {
                const categoryAssociations = category_ids.map(category_id => ({
                    discount_id: discount.id,
                    product_id: null,
                    category_id
                }));

                const { error: categoryError } = await supabase
                    .from('discount_products')
                    .insert(categoryAssociations);

                if (categoryError) {
                    console.error('❌ Category association error:', categoryError);
                    // Continue - don't fail the whole operation
                }
            }

            console.log(`✅ Discount created: ${discount.id}`);
            return discount;
        } catch (error) {
            console.error('🔥 createDiscount error:', error);
            logger.error(`Create discount error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all discounts with filters
     */
    async getAllDiscounts(filters = {}) {
        try {
            console.log('📂📂📂 getAllDiscounts called 📂📂📂');

            let query = supabase
                .from('discounts')
                .select(`
                    *,
                    discount_products (
                        product_id,
                        category_id
                    )
                `)
                .order('created_at', { ascending: false });

            if (filters.is_active !== undefined) {
                query = query.eq('is_active', filters.is_active);
            }

            if (filters.start_date) {
                query = query.gte('start_date', filters.start_date);
            }

            if (filters.end_date) {
                query = query.lte('end_date', filters.end_date);
            }

            const { data, error } = await query.limit(filters.limit || 100);

            if (error) {
                console.error('❌ getAllDiscounts error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} discounts`);
            return data || [];
        } catch (error) {
            console.error('🔥 getAllDiscounts error:', error);
            logger.error(`Get all discounts error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get active discounts
     */
    async getActiveDiscounts() {
        try {
            console.log('📂📂📂 getActiveDiscounts called 📂📂📂');

            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('discounts')
                .select(`
                    *,
                    discount_products (
                        product_id,
                        category_id
                    )
                `)
                .eq('is_active', true)
                .lte('start_date', today)
                .gte('end_date', today)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ getActiveDiscounts error:', error);
                throw error;
            }

            console.log(`📂 Found ${data?.length || 0} active discounts`);
            return data || [];
        } catch (error) {
            console.error('🔥 getActiveDiscounts error:', error);
            logger.error(`Get active discounts error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Calculate discount for a sale
     */
    async calculateDiscount(saleId, discountCode = null) {
        try {
            console.log('📂📂📂 calculateDiscount called 📂📂📂');
            console.log(`📂 Sale ID: ${saleId}, Discount Code: ${discountCode}`);

            // Get sale details
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .select(`
                    *,
                    sale_items (
                        id,
                        product_id,
                        product_name,
                        quantity,
                        unit_price,
                        total_price
                    )
                `)
                .eq('id', saleId)
                .single();

            if (saleError) {
                console.error('❌ Sale error:', saleError);
                throw new Error('Sale not found');
            }

            // Get active discounts
            const activeDiscounts = await this.getActiveDiscounts();

            if (activeDiscounts.length === 0) {
                return {
                    discount_amount: 0,
                    discounted_items: [],
                    message: 'No active discounts available'
                };
            }

            let totalDiscount = 0;
            const discountedItems = [];

            // Process each sale item
            for (const item of sale.sale_items) {
                let itemDiscount = 0;
                let appliedDiscount = null;

                // Check each discount
                for (const discount of activeDiscounts) {
                    // Check if discount applies to this product
                    const applies = await this.discountAppliesToProduct(discount.id, item.product_id);
                    
                    if (applies) {
                        // Check minimum purchase
                        if (sale.subtotal >= (discount.min_purchase || 0)) {
                            // Calculate discount
                            let discountAmount = 0;
                            if (discount.discount_type === 'percentage') {
                                discountAmount = (item.total_price * discount.discount_value) / 100;
                            } else {
                                discountAmount = Math.min(discount.discount_value, discount.max_discount || Infinity);
                            }

                            // Apply max discount limit
                            if (discount.max_discount && discountAmount > discount.max_discount) {
                                discountAmount = discount.max_discount;
                            }

                            if (discountAmount > itemDiscount) {
                                itemDiscount = discountAmount;
                                appliedDiscount = discount;
                            }
                        }
                    }
                }

                if (itemDiscount > 0) {
                    totalDiscount += itemDiscount;
                    discountedItems.push({
                        sale_item_id: item.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        original_price: item.total_price,
                        discount_amount: itemDiscount,
                        discount_percentage: appliedDiscount ? 
                            (itemDiscount / item.total_price) * 100 : 0,
                        applied_discount_id: appliedDiscount?.id || null
                    });
                }
            }

            return {
                discount_amount: totalDiscount,
                discounted_items: discountedItems,
                total_before_discount: sale.subtotal,
                total_after_discount: sale.subtotal - totalDiscount
            };
        } catch (error) {
            console.error('🔥 calculateDiscount error:', error);
            logger.error(`Calculate discount error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Apply discount to a sale
     */
    async applyDiscount(saleId, discountCode = null) {
        try {
            console.log('📂📂📂 applyDiscount called 📂📂📂');

            const result = await this.calculateDiscount(saleId, discountCode);

            if (result.discount_amount > 0) {
                // Update the sale with discount
                const { data: updatedSale, error: updateError } = await supabase
                    .from('sales')
                    .update({
                        discount: result.discount_amount,
                        total: result.total_after_discount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', saleId)
                    .select()
                    .single();

                if (updateError) {
                    console.error('❌ Update sale error:', updateError);
                    throw new Error('Failed to update sale with discount');
                }

                // Log discount usage
                for (const item of result.discounted_items) {
                    if (item.applied_discount_id) {
                        await supabase
                            .from('discount_usage')
                            .insert([{
                                discount_id: item.applied_discount_id,
                                sale_id: saleId,
                                sale_item_id: item.sale_item_id,
                                discount_amount: item.discount_amount,
                                applied_at: new Date().toISOString()
                            }]);
                    }
                }

                return {
                    success: true,
                    sale: updatedSale,
                    discount_applied: result.discount_amount,
                    discounted_items: result.discounted_items
                };
            }

            return {
                success: false,
                message: 'No applicable discounts found',
                discount_applied: 0
            };
        } catch (error) {
            console.error('🔥 applyDiscount error:', error);
            logger.error(`Apply discount error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if discount applies to a product
     */
    async discountAppliesToProduct(discountId, productId) {
        try {
            const { data, error } = await supabase
                .from('discount_products')
                .select('*')
                .eq('discount_id', discountId)
                .or(`product_id.eq.${productId},category_id.in(select category_id from products where id = '${productId}')`);

            if (error) {
                console.error('❌ discountAppliesToProduct error:', error);
                return false;
            }

            return data && data.length > 0;
        } catch (error) {
            console.error('🔥 discountAppliesToProduct error:', error);
            return false;
        }
    }

    /**
     * Get discount usage report
     */
    async getDiscountUsageReport(startDate, endDate) {
        try {
            console.log('📂📂📂 getDiscountUsageReport called 📂📂📂');

            const { data, error } = await supabase
                .from('discount_usage')
                .select(`
                    *,
                    discount:discount_id (
                        id,
                        name,
                        discount_type,
                        discount_value
                    ),
                    sale:sale_id (
                        id,
                        receipt_number,
                        sale_date,
                        customer_name
                    )
                `)
                .gte('applied_at', startDate.toISOString())
                .lte('applied_at', endDate.toISOString())
                .order('applied_at', { ascending: false });

            if (error) {
                console.error('❌ getDiscountUsageReport error:', error);
                throw error;
            }

            // Calculate totals
            const totalDiscountAmount = data.reduce((sum, item) => sum + item.discount_amount, 0);
            const totalUsageCount = data.length;

            // Group by discount
            const discountBreakdown = {};
            data.forEach(item => {
                const key = item.discount_id;
                if (!discountBreakdown[key]) {
                    discountBreakdown[key] = {
                        discount_id: key,
                        discount_name: item.discount?.name || 'Unknown',
                        usage_count: 0,
                        total_discount_amount: 0
                    };
                }
                discountBreakdown[key].usage_count++;
                discountBreakdown[key].total_discount_amount += item.discount_amount;
            });

            return {
                total_discount_amount: totalDiscountAmount,
                total_usage_count: totalUsageCount,
                discount_breakdown: Object.values(discountBreakdown),
                usage_details: data
            };
        } catch (error) {
            console.error('🔥 getDiscountUsageReport error:', error);
            logger.error(`Get discount usage report error: ${error.message}`);
            throw error;
        }
    }
}

export default new DiscountService();