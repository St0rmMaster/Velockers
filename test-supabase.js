
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

async function testConnection() {
  console.log('Attempting to connect to Supabase...');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined.');
    console.error('Please ensure you have a .env file in the exce1sior-configurator directory with these variables.');
    return;
  }

  console.log('Supabase URL found:', supabaseUrl.substring(0, 20) + '...');

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    console.log('Supabase client created. Fetching data from "dealers" table...');

    // Let's try to fetch one record from a table we know exists from the code
    const { data, error } = await supabase
      .from('dealers')
      .select('id, name')
      .limit(1);

    if (error) {
      console.error('\n--- Supabase Connection Test FAILED ---');
      console.error('Error details:', error.message);
      if (error.details) console.error('Details:', error.details);
      if (error.hint) console.error('Hint:', error.hint);
    } else {
      console.log('\n--- Supabase Connection Test SUCCESSFUL ---');
      console.log('Successfully fetched data:', data);
    }

  } catch (e) {
    console.error('\n--- Supabase Connection Test FAILED ---');
    console.error('A critical error occurred:', e.message);
  }
}

testConnection();
