/**
 * Database Client for D1 and KV operations
 */

import { logger } from '../utils/logger.js';
import { generateReferralCode } from '../utils/helpers.js';

export class Database {
  constructor(d1, kv) {
    this.d1 = d1;
    this.kv = kv;
  }

  // ==========================================
  // USER OPERATIONS
  // ==========================================

  async getUser(telegramId) {
    try {
      const result = await this.d1.prepare(
        'SELECT * FROM users WHERE telegram_id = ?'
      ).bind(telegramId).first();

      return result ? this._mapUser(result) : null;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  async createUser(userData) {
    try {
      const referralCode = generateReferralCode();
      
      await this.d1.prepare(`
        INSERT INTO users (
          telegram_id, username, full_name, referral_code, referred_by
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        userData.telegramId,
        userData.username,
        userData.fullName,
        referralCode,
        userData.referredBy || ''
      ).run();

      return await this.getUser(userData.telegramId);
    } catch (error) {
      logger.error('Error creating user:', error);
      return null;
    }
  }

  async updateUser(user) {
    try {
      await this.d1.prepare(`
        UPDATE users SET
          username = ?,
          full_name = ?,
          ap = ?,
          total_ap = ?,
          pp = ?,
          weekly_points = ?,
          streak = ?,
          last_played_date = ?,
          subscription_status = ?,
          total_questions = ?,
          correct_answers = ?,
          suspicious_flags = ?,
          updated_at = datetime('now')
        WHERE telegram_id = ?
      `).bind(
        user.username,
        user.fullName,
        user.ap,
        user.totalAp,
        user.pp,
        user.weeklyPoints,
        user.streak,
        user.lastPlayedDate,
        user.subscriptionStatus,
        user.totalQuestions,
        user.correctAnswers,
        user.suspiciousFlags,
        user.telegramId
      ).run();

      return true;
    } catch (error) {
      logger.error('Error updating user:', error);
      return false;
    }
  }

  async getUserByReferralCode(code) {
    try {
      const result = await this.d1.prepare(
        'SELECT * FROM users WHERE referral_code = ?'
      ).bind(code).first();

      return result ? this._mapUser(result) : null;
    } catch (error) {
      logger.error('Error getting user by referral code:', error);
      return null;
    }
  }

  async getUserRank(telegramId) {
    try {
      const result = await this.d1.prepare(`
        SELECT COUNT(*) + 1 as rank
        FROM users
        WHERE weekly_points > (
          SELECT weekly_points FROM users WHERE telegram_id = ?
        )
      `).bind(telegramId).first();

      return result?.rank || 'Unranked';
    } catch (error) {
      logger.error('Error getting user rank:', error);
      return 'Unranked';
    }
  }

  // ==========================================
  // QUESTION OPERATIONS
  // ==========================================

  async getRandomQuestion(telegramId, excludeAnswered = true) {
    try {
      let query = 'SELECT * FROM questions WHERE is_active = 1';
      
      if (excludeAnswered) {
        query += ` AND question_id NOT IN (
          SELECT question_id FROM attempts 
          WHERE telegram_id = ? AND created_at > date('now', '-7 days')
        )`;
      }
      
      query += ' ORDER BY RANDOM() LIMIT 1';

      const stmt = excludeAnswered 
        ? this.d1.prepare(query).bind(telegramId)
        : this.d1.prepare(query);

      const result = await stmt.first();
      return result ? this._mapQuestion(result) : null;
    } catch (error) {
      logger.error('Error getting random question:', error);
      return null;
    }
  }

  async getQuestion(questionId) {
    try {
      const result = await this.d1.prepare(
        'SELECT * FROM questions WHERE question_id = ?'
      ).bind(questionId).first();

      return result ? this._mapQuestion(result) : null;
    } catch (error) {
      logger.error('Error getting question:', error);
      return null;
    }
  }

  async updateQuestionStats(questionId, wasCorrect) {
    try {
      await this.d1.prepare(`
        UPDATE questions SET
          times_asked = times_asked + 1,
          times_correct = times_correct + ?
        WHERE question_id = ?
      `).bind(wasCorrect ? 1 : 0, questionId).run();

      return true;
    } catch (error) {
      logger.error('Error updating question stats:', error);
      return false;
    }
  }

  // ==========================================
  // ATTEMPT OPERATIONS
  // ==========================================

  async createAttempt(attempt) {
    try {
      await this.d1.prepare(`
        INSERT INTO attempts (
          attempt_id, telegram_id, question_id, selected_option,
          is_correct, response_time_seconds, points_awarded,
          point_type, attempt_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        attempt.attemptId,
        attempt.telegramId,
        attempt.questionId,
        attempt.selectedOption,
        attempt.isCorrect ? 1 : 0,
        attempt.responseTimeSeconds,
        attempt.pointsAwarded,
        attempt.pointType,
        attempt.attemptNumber
      ).run();

      return true;
    } catch (error) {
      logger.error('Error creating attempt:', error);
      return false;
    }
  }

  async getAttemptCount(telegramId, questionId) {
    try {
      const result = await this.d1.prepare(`
        SELECT COUNT(*) as count
        FROM attempts
        WHERE telegram_id = ? AND question_id = ?
      `).bind(telegramId, questionId).first();

      return result?.count || 0;
    } catch (error) {
      logger.error('Error getting attempt count:', error);
      return 0;
    }
  }

  // ==========================================
  // LEADERBOARD OPERATIONS
  // ==========================================

  async getTopUsers(limit = 50) {
    try {
      const results = await this.d1.prepare(`
        SELECT telegram_id, username, full_name, weekly_points, streak
        FROM users
        WHERE is_banned = 0
        ORDER BY weekly_points DESC
        LIMIT ?
      `).bind(limit).all();

      return results.results || [];
    } catch (error) {
      logger.error('Error getting top users:', error);
      return [];
    }
  }

  // ==========================================
  // KV CACHE OPERATIONS
  // ==========================================

  async cacheActiveQuestion(telegramId, questionData) {
    const key = `active_question:${telegramId}`;
    await this.kv.put(key, JSON.stringify(questionData), { expirationTtl: 300 }); // 5 minutes
  }

  async getActiveQuestion(telegramId) {
    const key = `active_question:${telegramId}`;
    const data = await this.kv.get(key);
    return data ? JSON.parse(data) : null;
  }

  async clearActiveQuestion(telegramId) {
    const key = `active_question:${telegramId}`;
    await this.kv.delete(key);
  }

  async checkRateLimit(telegramId, isSubscriber = false) {
    const key = `rate_limit:${telegramId}`;
    const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const fullKey = `${key}:${hourKey}`;

    const count = parseInt(await this.kv.get(fullKey) || '0');
    const limit = isSubscriber ? 40 : 20;

    if (count >= limit) {
      return { allowed: false, remaining: 0, limit };
    }

    await this.kv.put(fullKey, String(count + 1), { expirationTtl: 3600 });
    return { allowed: true, remaining: limit - count - 1, limit };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  _mapUser(row) {
    return {
      telegramId: row.telegram_id,
      username: row.username,
      fullName: row.full_name,
      ap: row.ap,
      totalAp: row.total_ap,
      pp: row.pp,
      weeklyPoints: row.weekly_points,
      streak: row.streak,
      lastPlayedDate: row.last_played_date,
      subscriptionStatus: row.subscription_status,
      subscriptionExpires: row.subscription_expires,
      totalQuestions: row.total_questions,
      correctAnswers: row.correct_answers,
      referralCode: row.referral_code,
      referredBy: row.referred_by,
      isBanned: row.is_banned === 1,
      suspiciousFlags: row.suspicious_flags,
      createdAt: row.created_at
    };
  }

  _mapQuestion(row) {
    return {
      questionId: row.question_id,
      questionText: row.question_text,
      optionA: row.option_a,
      optionB: row.option_b,
      optionC: row.option_c,
      optionD: row.option_d,
      correctOption: row.correct_option,
      category: row.category,
      difficulty: row.difficulty,
      timeLimitSeconds: row.time_limit_seconds,
      timesAsked: row.times_asked,
      timesCorrect: row.times_correct,
      isActive: row.is_active === 1
    };
  }
}
