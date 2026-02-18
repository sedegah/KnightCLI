/**
 * G-NEX Arena: Competitive Quiz Game Modes
 * Implements 1v1 challenges, Partner Mode, and Squad Mode
 */

import { logger } from '../utils/logger.js';

export class ArenaManager {
  constructor(kv) {
    this.kv = kv;
  }

  // ==========================================
  // 1v1 CHALLENGE SYSTEM
  // ==========================================

  async createChallenge(challengerId, opponentId, challengeType = 'standard') {
    try {
      const challengeId = crypto.randomUUID();
      const challenge = {
        id: challengeId,
        challengerId,
        opponentId,
        type: challengeType, // 'standard', 'speed', 'streak'
        status: 'pending',
        questionsPerRound: 5,
        timeLimit: 30, // seconds per question
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      await this.kv.put(`challenge:${challengeId}`, JSON.stringify(challenge));
      
      // Store in user's active challenges
      await this.addUserChallenge(challengerId, challengeId, 'sent');
      await this.addUserChallenge(opponentId, challengeId, 'received');

      return challenge;
    } catch (error) {
      logger.error('Error creating challenge:', error);
      return null;
    }
  }

  async acceptChallenge(challengeId, acceptingUserId) {
    try {
      const challengeData = await this.kv.get(`challenge:${challengeId}`);
      if (!challengeData) return null;

      const challenge = JSON.parse(challengeData);
      
      if (challenge.opponentId !== acceptingUserId || challenge.status !== 'pending') {
        return null;
      }

      challenge.status = 'active';
      challenge.startedAt = new Date().toISOString();
      challenge.currentRound = 1;
      challenge.currentQuestion = 0;
      challenge.challengerScore = 0;
      challenge.opponentScore = 0;

      await this.kv.put(`challenge:${challengeId}`, JSON.stringify(challenge));
      return challenge;
    } catch (error) {
      logger.error('Error accepting challenge:', error);
      return null;
    }
  }

  async submitChallengeAnswer(challengeId, userId, questionId, answer, responseTime) {
    try {
      const challengeData = await this.kv.get(`challenge:${challengeId}`);
      if (!challengeData) return null;

      const challenge = JSON.parse(challengeData);
      
      if (challenge.status !== 'active') return null;

      // Get question and check answer
      const questionData = await this.kv.get(`questions:${questionId}`);
      if (!questionData) return null;

      const question = JSON.parse(questionData);
      const isCorrect = answer.toUpperCase() === question.correct_option.toUpperCase();

      // Calculate points
      let points = 0;
      if (isCorrect) {
        points = this.calculateChallengePoints(challenge.type, responseTime, question.difficulty);
      }

      // Update scores
      if (userId === challenge.challengerId) {
        challenge.challengerScore += points;
      } else if (userId === challenge.opponentId) {
        challenge.opponentScore += points;
      }

      challenge.currentQuestion++;

      // Check if challenge is complete
      if (challenge.currentQuestion >= challenge.questionsPerRound) {
        challenge.status = 'completed';
        challenge.completedAt = new Date().toISOString();
        challenge.winner = challenge.challengerScore > challenge.opponentScore ? challenge.challengerId : 
                     challenge.opponentScore > challenge.challengerScore ? challenge.opponentId : 'tie';
      }

      await this.kv.put(`challenge:${challengeId}`, JSON.stringify(challenge));

      return {
        isCorrect,
        points,
        correctAnswer: question.correct_option,
        challengeComplete: challenge.status === 'completed',
        currentScore: userId === challenge.challengerId ? challenge.challengerScore : challenge.opponentScore
      };
    } catch (error) {
      logger.error('Error submitting challenge answer:', error);
      return null;
    }
  }

  calculateChallengePoints(type, responseTime, difficulty) {
    let basePoints = 10;
    
    // Type multiplier
    if (type === 'speed') basePoints = 15;
    if (type === 'streak') basePoints = 12;

    // Difficulty multiplier
    if (difficulty === 'Medium') basePoints *= 1.5;
    if (difficulty === 'Hard') basePoints *= 2;

    // Speed bonus (under 10 seconds = bonus)
    if (responseTime < 10) {
      basePoints *= 1.5;
    }

    return Math.round(basePoints);
  }

  // ==========================================
  // PARTNER MODE (DUO PLAY)
  // ==========================================

  async createPartnership(player1Id, player2Id) {
    try {
      // Check if either player is already in a partnership
      const existing1 = await this.getActivePartnership(player1Id);
      const existing2 = await this.getActivePartnership(player2Id);
      
      if (existing1 || existing2) {
        return { error: 'One or both players are already in a partnership' };
      }

      const partnershipId = crypto.randomUUID();
      const partnership = {
        id: partnershipId,
        player1Id,
        player2Id,
        status: 'active',
        combinedScore: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        currentStreak: 0,
        bestStreak: 0,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      await this.kv.put(`partnership:${partnershipId}`, JSON.stringify(partnership));
      
      // Store partnership references for both players
      await this.kv.put(`user_partnership:${player1Id}`, partnershipId);
      await this.kv.put(`user_partnership:${player2Id}`, partnershipId);

      return partnership;
    } catch (error) {
      logger.error('Error creating partnership:', error);
      return { error: 'Failed to create partnership' };
    }
  }

  async getActivePartnership(playerId) {
    try {
      const partnershipId = await this.kv.get(`user_partnership:${playerId}`);
      if (!partnershipId) return null;

      const partnershipData = await this.kv.get(`partnership:${partnershipId}`);
      if (!partnershipData) return null;

      const partnership = JSON.parse(partnershipData);
      return partnership.status === 'active' ? partnership : null;
    } catch (error) {
      logger.error('Error getting active partnership:', error);
      return null;
    }
  }

  async submitPartnerAnswer(partnershipId, playerId, questionId, answer, responseTime) {
    try {
      const partnershipData = await this.kv.get(`partnership:${partnershipId}`);
      if (!partnershipData) return null;

      const partnership = JSON.parse(partnershipData);
      
      // Get question and check answer
      const questionData = await this.kv.get(`questions:${questionId}`);
      if (!questionData) return null;

      const question = JSON.parse(questionData);
      const isCorrect = answer.toUpperCase() === question.correct_option.toUpperCase();

      // Update partnership stats
      partnership.questionsAnswered++;
      partnership.lastActivity = new Date().toISOString();
      
      if (isCorrect) {
        partnership.correctAnswers++;
        partnership.currentStreak++;
        partnership.bestStreak = Math.max(partnership.bestStreak, partnership.currentStreak);
      } else {
        partnership.currentStreak = 0;
      }

      // Calculate shared points
      let points = 0;
      if (isCorrect) {
        points = this.calculatePartnerPoints(responseTime, question.difficulty, partnership.currentStreak);
        partnership.combinedScore += points;
      }

      await this.kv.put(`partnership:${partnershipId}`, JSON.stringify(partnership));

      return {
        isCorrect,
        points,
        correctAnswer: question.correct_option,
        partnershipStats: {
          combinedScore: partnership.combinedScore,
          currentStreak: partnership.currentStreak,
          accuracy: Math.round((partnership.correctAnswers / partnership.questionsAnswered) * 100)
        }
      };
    } catch (error) {
      logger.error('Error submitting partner answer:', error);
      return null;
    }
  }

  calculatePartnerPoints(responseTime, difficulty, streak) {
    let basePoints = 8; // Base points for partners (shared)

    // Difficulty multiplier
    if (difficulty === 'Medium') basePoints *= 1.3;
    if (difficulty === 'Hard') basePoints *= 1.6;

    // Speed bonus
    if (responseTime < 15) {
      basePoints *= 1.3;
    }

    // Streak bonus
    if (streak >= 5) basePoints *= 1.2;
    if (streak >= 10) basePoints *= 1.5;

    return Math.round(basePoints);
  }

  // ==========================================
  // SQUAD MODE (GROUP COMPETITION)
  // ==========================================

  async createSquad(creatorId, squadName, maxMembers = 10) {
    try {
      // Check if user is already in a squad
      const existingSquad = await this.getUserSquad(creatorId);
      if (existingSquad) {
        return { error: 'You are already in a squad' };
      }

      const squadId = crypto.randomUUID();
      const squad = {
        id: squadId,
        name: squadName,
        creatorId,
        leaderId: creatorId,
        memberIds: [creatorId],
        maxMembers,
        status: 'active',
        weeklyScore: 0,
        totalScore: 0,
        weeklyRank: 0,
        battlesWon: 0,
        battlesPlayed: 0,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      await this.kv.put(`squad:${squadId}`, JSON.stringify(squad));
      await this.kv.put(`user_squad:${creatorId}`, squadId);

      return squad;
    } catch (error) {
      logger.error('Error creating squad:', error);
      return { error: 'Failed to create squad' };
    }
  }

  async joinSquad(squadId, userId) {
    try {
      // Check if user is already in a squad
      const existingSquad = await this.getUserSquad(userId);
      if (existingSquad) {
        return { error: 'You are already in a squad' };
      }

      const squadData = await this.kv.get(`squad:${squadId}`);
      if (!squadData) {
        return { error: 'Squad not found' };
      }

      const squad = JSON.parse(squadData);
      
      if (squad.memberIds.length >= squad.maxMembers) {
        return { error: 'Squad is full' };
      }

      squad.memberIds.push(userId);
      squad.lastActivity = new Date().toISOString();

      await this.kv.put(`squad:${squadId}`, JSON.stringify(squad));
      await this.kv.put(`user_squad:${userId}`, squadId);

      return squad;
    } catch (error) {
      logger.error('Error joining squad:', error);
      return { error: 'Failed to join squad' };
    }
  }

  async getUserSquad(userId) {
    try {
      const squadId = await this.kv.get(`user_squad:${userId}`);
      if (!squadId) return null;

      const squadData = await this.kv.get(`squad:${squadId}`);
      if (!squadData) return null;

      const squad = JSON.parse(squadData);
      return squad.status === 'active' ? squad : null;
    } catch (error) {
      logger.error('Error getting user squad:', error);
      return null;
    }
  }

  async updateSquadScore(squadId, points, isBattle = false) {
    try {
      const squadData = await this.kv.get(`squad:${squadId}`);
      if (!squadData) return null;

      const squad = JSON.parse(squadData);
      
      squad.weeklyScore += points;
      squad.totalScore += points;
      squad.lastActivity = new Date().toISOString();

      if (isBattle) {
        squad.battlesPlayed++;
        // Battle win logic handled separately
      }

      await this.kv.put(`squad:${squadId}`, JSON.stringify(squad));
      return squad;
    } catch (error) {
      logger.error('Error updating squad score:', error);
      return null;
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  async addUserChallenge(userId, challengeId, type) {
    const key = `user_challenges:${userId}`;
    const existing = await this.kv.get(key);
    const challenges = existing ? JSON.parse(existing) : [];
    
    challenges.push({ challengeId, type, createdAt: new Date().toISOString() });
    await this.kv.put(key, JSON.stringify(challenges));
  }

  async getUserChallenges(userId, type = 'all') {
    try {
      const challengeData = await this.kv.get(`user_challenges:${userId}`);
      if (!challengeData) return [];

      const challenges = JSON.parse(challengeData);
      
      if (type === 'all') return challenges;
      
      return challenges.filter(c => c.type === type);
    } catch (error) {
      logger.error('Error getting user challenges:', error);
      return [];
    }
  }

  async getChallenge(challengeId) {
    try {
      const challengeData = await this.kv.get(`challenge:${challengeId}`);
      return challengeData ? JSON.parse(challengeData) : null;
    } catch (error) {
      logger.error('Error getting challenge:', error);
      return null;
    }
  }
}
