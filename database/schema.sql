-- I-Crush Quiz Game Database Schema
-- Cloudflare D1 SQL Database

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT NOT NULL,
    full_name TEXT NOT NULL,
    ap INTEGER DEFAULT 0,
    pp INTEGER DEFAULT 0,
    weekly_points INTEGER DEFAULT 0,
    total_ap INTEGER DEFAULT 0,
    total_pp INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_played_date TEXT,
    subscription_status TEXT DEFAULT 'free',
    subscription_expires TEXT,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    referral_code TEXT,
    referred_by TEXT,
    is_banned BOOLEAN DEFAULT FALSE,
    suspicious_flags TEXT DEFAULT '[]',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct INTEGER NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    points INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User attempts table (for rate limiting)
CREATE TABLE IF NOT EXISTS user_attempts (
    id TEXT PRIMARY KEY,
    telegram_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    selected_option TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    attempt_number INTEGER NOT NULL,
    points_earned INTEGER DEFAULT 0,
    speed_bonus INTEGER DEFAULT 0,
    streak_bonus INTEGER DEFAULT 0,
    attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

-- Leaderboard cache table
CREATE TABLE IF NOT EXISTS leaderboard_cache (
    id TEXT PRIMARY KEY,
    telegram_id INTEGER NOT NULL,
    weekly_points INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_telegram_id INTEGER NOT NULL,
    referred_telegram_id INTEGER NOT NULL,
    referral_code TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_telegram_id) REFERENCES users(telegram_id),
    FOREIGN KEY (referred_telegram_id) REFERENCES users(telegram_id)
);

-- Active questions cache table
CREATE TABLE IF NOT EXISTS active_questions (
    id TEXT PRIMARY KEY,
    telegram_id INTEGER NOT NULL,
    question_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    attempt_number INTEGER DEFAULT 1,
    is_prize_round BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_user_attempts_telegram_id ON user_attempts(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_attempts_created_at ON user_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_weekly_points ON leaderboard_cache(weekly_points);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_telegram_id);
