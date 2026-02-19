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
        'SELECT * FROM questions WHERE is_active = TRUE ORDER BY RANDOM() LIMIT 1'
      );
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error('Error getting random question:', error);
      return null;
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
}
