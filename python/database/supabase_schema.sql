-- Supabase Database Schema for Knight Quiz Bot
-- Run this SQL in your Supabase SQL Editor to create all necessary tables

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== USERS TABLE =====
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT NOT NULL DEFAULT '',
    full_name TEXT NOT NULL DEFAULT '',
    ap INTEGER DEFAULT 0,
    total_ap INTEGER DEFAULT 0,
    pp INTEGER DEFAULT 0,
    weekly_points INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_played_date TEXT,
    subscription_status TEXT DEFAULT 'free',
    subscription_expires TEXT,
    streak_freezes_remaining INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    referral_code TEXT DEFAULT '',
    referred_by TEXT DEFAULT '',
    is_banned BOOLEAN DEFAULT FALSE,
    suspicious_flags INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Backward-compatible migration for existing deployments
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_ap INTEGER DEFAULT 0;

-- Create index on telegram_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_ap ON users(ap DESC);
CREATE INDEX IF NOT EXISTS idx_users_total_ap ON users(total_ap DESC);
CREATE INDEX IF NOT EXISTS idx_users_weekly_points ON users(weekly_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- ===== QUESTIONS TABLE =====
CREATE TABLE IF NOT EXISTS questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question_id TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    question_text TEXT NOT NULL,
    image_url TEXT,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL,
    explanation TEXT DEFAULT '',
    difficulty TEXT DEFAULT 'medium',
    tags TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for questions
CREATE INDEX IF NOT EXISTS idx_questions_question_id ON questions(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- ===== ATTEMPTS TABLE =====
CREATE TABLE IF NOT EXISTS attempts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    question_id TEXT NOT NULL,
    selected_option TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    time_taken INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Create indexes for attempts
CREATE INDEX IF NOT EXISTS idx_attempts_telegram_id ON attempts(telegram_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question_id ON attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_timestamp ON attempts(timestamp DESC);

-- ===== REFERRALS TABLE =====
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    referrer_id BIGINT NOT NULL,
    referred_id BIGINT NOT NULL,
    referral_code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reward_claimed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (referrer_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
    FOREIGN KEY (referred_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
    UNIQUE(referrer_id, referred_id)
);

-- Create indexes for referrals
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- ===== LEADERBOARD VIEW =====
-- Create a materialized view for faster leaderboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_cache AS
SELECT 
    telegram_id,
    username,
    full_name,
    ap,
    pp,
    weekly_points,
    streak,
    total_questions,
    correct_answers,
    CASE 
        WHEN total_questions > 0 
        THEN ROUND((correct_answers::NUMERIC / total_questions::NUMERIC) * 100, 1)
        ELSE 0 
    END as accuracy
FROM users
WHERE is_banned = FALSE
ORDER BY ap DESC;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_ap ON leaderboard_cache(ap DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_weekly ON leaderboard_cache(weekly_points DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_cache_telegram_id ON leaderboard_cache(telegram_id);

-- ===== FUNCTIONS =====

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to update updated_at automatically
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at 
    BEFORE UPDATE ON questions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to refresh leaderboard cache
CREATE OR REPLACE FUNCTION refresh_leaderboard_cache()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_cache;
END;
$$ LANGUAGE plpgsql;

-- Function to rollover AP at week end (Sunday 23:59 in scheduler timezone)
CREATE OR REPLACE FUNCTION rollover_weekly_ap()
RETURNS void AS $$
BEGIN
    UPDATE users
    SET total_ap = COALESCE(total_ap, 0) + COALESCE(ap, 0),
        ap = 0,
        weekly_points = 0;
END;
$$ LANGUAGE plpgsql;

-- ===== ROW LEVEL SECURITY (RLS) =====
-- Enable RLS on all tables for additional security

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (your bot)
-- These policies allow full access when using the service role key

/*
DROP POLICY IF EXISTS "Enable all access for service role" ON users;
DROP POLICY IF EXISTS "Enable all access for service role" ON questions;
DROP POLICY IF EXISTS "Enable all access for service role" ON attempts;
DROP POLICY IF EXISTS "Enable all access for service role" ON referrals;

CREATE POLICY "Service role full access" ON users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON questions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON attempts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON referrals
    FOR ALL USING (auth.role() = 'service_role');

REVOKE ALL ON TABLE leaderboard_cache FROM anon, authenticated;
GRANT SELECT ON TABLE leaderboard_cache TO service_role;
*/

-- ===== SAMPLE DATA (Optional) =====
-- Uncomment to insert sample admin user
/*
INSERT INTO users (telegram_id, username, full_name, ap, pp, subscription_status)
VALUES (123456789, 'admin', 'Admin User', 0, 0, 'free')
ON CONFLICT (telegram_id) DO NOTHING;
*/

-- ===== HELPFUL QUERIES =====

-- To manually refresh leaderboard cache:
-- SELECT refresh_leaderboard_cache();

-- To rollover AP + reset weekly counters:
-- SELECT rollover_weekly_ap();

-- To view top 10 users by all-time points:
-- SELECT * FROM leaderboard_cache ORDER BY ap DESC LIMIT 10;

-- To view top 10 users by weekly points:
-- SELECT * FROM leaderboard_cache ORDER BY weekly_points DESC LIMIT 10;

-- To check database size:
-- SELECT pg_size_pretty(pg_database_size(current_database()));

-- To check table sizes:
-- SELECT 
--     tablename,
--     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
