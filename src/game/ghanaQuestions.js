/**
 * G-NEX Ghana-Focused Question System
 * Implements Ghana-specific categories, content, and local events
 */

import { logger } from '../utils/logger.js';

export class GhanaQuestionManager {
  constructor(kv) {
    this.kv = kv;
    
    // Ghana-specific question categories
    this.categories = {
      CULTURE: { name: 'Ghanaian Culture', emoji: '🇬🇭', weight: 1.2 },
      SPORTS: { name: 'Ghanaian Sports', emoji: '⚽', weight: 1.3 },
      MUSIC: { name: 'Ghanaian Music', emoji: '🎵', weight: 1.1 },
      HISTORY: { name: 'Ghanaian History', emoji: '📚', weight: 1.0 },
      POLITICS: { name: 'Ghanaian Politics', emoji: '🏛️', weight: 0.9 },
      GEOGRAPHY: { name: 'Ghanaian Geography', emoji: '🗺️', weight: 1.0 },
      FOOD: { name: 'Ghanaian Cuisine', emoji: '🍛', weight: 1.1 },
      ENTERTAINMENT: { name: 'Ghanaian Entertainment', emoji: '🎬', weight: 1.0 },
      LANGUAGE: { name: 'Ghanaian Languages', emoji: '💬', weight: 1.2 },
      CURRENT_AFFAIRS: { name: 'Ghana Current Affairs', emoji: '📰', weight: 1.1 }
    };

    // Local holiday bonuses
    this.holidayBonuses = {
      'independence_day': { date: '03-06', multiplier: 1.5, name: 'Independence Day' },
      'republic_day': { date: '07-01', multiplier: 1.3, name: 'Republic Day' },
      'founders_day': { date: '09-21', multiplier: 1.4, name: 'Kwame Nkrumah Memorial Day' },
      'farmers_day': { date: '12-05', multiplier: 1.2, name: 'Farmers Day' },
      'workers_day': { date: '05-01', multiplier: 1.2, name: 'Workers Day' },
      'christmas': { date: '12-25', multiplier: 1.3, name: 'Christmas' },
      'eid_fitr': { date: 'variable', multiplier: 1.3, name: 'Eid al-Fitr' },
      'eid_adha': { date: 'variable', multiplier: 1.3, name: 'Eid al-Adha' }
    };

    // Ghana-specific difficulty adjustments
    this.difficultyModifiers = {
      EASY: { basePoints: 5, timeLimit: 30 },
      MEDIUM: { basePoints: 8, timeLimit: 25 },
      HARD: { basePoints: 12, timeLimit: 20 },
      EXPERT: { basePoints: 20, timeLimit: 15 }
    };
  }

  // ==========================================
  // HOLIDAY BONUS SYSTEM
  // ==========================================

  async getTodayHolidayBonus() {
    try {
      const today = new Date();
      const todayString = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      for (const [key, holiday] of Object.entries(this.holidayBonuses)) {
        if (holiday.date === todayString) {
          return holiday;
        }
      }

      // Check for variable date holidays (Eid, etc.)
      const variableHolidays = await this.getVariableDateHolidays(today);
      for (const holiday of variableHolidays) {
        if (this.isSameDay(today, holiday.date)) {
          return holiday;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting today holiday bonus:', error);
      return null;
    }
  }

  async getVariableDateHolidays(date) {
    // This would calculate Islamic holidays and other variable date holidays
    // For now, return empty array - would integrate with Islamic calendar API
    return [];
  }

  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  async calculateHolidayMultiplier(question) {
    const holiday = await this.getTodayHolidayBonus();
    
    if (!holiday) return 1.0;

    // Extra bonus for Ghanaian questions on holidays
    const isGhanaQuestion = this.categories[question.category] !== undefined;
    
    if (isGhanaQuestion) {
      return holiday.multiplier * 1.1; // Extra 10% for Ghana questions on holidays
    }

    return holiday.multiplier;
  }

  // ==========================================
  // GHANA-SPECIFIC QUESTION CREATION
  // ==========================================

  async createGhanaQuestion(questionData) {
    try {
      const question = {
        id: crypto.randomUUID(),
        question_id: questionData.questionId || Date.now(),
        category: questionData.category,
        question_text: questionData.questionText,
        option_a: questionData.options.A,
        option_b: questionData.options.B,
        option_c: questionData.options.C,
        option_d: questionData.options.D,
        correct_option: questionData.correctOption,
        difficulty: questionData.difficulty || 'MEDIUM',
        image_url: questionData.imageUrl || null,
        audio_url: questionData.audioUrl || null, // For local language questions
        ghana_context: questionData.ghanaContext || null,
        region_specific: questionData.regionSpecific || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        times_asked: 0,
        times_correct: 0,
        average_response_time: 0
      };

      await this.kv.put(`questions:${question.id}`, JSON.stringify(question));
      return question;
    } catch (error) {
      logger.error('Error creating Ghana question:', error);
      return null;
    }
  }

  // ==========================================
  // SAMPLE GHANA QUESTIONS
  // ==========================================

  async loadSampleGhanaQuestions() {
    try {
      const sampleQuestions = [
        {
          questionId: 1001,
          category: 'CULTURE',
          questionText: 'What is the name of the traditional Ghanaian cloth worn during special occasions?',
          options: {
            A: 'Kente',
            B: 'Ankara',
            C: 'Batik',
            D: 'Dashiki'
          },
          correctOption: 'A',
          difficulty: 'EASY',
          ghanaContext: 'Kente cloth is a traditional Ghanaian textile worn by royalty and for special occasions',
          regionSpecific: false
        },
        {
          questionId: 1002,
          category: 'SPORTS',
          questionText: 'Which Ghanaian football player is known as the "Baby Jet"?',
          options: {
            A: 'Samuel Osei Kuffour',
            B: 'Asamoah Gyan',
            C: 'Abedi Pele',
            D: 'Stephen Appiah'
          },
          correctOption: 'B',
          difficulty: 'MEDIUM',
          ghanaContext: 'Asamoah Gyan earned the nickname "Baby Jet" for his speed and scoring ability',
          regionSpecific: false
        },
        {
          questionId: 1003,
          category: 'HISTORY',
          questionText: 'In which year did Ghana gain independence from British colonial rule?',
          options: {
            A: '1956',
            B: '1957',
            C: '1960',
            D: '1963'
          },
          correctOption: 'B',
          difficulty: 'EASY',
          ghanaContext: 'Ghana was the first sub-Saharan African country to gain independence',
          regionSpecific: false
        },
        {
          questionId: 1004,
          category: 'MUSIC',
          questionText: 'Which Ghanaian music genre combines highlife and hip-hop elements?',
          options: {
            A: 'Azonto',
            B: 'Hiplife',
            C: 'Kpalongo',
            D: 'Adowa'
          },
          correctOption: 'B',
          difficulty: 'MEDIUM',
          ghanaContext: 'Hiplife was pioneered by Reggie Rockstone in the 1990s',
          regionSpecific: false
        },
        {
          questionId: 1005,
          category: 'FOOD',
          questionText: 'What is the national dish of Ghana, made from maize and cassava dough?',
          options: {
            A: 'Jollof rice',
            B: 'Banku',
            C: 'Fufu',
            D: 'Kenkey'
          },
          correctOption: 'B',
          difficulty: 'EASY',
          ghanaContext: 'Banku is a traditional Ghanaian dish served with soup or stew',
          regionSpecific: false
        },
        {
          questionId: 1006,
          category: 'LANGUAGE',
          questionText: 'How do you say "Thank you" in Twi?',
          options: {
            A: 'Meda wo ase',
            B: 'Me da wo akye',
            C: 'Yoo',
            D: 'Ete sen'
          },
          correctOption: 'B',
          difficulty: 'MEDIUM',
          ghanaContext: 'Twi is one of the most widely spoken languages in Ghana',
          regionSpecific: false,
          audioUrl: 'audio/thank_you_twi.mp3'
        },
        {
          questionId: 1007,
          category: 'GEOGRAPHY',
          questionText: 'Which region is known as the "Golden Stool" region of Ghana?',
          options: {
            A: 'Ashanti Region',
            B: 'Greater Accra',
            C: 'Western Region',
            D: 'Northern Region'
          },
          correctOption: 'A',
          difficulty: 'MEDIUM',
          ghanaContext: 'The Golden Stool is the sacred symbol of the Ashanti people',
          regionSpecific: false
        },
        {
          questionId: 1008,
          category: 'CURRENT_AFFAIRS',
          questionText: 'What is the current currency of Ghana?',
          options: {
            A: 'Cedis',
            B: 'Cedi',
            C: 'Ghana Dollar',
            D: 'West African CFA'
          },
          correctOption: 'B',
          difficulty: 'EASY',
          ghanaContext: 'The Ghanaian Cedi (GHS) is the official currency',
          regionSpecific: false
        }
      ];

      for (const questionData of sampleQuestions) {
        await this.createGhanaQuestion(questionData);
      }

      logger.info(`Loaded ${sampleQuestions.length} sample Ghana questions`);
      return sampleQuestions.length;
    } catch (error) {
      logger.error('Error loading sample Ghana questions:', error);
      return 0;
    }
  }

  // ==========================================
  // REGION-SPECIFIC QUESTIONS
  // ==========================================

  async getRegionalQuestions(userId, userRegion = null) {
    try {
      // Get user's region from their profile or location data
      if (!userRegion) {
        userRegion = await this.getUserRegion(userId);
      }

      const list = await this.kv.list({ prefix: 'questions:' });
      const regionalQuestions = [];

      for (const key of list.keys) {
        const questionData = await this.kv.get(key.name);
        if (questionData) {
          const question = JSON.parse(questionData);
          
          // Include questions specific to user's region or general Ghana questions
          if (!question.region_specific || question.region_specific === userRegion) {
            regionalQuestions.push(question);
          }
        }
      }

      return regionalQuestions;
    } catch (error) {
      logger.error('Error getting regional questions:', error);
      return [];
    }
  }

  async getUserRegion(userId) {
    try {
      // This would integrate with user profile system
      // For now, return null (general Ghana questions)
      return null;
    } catch (error) {
      logger.error('Error getting user region:', error);
      return null;
    }
  }

  // ==========================================
  // LOCAL LANGUAGE SUPPORT
  // ==========================================

  async getQuestionInLocalLanguage(questionId, language = 'twi') {
    try {
      const questionData = await this.kv.get(`questions:${questionId}`);
      if (!questionData) return null;

      const question = JSON.parse(questionData);
      
      // Check if local language version exists
      const localVersion = await this.kv.get(`questions_local:${questionId}_${language}`);
      
      if (localVersion) {
        return JSON.parse(localVersion);
      }

      // Return original question with local language note
      return {
        ...question,
        localLanguageNote: `This question is available in ${language.toUpperCase()} - ask your admin to enable it!`
      };
    } catch (error) {
      logger.error('Error getting local language question:', error);
      return null;
    }
  }

  async createLocalLanguageVersion(questionId, language, translations) {
    try {
      const originalData = await this.kv.get(`questions:${questionId}`);
      if (!originalData) return false;

      const original = JSON.parse(originalData);
      
      const localVersion = {
        ...original,
        question_text: translations.questionText,
        option_a: translations.options.A,
        option_b: translations.options.B,
        option_c: translations.options.C,
        option_d: translations.options.D,
        language,
        translated_at: new Date().toISOString()
      };

      await this.kv.put(`questions_local:${questionId}_${language}`, JSON.stringify(localVersion));
      return true;
    } catch (error) {
      logger.error('Error creating local language version:', error);
      return false;
    }
  }

  // ==========================================
  // CULTURAL EVENTS AND SPECIAL QUESTIONS
  // ==========================================

  async createEventQuestions(eventName, questions) {
    try {
      const eventQuestions = [];
      
      for (const questionData of questions) {
        const question = {
          ...questionData,
          event_name: eventName,
          event_specific: true,
          event_start_date: new Date().toISOString(),
          event_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          bonus_multiplier: 1.5
        };

        const created = await this.createGhanaQuestion(question);
        if (created) {
          eventQuestions.push(created);
        }
      }

      logger.info(`Created ${eventQuestions.length} questions for event: ${eventName}`);
      return eventQuestions;
    } catch (error) {
      logger.error('Error creating event questions:', error);
      return [];
    }
  }

  async getActiveEventQuestions() {
    try {
      const today = new Date();
      const list = await this.kv.list({ prefix: 'questions:' });
      const eventQuestions = [];

      for (const key of list.keys) {
        const questionData = await this.kv.get(key.name);
        if (questionData) {
          const question = JSON.parse(questionData);
          
          if (question.event_specific && 
              new Date(question.event_start_date) <= today && 
              new Date(question.event_end_date) >= today) {
            eventQuestions.push(question);
          }
        }
      }

      return eventQuestions;
    } catch (error) {
      logger.error('Error getting active event questions:', error);
      return [];
    }
  }

  // ==========================================
  // QUESTION DIFFICULTY ADJUSTMENT
  // ==========================================

  async calculateGhanaQuestionPoints(question, responseTime, userStreak = 0) {
    try {
      const basePoints = this.difficultyModifiers[question.difficulty]?.basePoints || 8;
      
      let points = basePoints;

      // Ghana category bonus
      const categoryBonus = this.categories[question.category]?.weight || 1.0;
      points *= categoryBonus;

      // Holiday bonus
      const holidayMultiplier = await this.calculateHolidayMultiplier(question);
      points *= holidayMultiplier;

      // Speed bonus
      const timeLimit = this.difficultyModifiers[question.difficulty]?.timeLimit || 25;
      if (responseTime < timeLimit * 0.3) { // Under 30% of time limit
        points *= 1.5;
      } else if (responseTime < timeLimit * 0.6) { // Under 60% of time limit
        points *= 1.2;
      }

      // Streak bonus
      if (userStreak >= 7) points *= 1.1;
      if (userStreak >= 30) points *= 1.3;

      return Math.round(points);
    } catch (error) {
      logger.error('Error calculating Ghana question points:', error);
      return 8; // Default points
    }
  }

  // ==========================================
  // EDUCATIONAL CONTENT
  // ==========================================

  async getQuestionExplanation(questionId) {
    try {
      const explanation = await this.kv.get(`explanation:${questionId}`);
      
      if (explanation) {
        return JSON.parse(explanation);
      }

      // Generate basic explanation for Ghana questions
      const questionData = await this.kv.get(`questions:${questionId}`);
      if (questionData) {
        const question = JSON.parse(questionData);
        
        if (question.ghana_context) {
          return {
            text: question.ghana_context,
            sources: ['Ghana Cultural Encyclopedia'],
            learnMore: `Learn more about ${question.category.toLowerCase()} in Ghana`
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting question explanation:', error);
      return null;
    }
  }

  async addQuestionExplanation(questionId, explanation) {
    try {
      const explanationData = {
        questionId,
        text: explanation.text,
        sources: explanation.sources || [],
        learnMore: explanation.learnMore || '',
        addedAt: new Date().toISOString(),
        addedBy: explanation.addedBy || 'system'
      };

      await this.kv.put(`explanation:${questionId}`, JSON.stringify(explanationData));
      return true;
    } catch (error) {
      logger.error('Error adding question explanation:', error);
      return false;
    }
  }

  // ==========================================
  // ANALYTICS AND INSIGHTS
  // ==========================================

  async getGhanaQuestionStats() {
    try {
      const list = await this.kv.list({ prefix: 'questions:' });
      const stats = {
        totalQuestions: list.keys.length,
        categoryBreakdown: {},
        difficultyBreakdown: {},
        averageDifficulty: 0,
        mostCorrect: null,
        leastCorrect: null,
        regionalQuestions: 0,
        localLanguageQuestions: 0
      };

      const questionStats = [];
      let totalDifficulty = 0;

      for (const key of list.keys) {
        const questionData = await this.kv.get(key.name);
        if (questionData) {
          const question = JSON.parse(questionData);
          
          // Category breakdown
          if (!stats.categoryBreakdown[question.category]) {
            stats.categoryBreakdown[question.category] = 0;
          }
          stats.categoryBreakdown[question.category]++;

          // Difficulty breakdown
          if (!stats.difficultyBreakdown[question.difficulty]) {
            stats.difficultyBreakdown[question.difficulty] = 0;
          }
          stats.difficultyBreakdown[question.difficulty]++;

          // Regional and local language stats
          if (question.region_specific) stats.regionalQuestions++;
          if (question.language) stats.localLanguageQuestions++;

          // Performance stats
          const accuracy = question.times_asked > 0 ? (question.times_correct / question.times_asked) : 0;
          questionStats.push({
            id: question.id,
            category: question.category,
            difficulty: question.difficulty,
            accuracy,
            timesAsked: question.times_asked
          });

          totalDifficulty += this.getDifficultyLevel(question.difficulty);
        }
      }

      stats.averageDifficulty = stats.totalQuestions > 0 ? totalDifficulty / stats.totalQuestions : 0;

      // Find most and least correct questions
      questionStats.sort((a, b) => b.accuracy - a.accuracy);
      stats.mostCorrect = questionStats[0];
      stats.leastCorrect = questionStats[questionStats.length - 1];

      return stats;
    } catch (error) {
      logger.error('Error getting Ghana question stats:', error);
      return null;
    }
  }

  getDifficultyLevel(difficulty) {
    const levels = { EASY: 1, MEDIUM: 2, HARD: 3, EXPERT: 4 };
    return levels[difficulty] || 2;
  }
}
