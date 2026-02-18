/**
 * G-NEX Streak Rewards and Multiplier System
 * Implements daily streaks with escalating rewards
 */

import { logger } from '../utils/logger.js';

export class StreakManager {
  constructor(kv) {
    this.kv = kv;
    
    // Streak reward thresholds
    this.streakRewards = {
      3: { type: 'points', amount: 50, description: '3-Day Streak Bonus: +50 AP' },
      7: { type: 'data_draw', amount: 'entry', description: '7-Day Streak: Entry into data draw' },
      14: { type: 'multiplier', amount: 1.2, description: '14-Day Streak: 1.2x Points Multiplier' },
      30: { type: 'guaranteed', amount: '100MB', description: '30-Day Streak: Guaranteed 100MB Data' },
      60: { type: 'multiplier', amount: 1.5, description: '60-Day Streak: 1.5x Points Multiplier' },
      90: { type: 'exclusive', amount: 'elite_entry', description: '90-Day Streak: Elite Tournament Entry' },
      180: { type: 'legendary', amount: '500MB', description: '180-Day Streak: Legendary 500MB Data' },
      365: { type: 'immortal', amount: '1GB', description: '365-Day Streak: Immortal 1GB Data' }
    };

    // Streak protection costs (in points)
    this.streakProtectionCosts = {
      1: 100,   // Protect 1 day streak
      3: 250,   // Protect 3 day streak
      7: 500,   // Protect 7 day streak
      14: 1000, // Protect 14 day streak
      30: 2000  // Protect 30+ day streak
    };
  }

  // ==========================================
  // STREAK TRACKING
  // ==========================================

  async updateDailyStreak(userId, playedToday = true) {
    try {
      const streakData = await this.getUserStreakData(userId);
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      let streak = streakData || {
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

      const wasStreakBroken = this.checkIfStreakBroken(streak.lastPlayDate, today, streak.protectedUntil);

      if (wasStreakBroken) {
        // Streak was broken, reset to 1 if playing today
        streak.currentStreak = playedToday ? 1 : 0;
        streak.multiplier = 1.0;
        
        if (playedToday) {
          logger.info(`Streak broken for user ${userId}, starting new streak`);
        }
      } else if (playedToday && streak.lastPlayDate !== today) {
        // Played today and it's a new day, increment streak
        streak.currentStreak++;
        streak.multiplier = this.calculateStreakMultiplier(streak.currentStreak);
        
        // Update longest streak if needed
        if (streak.currentStreak > streak.longestStreak) {
          streak.longestStreak = streak.currentStreak;
        }

        logger.info(`User ${userId} streak updated to ${streak.currentStreak} days`);
      }

      if (playedToday && streak.lastPlayDate !== today) {
        streak.lastPlayDate = today;
        streak.totalDaysPlayed++;
      }

      await this.kv.put(`streak:${userId}`, JSON.stringify(streak));
      
      return {
        streak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        multiplier: streak.multiplier,
        wasBroken: wasStreakBroken && playedToday,
        rewardsAvailable: this.getAvailableRewards(streak)
      };
    } catch (error) {
      logger.error('Error updating daily streak:', error);
      return null;
    }
  }

  checkIfStreakBroken(lastPlayDate, today, protectedUntil) {
    if (!lastPlayDate) return false;

    // Check if streak is protected
    if (protectedUntil && new Date(protectedUntil) > new Date(today)) {
      return false;
    }

    const lastPlay = new Date(lastPlayDate);
    const current = new Date(today);
    const daysDiff = Math.floor((current - lastPlay) / (1000 * 60 * 60 * 24));

    return daysDiff > 1; // Streak broken if more than 1 day gap
  }

  calculateStreakMultiplier(streakDays) {
    let multiplier = 1.0;

    if (streakDays >= 14) multiplier = 1.2;
    if (streakDays >= 30) multiplier = 1.3;
    if (streakDays >= 60) multiplier = 1.5;
    if (streakDays >= 90) multiplier = 1.8;
    if (streakDays >= 180) multiplier = 2.0;
    if (streakDays >= 365) multiplier = 2.5;

    return multiplier;
  }

  // ==========================================
  // STREAK REWARDS
  // ==========================================

  getAvailableRewards(streakData) {
    const available = [];
    
    for (const [days, reward] of Object.entries(this.streakRewards)) {
      const streakDays = parseInt(days);
      
      if (streakData.currentStreak >= streakDays && !streakData.rewardsClaimed.includes(days)) {
        available.push({
          days: streakDays,
          ...reward
        });
      }
    }

    return available;
  }

  async claimStreakReward(userId, streakDays) {
    try {
      const streakData = await this.getUserStreakData(userId);
      if (!streakData) return { error: 'No streak data found' };

      const reward = this.streakRewards[streakDays];
      if (!reward) return { error: 'Invalid reward tier' };

      if (streakData.currentStreak < streakDays) {
        return { error: 'Streak not long enough for this reward' };
      }

      if (streakData.rewardsClaimed.includes(streakDays.toString())) {
        return { error: 'Reward already claimed' };
      }

      // Mark reward as claimed
      streakData.rewardsClaimed.push(streakDays.toString());

      // Process reward based on type
      let rewardResult = null;

      switch (reward.type) {
        case 'points':
          rewardResult = await this.grantPointsReward(userId, reward.amount);
          break;
        case 'data_draw':
          rewardResult = await this.enterDataDraw(userId, streakDays);
          break;
        case 'guaranteed':
          rewardResult = await this.grantDataReward(userId, reward.amount);
          break;
        case 'multiplier':
          streakData.multiplier = reward.amount;
          rewardResult = { type: 'multiplier', value: reward.amount };
          break;
        case 'exclusive':
          rewardResult = await this.grantExclusiveAccess(userId, reward.amount);
          break;
        case 'legendary':
        case 'immortal':
          rewardResult = await this.grantDataReward(userId, reward.amount);
          break;
      }

      await this.kv.put(`streak:${userId}`, JSON.stringify(streakData));

      return {
        success: true,
        reward: {
          days: streakDays,
          ...reward,
          result: rewardResult
        }
      };
    } catch (error) {
      logger.error('Error claiming streak reward:', error);
      return { error: 'Failed to claim reward' };
    }
  }

  async grantPointsReward(userId, amount) {
    try {
      // Update user's points in ranking system
      // This would integrate with the ranking system
      return { type: 'points', amount, message: `+${amount} AP awarded!` };
    } catch (error) {
      logger.error('Error granting points reward:', error);
      return null;
    }
  }

  async enterDataDraw(userId, streakDays) {
    try {
      const drawId = `weekly_draw_${this.getWeekNumber()}`;
      const drawEntry = {
        userId,
        streakDays,
        entryDate: new Date().toISOString(),
        weight: streakDays // Higher streak = higher chance
      };

      await this.kv.put(`draw_entry:${userId}:${drawId}`, JSON.stringify(drawEntry));
      
      return { type: 'data_draw', drawId, message: 'Entered into weekly data draw!' };
    } catch (error) {
      logger.error('Error entering data draw:', error);
      return null;
    }
  }

  async grantDataReward(userId, amount) {
    try {
      // This would integrate with your data reward system
      const rewardId = crypto.randomUUID();
      const reward = {
        id: rewardId,
        userId,
        amount,
        type: 'data',
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days to claim
      };

      await this.kv.put(`data_reward:${rewardId}`, JSON.stringify(reward));
      
      return { type: 'data', amount, rewardId, message: `${amount} data reward ready to claim!` };
    } catch (error) {
      logger.error('Error granting data reward:', error);
      return null;
    }
  }

  async grantExclusiveAccess(userId, accessType) {
    try {
      const access = {
        userId,
        type: accessType,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };

      await this.kv.put(`exclusive_access:${userId}:${accessType}`, JSON.stringify(access));
      
      return { type: 'exclusive', accessType, message: 'Exclusive tournament access granted!' };
    } catch (error) {
      logger.error('Error granting exclusive access:', error);
      return null;
    }
  }

  // ==========================================
  // STREAK PROTECTION
  // ==========================================

  async protectStreak(userId, days, userPoints) {
    try {
      const cost = this.getProtectionCost(days);
      if (userPoints < cost) {
        return { error: `Insufficient points. Need ${cost} points.` };
      }

      const streakData = await this.getUserStreakData(userId);
      if (!streakData) return { error: 'No active streak to protect' };

      // Calculate protection period (1 day per day protected, up to 7 days max)
      const protectionDays = Math.min(days, 7);
      const protectionUntil = new Date(Date.now() + protectionDays * 24 * 60 * 60 * 1000);

      streakData.protectedUntil = protectionUntil.toISOString();

      await this.kv.put(`streak:${userId}`, JSON.stringify(streakData));

      return {
        success: true,
        cost,
        protectionDays,
        protectedUntil: protectionUntil.toISOString(),
        message: `Streak protected for ${protectionDays} days!`
      };
    } catch (error) {
      logger.error('Error protecting streak:', error);
      return { error: 'Failed to protect streak' };
    }
  }

  getProtectionCost(days) {
    return this.streakProtectionCosts[days] || this.streakProtectionCosts[30];
  }

  // ==========================================
  // STREAK VISUALIZATION AND SHARING
  // ==========================================

  async generateStreakCard(userId) {
    try {
      const streakData = await this.getUserStreakData(userId);
      if (!streakData) return null;

      const tier = this.getStreakTier(streakData.currentStreak);
      const nextReward = this.getNextReward(streakData);

      return {
        currentStreak: streakData.currentStreak,
        longestStreak: streakData.longestStreak,
        multiplier: streakData.multiplier,
        tier,
        nextReward,
        daysPlayed: streakData.totalDaysPlayed,
        protectedUntil: streakData.protectedUntil,
        cardImage: this.generateStreakImageUrl(streakData.currentStreak, tier)
      };
    } catch (error) {
      logger.error('Error generating streak card:', error);
      return null;
    }
  }

  getStreakTier(streakDays) {
    if (streakDays >= 365) return { name: 'Immortal', emoji: '👑', color: '#FF6B6B' };
    if (streakDays >= 180) return { name: 'Legendary', emoji: '🔥', color: '#FF9F40' };
    if (streakDays >= 90) return { name: 'Elite', emoji: '💎', color: '#4ECDC4' };
    if (streakDays >= 30) return { name: 'Master', emoji: '🏆', color: '#45B7D1' };
    if (streakDays >= 14) return { name: 'Veteran', emoji: '⭐', color: '#96CEB4' };
    if (streakDays >= 7) return { name: 'Regular', emoji: '📅', color: '#FFEAA7' };
    if (streakDays >= 3) return { name: 'Rising', emoji: '🌱', color: '#DFE6E9' };
    return { name: 'Beginner', emoji: '🌟', color: '#B2BEC3' };
  }

  getNextReward(streakData) {
    const available = this.getAvailableRewards(streakData);
    return available.length > 0 ? available[0] : this.getNextUpcomingReward(streakData.currentStreak);
  }

  getNextUpcomingReward(currentStreak) {
    for (const [days, reward] of Object.entries(this.streakRewards)) {
      const streakDays = parseInt(days);
      if (currentStreak < streakDays) {
        return { days: streakDays, ...reward, daysToGo: streakDays - currentStreak };
      }
    }
    return null;
  }

  generateStreakImageUrl(streakDays, tier) {
    // This would generate an image URL for sharing streak cards
    // For now, return a placeholder
    return `https://via.placeholder.com/400x200/${tier.color.replace('#', '')}/FFFFFF?text=Streak:+${streakDays}+days`;
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  async getUserStreakData(userId) {
    try {
      const streakData = await this.kv.get(`streak:${userId}`);
      return streakData ? JSON.parse(streakData) : null;
    } catch (error) {
      logger.error('Error getting user streak data:', error);
      return null;
    }
  }

  getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek) + 1;
  }

  // ==========================================
  // DATA DRAW MANAGEMENT
  // ==========================================

  async runWeeklyDataDraw() {
    try {
      logger.info('Running weekly data draw...');
      
      const drawId = `weekly_draw_${this.getWeekNumber()}`;
      const entries = await this.getDrawEntries(drawId);

      if (entries.length === 0) {
        logger.info('No entries for weekly draw');
        return [];
      }

      // Weighted random selection based on streak length
      const winners = this.selectDrawWinners(entries, 5); // 5 winners per week

      // Grant data rewards to winners
      const rewards = [];
      for (let i = 0; i < winners.length; i++) {
        const amounts = ['500MB', '300MB', '200MB', '100MB', '100MB'];
        const reward = await this.grantDataReward(winners[i].userId, amounts[i]);
        rewards.push({ ...winners[i], reward });
      }

      logger.info(`Weekly draw completed. ${winners.length} winners selected.`);
      return rewards;
    } catch (error) {
      logger.error('Error running weekly data draw:', error);
      return [];
    }
  }

  async getDrawEntries(drawId) {
    try {
      const list = await this.kv.list({ prefix: `draw_entry:` });
      const entries = [];

      for (const key of list.keys) {
        if (key.name.includes(drawId)) {
          const entryData = await this.kv.get(key.name);
          if (entryData) {
            entries.push(JSON.parse(entryData));
          }
        }
      }

      return entries;
    } catch (error) {
      logger.error('Error getting draw entries:', error);
      return [];
    }
  }

  selectDrawWinners(entries, winnerCount) {
    // Weighted selection based on streak length
    const weights = entries.map(entry => entry.weight || 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    const winners = [];
    const availableEntries = [...entries];

    for (let i = 0; i < Math.min(winnerCount, availableEntries.length); i++) {
      const random = Math.random() * totalWeight;
      let weightSum = 0;
      
      for (let j = 0; j < availableEntries.length; j++) {
        weightSum += availableEntries[j].weight || 1;
        if (random <= weightSum) {
          winners.push(availableEntries[j]);
          availableEntries.splice(j, 1);
          break;
        }
      }
    }

    return winners;
  }
}
