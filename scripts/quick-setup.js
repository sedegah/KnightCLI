/**
 * Quick Setup - Get I-Crush working with sample data
 * This bypasses Supabase migration for now
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🚀 Quick Setup for I-Crush Quiz Bot\n');

try {
  // 1. Fix wrangler.toml encoding
  console.log('🔧 Fixing wrangler.toml...');
  const wranglerConfig = `name = "icrush-quiz-game"
main = "src/index.js"
compatibility_date = "2024-03-21"

[[d1_databases]]
binding = "GNEX_D1"
database_name = "icrush-quiz-db"
database_id = "752a111e-1154-4a5b-9854-7784320dc6db"

[env.production]
name = "icrush-quiz-game"
vars = { ENVIRONMENT = "production" }

[env.production.d1_databases]
GNEX_D1_PREVIEW = false`;
  
  fs.writeFileSync('wrangler.toml', wranglerConfig, 'utf8');
  console.log('✅ Fixed wrangler.toml');
  
  // 2. Create database schema
  console.log('📋 Creating database schema...');
  execSync('npx wrangler d1 execute icrush-quiz-db --file=./database/schema.sql', { stdio: 'inherit' });
  
  // 3. Add sample questions
  console.log('📚 Adding sample Ghana questions...');
  execSync('npx wrangler d1 execute icrush-quiz-db --file=./database/sample_questions.sql', { stdio: 'inherit' });
  
  // 4. Verify setup
  console.log('✅ Verifying database...');
  const result = execSync('npx wrangler d1 execute icrush-quiz-db --command="SELECT COUNT(*) as question_count FROM questions;"', { encoding: 'utf8' });
  console.log(result);
  
  // 5. Deploy
  console.log('🚀 Deploying bot...');
  execSync('npm run deploy', { stdio: 'inherit' });
  
  console.log('\n🎉 Quick setup complete!');
  console.log('\n📱 Your bot is now live with sample Ghana questions!');
  console.log('\n📋 To add your Supabase data later:');
  console.log('1. Run: node scripts/update-supabase-creds.js');
  console.log('2. Run: node scripts/supabase-to-d1.js');
  console.log('3. Run: npx wrangler d1 execute icrush-quiz-db --file=./database/supabase-migration.sql');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('\n📋 Manual steps:');
  console.log('1. Make sure wrangler is installed and you\'re logged in');
  console.log('2. Check your D1 database ID in wrangler.toml');
  console.log('3. Try running commands individually');
}
