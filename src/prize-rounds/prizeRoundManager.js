/**
 * G-NEX Prize Round Manager
 * Handles scheduled prize draws and winner announcements
 */

import { logger } from '../utils/logger.js';
import { sendMessage } from '../utils/telegram.js';

export class PrizeRoundManager {
  constructor(database, botToken) {
    this.db = database;
    this.botToken = botToken;
  }

  /**
   * Backward-compatible manual trigger.
   * Releases morning round results.
   */
  async runMorningRound() {
    return this.releaseRoundResults('MORNING');
  }

  /**
   * Backward-compatible manual trigger.
   * Releases evening round results.
   */
  async runEveningRound() {
    return this.releaseRoundResults('EVENING');
  }

  async startRound(roundType) {
    try {
      const roundName = roundType === 'MORNING' ? '🌅 Morning' : '🌆 Evening';
      const message = `🚀 *${roundName} Prize Round Started!*\n\n` +
        `⏱️ Round Duration: 2 hours\n` +
        `🏁 Round End: ${roundType === 'MORNING' ? '11:00 UTC' : '23:00 UTC'}\n` +
        `📢 Results Release: ${roundType === 'MORNING' ? '12:00 UTC' : '00:00 UTC'}\n\n` +
        `🏆 Top 3 users will be announced.\n` +
        `⚖️ No extra bonus points are added to keep competition fair.\n\n` +
        `Play now and climb!`;

      await this.broadcastMessage(message);
      logger.info(`✅ ${roundType} prize round start announced`);
      return { success: true, phase: 'START', roundType, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error(`❌ ${roundType} prize round start failed:`, error);
      return { success: false, error: error.message };
    }
  }

  async endRound(roundType) {
    try {
      const roundName = roundType === 'MORNING' ? '🌅 Morning' : '🌆 Evening';
      const message = `⏹️ *${roundName} Prize Round Ended!*\n\n` +
        `Thanks for participating.\n` +
        `📊 Results will be released at ${roundType === 'MORNING' ? '12:00 UTC' : '00:00 UTC'} with Top 3.`;

      await this.broadcastMessage(message);
      logger.info(`✅ ${roundType} prize round end announced`);
      return { success: true, phase: 'END', roundType, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error(`❌ ${roundType} prize round end failed:`, error);
      return { success: false, error: error.message };
    }
  }

  async releaseRoundResults(roundType, releaseTime = new Date()) {
    try {
      const window = this.getRoundWindow(roundType, releaseTime);
      const winners = await this.selectWinnersForWindow(window.startIso, window.endIso, 3);

      if (!winners.length) {
        await this.announceNoWinners(roundType, window);
        return {
          success: true,
          winnersCount: 0,
          phase: 'RESULTS',
          roundType,
          window
        };
      }

      const roundName = roundType === 'MORNING' ? '🌅 Morning' : '🌆 Evening';
      let announcement = `🎊 *${roundName} Prize Round Results!*\n\n`;
      announcement += `🏆 *Top 3 Winners:*\n\n`;

      winners.forEach((winner, idx) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = medals[idx] || `${idx + 1}.`;
        announcement += `${medal} *${winner.display_name}*\n`;
        announcement += `   ⭐ Round Score: ${winner.round_points}\n`;
        announcement += `   ✅ Correct: ${winner.correct_answers} / ${winner.attempts}\n\n`;
      });

      announcement += `⚖️ No extra points were awarded for winning this round.\n`;
      announcement += `This keeps leaderboard gaps fair for everyone.\n\n`;
      announcement += `⏰ Next ${roundType === 'MORNING' ? 'Evening' : 'Morning'} Prize Round starts at ${roundType === 'MORNING' ? '21:00 UTC' : '09:00 UTC'}.`;

      await this.broadcastMessage(announcement);

      logger.info(`📢 ${roundType} results released with ${winners.length} winners`);
      return {
        success: true,
        winnersCount: winners.length,
        phase: 'RESULTS',
        roundType,
        window,
        winners
      };
    } catch (error) {
      logger.error(`Error releasing ${roundType} round results:`, error);
      return { success: false, error: error.message };
    }
  }

  getRoundWindow(roundType, releaseTime = new Date()) {
    const at = new Date(releaseTime);
    let baseDate = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));

    if (roundType === 'EVENING' && at.getUTCHours() === 0) {
      baseDate = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
    }

    const y = baseDate.getUTCFullYear();
    const m = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(baseDate.getUTCDate()).padStart(2, '0');
    const day = `${y}-${m}-${d}`;

    if (roundType === 'MORNING') {
      return {
        startIso: `${day}T09:00:00.000Z`,
        endIso: `${day}T11:00:00.000Z`,
        label: `${day} 09:00-11:00 UTC`
      };
    }

    return {
      startIso: `${day}T21:00:00.000Z`,
      endIso: `${day}T23:00:00.000Z`,
      label: `${day} 21:00-23:00 UTC`
    };
  }

  async selectWinnersForWindow(startIso, endIso, limit = 3) {
    try {
      const query = `
        SELECT
          u.telegram_id,
          COALESCE(NULLIF(u.full_name, ''), NULLIF(u.username, ''), 'Player ' || u.telegram_id) AS display_name,
          SUM(CASE WHEN ua.is_correct = 1 THEN ua.points_earned ELSE 0 END) AS round_points,
          SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers,
          COUNT(ua.id) AS attempts
        FROM users u
        INNER JOIN user_attempts ua ON u.telegram_id = ua.telegram_id
        WHERE u.is_banned = 0
          AND ua.attempted_at >= ?
          AND ua.attempted_at < ?
        GROUP BY u.telegram_id, u.full_name, u.username
        HAVING round_points > 0
        ORDER BY round_points DESC, correct_answers DESC, attempts ASC
        LIMIT ?
      `;

      const rows = await this.db.executeQuery(query, [startIso, endIso, limit]);
      return rows || [];
    } catch (error) {
      logger.error('Error selecting winners for window:', error);
      return [];
    }
  }

  async announceNoWinners(roundType, window = null) {
    try {
      const roundName = roundType === 'MORNING' ? '🌅 Morning' : '🌆 Evening';
      const message = `🎊 *${roundName} Prize Round Results*\n\n` +
        `No eligible winners for this round window${window?.label ? ` (${window.label})` : ''}.\n\n` +
        `🏆 Only Top 3 are recognized when there are qualifying scores.\n` +
        `⚖️ No extra points are awarded for winning.\n\n` +
        `⏰ Next round starts at ${roundType === 'MORNING' ? '21:00 UTC' : '09:00 UTC'}.`;

      await this.broadcastMessage(message);
      logger.info(`📢 No-winner ${roundType} results update sent`);
      return true;
    } catch (error) {
      logger.error('Error announcing no-winner prize round update:', error);
      return false;
    }
  }

  async broadcastMessage(message) {
    const users = await this.db.getUsersForNotifications();
    let sentCount = 0;
    let failedCount = 0;

    for (const user of users) {
      try {
        const result = await sendMessage(this.botToken, user.telegram_id, message);
        if (result?.ok) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
        logger.warn(`Failed broadcast to ${user.telegram_id}:`, error);
      }
    }

    logger.info(`📢 Broadcast complete: ${sentCount} sent, ${failedCount} failed`);
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
