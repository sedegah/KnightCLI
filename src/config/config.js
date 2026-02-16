/**
 * Application Configuration
 */

export const config = {
  // Game Configuration
  scoring: {
    free: {
      continuous: {
        correct: 5,
        speedBonusMax: 0,
        attempts: 1
      },
      prizeRound: {
        correct: 10,
        speedBonusMax: 5,
        attempts: 1
      }
    },
    subscriber: {
      continuous: {
        correct: 8,
        speedBonusMax: 0,
        attempts: 1
      },
      prizeRound: {
        correct: 15,
        speedBonusMax: 7,
        attempts: 2,
        secondAttemptMultiplier: 0.8
      }
    }
  },

  // Streak bonuses
  streakBonuses: {
    3: 5,
    7: 15,
    30: 50
  },

  // Rate limits
  rateLimits: {
    free: {
      hourly: 20,
      daily: 200
    },
    subscriber: {
      hourly: 40,
      daily: 400
    }
  },

  // Question settings
  questionTimeLimit: 30, // seconds
  prizeRoundDuration: 15, // minutes
  prizeRoundQuestionCount: 10,

  // Anti-cheat
  antiCheat: {
    minAnswerTimeSeconds: 2,
    maxCorrectStreakBeforeReview: 50,
    maxHourlyRequests: 100
  },

  // Leaderboard
  leaderboard: {
    topCount: 50,
    displayCount: 10
  },

  // Weekly rewards
  weeklyRewards: {
    1: { type: 'cash', amountUSD: 100 },
    2: { type: 'cash', amountUSD: 50 },
    3: { type: 'cash', amountUSD: 25 },
    4: { type: 'subscription', months: 1 },
    5: { type: 'subscription', months: 1 },
    6: { type: 'subscription', months: 1 },
    7: { type: 'subscription', months: 1 },
    8: { type: 'subscription', months: 1 },
    9: { type: 'subscription', months: 1 },
    10: { type: 'subscription', months: 1 }
  },

  // Prize round times (UTC hours)
  prizeRounds: {
    morning: 9,
    evening: 21
  }
};

/**
 * Get configuration value from environment or use default
 */
export function getConfig(key, defaultValue, env) {
  return env?.[key] ?? defaultValue;
}
