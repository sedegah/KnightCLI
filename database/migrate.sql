-- I-Crush Quiz Game Database Migration Script
-- Run this script to initialize your D1 database

-- Create tables and insert sample data
-- Execute: npx wrangler d1 execute --local --file=./database/schema.sql
-- Then: npx wrangler d1 execute --local --file=./database/sample_questions.sql

-- Verify setup
-- You can check your database with:
-- npx wrangler d1 execute --local --command="SELECT COUNT(*) FROM questions;"

-- Sample user creation test
-- INSERT INTO users (telegram_id, username, full_name, ap, pp, weekly_points, total_ap, total_pp, streak, last_played_date, subscription_status, total_questions, correct_answers, referral_code, referred_by, is_banned, suspicious_flags) 
-- VALUES (5715661449, 'sedegah', 'Sedegah Kimathi', 0, 0, 0, 0, 0, '2026-02-19', 'free', NULL, 0, 0, NULL, NULL, FALSE, '[]');

-- Check tables exist
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'questions', 'user_attempts', 'leaderboard_cache', 'referrals', 'active_questions');
