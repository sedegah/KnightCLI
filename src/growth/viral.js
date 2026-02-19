/**
 * G-NEX Viral Growth System
 * Implements referrals, sharing cards, and viral mechanics
 */

import { logger } from '../utils/logger.js';

export class ViralGrowthManager {
  constructor(kv) {
    this.kv = kv;
    
    // Referral rewards
    this.referralRewards = {
      inviter: { points: 50, data: '50MB', description: '50 points + 50MB data' },
      referred: { points: 25, data: '25MB', description: '25 points + 25MB data' },
      bonus: { threshold: 5, points: 200, data: '200MB', description: 'Bonus for 5 referrals' }
    };

    // Sharing card templates
    this.cardTemplates = {
      rank_achievement: {
        name: 'Rank Achievement',
        template: '🏆 **I ranked #{rank} today!**\n\nJoin me in Ghana\'s competitive quiz arena!',
        color: '#FFD700'
      },
      streak_milestone: {
        name: 'Streak Milestone',
        template: '🔥 **{streak}-day streak!**\n\nCan you beat my record in G-NEX?',
        color: '#FF6B6B'
      },
      squad_victory: {
        name: 'Squad Victory',
        template: '👥 **My squad is #1!**\n\nJoin our team and dominate Ghana!',
        color: '#4ECDC4'
      },
      battle_win: {
        name: 'Battle Victory',
        template: '⚔️ **Victory!**\n\nThink you can beat me? Challenge me in G-NEX!',
        color: '#45B7D1'
      },
      tier_upgrade: {
        name: 'Tier Upgrade',
        template: '📈 **Reached {tier} tier!**\n\nClimb the ranks with me in G-NEX!',
        color: '#96CEB4'
      }
    };
  }

  // ==========================================
  // REFERRAL SYSTEM
  // ==========================================

  async generateReferralCode(userId) {
    try {
      const code = this.generateReferralCodeString();
      
      const referral = {
        userId,
        code,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        referredUsers: [],
        totalReferrals: 0,
        bonusClaimed: []
      };

      await this.kv.put(`referral:${code}`, JSON.stringify(referral));
      await this.kv.put(`user_referral:${userId}`, code);

      logger.info(`Generated referral code for user ${userId}: ${code}`);
      return referral;
    } catch (error) {
      logger.error('Error generating referral code:', error);
      return null;
    }
  }

  generateReferralCodeString() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async getReferralCode(userId) {
    try {
      const code = await this.kv.get(`user_referral:${userId}`);
      return code || null;
    } catch (error) {
      logger.error('Error getting referral code:', error);
      return null;
    }
  }

  async processReferral(referralCode, newUserId) {
    try {
      const referralData = await this.kv.get(`referral:${referralCode}`);
      if (!referralData) {
        return { success: false, error: 'Invalid referral code' };
      }

      const referral = JSON.parse(referralData);
      
      if (referral.status !== 'active') {
        return { success: false, error: 'Referral code is not active' };
      }

      if (new Date() > new Date(referral.expiresAt)) {
        return { success: false, error: 'Referral code has expired' };
      }

      if (referral.referredUsers.includes(newUserId)) {
        return { success: false, error: 'You have already used this referral code' };
      }

      // Add new user to referred users
      referral.referredUsers.push(newUserId);
      referral.totalReferrals++;

      // Check for bonus milestones
      const bonuses = [];
      for (const [threshold, bonus] of Object.entries(this.referralRewards.bonus)) {
        const thresholdNum = parseInt(threshold);
        if (referral.totalReferrals >= thresholdNum && !referral.bonusClaimed.includes(threshold)) {
          bonuses.push({ threshold, ...bonus });
          referral.bonusClaimed.push(threshold);
        }
      }

      await this.kv.put(`referral:${referralCode}`, JSON.stringify(referral));

      return {
        success: true,
        referral,
        inviterReward: this.referralRewards.inviter,
        referredReward: this.referralRewards.referred,
        bonuses
      };
    } catch (error) {
      logger.error('Error processing referral:', error);
      return { success: false, error: 'Failed to process referral' };
    }
  }

  async claimReferralBonus(userId, referralCode, threshold) {
    try {
      const referralData = await this.kv.get(`referral:${referralCode}`);
      if (!referralData) {
        return { success: false, error: 'Invalid referral code' };
      }

      const referral = JSON.parse(referralData);
      
      if (referral.userId !== userId) {
        return { success: false, error: 'This referral code belongs to another user' };
      }

      if (!referral.bonusClaimed.includes(threshold.toString())) {
        return { success: false, error: 'Bonus not available or already claimed' };
      }

      // Mark bonus as claimed
      referral.bonusClaimed.push(threshold.toString());
      await this.kv.put(`referral:${referralCode}`, JSON.stringify(referral));

      // Grant bonus rewards
      const bonus = this.referralRewards.bonus[threshold];
      
      // This would integrate with economy and data reward systems
      return {
        success: true,
        bonus,
        message: `Referral bonus claimed: ${bonus.description}!`
      };
    } catch (error) {
      logger.error('Error claiming referral bonus:', error);
      return { success: false, error: 'Failed to claim bonus' };
    }
  }

  async getReferralStats(userId) {
    try {
      const code = await this.getReferralCode(userId);
      if (!code) {
        return { totalReferrals: 0, activeReferrals: 0, totalEarned: 0 };
      }

      const referralData = await this.kv.get(`referral:${code}`);
      if (!referralData) {
        return { totalReferrals: 0, activeReferrals: 0, totalEarned: 0 };
      }

      const referral = JSON.parse(referralData);
      
      // Calculate total earnings from referrals
      const totalEarned = referral.totalReferrals * this.referralRewards.inviter.points;
      
      return {
        totalReferrals: referral.totalReferrals,
        activeReferrals: referral.referredUsers.length,
        totalEarned,
        code,
        expiresAt: referral.expiresAt,
        bonusesAvailable: this.getAvailableBonuses(referral)
      };
    } catch (error) {
      logger.error('Error getting referral stats:', error);
      return { totalReferrals: 0, activeReferrals: 0, totalEarned: 0 };
    }
  }

  getAvailableBonuses(referral) {
    const available = [];
    
    for (const [threshold, bonus] of Object.entries(this.referralRewards.bonus)) {
      const thresholdNum = parseInt(threshold);
      if (referral.totalReferrals >= thresholdNum && !referral.bonusClaimed.includes(threshold)) {
        available.push({ threshold: thresholdNum, ...bonus });
      }
    }

    return available;
  }

  // ==========================================
  // SHARING CARD SYSTEM
  // ==========================================

  async generateSharingCard(userId, cardType, metadata = {}) {
    try {
      const template = this.cardTemplates[cardType];
      if (!template) {
        return { success: false, error: 'Invalid card type' };
      }

      // Get user data for personalization
      const userData = await this.getUserSharingData(userId);
      
      // Generate card content
      const cardContent = this.generateCardContent(template, userData, metadata);
      
      // Create sharing record
      const card = {
        id: crypto.randomUUID(),
        userId,
        type: cardType,
        content: cardContent,
        template,
        metadata,
        createdAt: new Date().toISOString(),
        shares: 0,
        clicks: 0
      };

      await this.kv.put(`sharing_card:${card.id}`, JSON.stringify(card));
      
      return {
        success: true,
        card,
        shareUrl: `https://t.me/codecadencebot?start=${card.id}`,
        imageUrl: this.generateCardImageUrl(card)
      };
    } catch (error) {
      logger.error('Error generating sharing card:', error);
      return { success: false, error: 'Failed to generate sharing card' };
    }
  }

  async getUserSharingData(userId) {
    try {
      // This would integrate with ranking, arena, and other systems
      // For now, return mock data
      return {
        username: `Player${userId}`,
        rank: 42,
        tier: 'SILVER',
        streak: 7,
        weeklyPoints: 250,
        squadName: 'Ghana Champions',
        battlesWon: 3,
        accuracy: 85
      };
    } catch (error) {
      logger.error('Error getting user sharing data:', error);
      return null;
    }
  }

  generateCardContent(template, userData, metadata) {
    let content = template.template;
    
    // Replace placeholders
    content = content.replace('{rank}', userData.rank.toString());
    content = content.replace('{tier}', userData.tier);
    content = content.replace('{streak}', userData.streak.toString());
    content = content.replace('{username}', userData.username);
    content = content.replace('{squad}', userData.squadName || 'My Squad');
    
    // Add metadata if provided
    if (metadata.weeklyPoints) {
      content += `\n\n📊 Weekly Points: ${userData.weeklyPoints.toLocaleString()}`;
    }
    
    if (metadata.battlesWon) {
      content += `\n⚔️ Battles Won: ${userData.battlesWon}`;
    }
    
    if (metadata.accuracy) {
      content += `\n🎯 Accuracy: ${userData.accuracy}%`;
    }
    
    content += `\n\n🇬🇭 Play G-NEX: @codecadencebot`;
    
    return content;
  }

  generateCardImageUrl(card) {
    // This would generate an actual image using an image service
    // For now, return a placeholder URL
    return `https://via.placeholder.com/400x200/${card.template.color.replace('#', '')}/FFFFFF?text=${encodeURIComponent(card.content.substring(0, 50))}`;
  }

  async trackCardShare(cardId, action = 'share') {
    try {
      const cardData = await this.kv.get(`sharing_card:${cardId}`);
      if (!cardData) return false;

      const card = JSON.parse(cardData);
      
      if (action === 'share') {
        card.shares++;
      } else if (action === 'click') {
        card.clicks++;
      }

      await this.kv.put(`sharing_card:${cardId}`, JSON.stringify(card));
      return true;
    } catch (error) {
      logger.error('Error tracking card share:', error);
      return false;
    }
  }

  // ==========================================
  // INVITATION SYSTEM
  // ==========================================

  async createSquadInvite(squadId, inviterId, message = null) {
    try {
      const invite = {
        id: crypto.randomUUID(),
        squadId,
        inviterId,
        message: message || 'Join my squad in G-NEX and dominate Ghana!',
        status: 'active',
        maxUses: 10,
        usedBy: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      await this.kv.put(`squad_invite:${invite.id}`, JSON.stringify(invite));
      
      // Add to squad's active invites
      await this.addSquadInvite(squadId, invite.id);

      return {
        success: true,
        invite,
        inviteUrl: `https://t.me/codecadencebot?join_squad=${invite.id}`
      };
    } catch (error) {
      logger.error('Error creating squad invite:', error);
      return { success: false, error: 'Failed to create squad invite' };
    }
  }

  async createPartnerInvite(partnershipId, inviterId, message = null) {
    try {
      const invite = {
        id: crypto.randomUUID(),
        partnershipId,
        inviterId,
        message: message || 'Be my quiz partner in G-NEX!',
        status: 'active',
        maxUses: 2,
        usedBy: [],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days
      };

      await this.kv.put(`partner_invite:${invite.id}`, JSON.stringify(invite));
      
      return {
        success: true,
        invite,
        inviteUrl: `https://t.me/codecadencebot?join_partner=${invite.id}`
      };
    } catch (error) {
      logger.error('Error creating partner invite:', error);
      return { success: false, error: 'Failed to create partner invite' };
    }
  }

  async acceptSquadInvite(inviteId, userId) {
    try {
      const inviteData = await this.kv.get(`squad_invite:${inviteId}`);
      if (!inviteData) {
        return { success: false, error: 'Invalid squad invite' };
      }

      const invite = JSON.parse(inviteData);
      
      if (invite.status !== 'active') {
        return { success: false, error: 'Invite is no longer active' };
      }

      if (invite.usedBy.includes(userId)) {
        return { success: false, error: 'You have already used this invite' };
      }

      if (invite.usedBy.length >= invite.maxUses) {
        return { success: false, error: 'Invite has reached maximum uses' };
      }

      if (new Date() > new Date(invite.expiresAt)) {
        return { success: false, error: 'Invite has expired' };
      }

      // Add user to used list
      invite.usedBy.push(userId);
      
      // Update invite if needed
      if (invite.usedBy.length >= invite.maxUses) {
        invite.status = 'completed';
      }

      await this.kv.put(`squad_invite:${inviteId}`, JSON.parse(invite));

      return {
        success: true,
        invite,
        squadId: invite.squadId
      };
    } catch (error) {
      logger.error('Error accepting squad invite:', error);
      return { success: false, error: 'Failed to accept invite' };
    }
  }

  async acceptPartnerInvite(inviteId, userId) {
    try {
      const inviteData = await this.kv.get(`partner_invite:${inviteId}`);
      if (!inviteData) {
        return { success: false, error: 'Invalid partner invite' };
      }

      const invite = JSON.parse(inviteData);
      
      if (invite.status !== 'active') {
        return { success: false, error: 'Invite is no longer active' };
      }

      if (invite.usedBy.includes(userId)) {
        return { success: false, error: 'You have already used this invite' };
      }

      if (invite.usedBy.length >= invite.maxUses) {
        return { success: false, error: 'Invite has reached maximum uses' };
      }

      if (new Date() > new Date(invite.expiresAt)) {
        return { success: false, error: 'Invite has expired' };
      }

      // Add user to used list
      invite.usedBy.push(userId);
      
      // Update invite if needed
      if (invite.usedBy.length >= invite.maxUses) {
        invite.status = 'completed';
      }

      await this.kv.put(`partner_invite:${inviteId}`, JSON.parse(invite));

      return {
        success: true,
        invite,
        partnershipId: invite.partnershipId
      };
    } catch (error) {
      logger.error('Error accepting partner invite:', error);
      return { success: false, error: 'Failed to accept invite' };
    }
  }

  // ==========================================
  // VIRAL CHALLENGES
  // ==========================================

  async createViralChallenge(challengerId, challengeType, metadata = {}) {
    try {
      const challenge = {
        id: crypto.randomUUID(),
        challengerId,
        type: challengeType, // 'rank_beat', 'streak_challenge', 'squad_battle'
        status: 'active',
        metadata,
        participants: [challengerId],
        targetCount: metadata.targetCount || 5,
        rewardPool: metadata.rewardPool || 500,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      await this.kv.put(`viral_challenge:${challenge.id}`, JSON.stringify(challenge));

      return {
        success: true,
        challenge,
        challengeUrl: `https://t.me/codecadencebot?challenge=${challenge.id}`
      };
    } catch (error) {
      logger.error('Error creating viral challenge:', error);
      return { success: false, error: 'Failed to create challenge' };
    }
  }

  async joinViralChallenge(challengeId, userId) {
    try {
      const challengeData = await this.kv.get(`viral_challenge:${challengeId}`);
      if (!challengeData) {
        return { success: false, error: 'Invalid challenge' };
      }

      const challenge = JSON.parse(challengeData);
      
      if (challenge.status !== 'active') {
        return { success: false, error: 'Challenge is no longer active' };
      }

      if (challenge.participants.includes(userId)) {
        return { success: false, error: 'You have already joined this challenge' };
      }

      if (challenge.participants.length >= challenge.targetCount) {
        return { success: false, error: 'Challenge is full' };
      }

      challenge.participants.push(userId);
      await this.kv.put(`viral_challenge:${challengeId}`, JSON.stringify(challenge));

      return {
        success: true,
        challenge,
        message: `Joined ${challenge.type} challenge! ${challenge.participants.length}/${challenge.targetCount} participants`
      };
    } catch (error) {
      logger.error('Error joining viral challenge:', error);
      return { success: false, error: 'Failed to join challenge' };
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  async addSquadInvite(squadId, inviteId) {
    try {
      const key = `squad_invites:${squadId}`;
      const existing = await this.kv.get(key);
      const invites = existing ? JSON.parse(existing) : [];
      
      invites.push(inviteId);
      await this.kv.put(key, JSON.stringify(invites));
    } catch (error) {
      logger.error('Error adding squad invite:', error);
    }
  }

  async getUserReferralCode(userId) {
    try {
      return await this.kv.get(`user_referral:${userId}`);
    } catch (error) {
      logger.error('Error getting user referral code:', error);
      return null;
    }
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  async getViralGrowthStats() {
    try {
      const stats = {
        totalReferrals: 0,
        activeReferralCodes: 0,
        totalShares: 0,
        totalClicks: 0,
        squadInvites: 0,
        partnerInvites: 0,
        viralChallenges: 0,
        conversionRate: 0
      };

      // Count referral codes
      const referralList = await this.kv.list({ prefix: 'referral:' });
      stats.totalReferrals = referralList.keys.length;
      
      for (const key of referralList.keys) {
        const referralData = await this.kv.get(key.name);
        if (referralData) {
          const referral = JSON.parse(referralData);
          if (referral.status === 'active') {
            stats.activeReferralCodes++;
          }
        }
      }

      // Count sharing cards
      const cardList = await this.kv.list({ prefix: 'sharing_card:' });
      
      for (const key of cardList.keys) {
        const cardData = await this.kv.get(key.name);
        if (cardData) {
          const card = JSON.parse(cardData);
          stats.totalShares += card.shares;
          stats.totalClicks += card.clicks;
        }
      }

      // Count invites
      const squadInviteList = await this.kv.list({ prefix: 'squad_invite:' });
      stats.squadInvites = squadInviteList.keys.length;
      
      const partnerInviteList = await this.kv.list({ prefix: 'partner_invite:' });
      stats.partnerInvites = partnerInviteList.keys.length;

      // Count challenges
      const challengeList = await this.kv.list({ prefix: 'viral_challenge:' });
      stats.viralChallenges = challengeList.keys.length;

      // Calculate conversion rate
      stats.conversionRate = stats.totalClicks > 0 ? (stats.totalReferrals / stats.totalClicks) * 100 : 0;

      return stats;
    } catch (error) {
      logger.error('Error getting viral growth stats:', error);
      return null;
    }
  }
}
