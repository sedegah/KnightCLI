/**
 * Scoring Engine
 * Calculates points based on user type, question mode, speed, and streaks
 */

import { config } from '../config/config.js';
import { UserType, QuestionType, PointType } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export class ScoringEngine {
  /**
   * Calculate points for an answer
   */
  static calculatePoints(user, question, isCorrect, responseTimeSeconds, attemptNumber = 1, isPrizeRound = false) {
    const userType = user.subscriptionStatus === UserType.SUBSCRIBER ? 'subscriber' : 'free';
    const mode = isPrizeRound ? 'prizeRound' : 'continuous';
    const scoring = config.scoring[userType][mode];

    if (!isCorrect) {
      return {
        total: 0,
        breakdown: { base: 0, speedBonus: 0, streakBonus: 0, total: 0 }
      };
    }

    let basePoints = scoring.correct;

    // Subscriber second attempt in prize rounds gets 80%
    if (isPrizeRound && userType === 'subscriber' && attemptNumber === 2) {
      basePoints = Math.floor(basePoints * (scoring.secondAttemptMultiplier || 1.0));
    }

    // Calculate speed bonus (only in prize rounds)
    let speedBonus = 0;
    if (isPrizeRound && scoring.speedBonusMax > 0) {
      speedBonus = this._calculateSpeedBonus(
        responseTimeSeconds,
        question.timeLimitSeconds,
        scoring.speedBonusMax
      );
    }

    // Calculate streak bonus
    const streakBonus = this._getStreakBonus(user.streak);

    const total = basePoints + speedBonus + streakBonus;

    const breakdown = {
      base: basePoints,
      speedBonus,
      streakBonus,
      total
    };

    logger.info(`Points calculated for user ${user.telegramId}:`, breakdown);
    return { total, breakdown };
  }

  /**
   * Calculate speed bonus (linear)
   */
  static _calculateSpeedBonus(responseTime, timeLimit, maxBonus) {
    if (responseTime <= 0 || timeLimit <= 0 || maxBonus <= 0) {
      return 0;
    }

    const ratio = Math.min(Math.max(responseTime / timeLimit, 0), 1);
    return Math.floor(maxBonus * (1 - ratio));
  }

  /**
   * Get streak bonus based on current streak
   */
  static _getStreakBonus(streak) {
    const bonuses = config.streakBonuses;
    const milestones = Object.keys(bonuses).map(Number).sort((a, b) => b - a);

    for (const milestone of milestones) {
      if (streak >= milestone) {
        return bonuses[milestone];
      }
    }

    return 0;
  }

  /**
   * Update user streak
   */
  static updateStreak(user) {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    let streakBroken = false;

    if (!user.lastPlayedDate) {
      user.streak = 1;
      user.lastPlayedDate = today;
      return { user, streakBroken };
    }

    const lastPlayed = new Date(user.lastPlayedDate);
    const lastPlayedDate = lastPlayed.toISOString().split('T')[0];
    
    const daysDiff = Math.floor((now - lastPlayed) / (1000 * 60 * 60 * 24));

    if (lastPlayedDate === today) {
      // Already played today, no change
    } else if (daysDiff === 1) {
      // Consecutive day
      user.streak += 1;
      user.lastPlayedDate = today;
    } else {
      // Streak broken
      user.streak = 1;
      user.lastPlayedDate = today;
      streakBroken = true;
      logger.info(`Streak broken for user ${user.telegramId}`);
    }

    return { user, streakBroken };
  }

  /**
   * Apply points to user
   */
  static applyPoints(user, points, isPrizeRound) {
    const pointType = isPrizeRound ? PointType.PP : PointType.AP;

    if (pointType === PointType.PP) {
      user.pp += points;
    } else {
      user.ap += points;
      user.totalAp += points;
    }

    user.weeklyPoints += points;
    return user;
  }

  /**
   * Format points breakdown for display
   */
  static formatBreakdown(breakdown, pointType) {
    const lines = [];

    if (breakdown.base > 0) {
      lines.push(`Base: +${breakdown.base} ${pointType}`);
    }

    if (breakdown.speedBonus > 0) {
      lines.push(`⚡ Speed Bonus: +${breakdown.speedBonus}`);
    }

    if (breakdown.streakBonus > 0) {
      lines.push(`🔥 Streak Bonus: +${breakdown.streakBonus}`);
    }

    lines.push(`\n**Total: +${breakdown.total} ${pointType}**`);

    return lines.join('\n');
  }
}
