/**
 * D1 Database Schema
 * 
 * Run this with: wrangler d1 execute gnex-db --file=./src/database/schema.sql
 */

-- ==========================================
-- USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL,
  
  -- Points
  ap INTEGER DEFAULT 0,
  total_ap INTEGER DEFAULT 0,
  pp INTEGER DEFAULT 0,
  weekly_points INTEGER DEFAULT 0,
  
  -- Streak
  streak INTEGER DEFAULT 0,
  last_played_date TEXT,
  
  -- Subscription
  subscription_status TEXT DEFAULT 'free',
  subscription_expires TEXT,
  
  -- Stats
  total_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  
  -- Referral
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  
  -- Security
  is_banned INTEGER DEFAULT 0,
  suspicious_flags INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_weekly_points ON users(weekly_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_status, subscription_expires);

-- ==========================================
-- QUESTIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS questions (
  question_id TEXT PRIMARY KEY,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL,
  
  -- Metadata
  category TEXT,
  difficulty TEXT DEFAULT 'medium',
  time_limit_seconds INTEGER DEFAULT 30,
  
  -- Stats
  times_asked INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  
  -- Status
  is_active INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(is_active);

-- ==========================================
-- ATTEMPTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS attempts (
  attempt_id TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  
  -- Answer data
  selected_option TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  response_time_seconds REAL NOT NULL,
  
  -- Points
  points_awarded INTEGER DEFAULT 0,
  point_type TEXT NOT NULL,
  attempt_number INTEGER DEFAULT 1,
  
  -- Timestamp
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),
  FOREIGN KEY (question_id) REFERENCES questions(question_id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(telegram_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created_at);

-- ==========================================
-- REFERRALS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_telegram_id INTEGER NOT NULL,
  referred_telegram_id INTEGER NOT NULL,
  referral_code TEXT NOT NULL,
  bonus_awarded INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (referrer_telegram_id) REFERENCES users(telegram_id),
  FOREIGN KEY (referred_telegram_id) REFERENCES users(telegram_id),
  
  UNIQUE(referrer_telegram_id, referred_telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_telegram_id);

-- ==========================================
-- SQUADS TABLE (for squad mode)
-- ==========================================
CREATE TABLE IF NOT EXISTS squads (
  squad_id TEXT PRIMARY KEY,
  squad_name TEXT NOT NULL,
  leader_telegram_id INTEGER NOT NULL,
  
  -- Stats
  total_members INTEGER DEFAULT 1,
  total_points INTEGER DEFAULT 0,
  weekly_points INTEGER DEFAULT 0,
  
  -- Settings
  max_members INTEGER DEFAULT 10,
  is_public INTEGER DEFAULT 1,
  invite_code TEXT UNIQUE,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (leader_telegram_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_squads_weekly_points ON squads(weekly_points DESC);

-- ==========================================
-- SQUAD_MEMBERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS squad_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  squad_id TEXT NOT NULL,
  telegram_id INTEGER NOT NULL,
  joined_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (squad_id) REFERENCES squads(squad_id),
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),
  
  UNIQUE(squad_id, telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(telegram_id);

-- ==========================================
-- PARTNERSHIPS TABLE (for duo mode)
-- ==========================================
CREATE TABLE IF NOT EXISTS partnerships (
  partnership_id TEXT PRIMARY KEY,
  player1_telegram_id INTEGER NOT NULL,
  player2_telegram_id INTEGER NOT NULL,
  
  -- Stats
  total_points INTEGER DEFAULT 0,
  weekly_points INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  
  -- Status
  is_active INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (player1_telegram_id) REFERENCES users(telegram_id),
  FOREIGN KEY (player2_telegram_id) REFERENCES users(telegram_id),
  
  CHECK(player1_telegram_id < player2_telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_partnerships_weekly ON partnerships(weekly_points DESC);

-- ==========================================
-- BATTLES TABLE (for 1v1 mode)
-- ==========================================
CREATE TABLE IF NOT EXISTS battles (
  battle_id TEXT PRIMARY KEY,
  challenger_telegram_id INTEGER NOT NULL,
  opponent_telegram_id INTEGER NOT NULL,
  
  -- Scores
  challenger_score INTEGER DEFAULT 0,
  opponent_score INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, active, completed, cancelled
  winner_telegram_id INTEGER,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  
  FOREIGN KEY (challenger_telegram_id) REFERENCES users(telegram_id),
  FOREIGN KEY (opponent_telegram_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_battles_challenger ON battles(challenger_telegram_id);
CREATE INDEX IF NOT EXISTS idx_battles_opponent ON battles(opponent_telegram_id);
CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);

-- ==========================================
-- REWARDS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS rewards (
  reward_id TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL,
  
  -- Reward details
  reward_type TEXT NOT NULL, -- cash, subscription, data
  amount TEXT,
  description TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, claimed, fulfilled
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  claimed_at TEXT,
  fulfilled_at TEXT,
  
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_rewards_user ON rewards(telegram_id);
CREATE INDEX IF NOT EXISTS idx_rewards_status ON rewards(status);
