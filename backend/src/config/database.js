import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Supabase Database Connection
 */

// Get credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate credentials but DON'T crash the server
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file!');
    console.error('Please check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    console.error('⚠️ Server will continue but database features will not work');
    // Remove: process.exit(1);
}

// Create the Supabase client
const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Test the connection
async function testConnection() {
    try {
        if (!supabaseUrl || !supabaseKey) {
            console.warn('⚠️ Supabase credentials missing, skipping connection test');
            return false;
        }
        
        const { data, error } = await supabase
            .from('products')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        console.log('✅ Supabase connected successfully!');
        return true;
    } catch (error) {
        console.error('❌ Failed to connect to Supabase:', error.message);
        return false;
    }
}

export { supabase, testConnection };