/**
 * KV-based Database Client
 * Uses Cloudflare KV for all data operations
 */

import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';
import { generateReferralCode } from '../utils/helpers.js';

export class KVDatabase {
  constructor(kv) {
    this.kv = kv;
  }

  // ==========================================
  // USER OPERATIONS
  // ==========================================

  async getUser(telegramId) {
    try {
      // Search through all user keys to find by telegram_id
      const list = await this.kv.list({ prefix: 'users:' });
      
      for (const key of list.keys) {
        const userData = await this.kv.get(key.name);
        if (userData) {
          const user = JSON.parse(userData);
          if (user.telegram_id === telegramId) {
            return this._mapUser(user);
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  async createUser(userData) {
    try {
      const referralCode = generateReferralCode();
      const userId = crypto.randomUUID();
      
      const newUser = {
        id: userId,
        telegram_id: userData.telegramId,
        username: userData.username,
        full_name: userData.fullName,
        referral_code: referralCode,
        referred_by: userData.referredBy || '',
        ap: 0,
        pp: 0,
        weekly_points: 0,
        streak: 0,
        last_played_date: null,
        subscription_status: 'free',
        subscription_expires: null,
        streak_freezes_remaining: 0,
        total_questions: 0,
        correct_answers: 0,
        is_banned: false,
        suspicious_flags: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await this.kv.put(`users:${userId}`, JSON.stringify(newUser));
      return this._mapUser(newUser);
    } catch (error) {
      logger.error('Error creating user:', error);
      return null;
    }
  }

  async updateUser(user) {
    try {
      // Find user by telegram_id
      const existingUser = await this.getUser(user.telegramId);
      if (!existingUser) return false;

      const updatedUser = {
        id: existingUser.id,
        telegram_id: user.telegramId,
        username: user.username,
        full_name: user.fullName,
        ap: user.ap,
        pp: user.pp,
        weekly_points: user.weeklyPoints,
        streak: user.streak,
        last_played_date: user.lastPlayedDate,
        subscription_status: user.subscriptionStatus,
        subscription_expires: user.subscriptionExpires,
        total_questions: user.totalQuestions,
        correct_answers: user.correctAnswers,
        referral_code: user.referralCode,
        referred_by: user.referredBy,
        is_banned: user.isBanned,
        suspicious_flags: user.suspiciousFlags,
        created_at: existingUser.createdAt,
        updated_at: new Date().toISOString()
      };

      await this.kv.put(`users:${existingUser.id}`, JSON.stringify(updatedUser));
      return true;
    } catch (error) {
      logger.error('Error updating user:', error);
      return false;
    }
  }

  async getUserByReferralCode(code) {
    try {
      const list = await this.kv.list({ prefix: 'users:' });
      
      for (const key of list.keys) {
        const userData = await this.kv.get(key.name);
        if (userData) {
          const user = JSON.parse(userData);
          if (user.referral_code === code) {
            return this._mapUser(user);
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting user by referral code:', error);
      return null;
    }
  }

  async getUserRank(telegramId) {
    try {
      const list = await this.kv.list({ prefix: 'users:' });
      const users = [];

      for (const key of list.keys) {
        const userData = await this.kv.get(key.name);
        if (userData) {
          const user = JSON.parse(userData);
          if (!user.is_banned) {
            users.push(user);
          }
        }
      }

      // Sort by weekly_points descending
      users.sort((a, b) => b.weekly_points - a.weekly_points);
      
      const rank = users.findIndex(user => user.telegram_id === telegramId) + 1;
      return rank > 0 ? rank : 'Unranked';
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
      const list = await this.kv.list({ prefix: 'questions:' });
      const questions = [];

      for (const key of list.keys) {
        const questionData = await this.kv.get(key.name);
        if (questionData) {
          const question = JSON.parse(questionData);
          questions.push(question);
        }
      }

      if (questions.length === 0) return null;

      // Filter out answered questions if requested
      let availableQuestions = questions;
      if (excludeAnswered) {
        const answeredQuestions = await this.getAnsweredQuestionIds(telegramId);
        availableQuestions = questions.filter(q => !answeredQuestions.includes(q.question_id));
      }

      if (availableQuestions.length === 0) return null;

      // Pick random question
      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      return this._mapQuestion(availableQuestions[randomIndex]);
    } catch (error) {
      logger.error('Error getting random question:', error);
      return null;
    }
  }

  async getQuestion(questionId) {
    try {
      const list = await this.kv.list({ prefix: 'questions:' });
      
      for (const key of list.keys) {
        const questionData = await this.kv.get(key.name);
        if (questionData) {
          const question = JSON.parse(questionData);
          if (question.question_id === questionId) {
            return this._mapQuestion(question);
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting question:', error);
      return null;
    }
  }

  async updateQuestionStats(questionId, wasCorrect) {
    try {
      const question = await this.getQuestion(questionId);
      if (!question) return false;

      const updatedQuestion = {
        ...question,
        times_asked: (question.timesAsked || 0) + 1,
        times_correct: (question.timesCorrect || 0) + (wasCorrect ? 1 : 0)
      };

      // Find the question key and update it
      const list = await this.kv.list({ prefix: 'questions:' });
      for (const key of list.keys) {
        const questionData = await this.kv.get(key.name);
        if (questionData) {
          const q = JSON.parse(questionData);
          if (q.question_id === questionId) {
            await this.kv.put(key.name, JSON.stringify(updatedQuestion));
            return true;
          }
        }
      }

      return false;
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
      const attemptData = {
        id: crypto.randomUUID(),
        attempt_id: attempt.attemptId,
        telegram_id: attempt.telegramId,
        question_id: attempt.questionId,
        selected_option: attempt.selectedOption,
        is_correct: attempt.isCorrect,
        response_time_seconds: attempt.responseTimeSeconds,
        points_awarded: attempt.pointsAwarded,
        point_type: attempt.pointType,
        attempt_number: attempt.attemptNumber,
        created_at: new Date().toISOString()
      };

      await this.kv.put(`attempts:${attemptData.id}`, JSON.stringify(attemptData));
      return true;
    } catch (error) {
      logger.error('Error creating attempt:', error);
      return false;
    }
  }

  async getAttemptCount(telegramId, questionId) {
    try {
      const list = await this.kv.list({ prefix: 'attempts:' });
      let count = 0;

      for (const key of list.keys) {
        const attemptData = await this.kv.get(key.name);
        if (attemptData) {
          const attempt = JSON.parse(attemptData);
          if (attempt.telegram_id === telegramId && attempt.question_id === questionId) {
            count++;
          }
        }
      }

      return count;
    } catch (error) {
      logger.error('Error getting attempt count:', error);
      return 0;
    }
  }

  async getAnsweredQuestionIds(telegramId, daysBack = 7) {
    try {
      const list = await this.kv.list({ prefix: 'attempts:' });
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      const answeredIds = new Set();

      for (const key of list.keys) {
        const attemptData = await this.kv.get(key.name);
        if (attemptData) {
          const attempt = JSON.parse(attemptData);
          if (attempt.telegram_id === telegramId && 
              new Date(attempt.created_at) > cutoffDate) {
            answeredIds.add(attempt.question_id);
          }
        }
      }

      return Array.from(answeredIds);
    } catch (error) {
      logger.error('Error getting answered question IDs:', error);
      return [];
    }
  }

  // ==========================================
  // LEADERBOARD OPERATIONS
  // ==========================================

  async getTopUsers(limit = 50) {
    try {
      const list = await this.kv.list({ prefix: 'users:' });
      const users = [];

      for (const key of list.keys) {
        const userData = await this.kv.get(key.name);
        if (userData) {
          const user = JSON.parse(userData);
          if (!user.is_banned) {
            users.push({
              telegram_id: user.telegram_id,
              username: user.username,
              full_name: user.full_name,
              weekly_points: user.weekly_points,
              streak: user.streak
            });
          }
        }
      }

      // Sort by weekly_points descending and limit
      users.sort((a, b) => b.weekly_points - a.weekly_points);
      return users.slice(0, limit);
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
      id: row.id,
      telegramId: row.telegram_id,
      username: row.username,
      fullName: row.full_name,
      ap: row.ap,
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
      isBanned: row.is_banned,
      suspiciousFlags: row.suspicious_flags,
      createdAt: row.created_at
    };
  }

  _mapQuestion(row) {
    return {
      id: row.id,
      questionId: row.question_id,
      questionText: row.question_text,
      optionA: row.option_a,
      optionB: row.option_b,
      optionC: row.option_c,
      optionD: row.option_d,
      correctOption: row.correct_option,
      category: row.category,
      difficulty: row.difficulty,
      timeLimitSeconds: row.time_limit_seconds || 30,
      timesAsked: row.times_asked || 0,
      timesCorrect: row.times_correct || 0,
      isActive: true
    };
  }
}
