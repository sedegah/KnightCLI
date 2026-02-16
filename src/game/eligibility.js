/**
 * Eligibility Checker
 * Validates user eligibility for playing
 */

import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export class EligibilityChecker {
  /**
   * Check if user can play
   */
  static async checkPlayEligibility(user, db) {
    // Check if banned
    if (user.isBanned) {
      return {
        allowed: false,
        message: '🚫 **Account Suspended**\n\nYour account has been suspended. Contact support for assistance.'
      };
    }

    // Check rate limit
    const isSubscriber = user.subscriptionStatus === 'subscriber';
    const rateLimit = await db.checkRateLimit(user.telegramId, isSubscriber);
    
    if (!rateLimit.allowed) {
      return {
        allowed: false,
        message: `⏱️ **Rate Limit Reached**\n\n` +
                 `You've reached your hourly question limit (${rateLimit.limit}).\n\n` +
                 `⏰ Try again in a few minutes` +
                 (!isSubscriber ? ` or upgrade to Premium for more questions!` : '!')
      };
    }

    return { allowed: true, remaining: rateLimit.remaining };
  }

  /**
   * Validate answer timing (anti-cheat)
   */
  static validateAnswerTiming(responseTimeSeconds) {
    const minTime = config.antiCheat.minAnswerTimeSeconds;

    if (responseTimeSeconds < minTime) {
      return {
        valid: false,
        message: `⚠️ **Answer Too Fast**\n\n` +
                `Please take time to read the question carefully.`
      };
    }

    if (responseTimeSeconds > config.questionTimeLimit * 2) {
      return {
        valid: false,
        message: `⏱️ **Time Expired**\n\n` +
                `Please request a new question.`
      };
    }

    return { valid: true };
  }

  /**
   * Check for suspicious behavior
   */
  static checkSuspiciousBehavior(user, responseTimeSeconds) {
    const flags = [];

    // Consistently answering too fast
    if (responseTimeSeconds < 3 && user.correctAnswers > 10) {
      const accuracy = user.correctAnswers / user.totalQuestions;
      if (accuracy > 0.95) {
        flags.push('high_speed_high_accuracy');
      }
    }

    // Unrealistic correct streak
    const recentCorrect = user.correctAnswers;
    if (recentCorrect > config.antiCheat.maxCorrectStreakBeforeReview) {
      flags.push('long_correct_streak');
    }

    return {
      suspicious: flags.length > 0,
      flags
    };
  }

  /**
   * Check prize round eligibility
   */
  static checkPrizeRoundEligibility(user) {
    // No special requirements for now
    // Can add minimum AP, minimum questions, etc.
    return { allowed: true };
  }
}
