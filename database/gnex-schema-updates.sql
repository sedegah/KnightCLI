-- G-NEX Complete System Schema Updates
-- Add all tables and columns for the competitive quiz arena

-- ==========================================
-- USERS TABLE ENHANCEMENTS
-- ==========================================

-- Add new columns to existing users table
ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'Bronze' CHECK(tier IN ('Bronze', 'Silver', 'Gold', 'Diamond', 'Elite'));
ALTER TABLE users ADD COLUMN tier_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN streak_last_play TEXT DEFAULT NULL; -- ISO date string
ALTER TABLE users ADD COLUMN streak_protected INTEGER DEFAULT 0; -- boolean
ALTER TABLE users ADD COLUMN total_points INTEGER DEFAULT 0; -- Weekly rollover target
ALTER TABLE users ADD COLUMN battles_won INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN battles_lost INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN battles_total INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN data_earned_mb INTEGER DEFAULT 0; -- Total data earned in MB
ALTER TABLE users ADD COLUMN last_daily_reward TEXT DEFAULT NULL; -- ISO date string

-- ==========================================
-- 1v1 CHALLENGES SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenger_id INTEGER NOT NULL,
    challenged_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'active', 'completed', 'expired', 'cancelled')),
    challenge_type TEXT DEFAULT 'standard' CHECK(challenge_type IN ('standard', 'speed', 'streak')),
    
    -- Challenge configuration
    total_questions INTEGER DEFAULT 5,
    time_limit_seconds INTEGER DEFAULT 300, -- 5 minutes total
    
    -- Questions and answers
    questions_json TEXT, -- JSON array of question IDs
    challenger_answers TEXT, -- JSON array of answers
    challenged_answers TEXT, -- JSON array of answers
    
    -- Scoring
    challenger_score INTEGER DEFAULT 0,
    challenged_score INTEGER DEFAULT 0,
    challenger_time_taken INTEGER DEFAULT 0, -- seconds
    challenged_time_taken INTEGER DEFAULT 0, -- seconds
    winner_id INTEGER,
    
    -- Rewards
    points_awarded INTEGER DEFAULT 0,
    bonus_multiplier REAL DEFAULT 1.0,
    
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    accepted_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    expires_at TEXT DEFAULT (datetime('now', '+24 hours')),
    
    FOREIGN KEY (challenger_id) REFERENCES users(telegram_id),
    FOREIGN KEY (challenged_id) REFERENCES users(telegram_id),
    FOREIGN KEY (winner_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges(created_at);

-- ==========================================
-- PARTNER MODE SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS partnerships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('pending', 'active', 'dissolved')),
    
    -- Statistics
    total_points INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    dissolved_at TEXT,
    
    FOREIGN KEY (user1_id) REFERENCES users(telegram_id),
    FOREIGN KEY (user2_id) REFERENCES users(telegram_id),
    UNIQUE(user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_partnerships_user1 ON partnerships(user1_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_user2 ON partnerships(user2_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_status ON partnerships(status);

-- Partnership game sessions
CREATE TABLE IF NOT EXISTS partnership_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partnership_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    
    user1_answer TEXT,
    user2_answer TEXT,
    
    is_correct INTEGER DEFAULT 0, -- boolean
    points_earned INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (partnership_id) REFERENCES partnerships(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- ==========================================
-- SQUAD SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS squads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    creator_id INTEGER NOT NULL,
    
    -- Configuration
    max_members INTEGER DEFAULT 10,
    is_public INTEGER DEFAULT 1, -- boolean
    join_code TEXT UNIQUE, -- Optional join code
    
    -- Statistics
    total_points INTEGER DEFAULT 0,
    weekly_points INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    members_count INTEGER DEFAULT 1,
    rank INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (creator_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_squads_creator ON squads(creator_id);
CREATE INDEX IF NOT EXISTS idx_squads_rank ON squads(rank);
CREATE INDEX IF NOT EXISTS idx_squads_public ON squads(is_public);

CREATE TABLE IF NOT EXISTS squad_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    squad_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    role TEXT DEFAULT 'member' CHECK(role IN ('creator', 'admin', 'member')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'left', 'kicked')),
    
    -- Member statistics
    points_contributed INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    
    -- Timestamps
    joined_at TEXT DEFAULT (datetime('now')),
    left_at TEXT,
    
    FOREIGN KEY (squad_id) REFERENCES squads(id),
    FOREIGN KEY (user_id) REFERENCES users(telegram_id),
    UNIQUE(squad_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members(squad_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_user ON squad_members(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_status ON squad_members(status);

-- ==========================================
-- WALLET & TRANSACTIONS SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('earn_ap', 'earn_pp', 'spend_ap', 'spend_pp', 'reward', 'penalty', 'streak_bonus', 'referral_bonus', 'battle_reward')),
    
    amount INTEGER NOT NULL, -- Can be negative for spending
    point_type TEXT NOT NULL CHECK(point_type IN ('ap', 'pp')),
    
    description TEXT NOT NULL,
    
    -- Related entities
    related_question_id INTEGER,
    related_challenge_id INTEGER,
    related_user_id INTEGER, -- For referrals, battles, etc.
    
    -- Metadata
    metadata_json TEXT, -- Additional JSON data
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(telegram_id),
    FOREIGN KEY (related_question_id) REFERENCES questions(id),
    FOREIGN KEY (related_challenge_id) REFERENCES challenges(id),
    FOREIGN KEY (related_user_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- ==========================================
-- BATTLE HISTORY & ACHIEVEMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS battle_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    battle_type TEXT NOT NULL CHECK(battle_type IN ('1v1', 'partner', 'squad')),
    
    -- Participants
    winner_id INTEGER,
    loser_id INTEGER,
    
    -- Or for team battles
    winning_team_id INTEGER,
    losing_team_id INTEGER,
    
    -- Battle details
    questions_count INTEGER DEFAULT 5,
    winner_score INTEGER DEFAULT 0,
    loser_score INTEGER DEFAULT 0,
    
    points_awarded INTEGER DEFAULT 0,
    data_awarded_mb INTEGER DEFAULT 0,
    
    duration_seconds INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (winner_id) REFERENCES users(telegram_id),
    FOREIGN KEY (loser_id) REFERENCES users(telegram_id),
    FOREIGN KEY (winning_team_id) REFERENCES squads(id),
    FOREIGN KEY (losing_team_id) REFERENCES squads(id)
);

CREATE INDEX IF NOT EXISTS idx_battle_history_winner ON battle_history(winner_id);
CREATE INDEX IF NOT EXISTS idx_battle_history_loser ON battle_history(loser_id);
CREATE INDEX IF NOT EXISTS idx_battle_history_type ON battle_history(battle_type);

-- ==========================================
-- ACHIEVEMENTS & BADGES
-- ==========================================

CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    
    -- Requirements
    requirement_type TEXT NOT NULL CHECK(requirement_type IN ('streak', 'battles_won', 'questions_answered', 'points_earned', 'referrals', 'tier')),
    requirement_value INTEGER NOT NULL,
    
    -- Rewards
    reward_ap INTEGER DEFAULT 0,
    reward_pp INTEGER DEFAULT 0,
    reward_data_mb INTEGER DEFAULT 0,
    
    is_active INTEGER DEFAULT 1, -- boolean
    created_at TEXT DEFAULT (datetime('now'))
);

-- User achievements tracking
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    
    progress INTEGER DEFAULT 0,
    is_completed INTEGER DEFAULT 0, -- boolean
    is_claimed INTEGER DEFAULT 0, -- boolean
    
    completed_at TEXT,
    claimed_at TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(telegram_id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(id),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_completed ON user_achievements(is_completed);

-- ==========================================
-- DATA REWARDS SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS data_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    
    reward_type TEXT NOT NULL CHECK(reward_type IN ('daily', 'weekly', 'monthly', 'streak', 'battle', 'referral', 'prize_round')),
    
    amount_mb INTEGER NOT NULL,
    network TEXT CHECK(network IN ('MTN', 'Vodafone', 'AirtelTigo', 'GLO', 'Any')),
    
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'rejected', 'expired')),
    
    phone_number TEXT,
    
    -- Admin approval
    approved_by INTEGER, -- Admin telegram_id
    approved_at TEXT,
    paid_at TEXT,
    
    notes TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT DEFAULT (datetime('now', '+7 days')),
    
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_data_rewards_user ON data_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_data_rewards_status ON data_rewards(status);
CREATE INDEX IF NOT EXISTS idx_data_rewards_type ON data_rewards(reward_type);

-- ==========================================
-- TIER PROGRESSION HISTORY
-- ==========================================

CREATE TABLE IF NOT EXISTS tier_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    
    from_tier TEXT NOT NULL,
    to_tier TEXT NOT NULL,
    
    reason TEXT, -- 'promotion', 'demotion', 'manual'
    
    tier_points INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_tier_history_user ON tier_history(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_history_created_at ON tier_history(created_at);

-- ==========================================
-- WEEKLY ROLLOVER HISTORY
-- ==========================================

CREATE TABLE IF NOT EXISTS weekly_rollover_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    
    week_number INTEGER NOT NULL, -- Week of year
    year INTEGER NOT NULL,
    
    arena_points INTEGER DEFAULT 0,
    prize_points INTEGER DEFAULT 0,
    total_rolled INTEGER DEFAULT 0,
    
    games_played INTEGER DEFAULT 0,
    accuracy REAL DEFAULT 0.0,
    streak INTEGER DEFAULT 0,
    
    rollover_date TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_rollover_user ON weekly_rollover_history(user_id);
CREATE INDEX IF NOT EXISTS idx_rollover_week ON weekly_rollover_history(week_number, year);

-- ==========================================
-- PRESET ACHIEVEMENTS DATA
-- ==========================================

INSERT OR IGNORE INTO achievements (code, name, description, icon, requirement_type, requirement_value, reward_ap, reward_pp) VALUES
('first_win', 'First Victory', 'Win your first battle', '🏆', 'battles_won', 1, 10, 5),
('streak_3', '3-Day Warrior', 'Maintain a 3-day streak', '🔥', 'streak', 3, 50, 0),
('streak_7', 'Week Champion', 'Maintain a 7-day streak', '🔥', 'streak', 7, 150, 0),
('streak_14', 'Fortnight Master', 'Maintain a 14-day streak', '🔥', 'streak', 14, 300, 50),
('streak_30', 'Monthly Legend', 'Maintain a 30-day streak', '🔥', 'streak', 30, 1000, 100),
('questions_100', 'Century Club', 'Answer 100 questions', '💯', 'questions_answered', 100, 100, 0),
('questions_500', 'Quiz Master', 'Answer 500 questions', '🎓', 'questions_answered', 500, 500, 50),
('questions_1000', 'Knowledge King', 'Answer 1000 questions', '👑', 'questions_answered', 1000, 1500, 100),
('battles_10', 'Battle Veteran', 'Win 10 battles', '⚔️', 'battles_won', 10, 100, 20),
('battles_50', 'Battle Expert', 'Win 50 battles', '⚔️', 'battles_won', 50, 500, 100),
('referral_5', 'Friend Magnet', 'Refer 5 friends', '🤝', 'referrals', 5, 200, 50),
('referral_20', 'Ambassador', 'Refer 20 friends', '🤝', 'referrals', 20, 1000, 200),
('silver_tier', 'Silver Status', 'Reach Silver tier', '🥈', 'tier', 2, 0, 0),
('gold_tier', 'Gold Status', 'Reach Gold tier', '🥇', 'tier', 3, 0, 50),
('diamond_tier', 'Diamond Status', 'Reach Diamond tier', '💎', 'tier', 4, 0, 100),
('elite_tier', 'Elite Status', 'Reach Elite tier', '👑', 'tier', 5, 0, 200);
