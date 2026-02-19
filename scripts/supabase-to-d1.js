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

// UPDATE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// OR use service role key for full access
const SUPABASE_SERVICE_KEY = 'your-service-role-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);

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
      return `  ('${q.id}', '${q.question.replace(/'/g, "''")}', '${q.option_a.replace(/'/g, "''")}', '${q.option_b.replace(/'/g, "''")}', '${q.option_c.replace(/'/g, "''")}', '${q.option_d.replace(/'/g, "''")}', ${q.correct}, '${q.category}', '${q.difficulty}', ${q.points}, ${q.is_active ? 'TRUE' : 'FALSE'}, '${q.created_at || ''}', '${q.updated_at || ''}')`;
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
    const { data, error } = await supabase
      .from('user_attempts')
      .select('*')
      .limit(1000); // Limit to prevent huge exports
    
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
      return `  ('${attempt.id}', ${attempt.telegram_id}, '${attempt.question_id}', '${attempt.selected_option}', ${attempt.is_correct ? 'TRUE' : 'FALSE'}, ${attempt.attempt_number}, ${attempt.points_earned || 0}, ${attempt.speed_bonus || 0}, ${attempt.streak_bonus || 0}, '${attempt.attempted_at || ''}')`;
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
