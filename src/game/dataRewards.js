/**
 * G-NEX Data Reward System
 * Implements free data rewards for Ghanaian telecom operators
 */

import { logger } from '../utils/logger.js';

export class DataRewardManager {
  constructor(kv) {
    this.kv = kv;
    
    // Ghana telecom operators
    this.operators = {
      MTN: { name: 'MTN Ghana', code: 'mtn', color: '#FFB900' },
      VODAFONE: { name: 'Vodafone Ghana', code: 'vod', color: '#E60000' },
      AIRTELTIGO: { name: 'AirtelTigo', code: 'tigo', color: '#00B900' },
      GLO: { name: 'GLO Ghana', code: 'glo', color: '#0099FF' }
    };

    // Data bundle sizes (in MB)
    this.bundleSizes = {
      TINY: { size: 50, name: '50MB', cost: 100 },
      SMALL: { size: 100, name: '100MB', cost: 180 },
      MEDIUM: { size: 250, name: '250MB', cost: 400 },
      LARGE: { size: 500, name: '500MB', cost: 750 },
      EXTRA_LARGE: { size: 1000, name: '1GB', cost: 1400 },
      HUGE: { size: 2000, name: '2GB', cost: 2500 },
      MASSIVE: { size: 5000, name: '5GB', cost: 5500 }
    };

    // Weekly reward pools (cost-controlled)
    this.weeklyPools = {
      INDIVIDUAL: { total: 10000, winners: 10, distribution: 'top_10' },
      SQUAD: { total: 5000, winners: 3, distribution: 'top_3' },
      PARTNERSHIP: { total: 3000, winners: 2, distribution: 'top_2' },
      STREAK: { total: 2000, winners: 5, distribution: 'streak_based' }
    };
  }

  // ==========================================
  // REWARD CREATION AND MANAGEMENT
  // ==========================================

  async createDataReward(userId, amount, source, metadata = {}) {
    try {
      const reward = {
        id: crypto.randomUUID(),
        userId,
        amount, // in MB
        source, // 'weekly_win', 'streak_reward', 'achievement', 'purchase'
        operator: metadata.operator || 'MTN', // Default to MTN
        phoneNumber: metadata.phoneNumber || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days to claim
        claimedAt: null,
        metadata
      };

      await this.kv.put(`data_reward:${reward.id}`, JSON.stringify(reward));
      
      // Add to user's pending rewards
      await this.addUserPendingReward(userId, reward.id);

      logger.info(`Created data reward: ${amount}MB for user ${userId} from ${source}`);
      return reward;
    } catch (error) {
      logger.error('Error creating data reward:', error);
      return null;
    }
  }

  async addUserPendingReward(userId, rewardId) {
    try {
      const key = `pending_rewards:${userId}`;
      const existing = await this.kv.get(key);
      const rewards = existing ? JSON.parse(existing) : [];
      
      rewards.push(rewardId);
      await this.kv.put(key, JSON.stringify(rewards));
    } catch (error) {
      logger.error('Error adding user pending reward:', error);
    }
  }

  // ==========================================
  // REWARD CLAIMING
  // ==========================================

  async claimDataReward(userId, rewardId, phoneNumber, operator) {
    try {
      const rewardData = await this.kv.get(`data_reward:${rewardId}`);
      if (!rewardData) {
        return { success: false, error: 'Reward not found' };
      }

      const reward = JSON.parse(rewardData);
      
      if (reward.userId !== userId) {
        return { success: false, error: 'This reward belongs to another user' };
      }

      if (reward.status !== 'pending') {
        return { success: false, error: 'Reward already claimed or expired' };
      }

      if (new Date() > new Date(reward.expiresAt)) {
        reward.status = 'expired';
        await this.kv.put(`data_reward:${rewardId}`, JSON.stringify(reward));
        return { success: false, error: 'Reward has expired' };
      }

      // Validate phone number
      const phoneValidation = this.validatePhoneNumber(phoneNumber, operator);
      if (!phoneValidation.valid) {
        return { success: false, error: phoneValidation.error };
      }

      // Process the reward (this would integrate with telecom APIs)
      const processingResult = await this.processDataReward(reward, phoneNumber, operator);
      
      if (processingResult.success) {
        reward.status = 'claimed';
        reward.claimedAt = new Date().toISOString();
        reward.phoneNumber = phoneNumber;
        reward.operator = operator;
        reward.transactionId = processingResult.transactionId;

        await this.kv.put(`data_reward:${rewardId}`, JSON.stringify(reward));
        
        // Remove from pending rewards
        await this.removeUserPendingReward(userId, rewardId);

        return {
          success: true,
          reward,
          message: `Successfully claimed ${reward.amount}MB data reward!`,
          processingDetails: processingResult
        };
      } else {
        return { success: false, error: 'Failed to process data reward' };
      }
    } catch (error) {
      logger.error('Error claiming data reward:', error);
      return { success: false, error: 'Failed to claim reward' };
    }
  }

  validatePhoneNumber(phoneNumber, operator) {
    // Basic Ghana phone number validation
    const ghanaRegex = /^(\+233|0)(2|5|3|7)\d{8}$/;
    
    if (!ghanaRegex.test(phoneNumber)) {
      return { valid: false, error: 'Invalid Ghanaian phone number format' };
    }

    // Check if number matches the selected operator
    const operatorPrefix = this.getOperatorPrefix(phoneNumber);
    if (operatorPrefix !== operator.toLowerCase()) {
      return { valid: false, error: `Phone number does not match ${operator} network` };
    }

    return { valid: true };
  }

  getOperatorPrefix(phoneNumber) {
    // Ghana operator prefixes
    const prefixes = {
      'mtn': ['024', '054', '055', '059', '+23324', '+23354', '+23355', '+23359'],
      'vod': ['020', '050', '+23320', '+23350'],
      'tigo': ['027', '057', '+23327', '+23357'],
      'glo': ['023', '024', '025', '026', '053', '054', '055', '056', '+23323', '+23324', '+23325', '+23326', '+23353', '+23354', '+23355', '+23356']
    };

    const cleanNumber = phoneNumber.replace('+233', '0');
    
    for (const [operator, prefixList] of Object.entries(prefixes)) {
      for (const prefix of prefixList) {
        if (cleanNumber.startsWith(prefix)) {
          return operator;
        }
      }
    }

    return 'unknown';
  }

  async processDataReward(reward, phoneNumber, operator) {
    try {
      // This would integrate with actual telecom APIs
      // For now, simulate successful processing
      
      const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Simulate API call to telecom provider
      const apiResult = await this.simulateTelecomAPI(reward, phoneNumber, operator);
      
      if (apiResult.success) {
        return {
          success: true,
          transactionId,
          provider: operator,
          amount: reward.amount,
          phoneNumber,
          estimatedDelivery: 'Within 24 hours'
        };
      } else {
        return { success: false, error: apiResult.error };
      }
    } catch (error) {
      logger.error('Error processing data reward:', error);
      return { success: false, error: 'Processing failed' };
    }
  }

  async simulateTelecomAPI(reward, phoneNumber, operator) {
    // Simulate telecom API response
    // In production, this would make actual API calls to MTN, Vodafone, etc.
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
    
    // Simulate 95% success rate
    if (Math.random() < 0.95) {
      return { success: true };
    } else {
      return { success: false, error: 'Telecom API temporarily unavailable' };
    }
  }

  async removeUserPendingReward(userId, rewardId) {
    try {
      const key = `pending_rewards:${userId}`;
      const existing = await this.kv.get(key);
      const rewards = existing ? JSON.parse(existing) : [];
      
      const updatedRewards = rewards.filter(id => id !== rewardId);
      await this.kv.put(key, JSON.stringify(updatedRewards));
    } catch (error) {
      logger.error('Error removing user pending reward:', error);
    }
  }

  // ==========================================
  // WEEKLY REWARD DISTRIBUTION
  // ==========================================

  async distributeWeeklyRewards() {
    try {
      logger.info('Starting weekly data reward distribution...');
      
      const results = {
        individual: await this.distributeIndividualRewards(),
        squad: await this.distributeSquadRewards(),
        partnership: await this.distributePartnershipRewards(),
        streak: await this.distributeStreakRewards()
      };

      logger.info(`Weekly distribution completed: ${JSON.stringify(results)}`);
      return results;
    } catch (error) {
      logger.error('Error distributing weekly rewards:', error);
      return null;
    }
  }

  async distributeIndividualRewards() {
    try {
      const pool = this.weeklyPools.INDIVIDUAL;
      const leaderboard = await this.getWeeklyLeaderboard();
      
      if (leaderboard.length < pool.winners) {
        logger.warn(`Not enough players for individual rewards (${leaderboard.length} < ${pool.winners})`);
        return { distributed: 0, winners: [] };
      }

      const winners = leaderboard.slice(0, pool.winners);
      const rewards = [];
      
      // Distribute rewards based on rank
      const rewardDistribution = [
        { rank: 1, amount: 1000 }, // 1GB
        { rank: 2, amount: 500 },  // 500MB
        { rank: 3, amount: 300 },  // 300MB
        { rank: 4, amount: 200 },  // 200MB
        { rank: 5, amount: 150 },  // 150MB
        { rank: 6, amount: 100 },  // 100MB
        { rank: 7, amount: 75 },   // 75MB
        { rank: 8, amount: 50 },   // 50MB
        { rank: 9, amount: 25 },   // 25MB
        { rank: 10, amount: 25 }   // 25MB
      ];

      for (const winner of winners) {
        const rewardInfo = rewardDistribution.find(r => r.rank === winner.rank);
        if (rewardInfo) {
          const reward = await this.createDataReward(
            winner.userId,
            rewardInfo.amount,
            'weekly_win',
            { rank: winner.rank, pool: 'individual' }
          );
          
          if (reward) {
            rewards.push({ ...reward, rank: winner.rank, weeklyPoints: winner.weeklyPoints });
          }
        }
      }

      return { distributed: rewards.length, winners: rewards };
    } catch (error) {
      logger.error('Error distributing individual rewards:', error);
      return { distributed: 0, winners: [] };
    }
  }

  async distributeSquadRewards() {
    try {
      const pool = this.weeklyPools.SQUAD;
      const squadLeaderboard = await this.getSquadLeaderboard();
      
      if (squadLeaderboard.length < pool.winners) {
        logger.warn(`Not enough squads for squad rewards (${squadLeaderboard.length} < ${pool.winners})`);
        return { distributed: 0, winners: [] };
      }

      const winners = squadLeaderboard.slice(0, pool.winners);
      const rewards = [];
      
      // Distribute squad rewards (shared among members)
      const rewardDistribution = [
        { rank: 1, amount: 2000 }, // 2GB shared
        { rank: 2, amount: 1000 }, // 1GB shared
        { rank: 3, amount: 500 }   // 500MB shared
      ];

      for (const winner of winners) {
        const rewardInfo = rewardDistribution.find(r => r.rank === winner.rank);
        if (rewardInfo) {
          const reward = await this.createDataReward(
            winner.id,
            rewardInfo.amount,
            'weekly_win',
            { rank: winner.rank, pool: 'squad', squadName: winner.name, memberCount: winner.memberCount }
          );
          
          if (reward) {
            rewards.push({ ...reward, rank: winner.rank, squadName: winner.name });
          }
        }
      }

      return { distributed: rewards.length, winners: rewards };
    } catch (error) {
      logger.error('Error distributing squad rewards:', error);
      return { distributed: 0, winners: [] };
    }
  }

  async distributePartnershipRewards() {
    try {
      const pool = this.weeklyPools.PARTNERSHIP;
      const partnershipLeaderboard = await this.getPartnershipLeaderboard();
      
      if (partnershipLeaderboard.length < pool.winners) {
        logger.warn(`Not enough partnerships for rewards (${partnershipLeaderboard.length} < ${pool.winners})`);
        return { distributed: 0, winners: [] };
      }

      const winners = partnershipLeaderboard.slice(0, pool.winners);
      const rewards = [];
      
      // Distribute partnership rewards (shared between partners)
      const rewardDistribution = [
        { rank: 1, amount: 1500 }, // 1.5GB shared
        { rank: 2, amount: 750 }   // 750MB shared
      ];

      for (const winner of winners) {
        const rewardInfo = rewardDistribution.find(r => r.rank === winner.rank);
        if (rewardInfo) {
          const reward = await this.createDataReward(
            winner.id,
            rewardInfo.amount,
            'weekly_win',
            { rank: winner.rank, pool: 'partnership', player1Id: winner.player1Id, player2Id: winner.player2Id }
          );
          
          if (reward) {
            rewards.push({ ...reward, rank: winner.rank });
          }
        }
      }

      return { distributed: rewards.length, winners: rewards };
    } catch (error) {
      logger.error('Error distributing partnership rewards:', error);
      return { distributed: 0, winners: [] };
    }
  }

  async distributeStreakRewards() {
    try {
      const pool = this.weeklyPools.STREAK;
      const streakDraw = await this.getStreakDrawEntries();
      
      if (streakDraw.length === 0) {
        logger.warn('No entries in streak draw');
        return { distributed: 0, winners: [] };
      }

      // Weighted random selection based on streak length
      const winners = this.selectWeightedWinners(streakDraw, pool.winners);
      const rewards = [];
      
      // Equal rewards for streak winners
      const rewardAmount = 200; // 200MB each

      for (const winner of winners) {
        const reward = await this.createDataReward(
          winner.userId,
          rewardAmount,
          'streak_reward',
          { streakDays: winner.streakDays, pool: 'streak' }
        );
        
        if (reward) {
          rewards.push({ ...reward, streakDays: winner.streakDays });
        }
      }

      return { distributed: rewards.length, winners: rewards };
    } catch (error) {
      logger.error('Error distributing streak rewards:', error);
      return { distributed: 0, winners: [] };
    }
  }

  // ==========================================
  // LEADERBOARD INTEGRATION
  // ==========================================

  async getWeeklyLeaderboard() {
    try {
      // This would integrate with the ranking system
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Error getting weekly leaderboard:', error);
      return [];
    }
  }

  async getSquadLeaderboard() {
    try {
      // This would integrate with the arena system
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Error getting squad leaderboard:', error);
      return [];
    }
  }

  async getPartnershipLeaderboard() {
    try {
      // This would integrate with the arena system
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Error getting partnership leaderboard:', error);
      return [];
    }
  }

  async getStreakDrawEntries() {
    try {
      // This would integrate with the streak system
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Error getting streak draw entries:', error);
      return [];
    }
  }

  selectWeightedWinners(entries, winnerCount) {
    // Weighted random selection based on streak length
    const weights = entries.map(entry => entry.streakDays || 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    const winners = [];
    const availableEntries = [...entries];

    for (let i = 0; i < Math.min(winnerCount, availableEntries.length); i++) {
      const random = Math.random() * totalWeight;
      let weightSum = 0;
      
      for (let j = 0; j < availableEntries.length; j++) {
        weightSum += availableEntries[j].streakDays || 1;
        if (random <= weightSum) {
          winners.push(availableEntries[j]);
          availableEntries.splice(j, 1);
          break;
        }
      }
    }

    return winners;
  }

  // ==========================================
  // USER REWARD HISTORY
  // ==========================================

  async getUserRewardHistory(userId, limit = 50) {
    try {
      const list = await this.kv.list({ prefix: 'data_reward:' });
      const userRewards = [];

      for (const key of list.keys) {
        const rewardData = await this.kv.get(key.name);
        if (rewardData) {
          const reward = JSON.parse(rewardData);
          if (reward.userId === userId) {
            userRewards.push(reward);
          }
        }
      }

      // Sort by creation date (most recent first)
      userRewards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return userRewards.slice(0, limit);
    } catch (error) {
      logger.error('Error getting user reward history:', error);
      return [];
    }
  }

  async getPendingRewards(userId) {
    try {
      const pendingIds = await this.kv.get(`pending_rewards:${userId}`);
      if (!pendingIds) return [];

      const rewards = [];
      for (const rewardId of JSON.parse(pendingIds)) {
        const rewardData = await this.kv.get(`data_reward:${rewardId}`);
        if (rewardData) {
          const reward = JSON.parse(rewardData);
          if (reward.status === 'pending') {
            rewards.push(reward);
          }
        }
      }

      return rewards;
    } catch (error) {
      logger.error('Error getting pending rewards:', error);
      return [];
    }
  }

  // ==========================================
  // REWARD ANALYTICS
  // ==========================================

  async getRewardAnalytics() {
    try {
      const list = await this.kv.list({ prefix: 'data_reward:' });
      const stats = {
        totalRewards: list.keys.length,
        statusBreakdown: { pending: 0, claimed: 0, expired: 0 },
        operatorBreakdown: { MTN: 0, VODAFONE: 0, AIRTELTIGO: 0, GLO: 0 },
        sourceBreakdown: {},
        totalDataDistributed: 0,
        averageRewardSize: 0,
        claimRate: 0,
        expirationRate: 0
      };

      let totalSize = 0;
      let claimedCount = 0;
      let expiredCount = 0;

      for (const key of list.keys) {
        const rewardData = await this.kv.get(key.name);
        if (rewardData) {
          const reward = JSON.parse(rewardData);
          
          // Status breakdown
          stats.statusBreakdown[reward.status]++;
          if (reward.status === 'claimed') claimedCount++;
          if (reward.status === 'expired') expiredCount++;

          // Operator breakdown
          stats.operatorBreakdown[reward.operator] = (stats.operatorBreakdown[reward.operator] || 0) + 1;

          // Source breakdown
          stats.sourceBreakdown[reward.source] = (stats.sourceBreakdown[reward.source] || 0) + 1;

          // Size calculations
          if (reward.status === 'claimed') {
            totalSize += reward.amount;
          }
        }
      }

      stats.totalDataDistributed = totalSize;
      stats.averageRewardSize = stats.totalRewards > 0 ? Math.round(totalSize / claimedCount) : 0;
      stats.claimRate = stats.totalRewards > 0 ? (claimedCount / stats.totalRewards) * 100 : 0;
      stats.expirationRate = stats.totalRewards > 0 ? (expiredCount / stats.totalRewards) * 100 : 0;

      return stats;
    } catch (error) {
      logger.error('Error getting reward analytics:', error);
      return null;
    }
  }

  // ==========================================
  // REWARD NOTIFICATIONS
  // ==========================================

  async sendRewardNotification(userId, reward, type = 'earned') {
    try {
      // This would integrate with Telegram notification system
      const message = this.formatRewardMessage(reward, type);
      
      logger.info(`Reward notification for user ${userId}: ${message}`);
      
      return {
        success: true,
        message,
        rewardId: reward.id
      };
    } catch (error) {
      logger.error('Error sending reward notification:', error);
      return { success: false, error: 'Failed to send notification' };
    }
  }

  formatRewardMessage(reward, type) {
    switch (type) {
      case 'earned':
        return `🎉 **Congratulations!**\n\nYou've earned **${reward.amount}MB** data reward!\n\nUse /claim_data to claim your reward.`;
      case 'claimed':
        return `✅ **Data Reward Claimed!**\n\nYour **${reward.amount}MB** data reward has been sent to your ${reward.operator} number.\n\nThank you for playing G-NEX! 🇬🇭`;
      case 'expired':
        return `⏰️ **Reward Expired**\n\nYour ${reward.amount}MB data reward has expired.\n\nKeep playing to earn new rewards!`;
      default:
        return `📱 **Data Reward**\n\n${reward.amount}MB data reward available.`;
    }
  }
}
