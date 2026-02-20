/**
 * I-Crush Quiz Game - D1 Database Client
 * Handles all game systems with Cloudflare D1 SQL database
 */

import { logger } from '../utils/logger.js';
import { randomUUID } from 'node:crypto';

export class D1Database {
  constructor(env) {
    this.env = env;
  }

  /**
   * Execute SQL query
   */
  async executeQuery(sql, params = []) {
    try {
      const db = this.env.GNEX_D1;
      if (!db) {
        throw new Error('D1 database binding not found. Make sure GNEX_D1 is configured in wrangler.toml');
      }
      const statement = db.prepare(sql);
      const boundStatement = statement.bind(...params);
      const result = await boundStatement.all();
      
      // D1 returns { success, results, meta }
      // We need the results array
      if (result && Array.isArray(result)) {
        return result;
      }
      if (result && Array.isArray(result.results)) {
        return result.results;
      }
      return [];
    } catch (error) {
      logger.error('Database query error:', { sql, params, error: error.message });
      throw error;
    }
  }

  /**
   * Get user by telegram ID
   */
  async getUser(telegramId) {
    try {
      const result = await this.executeQuery(
        'SELECT * FROM users WHERE telegram_id = ?',
        [telegramId]
      );
      return result && result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    try {
      const id = randomUUID();
      const result = await this.executeQuery(
        `INSERT INTO users (id, telegram_id, username, full_name, ap, pp, weekly_points, total_ap, total_pp, streak, last_played_date, subscription_status, total_questions, correct_answers, referral_code, referred_by, is_banned, suspicious_flags) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userData.telegramId,
          userData.username || `user_${userData.telegramId}`,
          userData.full_name || `User ${userData.telegramId}`,
          0, // ap
          0, // pp
          0, // weekly_points
          0, // total_ap
          0, // total_pp
          0, // streak
          new Date().toISOString().split('T')[0], // last_played_date
          'free', // subscription_status
          0, // total_questions
          0, // correct_answers
          userData.referralCode || null,
          userData.referredBy || null,
          false, // is_banned
          '[]' // suspicious_flags
        ]
      );
      // Fetch and return the created user
      return await this.getUser(userData.telegramId);
    } catch (error) {
      logger.error('Error creating user:', error);
      return null;
    }
  }

  /**
   * Update user data
   */
  async updateUser(telegramId, updates) {
    try {
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      
      await this.executeQuery(
        `UPDATE users SET ${setClause} WHERE telegram_id = ?`,
        [...values, telegramId]
      );
      return true;
    } catch (error) {
      logger.error('Error updating user:', error);
      return false;
    }
  }

  /**
   * Get random question
   */
  async getRandomQuestion() {
    try {
      const result = await this.executeQuery(
        `SELECT * FROM questions
         WHERE is_active = 1
         AND question IS NOT NULL
         AND TRIM(question) <> ''
         ORDER BY RANDOM() LIMIT 1`
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error getting random question:', error);
      return null;
    }
  }

  /**
   * Get random unseen question for a user (prevents repeats)
   */
  async getRandomUnseenQuestion(telegramId) {
    try {
      const result = await this.executeQuery(
        `SELECT q.*
         FROM questions q
         WHERE q.is_active = 1
           AND q.question IS NOT NULL
           AND TRIM(q.question) <> ''
           AND NOT EXISTS (
             SELECT 1
             FROM user_attempts ua
             WHERE ua.telegram_id = ?
               AND ua.question_id = q.id
           )
         ORDER BY RANDOM()
         LIMIT 1`,
        [telegramId]
      );

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error getting random unseen question:', error);
      return null;
    }
  }

  /**
   * Count answered normal-mode questions for a user
   */
  async getUserNormalQuestionCount(telegramId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await this.executeQuery(
        `SELECT COUNT(*) as count
         FROM user_attempts
         WHERE telegram_id = ?
         AND substr(attempted_at, 1, 10) = ?`,
        [telegramId, today]
      );

      return result.length > 0 ? Number(result[0].count || 0) : 0;
    } catch (error) {
      logger.error('Error getting user normal question count:', error);
      return 0;
    }
  }

  /**
   * Get question by ID
   */
  async getQuestion(questionId) {
    try {
      const result = await this.executeQuery(
        'SELECT * FROM questions WHERE id = ?',
        [questionId]
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error getting question:', error);
      return null;
    }
  }

  /**
   * Record user attempt
   */
  async recordAttempt(telegramId, questionId, selectedOption, isCorrect, pointsEarned, speedBonus, streakBonus) {
    try {
      const id = randomUUID();
      await this.executeQuery(
        `INSERT INTO user_attempts (id, telegram_id, question_id, selected_option, is_correct, attempt_number, points_earned, speed_bonus, streak_bonus, attempted_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          telegramId,
          questionId,
          selectedOption,
          isCorrect ? 1 : 0,
          1, // attempt_number
          pointsEarned,
          speedBonus,
          streakBonus,
          new Date().toISOString()
        ]
      );
      return true;
    } catch (error) {
      logger.error('Error recording attempt:', error);
      return false;
    }
  }

  /**
   * Get user rank
   */
  async getUserRank(telegramId) {
    try {
      const result = await this.executeQuery(
        `SELECT COUNT(*) + 1 as rank FROM users WHERE weekly_points > (SELECT weekly_points FROM users WHERE telegram_id = ?)`,
        [telegramId]
      );
      return result.length > 0 ? result[0].rank : null;
    } catch (error) {
      logger.error('Error getting user rank:', error);
      return null;
    }
  }

  /**
   * Get top users for leaderboard
   */
  async getTopUsers(limit = 10) {
    try {
      const result = await this.executeQuery(
        'SELECT * FROM users ORDER BY weekly_points DESC LIMIT ?',
        [limit]
      );
      return result;
    } catch (error) {
      logger.error('Error getting top users:', error);
      return [];
    }
  }

  /**
   * Get referral count
   */
  async getReferralCount(telegramId) {
    try {
      const result = await this.executeQuery(
        'SELECT COUNT(*) as count FROM referrals WHERE referrer_telegram_id = ?',
        [telegramId]
      );
      return result.length > 0 ? result[0].count : 0;
    } catch (error) {
      logger.error('Error getting referral count:', error);
      return 0;
    }
  }

  /**
   * Set user conversation state
   */
  async setUserState(telegramId, state, data = null) {
    try {
      await this.executeQuery(
        'UPDATE users SET conversation_state = ?, conversation_data = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?',
        [state, data ? JSON.stringify(data) : null, telegramId]
      );
      return true;
    } catch (error) {
      logger.error('Error setting user state:', error);
      return false;
    }
  }

  /**
   * Get user conversation state
   */
  async getUserState(telegramId) {
    try {
      const result = await this.executeQuery(
        'SELECT conversation_state, conversation_data FROM users WHERE telegram_id = ?',
        [telegramId]
      );
      if (result.length > 0 && result[0].conversation_state) {
        return {
          state: result[0].conversation_state,
          data: result[0].conversation_data ? JSON.parse(result[0].conversation_data) : null
        };
      }
      return null;
    } catch (error) {
      logger.error('Error getting user state:', error);
      return null;
    }
  }

  /**
   * Clear user conversation state
   */
  async clearUserState(telegramId) {
    try {
      await this.executeQuery(
        'UPDATE users SET conversation_state = NULL, conversation_data = NULL, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?',
        [telegramId]
      );
      return true;
    } catch (error) {
      logger.error('Error clearing user state:', error);
      return false;
    }
  }

  /**
   * Find user by username or telegram ID
   */
  async getUserByUsernameOrId(input) {
    try {
      // Remove @ if present
      const cleanInput = input.replace('@', '');
      
      // Try to parse as number (telegram ID)
      const numericId = parseInt(cleanInput, 10);
      
      if (!isNaN(numericId)) {
        // Search by telegram ID
        const result = await this.executeQuery(
          'SELECT * FROM users WHERE telegram_id = ?',
          [numericId]
        );
        return result.length > 0 ? result[0] : null;
      } else {
        // Search by username
        const result = await this.executeQuery(
          'SELECT * FROM users WHERE username = ? COLLATE NOCASE',
          [cleanInput]
        );
        return result.length > 0 ? result[0] : null;
      }
    } catch (error) {
      logger.error('Error finding user:', error);
      return null;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(telegramId) {
    try {
      const result = await this.executeQuery(
        `SELECT 
          u.*,
          COUNT(ua.id) as total_attempts,
          SUM(CASE WHEN ua.is_correct = TRUE THEN 1 ELSE 0 END) as correct_answers,
          AVG(CASE WHEN ua.is_correct = TRUE THEN 1 ELSE 0 END) * 100 as accuracy
        FROM users u
        LEFT JOIN user_attempts ua ON u.telegram_id = ua.telegram_id
        WHERE u.telegram_id = ?
        GROUP BY u.id`,
        [telegramId]
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error getting user stats:', error);
      return null;
    }
  }

  /**
   * Cache rate limit (simplified - no actual rate limiting for now)
   */
  async cacheRateLimit(telegramId, action) {
    return 0; // No rate limiting for MVP
  }

  /**
   * Get active question for user
   */
  async getActiveQuestion(telegramId) {
    try {
      const result = await this.executeQuery(
        'SELECT * FROM active_questions WHERE telegram_id = ? LIMIT 1',
        [telegramId]
      );
      if (!result || result.length === 0) {
        return null;
      }

      const row = result[0];
      const question = await this.getQuestion(row.question_id);
      if (!question) {
        return null;
      }

      const cachedAt = row.start_time ? Date.parse(row.start_time) : Date.now();
      return {
        question,
        cachedAt,
        startTime: cachedAt,
        attemptNumber: row.attempt_number || 1,
        isPrizeRound: !!row.is_prize_round
      };
    } catch (error) {
      logger.error('Error getting active question:', error);
      return null;
    }
  }

  /**
   * Cache active question for user
   */
  async cacheActiveQuestion(telegramId, data) {
    try {
      const id = randomUUID();
      const startTime = data.startTime ? new Date(data.startTime).toISOString() : new Date().toISOString();
      await this.executeQuery(
        `INSERT OR REPLACE INTO active_questions (id, telegram_id, question_id, start_time, attempt_number, is_prize_round)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          telegramId,
          data.question.id,
          startTime,
          data.attemptNumber || 1,
          data.isPrizeRound ? 1 : 0
        ]
      );
      return true;
    } catch (error) {
      logger.error('Error caching active question:', error);
      return false;
    }
  }

  /**
   * Create attempt record
   */
  async createAttempt(data) {
    try {
      const id = randomUUID();
      await this.executeQuery(
        `INSERT INTO user_attempts (id, telegram_id, question_id, selected_option, is_correct, attempt_number, points_earned, speed_bonus, streak_bonus, attempted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.telegramId,
          data.questionId,
          data.selectedOption,
          data.isCorrect ? 1 : 0,
          data.attemptNumber || 1,
          data.pointsEarned || 0,
          data.speedBonus || 0,
          data.streakBonus || 0,
          new Date().toISOString()
        ]
      );
      return true;
    } catch (error) {
      logger.error('Error creating attempt:', error);
      return false;
    }
  }

  /**
   * Update question statistics
   */
  async updateQuestionStats(questionId, isCorrect) {
    try {
      await this.executeQuery(
        `UPDATE questions 
         SET times_asked = times_asked + 1,
             times_correct = times_correct + ${isCorrect ? 1 : 0}
         WHERE id = ?`,
        [questionId]
      );
      return true;
    } catch (error) {
      logger.error('Error updating question stats:', error);
      return false;
    }
  }

  /**
   * Clear active question for user
   */
  async clearActiveQuestion(telegramId) {
    try {
      await this.executeQuery(
        'DELETE FROM active_questions WHERE telegram_id = ?',
        [telegramId]
      );
      return true;
    } catch (error) {
      logger.error('Error clearing active question:', error);
      return false;
    }
  }

  /**
   * Get top squads for rankings
   */
  async getTopSquads(limit = 10) {
    try {
      const result = await this.executeQuery(
        `SELECT * FROM v_squad_rankings LIMIT ?`,
        [limit]
      );
      return result;
    } catch (error) {
      logger.error('Error getting top squads:', error);
      return [];
    }
  }

  /**
   * Get top 1v1 battle players
   */
  async getTopBattlePlayers(limit = 10) {
    try {
      const result = await this.executeQuery(
        `SELECT * FROM v_battle_rankings LIMIT ?`,
        [limit]
      );
      return result;
    } catch (error) {
      logger.error('Error getting top battle players:', error);
      return [];
    }
  }

  /**
   * Get top partnerships for rankings
   */
  async getTopPartnerships(limit = 10) {
    try {
      const result = await this.executeQuery(
        `SELECT * FROM v_partnership_rankings LIMIT ?`,
        [limit]
      );
      return result;
    } catch (error) {
      logger.error('Error getting top partnerships:', error);
      return [];
    }
  }

  /**
   * Get top streak leaders
   */
  async getTopStreaks(limit = 10) {
    try {
      const result = await this.executeQuery(
        `SELECT * FROM v_streak_rankings LIMIT ?`,
        [limit]
      );
      return result;
    } catch (error) {
      logger.error('Error getting top streaks:', error);
      return [];
    }
  }

  /**
   * Get users eligible for bot notifications
   */
  async getUsersForNotifications() {
    try {
      const result = await this.executeQuery(
        `SELECT telegram_id, username, full_name
         FROM users
         WHERE is_banned = 0`
      );
      return result || [];
    } catch (error) {
      logger.error('Error getting users for notifications:', error);
      return [];
    }
  }
}