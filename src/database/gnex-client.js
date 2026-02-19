/**
 * G-NEX Complete Database Client
 * Handles all game systems: Arena, Ranking, Streaks, Economy, Data Rewards, Viral Growth
 */

import { logger } from '../utils/logger.js';

export class GNEXDatabase {
  constructor(kv) {
    this.kv = kv;
    
    // Cache frequently accessed data
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  async getUser(telegramId) {
    try {
      const cacheKey = `user:${telegramId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // First get the user ID from telegram mapping
      const userId = await this.kv.get(`telegram_to_user:${telegramId}`);
      if (!userId) return null;

      const userData = await this.kv.get(`users:${userId}`);
      if (!userData) return null;

      const user = JSON.parse(userData);
      this.setCache(cacheKey, user);
      return user;
    } catch (error) {
      logger.error('Error getting user:', error);
      return null;
    }
  }

  async createUser(userData) {
    try {
      const user = {
        id: crypto.randomUUID(),
        telegram_id: userData.telegramId,
        username: userData.username || `user_${userData.telegramId}`,
        full_name: userData.fullName,
        ap: 0,
        pp: 0,
        weekly_points: 0,
        streak: 0,
        last_played_date: new Date().toISOString().split('T')[0],
        subscription_status: 'free',
        subscription_expires: null,
        total_questions: 0,
        correct_answers: 0,
        referral_code: userData.referralCode || null,
        referred_by: userData.referredBy || null,
        is_banned: false,
        suspicious_flags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await this.kv.put(`users:${user.id}`, JSON.stringify(user));
      await this.kv.put(`telegram_to_user:${userData.telegramId}`, user.id);
      
      // Initialize user's game systems
      await this.initializeUserSystems(user.id, userData.telegramId);
      
      this.invalidateCache(`user:${userData.telegramId}`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      return null;
    }
  }

  async updateUser(userId, updates) {
    try {
      const userData = await this.kv.get(`users:${userId}`);
      if (!userData) return false;

      const user = JSON.parse(userData);
      Object.assign(user, updates);
      user.updated_at = new Date().toISOString();

      await this.kv.put(`users:${userId}`, JSON.stringify(user));
      
      // Invalidate cache for telegram ID
      this.invalidateCache(`user:${user.telegram_id}`);
      return true;
    } catch (error) {
      logger.error('Error updating user:', error);
      return false;
    }
  }

  async initializeUserSystems(userId, telegramId) {
    try {
      // Initialize wallet
      const wallet = {
        userId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        transactions: [],
        dailyBonusClaimed: false,
        lastBonusDate: null,
        createdAt: new Date().toISOString()
      };
      await this.kv.put(`wallet:${userId}`, JSON.stringify(wallet));

      // Initialize streak
      const streak = {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastPlayDate: null,
        streakHistory: [],
        protectedUntil: null,
        totalDaysPlayed: 0,
        rewardsClaimed: [],
        multiplier: 1.0,
        createdAt: new Date().toISOString()
      };
      await this.kv.put(`streak:${userId}`, JSON.stringify(streak));

      // Initialize ranking
      const ranking = {
        userId,
        weeklyPoints: 0,
        totalPoints: 0,
        currentTier: 'BRONZE',
        highestTier: 'BRONZE',
        weeklyRank: 0,
        bestWeeklyRank: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        currentStreak: 0,
        bestStreak: 0,
        battlesWon: 0,
        battlesPlayed: 0,
        challengesWon: 0,
        challengesPlayed: 0,
        partnershipWins: 0,
        partnershipsPlayed: 0,
        squadContributions: 0,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      await this.kv.put(`ranking:${userId}`, JSON.stringify(ranking));

      logger.info(`Initialized systems for user ${userId}`);
    } catch (error) {
      logger.error('Error initializing user systems:', error);
    }
  }

  // ==========================================
  // QUESTION MANAGEMENT
  // ==========================================

  async getRandomQuestion(telegramId, includeGhanaOnly = true) {
    try {
      const list = await this.kv.list({ prefix: 'questions:' });
      const questions = [];

      for (const key of list.keys) {
        const questionData = await this.kv.get(key.name);
        if (questionData) {
          const question = JSON.parse(questionData);
          if (question.is_active) {
            questions.push(question);
          }
        }
      }

      if (questions.length === 0) {
        logger.warn('No active questions found in database');
        return null;
      }

      // Weighted random selection (Ghana questions get higher weight)
      const weights = questions.map(q => {
        if (includeGhanaOnly && this.isGhanaQuestion(q.category)) {
          return 2; // Higher weight for Ghana questions
        }
        return 1;
      });

      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let random = Math.random() * totalWeight;
      let weightSum = 0;

      for (let i = 0; i < questions.length; i++) {
        weightSum += weights[i];
        if (random <= weightSum) {
          return questions[i];
        }
      }

      // Fallback to first question
      return questions[0];
    } catch (error) {
      logger.error('Error getting random question:', error);
      return null;
    }
  }

  isGhanaQuestion(category) {
    const ghanaCategories = ['CULTURE', 'SPORTS', 'MUSIC', 'HISTORY', 'POLITICS', 'GEOGRAPHY', 'FOOD', 'ENTERTAINMENT', 'LANGUAGE', 'CURRENT_AFFAIRS'];
    return ghanaCategories.includes(category);
  }

  async getQuestion(questionId) {
    try {
      const questionData = await this.kv.get(`questions:${questionId}`);
      return questionData ? JSON.parse(questionData) : null;
    } catch (error) {
      logger.error('Error getting question:', error);
      return null;
    }
  }

  async updateQuestionStats(questionId, isCorrect, responseTime) {
    try {
      const questionData = await this.kv.get(`questions:${questionId}`);
      if (!questionData) return false;

      const question = JSON.parse(questionData);
      question.times_asked = (question.times_asked || 0) + 1;
      
      if (isCorrect) {
        question.times_correct = (question.times_correct || 0) + 1;
      }

      // Update average response time
      const currentAvg = question.average_response_time || 0;
      question.average_response_time = ((currentAvg * (question.times_asked - 1)) + responseTime) / question.times_asked;

      await this.kv.put(`questions:${questionId}`, JSON.stringify(question));
      return true;
    } catch (error) {
      logger.error('Error updating question stats:', error);
      return false;
    }
  }

  // ==========================================
  // ATTEMPT TRACKING
  // ==========================================

  async createAttempt(attemptData) {
    try {
      const attempt = {
        id: crypto.randomUUID(),
        telegram_id: attemptData.telegramId,
        question_id: attemptData.questionId,
        selected_option: attemptData.selectedOption,
        is_correct: attemptData.isCorrect,
        response_time_seconds: attemptData.responseTimeSeconds,
        points_awarded: attemptData.pointsAwarded || 0,
        point_type: attemptData.pointType || 'ap',
        attempt_number: attemptData.attemptNumber || 1,
        created_at: new Date().toISOString()
      };

      await this.kv.put(`attempts:${attempt.id}`, JSON.stringify(attempt));
      return attempt;
    } catch (error) {
      logger.error('Error creating attempt:', error);
      return null;
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

  // ==========================================
  // LEADERBOARD & RANKING
  // ==========================================

  async getTopUsers(limit = 10) {
    try {
      const list = await this.kv.list({ prefix: 'users:' });
      const users = [];

      for (const key of list.keys) {
        const userData = await this.kv.get(key.name);
        if (userData) {
          const user = JSON.parse(userData);
          users.push({
            id: user.id,
            telegram_id: user.telegram_id,
            full_name: user.full_name,
            weekly_points: user.weekly_points,
            ap: user.ap,
            pp: user.pp,
            streak: user.streak
          });
        }
      }

      users.sort((a, b) => b.weekly_points - a.weekly_points);
      return users.slice(0, limit);
    } catch (error) {
      logger.error('Error getting top users:', error);
      return [];
    }
  }

  async getUserRank(telegramId) {
    try {
      const topUsers = await this.getTopUsers(1000);
      const userIndex = topUsers.findIndex(u => u.telegram_id === telegramId);
      return userIndex >= 0 ? userIndex + 1 : null;
    } catch (error) {
      logger.error('Error getting user rank:', error);
      return null;
    }
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  invalidateCache(key) {
    this.cache.delete(key);
  }

  // ==========================================
  // ARENA SYSTEM INTEGRATION
  // ==========================================

  async createChallenge(challengerId, opponentId, challengeType = 'standard') {
    try {
      const challengeId = crypto.randomUUID();
      const challenge = {
        id: challengeId,
        challengerId,
        opponentId,
        type: challengeType,
        status: 'pending',
        questionsPerRound: 5,
        timeLimit: 30,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        currentRound: 1,
        currentQuestion: 0,
        challengerScore: 0,
        opponentScore: 0,
        questions: [],
        answers: {}
      };

      await this.kv.put(`challenge:${challengeId}`, JSON.stringify(challenge));
      return challenge;
    } catch (error) {
      logger.error('Error creating challenge:', error);
      return null;
    }
  }

  async getChallenge(challengeId) {
    try {
      const challengeData = await this.kv.get(`challenge:${challengeId}`);
      return challengeData ? JSON.parse(challengeData) : null;
    } catch (error) {
      logger.error('Error getting challenge:', error);
      return null;
    }
  }

  async updateChallenge(challengeId, updates) {
    try {
      const challengeData = await this.kv.get(`challenge:${challengeId}`);
      if (!challengeData) return false;

      const challenge = JSON.parse(challengeData);
      Object.assign(challenge, updates);

      await this.kv.put(`challenge:${challengeId}`, JSON.stringify(challenge));
      return true;
    } catch (error) {
      logger.error('Error updating challenge:', error);
      return false;
    }
  }

  // ==========================================
  // PARTNERSHIP SYSTEM
  // ==========================================

  async createPartnership(player1Id, player2Id) {
    try {
      const partnershipId = crypto.randomUUID();
      const partnership = {
        id: partnershipId,
        player1Id,
        player2Id,
        status: 'active',
        combinedScore: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        currentStreak: 0,
        bestStreak: 0,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      await this.kv.put(`partnership:${partnershipId}`, JSON.stringify(partnership));
      await this.kv.put(`user_partnership:${player1Id}`, partnershipId);
      await this.kv.put(`user_partnership:${player2Id}`, partnershipId);

      return partnership;
    } catch (error) {
      logger.error('Error creating partnership:', error);
      return null;
    }
  }

  async getPartnership(userId) {
    try {
      const partnershipId = await this.kv.get(`user_partnership:${userId}`);
      if (!partnershipId) return null;

      const partnershipData = await this.kv.get(`partnership:${partnershipId}`);
      return partnershipData ? JSON.parse(partnershipData) : null;
    } catch (error) {
      logger.error('Error getting partnership:', error);
      return null;
    }
  }

  // ==========================================
  // SQUAD SYSTEM
  // ==========================================

  async createSquad(creatorId, squadName, maxMembers = 10) {
    try {
      const squadId = crypto.randomUUID();
      const squad = {
        id: squadId,
        name: squadName,
        creatorId,
        leaderId: creatorId,
        memberIds: [creatorId],
        maxMembers,
        status: 'active',
        weeklyScore: 0,
        totalScore: 0,
        weeklyRank: 0,
        battlesWon: 0,
        battlesPlayed: 0,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      await this.kv.put(`squad:${squadId}`, JSON.stringify(squad));
      await this.kv.put(`user_squad:${creatorId}`, squadId);

      return squad;
    } catch (error) {
      logger.error('Error creating squad:', error);
      return null;
    }
  }

  async getSquad(userId) {
    try {
      const squadId = await this.kv.get(`user_squad:${userId}`);
      if (!squadId) return null;

      const squadData = await this.kv.get(`squad:${squadId}`);
      return squadData ? JSON.parse(squadData) : null;
    } catch (error) {
      logger.error('Error getting squad:', error);
      return null;
    }
  }

  async updateSquad(squadId, updates) {
    try {
      const squadData = await this.kv.get(`squad:${squadId}`);
      if (!squadData) return false;

      const squad = JSON.parse(squadData);
      Object.assign(squad, updates);
      squad.lastActivity = new Date().toISOString();

      await this.kv.put(`squad:${squadId}`, JSON.stringify(squad));
      return true;
    } catch (error) {
      logger.error('Error updating squad:', error);
      return false;
    }
  }

  // ==========================================
  // CACHE OPERATIONS
  // ==========================================

  async cacheActiveQuestion(telegramId, questionData) {
    try {
      const cacheKey = `active_question:${telegramId}`;
      const cacheData = {
        ...questionData,
        cachedAt: Date.now()
      };
      
      await this.kv.put(cacheKey, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      logger.error('Error caching active question:', error);
      return false;
    }
  }

  async getActiveQuestion(telegramId) {
    try {
      const cacheKey = `active_question:${telegramId}`;
      const cachedData = await this.kv.get(cacheKey);
      
      if (!cachedData) return null;

      const cacheData = JSON.parse(cachedData);
      
      // Check if cache is expired (5 minutes)
      if (Date.now() - cacheData.cachedAt > 5 * 60 * 1000) {
        await this.kv.delete(cacheKey);
        return null;
      }

      return cacheData;
    } catch (error) {
      logger.error('Error getting active question:', error);
      return null;
    }
  }

  async clearActiveQuestion(telegramId) {
    try {
      const cacheKey = `active_question:${telegramId}`;
      await this.kv.delete(cacheKey);
      return true;
    } catch (error) {
      logger.error('Error clearing active question:', error);
      return false;
    }
  }

  async cacheRateLimit(telegramId, action = 'play') {
    try {
      const hour = new Date().getHours();
      const cacheKey = `rate_limit:${telegramId}:${action}:${hour}`;
      
      const current = await this.kv.get(cacheKey);
      const count = current ? parseInt(current) : 0;
      
      await this.kv.put(cacheKey, (count + 1).toString(), { expirationTtl: 3600 }); // 1 hour TTL
      
      return count + 1;
    } catch (error) {
      logger.error('Error caching rate limit:', error);
      return 0;
    }
  }

  // ==========================================
  // WALLET OPERATIONS
  // ==========================================

  async getUserWallet(userId) {
    try {
      const walletData = await this.kv.get(`wallet:${userId}`);
      return walletData ? JSON.parse(walletData) : null;
    } catch (error) {
      logger.error('Error getting user wallet:', error);
      return null;
    }
  }

  async updateUserWallet(userId, amount, type, description, metadata = {}) {
    try {
      let wallet = await this.getUserWallet(userId);
      
      if (!wallet) {
        wallet = {
          userId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          transactions: [],
          dailyBonusClaimed: false,
          lastBonusDate: null,
          createdAt: new Date().toISOString()
        };
      }

      const transaction = {
        id: crypto.randomUUID(),
        type,
        amount,
        description,
        metadata,
        timestamp: new Date().toISOString(),
        balanceBefore: wallet.balance
      };

      wallet.balance += amount;
      wallet.transactions.push(transaction);

      if (type === 'earn') {
        wallet.totalEarned += amount;
      } else if (type === 'spend') {
        wallet.totalSpent += Math.abs(amount);
      }

      await this.kv.put(`wallet:${userId}`, JSON.stringify(wallet));

      return {
        success: true,
        newBalance: wallet.balance,
        transaction
      };
    } catch (error) {
      logger.error('Error updating user wallet:', error);
      return { success: false, error: 'Failed to update wallet' };
    }
  }

  // ==========================================
  // HEALTH CHECK
  // ==========================================

  async healthCheck() {
    try {
      // Test basic KV operations
      const testKey = `health_check_${Date.now()}`;
      const testValue = JSON.stringify({ test: true, timestamp: Date.now() });
      
      await this.kv.put(testKey, testValue);
      const retrieved = await this.kv.get(testKey);
      await this.kv.delete(testKey);

      if (!retrieved || retrieved !== testValue) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }

  // ==========================================
  // BATCH OPERATIONS
  // ==========================================

  async batchGet(keys) {
    try {
      const results = {};
      
      for (const key of keys) {
        const value = await this.kv.get(key);
        if (value) {
          results[key] = JSON.parse(value);
        }
      }
      
      return results;
    } catch (error) {
      logger.error('Error in batch get:', error);
      return {};
    }
  }

  async batchPut(items) {
    try {
      const promises = [];
      
      for (const item of items) {
        promises.push(this.kv.put(item.key, JSON.stringify(item.value), item.options || {}));
      }
      
      await Promise.all(promises);
      return true;
    } catch (error) {
      logger.error('Error in batch put:', error);
      return false;
    }
  }
}
