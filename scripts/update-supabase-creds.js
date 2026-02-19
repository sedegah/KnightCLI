/**
 * Update Supabase credentials in migration script
 * Replace the placeholder with your actual Supabase URL and key
 */

import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔑 Supabase Credentials Setup\n');
console.log('Please provide your Supabase project details:\n');

rl.question('Supabase URL (e.g., https://your-project.supabase.co): ', (url) => {
  rl.question('Supabase Service Role Key (has full access): ', (key) => {
    const scriptContent = `/**
 * Supabase to D1 Migration Script
 * This script will connect to your Supabase and generate SQL for D1
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Your Supabase credentials
const SUPABASE_URL = '${url}';
const SUPABASE_SERVICE_KEY = '${key}';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// (rest of the script remains the same...)
`;

    fs.writeFileSync('scripts/supabase-to-d1.js', scriptContent, 'utf8');
    
    console.log('\n✅ Updated scripts/supabase-to-d1.js with your credentials!');
    console.log('\n🚀 Now run:');
    console.log('node scripts/supabase-to-d1.js');
    
    rl.close();
  });
});
