-- Add ranking-specific columns to support 1v1, partnership, and squad rankings
-- These columns will help calculate and display rankings properly

-- ==========================================
-- USERS TABLE - 1v1 Battle Rankings
-- ==========================================

-- Add battle rating/ELO system
ALTER TABLE users ADD COLUMN battle_rating INTEGER DEFAULT 1000; -- ELO-style rating
ALTER TABLE users ADD COLUMN battle_rank INTEGER DEFAULT 0; -- Calculated rank position

-- Add 1v1 specific stats
ALTER TABLE users ADD COLUMN win_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN best_win_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN perfect_games INTEGER DEFAULT 0; -- 5/5 correct in battle

-- Add weekly battle stats (for weekly rankings)
ALTER TABLE users ADD COLUMN weekly_battles_won INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN weekly_battles_played INTEGER DEFAULT 0;

-- ==========================================
-- PARTNERSHIPS TABLE - Partnership Rankings
-- ==========================================

-- Add partnership ranking columns
ALTER TABLE partnerships ADD COLUMN weekly_points INTEGER DEFAULT 0;
ALTER TABLE partnerships ADD COLUMN best_score INTEGER DEFAULT 0;
ALTER TABLE partnerships ADD COLUMN partnership_rank INTEGER DEFAULT 0;
ALTER TABLE partnerships ADD COLUMN tier TEXT DEFAULT 'Bronze';

-- Add performance metrics
ALTER TABLE partnerships ADD COLUMN win_streak INTEGER DEFAULT 0;
ALTER TABLE partnerships ADD COLUMN best_win_streak INTEGER DEFAULT 0;
ALTER TABLE partnerships ADD COLUMN accuracy REAL DEFAULT 0.0;

-- ==========================================
-- SQUADS TABLE - Squad Rankings
-- ==========================================

-- Add squad ranking columns (already has weekly_points, but let's ensure others)
ALTER TABLE squads ADD COLUMN squad_tier TEXT DEFAULT 'Bronze' CHECK(squad_tier IN ('Bronze', 'Silver', 'Gold', 'Diamond', 'Elite'));
ALTER TABLE squads ADD COLUMN best_weekly_score INTEGER DEFAULT 0;
ALTER TABLE squads ADD COLUMN win_streak INTEGER DEFAULT 0;
ALTER TABLE squads ADD COLUMN total_battles INTEGER DEFAULT 0;
ALTER TABLE squads ADD COLUMN battles_won INTEGER DEFAULT 0;

-- Add squad performance metrics
ALTER TABLE squads ADD COLUMN average_member_points REAL DEFAULT 0.0;
ALTER TABLE squads ADD COLUMN active_members INTEGER DEFAULT 0;

-- ==========================================
-- SQUAD_MEMBERS TABLE - Member Contribution Tracking
-- ==========================================

-- Add member contribution stats for squad rankings
ALTER TABLE squad_members ADD COLUMN weekly_contribution INTEGER DEFAULT 0;
ALTER TABLE squad_members ADD COLUMN total_contribution INTEGER DEFAULT 0;
ALTER TABLE squad_members ADD COLUMN battles_participated INTEGER DEFAULT 0;
ALTER TABLE squad_members ADD COLUMN mvp_count INTEGER DEFAULT 0; -- Times being top contributor

-- ==========================================
-- CHALLENGES TABLE - Enhanced Battle Tracking
-- ==========================================

-- Add battle ranking impact
ALTER TABLE challenges ADD COLUMN rating_change_challenger INTEGER DEFAULT 0;
ALTER TABLE challenges ADD COLUMN rating_change_challenged INTEGER DEFAULT 0;

-- Add battle difficulty/importance
ALTER TABLE challenges ADD COLUMN battle_tier TEXT DEFAULT 'Bronze';
ALTER TABLE challenges ADD COLUMN is_ranked INTEGER DEFAULT 1; -- boolean, affects rankings

-- ==========================================
-- CREATE RANKING VIEWS FOR EFFICIENT QUERIES
-- ==========================================

-- View for 1v1 Battle Rankings
CREATE VIEW IF NOT EXISTS v_battle_rankings AS
SELECT 
    u.telegram_id,
    u.full_name,
    u.username,
    u.tier,
    u.battle_rating,
    u.battles_won,
    u.battles_lost,
    u.battles_total,
    u.weekly_battles_won,
    u.win_streak,
    u.best_win_streak,
    CASE 
        WHEN u.battles_total > 0 
        THEN ROUND((CAST(u.battles_won AS REAL) / u.battles_total) * 100, 2)
        ELSE 0.0 
    END as win_percentage,
    ROW_NUMBER() OVER (ORDER BY u.battle_rating DESC, u.battles_won DESC) as rank
FROM users u
WHERE u.battles_total > 0
ORDER BY u.battle_rating DESC, u.battles_won DESC;

-- View for Partnership Rankings
CREATE VIEW IF NOT EXISTS v_partnership_rankings AS
SELECT 
    p.id,
    p.user1_id,
    p.user2_id,
    u1.full_name as user1_name,
    u2.full_name as user2_name,
    p.total_points,
    p.weekly_points,
    p.games_played,
    p.games_won,
    p.current_streak,
    p.best_streak,
    p.tier,
    CASE 
        WHEN p.games_played > 0 
        THEN ROUND((CAST(p.games_won AS REAL) / p.games_played) * 100, 2)
        ELSE 0.0 
    END as win_percentage,
    ROW_NUMBER() OVER (ORDER BY p.weekly_points DESC, p.total_points DESC) as rank
FROM partnerships p
JOIN users u1 ON p.user1_id = u1.telegram_id
JOIN users u2 ON p.user2_id = u2.telegram_id
WHERE p.status = 'active'
ORDER BY p.weekly_points DESC, p.total_points DESC;

-- View for Squad Rankings
CREATE VIEW IF NOT EXISTS v_squad_rankings AS
SELECT 
    s.id,
    s.name,
    s.description,
    s.squad_tier,
    s.total_points,
    s.weekly_points,
    s.games_played,
    s.battles_won,
    s.total_battles,
    s.members_count,
    s.active_members,
    s.average_member_points,
    s.win_streak,
    CASE 
        WHEN s.total_battles > 0 
        THEN ROUND((CAST(s.battles_won AS REAL) / s.total_battles) * 100, 2)
        ELSE 0.0 
    END as win_percentage,
    CASE 
        WHEN s.members_count > 0 
        THEN ROUND(CAST(s.weekly_points AS REAL) / s.members_count, 2)
        ELSE 0.0 
    END as points_per_member,
    ROW_NUMBER() OVER (ORDER BY s.weekly_points DESC, s.total_points DESC) as rank
FROM squads s
ORDER BY s.weekly_points DESC, s.total_points DESC;

-- View for Streak Rankings (already handled in users table, but let's make it clearer)
CREATE VIEW IF NOT EXISTS v_streak_rankings AS
SELECT 
    u.telegram_id,
    u.full_name,
    u.username,
    u.tier,
    u.streak,
    u.total_questions,
    u.streak_last_play,
    ROW_NUMBER() OVER (ORDER BY u.streak DESC, u.total_questions DESC) as rank
FROM users u
WHERE u.streak > 0
ORDER BY u.streak DESC, u.total_questions DESC;

-- ==========================================
-- INDEXES FOR RANKING QUERIES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_users_battle_rating ON users(battle_rating DESC);
CREATE INDEX IF NOT EXISTS idx_users_battles_won ON users(battles_won DESC);
CREATE INDEX IF NOT EXISTS idx_users_win_streak ON users(win_streak DESC);
CREATE INDEX IF NOT EXISTS idx_users_weekly_battles ON users(weekly_battles_won DESC);

CREATE INDEX IF NOT EXISTS idx_partnerships_weekly ON partnerships(weekly_points DESC);
CREATE INDEX IF NOT EXISTS idx_partnerships_total ON partnerships(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_partnerships_tier ON partnerships(tier);

CREATE INDEX IF NOT EXISTS idx_squads_weekly ON squads(weekly_points DESC);
CREATE INDEX IF NOT EXISTS idx_squads_tier ON squads(squad_tier);
CREATE INDEX IF NOT EXISTS idx_squads_active ON squads(active_members DESC);

CREATE INDEX IF NOT EXISTS idx_squad_members_contribution ON squad_members(weekly_contribution DESC);
CREATE INDEX IF NOT EXISTS idx_squad_members_mvp ON squad_members(mvp_count DESC);
