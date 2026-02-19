/**
 * Pull data from Supabase database
 * Run this script to export your existing Supabase data
 */

// You'll need to install: npm install @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Your Supabase credentials - replace with your actual values
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-supabase-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function exportTable(tableName, fileName) {
  console.log(`📥 Exporting ${tableName}...`);
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.error(`❌ Error exporting ${tableName}:`, error);
      return null;
    }
    
    if (data && data.length > 0) {
      const sqlData = convertToSQL(tableName, data);
      const filePath = path.join('database', `${fileName}.sql`);
      
      fs.writeFileSync(filePath, sqlData, 'utf8');
      console.log(`✅ Exported ${data.length} records to ${filePath}`);
      
      return data;
    } else {
      console.log(`⚠️ No data found in ${tableName}`);
      return [];
    }
  } catch (error) {
    console.error(`❌ Error exporting ${tableName}:`, error);
    return null;
  }
}

function convertToSQL(tableName, data) {
  if (!data || data.length === 0) return '';
  
  const columns = Object.keys(data[0]);
  const sqlStatements = [];
  
  data.forEach(record => {
    const values = columns.map(col => {
      const value = record[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
      return value;
    });
    
    sqlStatements.push(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
    );
  });
  
  return sqlStatements.join('\n');
}

async function main() {
  console.log('🚀 Starting Supabase data export...\n');
  
  // Create database directory if it doesn't exist
  if (!fs.existsSync('database')) {
    fs.mkdirSync('database');
  }
  
  // Export all tables
  const tables = [
    { name: 'users', file: 'users_data' },
    { name: 'questions', file: 'questions_data' },
    { name: 'user_attempts', file: 'attempts_data' },
    { name: 'referrals', file: 'referrals_data' },
    { name: 'leaderboard_cache', file: 'leaderboard_data' }
  ];
  
  for (const table of tables) {
    await exportTable(table.name, table.file);
  }
  
  console.log('\n✅ Data export complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Update SUPABASE_URL and SUPABASE_KEY in this script');
  console.log('2. Run: node scripts/pull-supabase-data.js');
  console.log('3. Run: npx wrangler d1 execute --local --file=./database/schema.sql');
  console.log('4. Run: npx wrangler d1 execute --local --file=./database/users_data.sql');
  console.log('5. Run: npx wrangler d1 execute --local --file=./database/questions_data.sql');
  console.log('6. Update your code to use D1 database');
  console.log('7. Deploy: npm run deploy');
}

main().catch(console.error);
