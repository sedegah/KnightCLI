/**
 * Telegram Update Handler
 * Routes and processes all Telegram updates
 */

import { Database } from '../database/client.js';
import { QuestionManager } from '../game/questionManager.js';
import { logger } from '../utils/logger.js';
import { sendMessage, sendMessageWithKeyboard } from '../utils/telegram.js';
import { createMainMenuKeyboard, createQuestionKeyboard } from './keyboards.js';
import { MESSAGES } from '../config/constants.js';

export async function handleTelegramUpdate(update, env) {
  const db = new Database(env.DB, env.KV);
  const questionManager = new QuestionManager(db);

  try {
    if (update.message) {
      await handleMessage(update.message, db, questionManager, env);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, db, questionManager, env);
    }
  } catch (error) {
    logger.error('Error handling update:', error);
  }
}

/**
 * Handle incoming messages
 */
async function handleMessage(message, db, questionManager, env) {
  const telegramId = message.from.id;
  const text = message.text;

  // Handle commands
  if (text.startsWith('/start')) {
    await handleStartCommand(message, db, env);
  } else if (text === '/play') {
    await handlePlayCommand(message, db, questionManager, env);
  } else if (text === '/stats') {
    await handleStatsCommand(message, db, env);
  } else if (text === '/leaderboard') {
    await handleLeaderboardCommand(message, db, env);
  } else if (text === '/help') {
    await handleHelpCommand(message, env);
  }
}

/**
 * Handle callback queries (button clicks)
 */
async function handleCallbackQuery(query, db, questionManager, env) {
  const telegramId = query.from.id;
  const data = query.callback_data;

  // Acknowledge the callback
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: query.id })
  });

  // Parse callback data
  if (data === 'play') {
    await handlePlayCallback(query.message, db, questionManager, env);
  } else if (data === 'stats') {
    await handleStatsCallback(query.message, db, env);
  } else if (data === 'leaderboard') {
    await handleLeaderboardCallback(query.message, db, env);
  } else if (data.startsWith('answer_')) {
    await handleAnswerCallback(query, data, db, questionManager, env);
  }
}

/**
 * /start command handler
 */
async function handleStartCommand(message, db, env) {
  const telegramId = message.from.id;
  const username = message.from.username || `user_${telegramId}`;
  const fullName = message.from.first_name + (message.from.last_name ? ` ${message.from.last_name}` : '');

  // Check if user exists
  let user = await db.getUser(telegramId);

  if (user) {
    // Existing user
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `Welcome back, ${user.fullName}! 👋\n\n` +
      `Your Points: ${user.ap} AP | ${user.pp} PP\n` +
      `Streak: ${user.streak} days 🔥\n\n` +
      `Ready to play?`,
      createMainMenuKeyboard()
    );
  } else {
    // Parse referral code from /start command
    const parts = message.text.split(' ');
    const referralCode = parts.length > 1 ? parts[1] : '';

    // Create new user
    user = await db.createUser({
      telegramId,
      username,
      fullName,
      referredBy: referralCode
    });

    if (!user) {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        '⚠️ Error creating account. Please try again.'
      );
      return;
    }

    // Send welcome message
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      MESSAGES.welcome,
      createMainMenuKeyboard()
    );

    logger.info(`New user registered: ${telegramId} (${username})`);
  }
}

/**
 * /play command handler
 */
async function handlePlayCommand(message, db, questionManager, env) {
  const telegramId = message.from.id;
  const user = await db.getUser(telegramId);

  if (!user) {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      'Please use /start to register first!'
    );
    return;
  }

  // Get question
  const { question, error } = await questionManager.getQuestionForUser(user, false);

  if (error) {
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      error,
      createMainMenuKeyboard()
    );
    return;
  }

  // Send question
  const questionText = questionManager.formatQuestionText(question, user.totalQuestions + 1);
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    questionText,
    createQuestionKeyboard(question.questionId)
  );
}

/**
 * Play button callback handler
 */
async function handlePlayCallback(message, db, questionManager, env) {
  const telegramId = message.chat.id;
  const user = await db.getUser(telegramId);

  if (!user) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, 'Please use /start first!');
    return;
  }

  const { question, error } = await questionManager.getQuestionForUser(user, false);

  if (error) {
    await sendMessageWithKeyboard(env.TELEGRAM_BOT_TOKEN, message.chat.id, error, createMainMenuKeyboard());
    return;
  }

  const questionText = questionManager.formatQuestionText(question, user.totalQuestions + 1);
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    questionText,
    createQuestionKeyboard(question.questionId)
  );
}

/**
 * Answer callback handler
 */
async function handleAnswerCallback(query, data, db, questionManager, env) {
  const telegramId = query.from.id;
  const user = await db.getUser(telegramId);

  if (!user) {
    return;
  }

  // Parse answer: "answer_<questionId>_<option>"
  const parts = data.split('_');
  const questionId = parts[1];
  const selectedOption = parts[2];

  // Process answer
  const result = await questionManager.processAnswer(user, questionId, selectedOption, false);

  if (!result.success) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, query.message.chat.id, result.error);
    return;
  }

  // Build response message
  let responseText = '';

  if (result.isCorrect) {
    const pointType = 'AP';
    const breakdown = questionManager.formatBreakdown || 
                     `Base: +${result.breakdown.base} ${pointType}\n` +
                     `${result.breakdown.speedBonus > 0 ? `⚡ Speed: +${result.breakdown.speedBonus}\n` : ''}` +
                     `${result.breakdown.streakBonus > 0 ? `🔥 Streak: +${result.breakdown.streakBonus}\n` : ''}` +
                     `\n**Total: +${result.breakdown.total} ${pointType}**`;

    responseText = `✅ **Correct!**\n\n${breakdown}`;
  } else {
    responseText = `❌ **Incorrect**\n\nThe correct answer was: **${result.correctOption}**\n\nDon't give up! Keep playing! 💪`;
  }

  if (result.streakBroken) {
    responseText += `\n\n💔 Your ${result.user.streak - 1}-day streak has ended. Start a new one!`;
  }

  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    query.message.chat.id,
    responseText,
    createMainMenuKeyboard()
  );
}

/**
 * /stats command handler
 */
async function handleStatsCommand(message, db, env) {
  const telegramId = message.from.id;
  const user = await db.getUser(telegramId);

  if (!user) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, 'Please use /start first!');
    return;
  }

  const rank = await db.getUserRank(telegramId);
  const accuracy = user.totalQuestions > 0 
    ? ((user.correctAnswers / user.totalQuestions) * 100).toFixed(1) 
    : 0;
  const userType = user.subscriptionStatus === 'subscriber' ? '💎 Premium' : 'Free';

  const statsText = MESSAGES.stats
    .replace('{ap}', user.ap.toLocaleString())
    .replace('{totalAp}', user.totalAp.toLocaleString())
    .replace('{pp}', user.pp.toLocaleString())
    .replace('{weeklyPoints}', user.weeklyPoints.toLocaleString())
    .replace('{streak}', user.streak)
    .replace('{totalQuestions}', user.totalQuestions)
    .replace('{accuracy}', accuracy)
    .replace('{rank}', rank)
    .replace('{userType}', userType);

  await sendMessageWithKeyboard(env.TELEGRAM_BOT_TOKEN, message.chat.id, statsText, createMainMenuKeyboard());
}

async function handleStatsCallback(message, db, env) {
  await handleStatsCommand({ from: { id: message.chat.id }, chat: message.chat }, db, env);
}

/**
 * /leaderboard command handler
 */
async function handleLeaderboardCommand(message, db, env) {
  const topUsers = await db.getTopUsers(10);

  if (topUsers.length === 0) {
    await sendMessage(env.TELEGRAM_BOT_TOKEN, message.chat.id, 'No leaderboard data yet!');
    return;
  }

  let leaderboardText = '🏆 **Weekly Leaderboard**\n\n';

  topUsers.forEach((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    leaderboardText += `${medal} **${user.full_name}** - ${user.weekly_points.toLocaleString()} pts\n`;
  });

  await sendMessageWithKeyboard(env.TELEGRAM_BOT_TOKEN, message.chat.id, leaderboardText, createMainMenuKeyboard());
}

async function handleLeaderboardCallback(message, db, env) {
  await handleLeaderboardCommand({ from: { id: message.chat.id }, chat: message.chat }, db, env);
}

/**
 * /help command handler
 */
async function handleHelpCommand(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    MESSAGES.help,
    createMainMenuKeyboard()
  );
}
