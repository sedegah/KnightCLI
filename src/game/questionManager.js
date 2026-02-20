/**
 * G-NEX Question Manager
 * Handles question delivery, scoring, and game flow
 */

import { logger } from '../utils/logger.js';

export class QuestionManager {
  constructor(database) {
    this.db = database;
  }

  calculateUpdatedStreak(user) {
    const today = new Date().toISOString().split('T')[0];
    const currentStreak = Number(user.streak || 0);
    const lastPlayedDate = user.last_played_date;

    if (!lastPlayedDate) {
      return { streak: 1, streakBroken: false, today };
    }

    const lastPlayed = new Date(lastPlayedDate).toISOString().split('T')[0];
    const todayStart = new Date(`${today}T00:00:00Z`).getTime();
    const lastPlayedStart = new Date(`${lastPlayed}T00:00:00Z`).getTime();
    const daysDiff = Math.floor((todayStart - lastPlayedStart) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 0) {
      return {
        streak: currentStreak > 0 ? currentStreak : 1,
        streakBroken: false,
        today
      };
    }

    if (daysDiff === 1) {
      return {
        streak: Math.max(currentStreak, 0) + 1,
        streakBroken: false,
        today
      };
    }

    return {
      streak: 1,
      streakBroken: currentStreak > 0,
      today
    };
  }

  async getQuestionForUser(user, isPrizeRound = false) {
    try {
      if (!isPrizeRound) {
        const normalQuestionCount = await this.db.getUserNormalQuestionCount(user.telegram_id);
        const normalQuestionLimit = 20;

        if (normalQuestionCount >= normalQuestionLimit) {
          return {
            question: null,
            error: `✅ You have reached today's normal quiz limit of ${normalQuestionLimit} questions.\n\nCome back tomorrow for more normal questions, or join prize rounds.`
          };
        }
      }

      // Check rate limiting
      const rateLimitCount = await this.db.cacheRateLimit(user.telegram_id, 'play');
      const maxAttempts = user.subscription_status === 'subscriber' ? 40 : 20;
      
      if (rateLimitCount > maxAttempts) {
        return {
          question: null,
          error: `⏰️ Rate limit reached! You can play ${maxAttempts} times per hour.\n\n💎 Upgrade to Premium for 40 attempts/hour!`
        };
      }

      // Check for active question
      const activeQuestion = await this.db.getActiveQuestion(user.telegram_id);
      if (activeQuestion) {
        const timeSinceCached = Date.now() - activeQuestion.cachedAt;
        if (timeSinceCached < 5 * 60 * 1000) { // 5 minutes
          return {
            question: activeQuestion.question,
            error: null
          };
        }
      }

      // Get new question
      const question = await this.db.getRandomUnseenQuestion(user.telegram_id);
      if (!question) {
        return {
          question: null,
          error: '📝 **No new questions available**\n\nYou have already attempted all currently available normal questions. Please check back later for new questions.\n\n*Powered by G-NEX*'
        };
      }

      // Cache the active question
      await this.db.cacheActiveQuestion(user.telegram_id, {
        question,
        startTime: Date.now(),
        attemptNumber: 1,
        isPrizeRound
      });

      return {
        question,
        error: null
      };
    } catch (error) {
      logger.error('Error getting question for user:', error);
      return {
        question: null,
        error: '⚠️ An error occurred. Please try again.'
      };
    }
  }

  async processAnswer(user, questionId, selectedOption, isPrizeRound = false) {
    try {
      // Get question
      const question = await this.db.getQuestion(questionId);
      if (!question) {
        return {
          success: false,
          error: 'Question not found'
        };
      }

      // Get active question data (optional)
      const activeData = await this.db.getActiveQuestion(user.telegram_id);
      const hasActiveQuestion = !!(activeData && activeData.question && activeData.question.id === question.id);

      // Calculate response time
      const responseTime = activeData?.startTime ? (Date.now() - activeData.startTime) / 1000 : 0;

      // Check if correct - correct is 0-3 index, map to A-D
      const correctLetter = String.fromCharCode(65 + question.correct); // 0=>A, 1=>B, 2=>C, 3=>D
      const isCorrect = selectedOption.toUpperCase() === correctLetter.toUpperCase();

      const streakUpdate = this.calculateUpdatedStreak(user);

      // Calculate points
      const points = await this.calculatePoints(
        { ...user, streak: streakUpdate.streak },
        question,
        isCorrect,
        responseTime,
        isPrizeRound
      );

      // Create attempt record
      await this.db.createAttempt({
        telegramId: user.telegram_id,
        questionId: question.id,
        selectedOption,
        isCorrect,
        responseTimeSeconds: Math.round(responseTime),
        pointsAwarded: points.total,
        pointType: points.type,
        attemptNumber: hasActiveQuestion ? activeData.attemptNumber : 1
      });

      // Update question stats
      await this.db.updateQuestionStats(question.id, isCorrect);

      // Update user stats
      const updates = {
        total_questions: user.total_questions + 1,
        correct_answers: user.correct_answers + (isCorrect ? 1 : 0),
        ap: user.ap + points.ap,
        pp: user.pp + points.pp,
        weekly_points: user.weekly_points + points.total,
        streak: streakUpdate.streak,
        last_played_date: streakUpdate.today
      };

      await this.db.updateUser(user.telegram_id, updates);

      // Clear active question
      if (hasActiveQuestion) {
        await this.db.clearActiveQuestion(user.telegram_id);
      }

      return {
        success: true,
        isCorrect,
        points,
        correctOption: String.fromCharCode(65 + question.correct),
        responseTime: Math.round(responseTime),
        streakBroken: streakUpdate.streakBroken,
        user: {
          ...user,
          ...updates
        }
      };
    } catch (error) {
      logger.error('Error processing answer:', error);
      return {
        success: false,
        error: 'Failed to process answer'
      };
    }
  }

  async calculatePoints(user, question, isCorrect, responseTime, isPrizeRound) {
    try {
      if (!isCorrect) {
        return {
          total: 0,
          ap: 0,
          pp: 0,
          type: isPrizeRound ? 'pp' : 'ap',
          breakdown: {
            base: 0,
            speedBonus: 0,
            streakBonus: 0,
            ghanaBonus: 0,
            subscriptionBonus: 0
          }
        };
      }

      let basePoints = 0;
      let ap = 0;
      let pp = 0;
      let pointType = 'ap';

      basePoints = isPrizeRound ? 10 : 8;
      
      // Ghana question bonus
      if (this.isGhanaQuestion(question.category)) {
        basePoints = Math.round(basePoints * 1.2);
      }

      // Speed bonus
      if (responseTime < 10) {
        basePoints = Math.round(basePoints * 1.5);
      } else if (responseTime < 20) {
        basePoints = Math.round(basePoints * 1.2);
      }

      // Streak bonus
      if (user.streak >= 30) {
        basePoints = Math.round(basePoints * 1.3);
      } else if (user.streak >= 7) {
        basePoints = Math.round(basePoints * 1.1);
      }

      // Subscription bonus
      if (user.subscription_status === 'subscriber') {
        basePoints = Math.round(basePoints * 1.25);
      }

      // Assign points based on game mode
      if (isPrizeRound) {
        pp = basePoints;
        pointType = 'pp';
      } else {
        ap = basePoints;
        pointType = 'ap';
      }

      return {
        total: basePoints,
        ap,
        pp,
        type: pointType,
        breakdown: {
          base: isPrizeRound ? 10 : 8,
          speedBonus: responseTime < 10 ? Math.round(basePoints * 0.3) : responseTime < 20 ? Math.round(basePoints * 0.1) : 0,
          streakBonus: user.streak >= 30
            ? Math.round(basePoints * 0.3)
            : user.streak >= 7
              ? Math.round(basePoints * 0.1)
              : 0,
          ghanaBonus: this.isGhanaQuestion(question.category) ? Math.round(basePoints * 0.2) : 0,
          subscriptionBonus: user.subscription_status === 'subscriber' ? Math.round(basePoints * 0.25) : 0
        }
      };
    } catch (error) {
      logger.error('Error calculating points:', error);
      return { total: 0, ap: 0, pp: 0, type: 'ap' };
    }
  }

  isGhanaQuestion(category) {
    const ghanaCategories = ['CULTURE', 'SPORTS', 'MUSIC', 'HISTORY', 'POLITICS', 'GEOGRAPHY', 'FOOD', 'ENTERTAINMENT', 'LANGUAGE', 'CURRENT_AFFAIRS'];
    return ghanaCategories.includes(category);
  }

  formatQuestionText(question, questionNumber) {
    const questionText = question.question || 'What is your answer?';
    
    // Check if it's a True/False question (options C and D are N/A)
    const isTrueFalse = (question.option_c === 'N/A' || !question.option_c) && 
                        (question.option_d === 'N/A' || !question.option_d);
    
    if (isTrueFalse) {
      // Format for True/False questions (only show A and B)
      return `**Question #${questionNumber}**\n\n${questionText}\n\n` +
             `A) ${question.option_a}\n` +
             `B) ${question.option_b}\n\n` +
             `⏱️ Time: 30s | Category: ${question.category || 'General'}`;
    }
    
    // Format for multiple choice questions (show all 4 options)
    return `**Question #${questionNumber}**\n\n${questionText}\n\n` +
           `A) ${question.option_a}\n` +
           `B) ${question.option_b}\n` +
           `C) ${question.option_c}\n` +
           `D) ${question.option_d}\n\n` +
           `⏱️ Time: 30s | Category: ${question.category || 'General'}`;
  }

  formatBreakdown(breakdown, pointType) {
    let text = '';
    
    if (breakdown.base > 0) {
      text += `Base: +${breakdown.base} ${pointType.toUpperCase()}\n`;
    }
    
    if (breakdown.speedBonus > 0) {
      text += `⚡ Speed: +${breakdown.speedBonus}\n`;
    }
    
    if (breakdown.streakBonus > 0) {
      text += `🔥 Streak: +${breakdown.streakBonus}\n`;
    }
    
    if (breakdown.ghanaBonus > 0) {
      text += `🇬🇭 Ghana: +${breakdown.ghanaBonus}\n`;
    }
    
    if (breakdown.subscriptionBonus > 0) {
      text += `💎 Premium: +${breakdown.subscriptionBonus}\n`;
    }
    
    if (breakdown.total) {
      text += `\n**Total: +${breakdown.total} ${pointType.toUpperCase()}**`;
    }
    
    return text;
  }
}
