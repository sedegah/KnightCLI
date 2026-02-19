/**
 * Setup D1 Database for I-Crush Quiz Game
 * Run this script to initialize your database
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🚀 Setting up I-Crush Quiz Database...\n');

// Check if database directory exists
if (!fs.existsSync('database')) {
  fs.mkdirSync('database');
  console.log('📁 Created database directory');
}

try {
  // 1. Create schema
  console.log('📋 Creating database schema...');
  execSync('npx wrangler d1 execute icrush-quiz-db --file=./database/schema.sql', { stdio: 'inherit' });
  
  // 2. Check if we have Supabase migration data
  if (fs.existsSync('database/supabase-migration.sql')) {
    console.log('📥 Importing Supabase data...');
    execSync('npx wrangler d1 execute icrush-quiz-db --file=./database/supabase-migration.sql', { stdio: 'inherit' });
  } else {
    console.log('⚠️  No Supabase migration data found. Using sample questions...');
    execSync('npx wrangler d1 execute icrush-quiz-db --file=./database/sample_questions.sql', { stdio: 'inherit' });
  }
  
  // 3. Verify setup
  console.log('✅ Verifying database setup...');
  const result = execSync('npx wrangler d1 execute icrush-quiz-db --command="SELECT COUNT(*) as user_count FROM users; SELECT COUNT(*) as question_count FROM questions;"', { encoding: 'utf8' });
  console.log(result);
  
  console.log('\n🎉 Database setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. If you haven\'t migrated from Supabase, run:');
  console.log('   npm install @supabase/supabase-js');
  console.log('   node scripts/supabase-to-d1.js');
  console.log('2. Deploy your bot: npm run deploy');
  
} catch (error) {
  console.error('❌ Error setting up database:', error.message);
  console.log('\n📋 Troubleshooting:');
  console.log('1. Make sure you have wrangler installed: npm install -g wrangler');
  console.log('2. Make sure you\'re logged in: npx wrangler auth login');
  console.log('3. Check your wrangler.toml configuration');
}
