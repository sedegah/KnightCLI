/**
 * G-NEX Question Manager
 * Handles question delivery, scoring, and game flow
 */

import { logger } from '../utils/logger.js';

export class QuestionManager {
  constructor(database) {
    this.db = database;
  }

  async getQuestionForUser(user, isPrizeRound = false) {
    try {
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
      const question = await this.db.getRandomQuestion(user.telegram_id, true);
      if (!question) {
        return {
          question: null,
          error: '📝 **No questions available**\n\nPlease contact the administrator to add questions to the database.\n\n*Powered by G-NEX*'
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

      // Calculate points
      const points = await this.calculatePoints(user, question, isCorrect, responseTime, isPrizeRound);

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
        last_played_date: new Date().toISOString().split('T')[0]
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
      let basePoints = 5;
      let ap = 0;
      let pp = 0;
      let pointType = 'ap';

      // Base points for correct answer
      if (isCorrect) {
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
        if (user.streak >= 7) {
          basePoints = Math.round(basePoints * 1.1);
        } else if (user.streak >= 30) {
          basePoints = Math.round(basePoints * 1.3);
        }

        // Subscription bonus
        if (user.subscription_status === 'subscriber') {
          basePoints = Math.round(basePoints * 1.25);
        }
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
          base: isCorrect ? (isPrizeRound ? 10 : 8) : 0,
          speedBonus: responseTime < 10 ? Math.round(basePoints * 0.3) : responseTime < 20 ? Math.round(basePoints * 0.1) : 0,
          streakBonus: user.streak >= 7 ? Math.round(basePoints * 0.1) : 0,
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
