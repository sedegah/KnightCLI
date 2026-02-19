/**
 * Supabase to D1 Migration Script
 * This script will connect to your Supabase and generate SQL for D1
 */

// Instructions:
// 1. Install: npm install @supabase/supabase-js
// 2. Update your Supabase credentials below
// 3. Run: node scripts/supabase-to-d1.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function exportUsers() {
  console.log('📥 Exporting users...');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) {
      console.error('❌ Error:', error);
      return '';
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ No users found');
      return '';
    }
    
    let sql = '-- Users data from Supabase\n';
    sql += 'INSERT OR REPLACE INTO users (id, telegram_id, username, full_name, ap, pp, weekly_points, total_ap, total_pp, streak, last_played_date, subscription_status, subscription_expires, total_questions, correct_answers, referral_code, referred_by, is_banned, suspicious_flags, created_at, updated_at) VALUES\n';
    
    const values = data.map(user => {
      return `  ('${user.id}', ${user.telegram_id}, '${user.username}', '${user.full_name}', ${user.ap || 0}, ${user.pp || 0}, ${user.weekly_points || 0}, ${user.total_ap || 0}, ${user.total_pp || 0}, ${user.streak || 0}, '${user.last_played_date || ''}', '${user.subscription_status || 'free'}', ${user.subscription_expires ? `'${user.subscription_expires}'` : 'NULL'}, ${user.total_questions || 0}, ${user.correct_answers || 0}, ${user.referral_code ? `'${user.referral_code}'` : 'NULL'}, ${user.referred_by ? `'${user.referred_by}'` : 'NULL'}, ${user.is_banned ? 'TRUE' : 'FALSE'}, '${JSON.stringify(user.suspicious_flags || [])}', '${user.created_at || ''}', '${user.updated_at || ''}')`;
    });
    
    sql += values.join(',\n') + ';\n\n';
    
    console.log(`✅ Exported ${data.length} users`);
    return sql;
  } catch (error) {
    console.error('❌ Error exporting users:', error);
    return '';
  }
}

async function exportQuestions() {
  console.log('📥 Exporting questions...');
  
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*');
    
    if (error) {
      console.error('❌ Error:', error);
      return '';
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ No questions found');
      return '';
    }
    
    let sql = '-- Questions data from Supabase\n';
    sql += 'INSERT OR REPLACE INTO questions (id, question, option_a, option_b, option_c, option_d, correct, category, difficulty, points, is_active, created_at, updated_at) VALUES\n';
    
    const values = data.map(q => {
      // Handle null/undefined values
      const question = (q.question || '').replace(/'/g, "''");
      const optionA = (q.option_a || q.optionA || '').replace(/'/g, "''");
      const optionB = (q.option_b || q.optionB || '').replace(/'/g, "''");
      const optionC = (q.option_c || q.optionC || '').replace(/'/g, "''");
      const optionD = (q.option_d || q.optionD || '').replace(/'/g, "''");
      
      return `  ('${q.id}', '${question}', '${optionA}', '${optionB}', '${optionC}', '${optionD}', ${q.correct || q.answer || 0}, '${q.category || 'general'}', '${q.difficulty || 'medium'}', ${q.points || 10}, ${q.is_active !== false ? 'TRUE' : 'FALSE'}, '${q.created_at || ''}', '${q.updated_at || ''}')`;
    });
    
    sql += values.join(',\n') + ';\n\n';
    
    console.log(`✅ Exported ${data.length} questions`);
    return sql;
  } catch (error) {
    console.error('❌ Error exporting questions:', error);
    return '';
  }
}

async function exportAttempts() {
  console.log('📥 Exporting user attempts...');
  
  try {
    // Try different table names
    let { data, error } = await supabase
      .from('attempts')
      .select('*')
      .limit(1000);
    
    // If that fails, try user_attempts
    if (error && error.code === 'PGRST205') {
      console.log('  Trying "user_attempts" table...');
      const result = await supabase
        .from('user_attempts')
        .select('*')
        .limit(1000);
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      console.error('❌ Error:', error);
      return '';
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ No attempts found');
      return '';
    }
    
    let sql = '-- User attempts data from Supabase\n';
    sql += 'INSERT OR REPLACE INTO user_attempts (id, telegram_id, question_id, selected_option, is_correct, attempt_number, points_earned, speed_bonus, streak_bonus, attempted_at) VALUES\n';
    
    const values = data.map(attempt => {
      return `  ('${attempt.id}', ${attempt.telegram_id}, '${attempt.question_id}', '${attempt.selected_option}', ${attempt.is_correct ? 'TRUE' : 'FALSE'}, ${attempt.attempt_number || 1}, ${attempt.points_earned || 0}, ${attempt.speed_bonus || 0}, ${attempt.streak_bonus || 0}, '${attempt.attempted_at || ''}')`;
    });
    
    sql += values.join(',\n') + ';\n\n';
    
    console.log(`✅ Exported ${data.length} attempts`);
    return sql;
  } catch (error) {
    console.error('❌ Error exporting attempts:', error);
    return '';
  }
}

async function exportReferrals() {
  console.log('📥 Exporting referrals...');
  
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*');
    
    if (error) {
      console.error('❌ Error:', error);
      return '';
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ No referrals found');
      return '';
    }
    
    let sql = '-- Referrals data from Supabase\n';
    sql += 'INSERT OR REPLACE INTO referrals (id, referrer_telegram_id, referred_telegram_id, referral_code, status, created_at) VALUES\n';
    
    const values = data.map(ref => {
      return `  ('${ref.id}', ${ref.referrer_telegram_id}, ${ref.referred_telegram_id}, '${ref.referral_code}', '${ref.status || 'pending'}', '${ref.created_at || ''}')`;
    });
    
    sql += values.join(',\n') + ';\n\n';
    
    console.log(`✅ Exported ${data.length} referrals`);
    return sql;
  } catch (error) {
    console.error('❌ Error exporting referrals:', error);
    return '';
  }
}

async function main() {
  console.log('🚀 Supabase to D1 Migration Script\n');
  console.log('⚠️  Make sure to update SUPABASE_URL and SUPABASE_KEY in this script!\n');
  
  // Create database directory
  if (!fs.existsSync('database')) {
    fs.mkdirSync('database');
  }
  
  let allSQL = '-- I-Crush Quiz Game - Supabase to D1 Migration\n';
  allSQL += '-- Generated on: ' + new Date().toISOString() + '\n\n';
  
  // Export all tables
  allSQL += await exportUsers();
  allSQL += await exportQuestions();
  allSQL += await exportAttempts();
  allSQL += await exportReferrals();
  
  // Write to file
  fs.writeFileSync('database/supabase-migration.sql', allSQL, 'utf8');
  
  console.log('\n✅ Migration complete!');
  console.log('📄 Data saved to: database/supabase-migration.sql');
  console.log('\n📋 Next steps:');
  console.log('1. Update your Supabase credentials in this script');
  console.log('2. Run: node scripts/supabase-to-d1.js');
  console.log('3. Run: npx wrangler d1 execute --local --file=./database/schema.sql');
  console.log('4. Run: npx wrangler d1 execute --local --file=./database/supabase-migration.sql');
  console.log('5. Update your code to use D1 instead of KV');
  console.log('6. Deploy: npm run deploy');
}

main().catch(console.error);
