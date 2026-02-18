/**
 * G-NEX Points Economy System
 * Implements spendable points, premium features, and virtual economy
 */

import { logger } from '../utils/logger.js';

export class EconomyManager {
  constructor(kv) {
    this.kv = kv;
    
    // Point costs for various features
    this.costs = {
      // Battle entries
      premium_battle: 50,
      speed_challenge: 75,
      streak_challenge: 100,
      
      // Bonus features
      bonus_round: 30,
      streak_protection_1day: 100,
      streak_protection_3day: 250,
      streak_protection_7day: 500,
      
      // Mystery boxes
      mystery_bronze: 25,
      mystery_silver: 75,
      mystery_gold: 200,
      mystery_diamond: 500,
      
      // Squad features
      squad_boost: 100,
      squad_rename: 50,
      squad_banner: 150,
      
      // Personalization
      custom_badge: 200,
      profile_theme: 100,
      celebration_animation: 25
    };

    // Mystery box rewards
    this.mysteryBoxRewards = {
      bronze: {
        points: { min: 10, max: 50, weight: 60 },
        data: { min: '10MB', max: '50MB', weight: 30 },
        items: { min: 1, max: 3, weight: 10 }
      },
      silver: {
        points: { min: 25, max: 150, weight: 50 },
        data: { min: '25MB', max: '150MB', weight: 35 },
        items: { min: 2, max: 5, weight: 15 }
      },
      gold: {
        points: { min: 50, max: 500, weight: 40 },
        data: { min: '50MB', max: '500MB', weight: 40 },
        items: { min: 3, max: 8, weight: 20 }
      },
      diamond: {
        points: { min: 100, max: 2000, weight: 30 },
        data: { min: '100MB', max: '1GB', weight: 45 },
        items: { min: 5, max: 15, weight: 25 }
      }
    };
  }

  // ==========================================
  // USER WALLET MANAGEMENT
  // ==========================================

  async getUserWallet(userId) {
    try {
      const walletData = await this.kv.get(`wallet:${userId}`);
      return walletData ? JSON.parse(walletData) : this.createDefaultWallet(userId);
    } catch (error) {
      logger.error('Error getting user wallet:', error);
      return this.createDefaultWallet(userId);
    }
  }

  createDefaultWallet(userId) {
    return {
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

  async updateUserWallet(userId, amount, type, description, metadata = {}) {
    try {
      let wallet = await this.getUserWallet(userId);
      
      const transaction = {
        id: crypto.randomUUID(),
        type, // 'earn', 'spend', 'bonus', 'refund'
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
  // POINT EARNING
  // ==========================================

  async awardPoints(userId, amount, source, metadata = {}) {
    try {
      const result = await this.updateUserWallet(userId, amount, 'earn', source, metadata);
      
      if (result.success) {
        logger.info(`Awarded ${amount} points to user ${userId} for ${source}`);
      }
      
      return result;
    } catch (error) {
      logger.error('Error awarding points:', error);
      return { success: false, error: 'Failed to award points' };
    }
  }

  async claimDailyBonus(userId) {
    try {
      const wallet = await this.getUserWallet(userId);
      const today = new Date().toISOString().split('T')[0];

      if (wallet.dailyBonusClaimed && wallet.lastBonusDate === today) {
        return { success: false, error: 'Daily bonus already claimed today' };
      }

      const bonusAmount = this.calculateDailyBonus(userId);
      const result = await this.updateUserWallet(userId, bonusAmount, 'bonus', 'Daily Login Bonus');

      if (result.success) {
        wallet.dailyBonusClaimed = true;
        wallet.lastBonusDate = today;
        await this.kv.put(`wallet:${userId}`, JSON.stringify(wallet));
      }

      return result;
    } catch (error) {
      logger.error('Error claiming daily bonus:', error);
      return { success: false, error: 'Failed to claim daily bonus' };
    }
  }

  calculateDailyBonus(userId) {
    // Base bonus with streak multiplier
    let baseBonus = 10;
    
    // Could integrate with streak system for multiplier
    // For now, return base bonus
    return baseBonus;
  }

  // ==========================================
  // POINT SPENDING
  // ==========================================

  async spendPoints(userId, amount, item, metadata = {}) {
    try {
      const wallet = await this.getUserWallet(userId);
      
      if (wallet.balance < amount) {
        return { success: false, error: 'Insufficient points' };
      }

      const result = await this.updateUserWallet(userId, -amount, 'spend', item, metadata);
      
      if (result.success) {
        logger.info(`User ${userId} spent ${amount} points on ${item}`);
      }
      
      return result;
    } catch (error) {
      logger.error('Error spending points:', error);
      return { success: false, error: 'Failed to spend points' };
    }
  }

  // ==========================================
  // PREMIUM BATTLE ENTRY
  // ==========================================

  async enterPremiumBattle(userId, battleType) {
    try {
      const cost = this.costs[`premium_${battleType}`] || this.costs.premium_battle;
      
      const spendResult = await this.spendPoints(userId, cost, `Premium ${battleType} Battle`);
      
      if (!spendResult.success) {
        return spendResult;
      }

      // Create premium battle entry
      const battleEntry = {
        id: crypto.randomUUID(),
        userId,
        type: battleType,
        cost,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour to play
      };

      await this.kv.put(`premium_battle:${battleEntry.id}`, JSON.stringify(battleEntry));

      return {
        success: true,
        battleEntry,
        message: `Entered premium ${battleType} battle!`
      };
    } catch (error) {
      logger.error('Error entering premium battle:', error);
      return { success: false, error: 'Failed to enter premium battle' };
    }
  }

  // ==========================================
  // MYSTERY BOX SYSTEM
  // ==========================================

  async purchaseMysteryBox(userId, boxType) {
    try {
      const cost = this.costs[`mystery_${boxType}`];
      
      const spendResult = await this.spendPoints(userId, cost, `Mystery ${boxType} Box`);
      
      if (!spendResult.success) {
        return spendResult;
      }

      // Generate mystery box rewards
      const rewards = this.generateMysteryBoxRewards(boxType);
      
      // Award rewards
      const awardedRewards = [];
      for (const reward of rewards) {
        if (reward.type === 'points') {
          await this.awardPoints(userId, reward.amount, 'Mystery Box', { boxType });
          awardedRewards.push(reward);
        } else if (reward.type === 'data') {
          // This would integrate with data reward system
          awardedRewards.push(reward);
        } else if (reward.type === 'items') {
          // This would integrate with items/inventory system
          awardedRewards.push(reward);
        }
      }

      return {
        success: true,
        boxType,
        rewards: awardedRewards,
        message: `Opened ${boxType} mystery box!`
      };
    } catch (error) {
      logger.error('Error purchasing mystery box:', error);
      return { success: false, error: 'Failed to purchase mystery box' };
    }
  }

  generateMysteryBoxRewards(boxType) {
    const rewardConfig = this.mysteryBoxRewards[boxType];
    const rewards = [];
    const numRewards = Math.floor(Math.random() * 3) + 1; // 1-3 rewards

    for (let i = 0; i < numRewards; i++) {
      const rewardType = this.selectRewardType(rewardConfig);
      let reward = {};

      switch (rewardType) {
        case 'points':
          reward = {
            type: 'points',
            amount: this.randomInRange(rewardConfig.points.min, rewardConfig.points.max)
          };
          break;
        case 'data':
          reward = {
            type: 'data',
            amount: this.selectDataAmount(rewardConfig.data)
          };
          break;
        case 'items':
          reward = {
            type: 'items',
            amount: this.randomInRange(rewardConfig.items.min, rewardConfig.items.max)
          };
          break;
      }

      rewards.push(reward);
    }

    return rewards;
  }

  selectRewardType(rewardConfig) {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const [type, config] of Object.entries(rewardConfig)) {
      cumulative += config.weight;
      if (random <= cumulative) {
        return type;
      }
    }

    return 'points'; // Default
  }

  selectDataAmount(range) {
    const amounts = {
      '10MB': 10, '25MB': 25, '50MB': 50, '100MB': 100, '150MB': 150,
      '200MB': 200, '300MB': 300, '500MB': 500, '750MB': 750, '1GB': 1000
    };

    const possibleAmounts = Object.keys(amounts)
      .filter(amount => amounts[amount] >= range.min && amounts[amount] <= range.max);

    return possibleAmounts[Math.floor(Math.random() * possibleAmounts.length)];
  }

  randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ==========================================
  // SQUAD ECONOMY
  // ==========================================

  async contributeToSquad(userId, squadId, amount) {
    try {
      const spendResult = await this.spendPoints(userId, amount, `Squad Contribution`);
      
      if (!spendResult.success) {
        return spendResult;
      }

      // Record squad contribution
      const contribution = {
        id: crypto.randomUUID(),
        userId,
        squadId,
        amount,
        timestamp: new Date().toISOString()
      };

      await this.kv.put(`squad_contribution:${contribution.id}`, JSON.stringify(contribution));

      // Add to squad's contribution pool
      const squadData = await this.kv.get(`squad:${squadId}`);
      if (squadData) {
        const squad = JSON.parse(squadData);
        squad.contributionPool = (squad.contributionPool || 0) + amount;
        await this.kv.put(`squad:${squadId}`, JSON.stringify(squad));
      }

      return {
        success: true,
        contribution,
        message: `Contributed ${amount} points to squad!`
      };
    } catch (error) {
      logger.error('Error contributing to squad:', error);
      return { success: false, error: 'Failed to contribute to squad' };
    }
  }

  async purchaseSquadBoost(userId, squadId, boostType) {
    try {
      const cost = this.costs.squad_boost;
      
      const spendResult = await this.spendPoints(userId, cost, `Squad ${boostType} Boost`);
      
      if (!spendResult.success) {
        return spendResult;
      }

      // Apply squad boost
      const boost = {
        id: crypto.randomUUID(),
        squadId,
        type: boostType,
        createdBy: userId,
        cost,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        active: true
      };

      await this.kv.put(`squad_boost:${boost.id}`, JSON.stringify(boost));

      return {
        success: true,
        boost,
        message: `Squad ${boostType} boost activated for 24 hours!`
      };
    } catch (error) {
      logger.error('Error purchasing squad boost:', error);
      return { success: false, error: 'Failed to purchase squad boost' };
    }
  }

  // ==========================================
  // TRANSACTION HISTORY
  // ==========================================

  async getTransactionHistory(userId, limit = 50, type = 'all') {
    try {
      const wallet = await this.getUserWallet(userId);
      
      let transactions = wallet.transactions;
      
      if (type !== 'all') {
        transactions = transactions.filter(t => t.type === type);
      }

      // Sort by timestamp (most recent first)
      transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return transactions.slice(0, limit);
    } catch (error) {
      logger.error('Error getting transaction history:', error);
      return [];
    }
  }

  // ==========================================
  // ECONOMY ANALYTICS
  // ==========================================

  async getEconomyStats() {
    try {
      const list = await this.kv.list({ prefix: 'wallet:' });
      const stats = {
        totalUsers: list.keys.length,
        totalPointsInCirculation: 0,
        totalPointsEarned: 0,
        totalPointsSpent: 0,
        averageBalance: 0,
        topSpenders: [],
        recentTransactions: []
      };

      const userBalances = [];
      const userSpending = [];

      for (const key of list.keys) {
        const walletData = await this.kv.get(key.name);
        if (walletData) {
          const wallet = JSON.parse(walletData);
          userBalances.push({ userId: wallet.userId, balance: wallet.balance });
          userSpending.push({ userId: wallet.userId, spent: wallet.totalSpent });
          
          stats.totalPointsInCirculation += wallet.balance;
          stats.totalPointsEarned += wallet.totalEarned;
          stats.totalPointsSpent += wallet.totalSpent;
        }
      }

      stats.averageBalance = stats.totalUsers > 0 ? Math.round(stats.totalPointsInCirculation / stats.totalUsers) : 0;

      // Top spenders
      userSpending.sort((a, b) => b.spent - a.spent);
      stats.topSpenders = userSpending.slice(0, 10);

      return stats;
    } catch (error) {
      logger.error('Error getting economy stats:', error);
      return null;
    }
  }

  // ==========================================
  // POINTS REFUNDS
  // ==========================================

  async processRefund(userId, originalTransactionId, reason) {
    try {
      const wallet = await this.getUserWallet(userId);
      const originalTransaction = wallet.transactions.find(t => t.id === originalTransactionId);
      
      if (!originalTransaction || originalTransaction.type !== 'spend') {
        return { success: false, error: 'Original transaction not found or not a spend transaction' };
      }

      const refundAmount = Math.abs(originalTransaction.amount);
      
      const result = await this.updateUserWallet(userId, refundAmount, 'refund', 
        `Refund: ${reason}`, { originalTransactionId });

      if (result.success) {
        logger.info(`Refunded ${refundAmount} points to user ${userId} for transaction ${originalTransactionId}`);
      }

      return result;
    } catch (error) {
      logger.error('Error processing refund:', error);
      return { success: false, error: 'Failed to process refund' };
    }
  }
}
