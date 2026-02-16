/**
 * Question Manager
 * Handles question delivery and answer processing
 */

import { ScoringEngine } from './scoring.js';
import { EligibilityChecker } from './eligibility.js';
import { logger } from '../utils/logger.js';
import { generateId } from '../utils/helpers.js';

export class QuestionManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get a question for the user
   */
  async getQuestionForUser(user, isPrizeRound = false) {
    // Check eligibility
    const eligibility = await EligibilityChecker.checkPlayEligibility(user, this.db);
    if (!eligibility.allowed) {
      return { question: null, error: eligibility.message };
    }

    // Get random question
    const question = await this.db.getRandomQuestion(user.telegramId, true);
    
    if (!question) {
      return {
        question: null,
        error: '🎉 **You\'ve answered all available questions!**\n\nNew questions are added regularly. Check back soon!'
      };
    }

    // Check attempt limit
    const attemptCount = await this.db.getAttemptCount(user.telegramId, question.questionId);
    const maxAttempts = user.subscriptionStatus === 'subscriber' && isPrizeRound ? 2 : 1;

    if (attemptCount >= maxAttempts) {
      // Try another question
      return this.getQuestionForUser(user, isPrizeRound);
    }

    // Cache active question
    const questionData = {
      userId: user.telegramId,
      question,
      startTime: Date.now(),
      attemptNumber: attemptCount + 1,
      isPrizeRound
    };

    await this.db.cacheActiveQuestion(user.telegramId, questionData);

    logger.info(`Delivered question ${question.questionId} to user ${user.telegramId}`);
    return { question, error: null };
  }

  /**
   * Process user's answer
   */
  async processAnswer(user, questionId, selectedOption, isPrizeRound = false) {
    // Get active question from cache
    const activeData = await this.db.getActiveQuestion(user.telegramId);
    
    if (!activeData || activeData.question.questionId !== questionId) {
      return {
        success: false,
        error: 'Question not found or expired. Please request a new question.'
      };
    }

    const { question, startTime, attemptNumber } = activeData;
    const responseTime = (Date.now() - startTime) / 1000; // Convert to seconds

    // Validate timing
    const timingCheck = EligibilityChecker.validateAnswerTiming(responseTime);
    if (!timingCheck.valid) {
      await this.db.clearActiveQuestion(user.telegramId);
      return { success: false, error: timingCheck.message };
    }

    // Check if answer is correct
    const isCorrect = selectedOption.toUpperCase() === question.correctOption.toUpperCase();

    // Calculate points
    const { total: points, breakdown } = ScoringEngine.calculatePoints(
      user,
      question,
      isCorrect,
      responseTime,
      attemptNumber,
      isPrizeRound
    );

    // Update user streak
    const { user: updatedUser, streakBroken } = ScoringEngine.updateStreak(user);
    
    // Apply points
    ScoringEngine.applyPoints(updatedUser, points, isPrizeRound);

    // Update stats
    updatedUser.totalQuestions += 1;
    if (isCorrect) {
      updatedUser.correctAnswers += 1;
    }

    // Check for suspicious behavior
    const suspiciousCheck = EligibilityChecker.checkSuspiciousBehavior(updatedUser, responseTime);
    if (suspiciousCheck.suspicious) {
      updatedUser.suspiciousFlags += 1;
      logger.warn(`Suspicious behavior detected for user ${updatedUser.telegramId}`);
    }

    // Save attempt
    const attempt = {
      attemptId: generateId(),
      telegramId: user.telegramId,
      questionId,
      selectedOption,
      isCorrect,
      responseTimeSeconds: responseTime,
      pointsAwarded: points,
      pointType: isPrizeRound ? 'pp' : 'ap',
      attemptNumber
    };

    await this.db.createAttempt(attempt);

    // Update user in database
    await this.db.updateUser(updatedUser);

    // Update question stats
    await this.db.updateQuestionStats(questionId, isCorrect);

    // Clear active question
    await this.db.clearActiveQuestion(user.telegramId);

    // Return result
    return {
      success: true,
      isCorrect,
      correctOption: question.correctOption,
      points,
      breakdown,
      streakBroken,
      user: updatedUser
    };
  }

  /**
   * Format question text for display
   */
  formatQuestionText(question, questionNumber) {
    return `**Question #${questionNumber}**\n\n${question.questionText}\n\n` +
           `A) ${question.optionA}\n` +
           `B) ${question.optionB}\n` +
           `C) ${question.optionC}\n` +
           `D) ${question.optionD}\n\n` +
           `⏱️ Time: ${question.timeLimitSeconds}s | Category: ${question.category}`;
  }
}
