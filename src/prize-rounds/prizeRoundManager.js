/**
 * G-NEX Prize Round Manager
 * Handles scheduled prize draws and winner announcements
 */

import { D1Database } from '../database/d1-client.js';
import { logger } from '../utils/logger.js';
import { sendMessage } from '../utils/telegram.js';

export class PrizeRoundManager {
  constructor(database, botToken) {
    this.db = database;
    this.botToken = botToken;
  }

  /**
   * Run morning prize round (9:00 AM UTC)
   */
  async runMorningRound() {
    try {
      logger.info('🌅 Starting Morning Prize Round (9:00 AM UTC)');
      
      const winners = await this.selectWinners('MORNING');
      
      if (winners.length === 0) {
        logger.warn('No active players for morning round');
        return { success: true, winnersCount: 0 };
      }

      // Award prizes
      const awardedWinners = await this.awardPrizes(winners, 'MORNING');
      
      // Announce results
      await this.announceWinners(awardedWinners, 'MORNING');
      
      logger.info(`✅ Morning Round Complete - ${awardedWinners.length} winners`);
      
      return {
        success: true,
        winnersCount: awardedWinners.length,
        roundType: 'MORNING',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('❌ Morning Prize Round Failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run evening prize round (9:00 PM UTC)
   */
  async runEveningRound() {
    try {
      logger.info('🌆 Starting Evening Prize Round (9:00 PM UTC)');
      
      const winners = await this.selectWinners('EVENING');
      
      if (winners.length === 0) {
        logger.warn('No active players for evening round');
        return { success: true, winnersCount: 0 };
      }

      // Award prizes
      const awardedWinners = await this.awardPrizes(winners, 'EVENING');
      
      // Announce results
      await this.announceWinners(awardedWinners, 'EVENING');
      
      logger.info(`✅ Evening Round Complete - ${awardedWinners.length} winners`);
      
      return {
        success: true,
        winnersCount: awardedWinners.length,
        roundType: 'EVENING',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('❌ Evening Prize Round Failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Select winners based on recent activity and points
   */
  async selectWinners(roundType) {
    try {
      // Get top 10 players who played in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const query = `
        SELECT DISTINCT u.telegram_id, u.full_name, u.ap, u.streak
        FROM users u
        INNER JOIN user_attempts ua ON u.telegram_id = ua.telegram_id
        WHERE ua.attempted_at > ?
        AND u.is_banned = 0
        ORDER BY u.ap DESC, u.streak DESC
        LIMIT 10
      `;

      const result = await this.db.executeQuery(query, [oneHourAgo]);
      
      return result || [];
    } catch (error) {
      logger.error('Error selecting winners:', error);
      return [];
    }
  }

  /**
   * Award prize points to winners
   */
  async awardPrizes(winners, roundType) {
    const prizeDistribution = {
      1: { pp: 1000, dataAmount: 1000 }, // 1GB
      2: { pp: 750, dataAmount: 750 },   // 750MB
      3: { pp: 500, dataAmount: 500 },   // 500MB
      4: { pp: 400, dataAmount: 400 },   // 400MB
      5: { pp: 300, dataAmount: 300 },   // 300MB
      6: { pp: 250, dataAmount: 250 },   // 250MB
      7: { pp: 200, dataAmount: 200 },   // 200MB
      8: { pp: 150, dataAmount: 150 },   // 150MB
      9: { pp: 100, dataAmount: 100 },   // 100MB
      10: { pp: 50, dataAmount: 50 }     // 50MB
    };

    const awardedWinners = [];

    for (let i = 0; i < winners.length; i++) {
      const position = i + 1;
      const prize = prizeDistribution[position];
      
      if (!prize) continue;

      try {
        const winner = winners[i];
        
        // Update user with prize points
        await this.db.updateUser(winner.telegram_id, {
          pp: winner.pp + prize.pp
        });

        awardedWinners.push({
          ...winner,
          prizePosition: position,
          prizePoints: prize.pp,
          dataAmount: prize.dataAmount
        });

        logger.info(`🏆 Prize #${position}: ${winner.full_name} +${prize.pp} Prize Points (+${prize.dataAmount}MB)`);
      } catch (error) {
        logger.error(`Failed to award prize to ${winners[i].full_name}:`, error);
      }
    }

    return awardedWinners;
  }

  /**
   * Announce winners in Telegram
   */
  async announceWinners(winners, roundType) {
    try {
      const roundName = roundType === 'MORNING' ? '🌅 Morning' : '🌆 Evening';
      let announcement = `🎊 *${roundName} Prize Round Results!*\n\n`;
      announcement += `🏆 *Top Winners:*\n\n`;

      winners.slice(0, 5).forEach((winner, idx) => {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const medal = medals[idx] || '⭐';
        announcement += `${medal} *#${winner.prizePosition}:* ${winner.full_name}\n`;
        announcement += `   💎 +${winner.prizePoints} Prize Points\n`;
        announcement += `   📱 +${winner.dataAmount}MB Data\n\n`;
      });

      announcement += `\n🎯 Keep playing to win the next round!\n`;
      announcement += `⏰ Next ${roundType === 'MORNING' ? 'Evening' : 'Morning'} Round coming soon!\n\n`;
      announcement += `*Powered by G-NEX 🇬🇭*`;

      // Send to announcement channel (replace with actual channel ID)
      // For now, just log it
      logger.info('📢 Prize Round Announcement:\n' + announcement);
      
      return true;
    } catch (error) {
      logger.error('Error announcing winners:', error);
      return false;
    }
  }

  /**
   * Get round statistics
   */
  async getRoundStats(roundType) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_players,
          AVG(ap) as avg_ap,
          MAX(ap) as max_ap,
          COUNT(DISTINCT prize_round_wins) as winners_count
        FROM users
        WHERE is_banned = 0
      `;

      const result = await this.db.executeQuery(query);
      return result[0] || {};
    } catch (error) {
      logger.error('Error getting round stats:', error);
      return {};
    }
  }
}
