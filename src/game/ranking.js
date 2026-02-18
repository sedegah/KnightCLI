/**
 * G-NEX Ranking and Tier System
 * Implements Bronze, Silver, Gold, Diamond, Elite Ghana Champion tiers
 */

import { logger } from '../utils/logger.js';

export class RankingSystem {
  constructor(kv) {
    this.kv = kv;
    
    // Tier thresholds (weekly points required)
    this.tiers = {
      BRONZE: { min: 0, max: 99, name: 'Bronze', emoji: '🥉', color: '#CD7F32' },
      SILVER: { min: 100, max: 299, name: 'Silver', emoji: '🥈', color: '#C0C0C0' },
      GOLD: { min: 300, max: 749, name: 'Gold', emoji: '🥇', color: '#FFD700' },
      DIAMOND: { min: 750, max: 1999, name: 'Diamond', emoji: '💎', color: '#B9F2FF' },
      ELITE: { min: 2000, max: Infinity, name: 'Elite Ghana Champion', emoji: '👑', color: '#FF6B6B' }
    };
  }

  // ==========================================
  // TIER CALCULATION
  // ==========================================

  async calculateUserTier(userId) {
    try {
      const user = await this.getUserRankingData(userId);
      if (!user) return this.tiers.BRONZE;

      const weeklyPoints = user.weeklyPoints || 0;
      
      for (const [tierKey, tier] of Object.entries(this.tiers)) {
        if (weeklyPoints >= tier.min && weeklyPoints <= tier.max) {
          return { ...tier, key: tierKey };
        }
      }

      return this.tiers.BRONZE;
    } catch (error) {
      logger.error('Error calculating user tier:', error);
      return this.tiers.BRONZE;
    }
  }

  async getUserRankingData(userId) {
    try {
      const rankingData = await this.kv.get(`ranking:${userId}`);
      return rankingData ? JSON.parse(rankingData) : null;
    } catch (error) {
      logger.error('Error getting user ranking data:', error);
      return null;
    }
  }

  async updateUserRanking(userId, points, isWeekly = true) {
    try {
      let ranking = await this.getUserRankingData(userId);
      
      if (!ranking) {
        ranking = {
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
          squadContributions: 0,
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };
      }

      // Update points
      if (isWeekly) {
        ranking.weeklyPoints += points;
      }
      ranking.totalPoints += points;
      ranking.lastUpdated = new Date().toISOString();

      // Calculate new tier
      const newTier = await this.calculateUserTier(userId);
      const previousTier = ranking.currentTier;
      ranking.currentTier = newTier.key;

      // Track highest tier achieved
      if (this.getTierLevel(newTier.key) > this.getTierLevel(ranking.highestTier)) {
        ranking.highestTier = newTier.key;
      }

      await this.kv.put(`ranking:${userId}`, JSON.stringify(ranking));

      return {
        ranking,
        tierUp: previousTier !== newTier.key && this.getTierLevel(newTier.key) > this.getTierLevel(previousTier),
        newTier,
        previousTier
      };
    } catch (error) {
      logger.error('Error updating user ranking:', error);
      return null;
    }
  }

  getTierLevel(tierKey) {
    const levels = { BRONZE: 1, SILVER: 2, GOLD: 3, DIAMOND: 4, ELITE: 5 };
    return levels[tierKey] || 1;
  }

  // ==========================================
  // LEADERBOARD MANAGEMENT
  // ==========================================

  async getWeeklyLeaderboard(limit = 50, tier = 'all') {
    try {
      const list = await this.kv.list({ prefix: 'ranking:' });
      const rankings = [];

      for (const key of list.keys) {
        const rankingData = await this.kv.get(key.name);
        if (rankingData) {
          const ranking = JSON.parse(rankingData);
          
          // Filter by tier if specified
          if (tier !== 'all' && ranking.currentTier !== tier) {
            continue;
          }

          rankings.push({
            userId: ranking.userId,
            weeklyPoints: ranking.weeklyPoints,
            totalPoints: ranking.totalPoints,
            currentTier: ranking.currentTier,
            currentStreak: ranking.currentStreak,
            battlesWon: ranking.battlesWon,
            lastUpdated: ranking.lastUpdated
          });
        }
      }

      // Sort by weekly points descending
      rankings.sort((a, b) => b.weeklyPoints - a.weeklyPoints);

      // Add rank positions
      const leaderboard = rankings.slice(0, limit).map((user, index) => ({
        ...user,
        rank: index + 1,
        tier: this.tiers[user.currentTier]
      }));

      return leaderboard;
    } catch (error) {
      logger.error('Error getting weekly leaderboard:', error);
      return [];
    }
  }

  async getSquadLeaderboard(limit = 20) {
    try {
      const list = await this.kv.list({ prefix: 'squad:' });
      const squads = [];

      for (const key of list.keys) {
        const squadData = await this.kv.get(key.name);
        if (squadData) {
          const squad = JSON.parse(squadData);
          if (squad.status === 'active') {
            squads.push({
              id: squad.id,
              name: squad.name,
              weeklyScore: squad.weeklyScore,
              memberCount: squad.memberIds.length,
              battlesWon: squad.battlesWon,
              battlesPlayed: squad.battlesPlayed,
              lastActivity: squad.lastActivity
            });
          }
        }
      }

      // Sort by weekly score descending
      squads.sort((a, b) => b.weeklyScore - a.weeklyScore);

      // Add rank positions
      const leaderboard = squads.slice(0, limit).map((squad, index) => ({
        ...squad,
        rank: index + 1
      }));

      return leaderboard;
    } catch (error) {
      logger.error('Error getting squad leaderboard:', error);
      return [];
    }
  }

  async getPartnershipLeaderboard(limit = 20) {
    try {
      const list = await this.kv.list({ prefix: 'partnership:' });
      const partnerships = [];

      for (const key of list.keys) {
        const partnershipData = await this.kv.get(key.name);
        if (partnershipData) {
          const partnership = JSON.parse(partnershipData);
          if (partnership.status === 'active') {
            partnerships.push({
              id: partnership.id,
              player1Id: partnership.player1Id,
              player2Id: partnership.player2Id,
              combinedScore: partnership.combinedScore,
              currentStreak: partnership.currentStreak,
              bestStreak: partnership.bestStreak,
              accuracy: partnership.questionsAnswered > 0 ? 
                Math.round((partnership.correctAnswers / partnership.questionsAnswered) * 100) : 0,
              lastActivity: partnership.lastActivity
            });
          }
        }
      }

      // Sort by combined score descending
      partnerships.sort((a, b) => b.combinedScore - a.combinedScore);

      // Add rank positions
      const leaderboard = partnerships.slice(0, limit).map((partnership, index) => ({
        ...partnership,
        rank: index + 1
      }));

      return leaderboard;
    } catch (error) {
      logger.error('Error getting partnership leaderboard:', error);
      return [];
    }
  }

  // ==========================================
  // TIER BENEFITS AND REWARDS
  // ==========================================

  getTierBenefits(tierKey) {
    const benefits = {
      BRONZE: {
        dailyBonusQuestions: 0,
        challengeDiscount: 0,
        prioritySupport: false,
        exclusiveTournaments: false,
        dataRewardMultiplier: 1.0,
        pointsMultiplier: 1.0
      },
      SILVER: {
        dailyBonusQuestions: 2,
        challengeDiscount: 0.1,
        prioritySupport: false,
        exclusiveTournaments: false,
        dataRewardMultiplier: 1.2,
        pointsMultiplier: 1.1
      },
      GOLD: {
        dailyBonusQuestions: 5,
        challengeDiscount: 0.15,
        prioritySupport: true,
        exclusiveTournaments: true,
        dataRewardMultiplier: 1.5,
        pointsMultiplier: 1.25
      },
      DIAMOND: {
        dailyBonusQuestions: 10,
        challengeDiscount: 0.25,
        prioritySupport: true,
        exclusiveTournaments: true,
        dataRewardMultiplier: 2.0,
        pointsMultiplier: 1.5
      },
      ELITE: {
        dailyBonusQuestions: 20,
        challengeDiscount: 0.5,
        prioritySupport: true,
        exclusiveTournaments: true,
        dataRewardMultiplier: 3.0,
        pointsMultiplier: 2.0
      }
    };

    return benefits[tierKey] || benefits.BRONZE;
  }

  async getUserBenefits(userId) {
    const tier = await this.calculateUserTier(userId);
    return this.getTierBenefits(tier.key);
  }

  // ==========================================
  // RANK NOTIFICATIONS
  // ==========================================

  async checkAndNotifyRankChanges(userId) {
    try {
      const ranking = await this.getUserRankingData(userId);
      if (!ranking) return null;

      const currentRank = await this.getUserWeeklyRank(userId);
      const previousBest = ranking.bestWeeklyRank;

      let notification = null;

      if (currentRank > 0 && currentRank < previousBest) {
        ranking.bestWeeklyRank = currentRank;
        notification = {
          type: 'new_best_rank',
          message: `🎉 New personal best! You're now ranked #${currentRank} this week!`,
          rank: currentRank
        };
      }

      if (currentRank <= 10 && previousBest > 10) {
        notification = {
          type: 'top_10',
          message: `🏆 Amazing! You've entered the Top 10! Current rank: #${currentRank}`,
          rank: currentRank
        };
      }

      if (currentRank === 1 && previousBest !== 1) {
        notification = {
          type: 'rank_1',
          message: `👑 YOU'RE #1! You're leading the Ghana leaderboard!`,
          rank: currentRank
        };
      }

      if (notification) {
        await this.kv.put(`ranking:${userId}`, JSON.stringify(ranking));
      }

      return notification;
    } catch (error) {
      logger.error('Error checking rank changes:', error);
      return null;
    }
  }

  async getUserWeeklyRank(userId) {
    try {
      const leaderboard = await this.getWeeklyLeaderboard(1000);
      const userEntry = leaderboard.find(u => u.userId === userId);
      return userEntry ? userEntry.rank : 0;
    } catch (error) {
      logger.error('Error getting user weekly rank:', error);
      return 0;
    }
  }

  // ==========================================
  // WEEKLY RESET (for scheduler)
  // ==========================================

  async performWeeklyReset() {
    try {
      logger.info('Starting weekly ranking reset...');
      
      const list = await this.kv.list({ prefix: 'ranking:' });
      let resetCount = 0;

      for (const key of list.keys) {
        const rankingData = await this.kv.get(key.name);
        if (rankingData) {
          const ranking = JSON.parse(rankingData);
          
          // Store previous week's performance for history
          const weeklyHistory = {
            week: this.getWeekNumber(new Date()),
            year: new Date().getFullYear(),
            points: ranking.weeklyPoints,
            tier: ranking.currentTier,
            rank: ranking.weeklyRank
          };

          await this.kv.put(`weekly_history:${ranking.userId}:${weeklyHistory.week}_${weeklyHistory.year}`, 
                           JSON.stringify(weeklyHistory));

          // Reset weekly stats
          ranking.weeklyPoints = 0;
          ranking.weeklyRank = 0;
          ranking.lastUpdated = new Date().toISOString();

          await this.kv.put(key.name, JSON.stringify(ranking));
          resetCount++;
        }
      }

      // Reset squad weekly scores
      const squadList = await this.kv.list({ prefix: 'squad:' });
      for (const key of squadList.keys) {
        const squadData = await this.kv.get(key.name);
        if (squadData) {
          const squad = JSON.parse(squadData);
          squad.weeklyScore = 0;
          squad.weeklyRank = 0;
          squad.lastActivity = new Date().toISOString();
          await this.kv.put(key.name, JSON.stringify(squad));
        }
      }

      logger.info(`Weekly reset completed. Reset ${resetCount} users.`);
      return resetCount;
    } catch (error) {
      logger.error('Error performing weekly reset:', error);
      return 0;
    }
  }

  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  // ==========================================
  // ACHIEVEMENTS AND BADGES
  // ==========================================

  async checkAchievements(userId) {
    try {
      const ranking = await this.getUserRankingData(userId);
      if (!ranking) return [];

      const achievements = [];

      // Streak achievements
      if (ranking.bestStreak >= 7) achievements.push({ id: 'week_warrior', name: 'Week Warrior', emoji: '🔥' });
      if (ranking.bestStreak >= 30) achievements.push({ id: 'month_master', name: 'Month Master', emoji: '📅' });

      // Battle achievements
      if (ranking.battlesWon >= 10) achievements.push({ id: 'battle_veteran', name: 'Battle Veteran', emoji: '⚔️' });
      if (ranking.battlesWon >= 50) achievements.push({ id: 'battle_legend', name: 'Battle Legend', emoji: '👑' });

      // Tier achievements
      if (ranking.highestTier === 'GOLD') achievements.push({ id: 'gold_player', name: 'Gold Player', emoji: '🥇' });
      if (ranking.highestTier === 'DIAMOND') achievements.push({ id: 'diamond_elite', name: 'Diamond Elite', emoji: '💎' });
      if (ranking.highestTier === 'ELITE') achievements.push({ id: 'ghana_champion', name: 'Ghana Champion', emoji: '🇬🇭' });

      // Accuracy achievements
      const accuracy = ranking.totalQuestions > 0 ? (ranking.correctAnswers / ranking.totalQuestions) : 0;
      if (accuracy >= 0.8 && ranking.totalQuestions >= 100) {
        achievements.push({ id: 'sharp_shooter', name: 'Sharp Shooter', emoji: '🎯' });
      }

      return achievements;
    } catch (error) {
      logger.error('Error checking achievements:', error);
      return [];
    }
  }
}
