/**
 * Telegram Update Handler
 * Routes and processes all Telegram updates
 */

import { D1Database } from '../database/d1-client.js';
import { QuestionManager } from '../game/questionManager.js';
import { ArenaManager } from '../game/arena.js';
import { RankingSystem } from '../game/ranking.js';
import { StreakManager } from '../game/streaks.js';
import { EconomyManager } from '../game/economy.js';
import { GhanaQuestionManager } from '../game/ghanaQuestions.js';
import { DataRewardManager } from '../game/dataRewards.js';
import { ViralGrowthManager } from '../growth/viral.js';
import { logger } from '../utils/logger.js';
import { sendMessage, sendMessageWithKeyboard, editMessageText } from '../utils/telegram.js';
import { createMainMenuKeyboard, createQuestionKeyboard } from './keyboards.js';
import { MESSAGES } from '../config/constants.js';

export async function handleTelegramUpdate(update, env) {
  const db = new D1Database(env);
  const questionManager = new QuestionManager(db);
  
  // Initialize all game systems with the same database instance
  const arenaManager = new ArenaManager(db);
  const rankingSystem = new RankingSystem(db);
  const streakManager = new StreakManager(db);
  const economyManager = new EconomyManager(db);
  const ghanaQuestions = new GhanaQuestionManager(db);
  const dataRewardManager = new DataRewardManager(db);
  const viralGrowth = new ViralGrowthManager(db);

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
 * Handle conversation flow when user is in a specific state
 */
async function handleConversationFlow(message, db, userState, env) {
  const telegramId = message.from.id;
  const text = message.text || '';
  
  switch (userState.state) {
    case '1v1_waiting_opponent':
      await handleChallenge1v1Input(message, db, text, env);
      break;
      
    case 'partnership_waiting_partner':
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        '🚧 Partnership feature is coming soon! Type /cancel to go back.'
      );
      break;
      
    case 'squad_waiting_name':
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        '🚧 Squad feature is coming soon! Type /cancel to go back.'
      );
      break;
      
    default:
      await db.clearUserState(telegramId);
      await handleUnknownMessage(message, db, env);
  }
}

/**
 * Handle 1v1 challenge opponent input
 */
async function handleChallenge1v1Input(message, db, opponentInput, env) {
  const challengerId = message.from.id;
  
  try {
    // Find the opponent
    const opponent = await db.getUserByUsernameOrId(opponentInput);
    
    if (!opponent) {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        '❌ Player not found. Please check the username or ID and try again.\n\nOr type /cancel to go back.'
      );
      return;
    }
    
    // Can't challenge yourself
    if (opponent.telegram_id === challengerId) {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        '❌ You can\'t challenge yourself! Please enter a different player.\n\nOr type /cancel to go back.'
      );
      return;
    }
    
    // Create challenge in database
    const challengeId = crypto.randomUUID();
    await db.executeQuery(
      `INSERT INTO challenges (id, challenger_id, opponent_id, status, questions_per_round, time_limit, created_at, expires_at)
       VALUES (?, ?, ?, 'pending', 5, 30, CURRENT_TIMESTAMP, datetime('now', '+24 hours'))`,
      [challengeId, challengerId, opponent.telegram_id]
    );
    
    // Clear user state
    await db.clearUserState(challengerId);
    
    // Notify challenger
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `✅ Challenge sent to ${opponent.full_name || opponent.username}!\n\n⏳ Waiting for them to accept...\n\nYou'll be notified when they respond.`,
      createMainMenuKeyboard()
    );
    
    // Notify opponent
    const challenger = await db.getUser(challengerId);
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      opponent.telegram_id,
      `🎮 **New 1v1 Challenge!**\n\n${challenger.full_name || challenger.username} has challenged you to a 5-question battle!\n\n⚡ Accept the challenge?`,
      {
        inline_keyboard: [
          [
            { text: '✅ Accept', callback_data: `accept_challenge_${challengeId}` },
            { text: '❌ Decline', callback_data: `decline_challenge_${challengeId}` }
          ]
        ]
      }
    );
    
  } catch (error) {
    logger.error('Error handling 1v1 challenge input:', error);
    await db.clearUserState(challengerId);
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ Something went wrong. Please try again later.',
      createMainMenuKeyboard()
    );
  }
}

/**
 * Handle incoming messages
 */
async function handleMessage(message, db, questionManager, env) {
  const telegramId = message.from.id;
  const text = message.text || '';

  // Check if user is in a conversation flow
  const userState = await db.getUserState(telegramId);
  if (userState && text !== '/cancel') {
    await handleConversationFlow(message, db, userState, env);
    return;
  }

  // Handle cancel command
  if (text === '/cancel') {
    await db.clearUserState(telegramId);
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ Operation cancelled.',
      createMainMenuKeyboard()
    );
    return;
  }

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
  } else if (text === '/invite') {
    await handleInviteCommand(message, env);
  } else if (text === '/subscribe') {
    await handleSubscribeCommand(message, env);
  } else if (text === '/arena') {
    await handleArenaCommand(message, env);
  } else if (text === '/rewards') {
    await handleRewardsCommand(message, env);
  } else if (text === '/streak') {
    await handleStreakCommand(message, db, env);
  } else if (text === '/referral') {
    await handleReferralCommand(message, db, env);
  } else if (text === '/challenge') {
    await handleChallengeCommand(message, db, env);
  } else if (text === '/partner') {
    await handlePartnerCommand(message, env);
  } else if (text === '/squad') {
    await handleSquadCommand(message, env);
  } else if (text === '/wallet') {
    await handleWalletCommand(message, db, env);
  } else if (text === '/share') {
    await handleShareCommand(message, db, env);
  } else if (text === '▶️ Play Quiz') {
    await handlePlayCommand(message, db, questionManager, env);
  } else if (text === '👤 My Stats') {
    await handleStatsCommand(message, db, env);
  } else if (text === '🏆 Leaderboard') {
    await handleLeaderboardCommand(message, db, env);
  } else if (text === '🤝 Invite Friends') {
    await handleInviteCommand(message, env);
  } else if (text === '💎 Go Premium') {
    await handleSubscribeCommand(message, env);
  } else {
    // Handle unknown messages with main menu
    await handleUnknownMessage(message, db, env);
  }
}

/**
 * Handle callback queries (button clicks)
 */
async function handleCallbackQuery(query, db, questionManager, env) {
  const telegramId = query.from.id;
  const data = query.data || query.callback_data || '';

  // Log callback for debugging
  console.log('Callback received:', { telegramId, data, queryId: query.id });

  try {
    // Acknowledge the callback
    const ackResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: query.id })
    });

    if (!ackResponse.ok) {
      console.error('Failed to acknowledge callback:', await ackResponse.text());
    }

    // Create a message-like object from the callback query
    const callbackChatId = query.message?.chat?.id || query.from?.id;
    const callbackMessageId = query.message?.message_id;
    const callbackMessage = {
      chat: { id: callbackChatId },
      from: query.from,
      message_id: callbackMessageId
    };

    console.log('Routing callback:', data);

    // Route callback to appropriate handler
    if (data === 'play_continuous') {
      await handlePlayCallback(callbackMessage, db, questionManager, env);
    } else if (data === 'show_stats') {
      await handleStatsCallback(callbackMessage, db, env);
    } else if (data === 'show_leaderboard') {
      await handleLeaderboardCallback(callbackMessage, db, env);
    } else if (data.startsWith('answer_') || ['A', 'B', 'C', 'D'].includes(data)) {
      await handleAnswerCallback(query, data, db, questionManager, env);
    } else if (data === 'arena_1v1') {
      await handleArena1v1Callback(callbackMessage, env);
    } else if (data === 'arena_partner') {
      await handleArenaPartnerCallback(callbackMessage, env);
    } else if (data === 'arena_squad') {
      await handleArenaSquadCallback(callbackMessage, env);
    } else if (data === 'arena_rankings') {
      await handleArenaRankingsCallback(callbackMessage, env);
    } else if (data === 'main_menu') {
      await handleMainMenuCallback(callbackMessage, env);
    } else if (data === 'individual_rankings') {
      await handleIndividualRankingsCallback(callbackMessage, db, env);
    } else if (data === 'squad_rankings') {
      await handleSquadRankingsCallback(callbackMessage, db, env);
    } else if (data === 'partner_rankings') {
      await handlePartnerRankingsCallback(callbackMessage, db, env);
    } else if (data === 'streak_rankings') {
      await handleStreakRankingsCallback(callbackMessage, db, env);
    } else if (data === 'battle_rankings') {
      await handleBattleRankingsCallback(callbackMessage, db, env);
    } else if (data === 'help') {
      await handleHelpCallback(callbackMessage, env);
    } else if (data === 'subscribe') {
      await handleSubscribeCallback(callbackMessage, env);
    } else if (data === 'wallet') {
      await handleWalletCallback(callbackMessage, db, env);
    } else if (data === 'rewards') {
      await handleRewardsCallback(callbackMessage, env);
    } else if (data === 'streak') {
      await handleStreakCallback(callbackMessage, db, env);
    } else if (data === 'referral') {
      await handleReferralCallback(callbackMessage, db, env);
    } else if (data === 'arena') {
      await handleArenaCallback(callbackMessage, env);
    } else if (data === 'start_1v1') {
      await handleStart1v1Callback(callbackMessage, db, env);
    } else if (data.startsWith('accept_challenge_')) {
      const challengeId = data.replace('accept_challenge_', '');
      await handleAcceptChallengeCallback(callbackMessage, db, challengeId, env);
    } else if (data.startsWith('decline_challenge_')) {
      const challengeId = data.replace('decline_challenge_', '');
      await handleDeclineChallengeCallback(callbackMessage, db, challengeId, env);
    } else if (data === 'view_rankings') {
      await handleViewRankingsCallback(callbackMessage, db, env);
    } else if (data === 'find_partner') {
      await handleFindPartnerCallback(callbackMessage, env);
    } else if (data === 'create_partnership') {
      await handleCreatePartnershipCallback(callbackMessage, env);
    } else if (data === 'find_squad') {
      await handleFindSquadCallback(callbackMessage, env);
    } else if (data === 'create_squad') {
      await handleCreateSquadCallback(callbackMessage, env);
    } else {
      // Handle unknown callback data
      console.warn('Unknown callback data:', data);
      await sendMessage(env.TELEGRAM_BOT_TOKEN, callbackMessage.chat.id, '❌ Unknown button action');
    }
  } catch (error) {
    console.error('Error handling callback:', error);
    console.error('Callback payload:', {
      data,
      hasMessage: !!query.message,
      chatId: query.message?.chat?.id,
      messageId: query.message?.message_id
    });
    const chatId = query.message?.chat?.id || query.from?.id;
    if (chatId) {
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, '❌ Error processing button');
    }
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
    console.log('Existing user found:', { telegramId, fullName: user.full_name });
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `Welcome back, ${user.full_name}! 👋\n\n` +
      `Your Points: ${user.ap || 0} AP | ${user.pp || 0} PP\n` +
      `Streak: ${user.streak || 0} days 🔥\n\n` +
      `Ready to crush some questions?\n\n*I-Crush by G-NEX*`,
      createMainMenuKeyboard()
    );
  } else {
    // Parse referral code from /start command
    const parts = message.text.split(' ');
    const referralCode = parts.length > 1 ? parts[1] : '';

    console.log('Creating new user:', { telegramId, username, fullName });

    // Create new user
    user = await db.createUser({
      telegramId,
      username,
      full_name: fullName,
      referredBy: referralCode
    });

    if (!user) {
      console.error('Failed to create user:', { telegramId });
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        '⚠️ Error creating account. Please try again.'
      );
      return;
    }

    console.log('User created successfully:', { telegramId, fullName: user.full_name });

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
  const questionText = questionManager.formatQuestionText(question, (user.total_questions || 0) + 1);
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    questionText,
    createQuestionKeyboard(question.id, question)
  );
}

/**
 * Play button callback handler
 */
async function handlePlayCallback(query, db, questionManager, env) {
  const telegramId = query.from.id;
  const user = await db.getUser(telegramId);

  if (!user) {
    await editMessageText(
      env.TELEGRAM_BOT_TOKEN,
      query.chat.id,
      query.message_id,
      'Please use /start first!'
    );
    return;
  }

  const { question, error } = await questionManager.getQuestionForUser(user, false);

  if (error) {
    await editMessageText(
      env.TELEGRAM_BOT_TOKEN,
      query.chat.id,
      query.message_id,
      error,
      createMainMenuKeyboard()
    );
    return;
  }

  const questionText = questionManager.formatQuestionText(question, (user.total_questions || 0) + 1);
  await editMessageText(
    env.TELEGRAM_BOT_TOKEN,
    query.chat.id,
    query.message_id,
    questionText,
    createQuestionKeyboard(question.id, question)
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

  const parsed = parseAnswerData(data);
  if (!parsed) {
    console.error('Invalid answer format:', data);
    return;
  }

  const selectedOption = parsed.selectedOption;
  let questionId = parsed.questionId;

  if (!questionId) {
    const activeData = await db.getActiveQuestion(user.telegram_id);
    if (!activeData || !activeData.question || !activeData.question.id) {
      const chatId = query.message?.chat?.id || query.chat?.id || query.from?.id;
      const messageId = query.message?.message_id || query.message_id;
      if (chatId && messageId) {
        await editMessageText(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          messageId,
          'No active question found. Please tap ▶️ Play Quiz again.'
        );
      }
      return;
    }
    questionId = activeData.question.id;
  }

  // Process answer
  const result = await questionManager.processAnswer(user, questionId, selectedOption, false);

  if (!result.success) {
    const chatId = query.message?.chat?.id || query.chat?.id || query.from?.id;
    const messageId = query.message?.message_id || query.message_id;
    if (!chatId || !messageId) {
      return;
    }
    await editMessageText(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      messageId,
      result.error
    );
    return;
  }

  // Build response message
  let responseText = '';

  if (result.isCorrect) {
    const pointType = 'Arena Points';
    const breakdownData = result.points?.breakdown;
    const breakdown = breakdownData && typeof questionManager.formatBreakdown === 'function'
      ? questionManager.formatBreakdown(breakdownData, pointType)
      : breakdownData
        ? `Base: +${breakdownData.base} ${pointType}\n` +
          `${breakdownData.speedBonus > 0 ? `⚡ Speed: +${breakdownData.speedBonus}\n` : ''}` +
          `${breakdownData.streakBonus > 0 ? `🔥 Streak: +${breakdownData.streakBonus}\n` : ''}` +
          `\n**Total: +${breakdownData.total} ${pointType}**`
        : `**Total: +${result.points?.total || 0} ${pointType}**`;

    responseText = `✅ **Correct!**\n\n${breakdown}`;
  } else {
    responseText = `❌ **Incorrect**\n\nThe correct answer was: **${result.correctOption}**\n\nDon't give up! Keep playing! 💪`;
  }

  if (result.streakBroken) {
    responseText += `\n\n💔 Your ${result.user.streak - 1}-day streak has ended. Start a new one!`;
  }

  await editMessageText(
    env.TELEGRAM_BOT_TOKEN,
    query.message?.chat?.id || query.chat?.id || query.from?.id,
    query.message?.message_id || query.message_id,
    responseText
  );

  const menuChatId = query.message?.chat?.id || query.chat?.id || query.from?.id;
  if (menuChatId) {
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      menuChatId,
      'Choose your next action:',
      createMainMenuKeyboard()
    );
  }
}

function parseAnswerData(data) {
  if (['A', 'B', 'C', 'D'].includes(data)) {
    return { selectedOption: data, questionId: null };
  }

  if (!data.startsWith('answer_')) {
    return null;
  }

  const parts = data.split('_');
  if (parts.length < 2) {
    return null;
  }

  const selectedOption = parts[1];
  const questionId = parts.length >= 3 ? parts.slice(2).join('_') : null;
  return { selectedOption, questionId };
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
  const totalQuestions = user.total_questions || 0;
  const correctAnswers = user.correct_answers || 0;
  const accuracy = totalQuestions > 0 
    ? ((correctAnswers / totalQuestions) * 100).toFixed(1) 
    : 0;
  const userType = user.subscription_status === 'subscriber' ? '💎 Premium' : 'Free';

  const statsText = MESSAGES.stats_template
    .replace('{ap}', (user.ap || 0).toLocaleString())
    .replace('{totalAp}', (user.total_ap || 0).toLocaleString())
    .replace('{pp}', (user.pp || 0).toLocaleString())
    .replace('{weeklyPoints}', (user.weekly_points || 0).toLocaleString())
    .replace('{streak}', user.streak || 0)
    .replace('{totalQuestions}', totalQuestions)
    .replace('{correctAnswers}', correctAnswers)
    .replace('{accuracy}', accuracy)
    .replace('{userType}', userType)
    .replace('{rank}', rank);

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
    leaderboardText += `${medal} **${user.full_name}** - ${(user.weekly_points || 0).toLocaleString()} pts\n`;
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

/**
 * Handle unknown messages
 */
async function handleUnknownMessage(message, db, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    "I didn't understand that. Please use the menu buttons or /help for commands.",
    createMainMenuKeyboard()
  );
}

// ==========================================
// G-NEX FEATURE COMMAND HANDLERS
// ==========================================

async function handleArenaCommand(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🏟️ **G-NEX Arena**\n\nChoose your battle mode:',
    {
      inline_keyboard: [
        [
          { text: '⚔️ 1v1 Challenge', callback_data: 'arena_1v1' },
          { text: '🤝 Find Partner', callback_data: 'arena_partner' }
        ],
        [
          { text: '👥 Join Squad', callback_data: 'arena_squad' },
          { text: '🏆 View Rankings', callback_data: 'arena_rankings' }
        ]
      ]
    }
  );
}

async function handleChallengeCommand(message, db, env) {
  // Redirect to arena 1v1 interface
  await handleArena1v1Callback(message, env);
}

async function handlePartnerCommand(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🤝 **Partner Mode**\n\nTeam up with a friend and answer questions together!\n\nBenefits:\n• Shared points\n• Combined streaks\n• Special partner rewards\n\nUse /arena to find or create a partnership!'
  );
}

async function handleSquadCommand(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '👥 **Squad Mode**\n\nJoin or create a squad (3-10 players)!\n\nFeatures:\n• Weekly squad leaderboard\n• Shared data rewards\n• Squad boosts and bonuses\n\nUse /arena to manage your squad!'
  );
}

async function handleRewardsCommand(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🎁 **Data Rewards**\n\nWin free mobile data by playing!\n\nWeekly Rewards:\n• Top 10 players: 200MB-1GB\n• Top 3 squads: 1-2GB shared\n• Streak draws: 5 winners\n\nCompatible with MTN, Vodafone, AirtelTigo, GLO'
  );
}

async function handleWalletCommand(message, db, env) {
  // Reuse the callback handler which already has the full implementation
  await handleWalletCallback(message, db, env);
}

async function handleStreakCommand(message, db, env) {
  // Reuse the callback handler which already has the full implementation
  await handleStreakCallback(message, db, env);
}

async function handleReferralCommand(message, db, env) {
  // Reuse the callback handler which already has the full implementation
  await handleReferralCallback(message, db, env);
}

async function handleShareCommand(message, db, env) {
  // Reuse referral callback for sharing referral link
  await handleReferralCallback(message, db, env);
}

async function handleInviteCommand(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '📨 **Invite System**\n\nCreate invites for:\n• Squad members\n• Quiz partners\n• Viral challenges\n\nGrow your team and dominate the leaderboards!'
  );
}

// ==========================================
// ARENA CALLBACK HANDLERS
// ==========================================

async function handleArena1v1Callback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '⚔️ **1v1 Challenge Mode**\n\nChallenge another player to a 5-question battle!\n\n**How it works:**\n• Send a challenge to a player\n• Answer 5 questions simultaneously\n• Winner gets bonus points and rank boost\n• Battle win badge added to profile\n\nReady to battle? Use /challenge to start!',
    {
      inline_keyboard: [
        [
          { text: '🎮 Start Challenge', callback_data: 'start_1v1' },
          { text: '📊 View Rankings', callback_data: 'view_rankings' }
        ],
        [
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleArenaPartnerCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🤝 **Partner Mode**\n\nTeam up with a friend for collaborative quiz solving!\n\n**Benefits:**\n• Shared points for correct answers\n• Combined streak building\n• Special partner-only rewards\n• Accountability - no one wants to disappoint their partner!\n\n**How to play:**\n• Find a partner or create a partnership\n• Answer questions together\n• Compete against other pairs\n\nUse /partner to find or create a partnership!',
    {
      inline_keyboard: [
        [
          { text: '🔍 Find Partner', callback_data: 'find_partner' },
          { text: '👥 Create Partnership', callback_data: 'create_partnership' }
        ],
        [
          { text: '📈 Partner Rankings', callback_data: 'partner_rankings' },
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleArenaSquadCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '👥 **Squad Mode**\n\nJoin or create a squad (3-10 players) for team competition!\n\n**Features:**\n• Weekly squad leaderboard\n• Combined team score\n• Shared data rewards for top squads\n• Squad chat integration for strategy\n• Squad boosts and bonuses\n\n**How it works:**\n• Join an existing squad or create your own\n• Compete for weekly squad rankings\n• Top squads share data rewards\n• Recruit friends to grow your squad\n\nUse /squad to manage your squad!',
    {
      inline_keyboard: [
        [
          { text: '🔍 Find Squad', callback_data: 'find_squad' },
          { text: '👥 Create Squad', callback_data: 'create_squad' }
        ],
        [
          { text: '🏆 Squad Rankings', callback_data: 'squad_rankings' },
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleArenaRankingsCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🏆 **G-NEX Rankings**\n\nChoose a ranking category:',
    {
      inline_keyboard: [
        [
          { text: '👤 Individual Rankings', callback_data: 'individual_rankings' },
          { text: '⚔️ Battle Rankings', callback_data: 'battle_rankings' }
        ],
        [
          { text: '👥 Squad Rankings', callback_data: 'squad_rankings' },
          { text: '🤝 Partner Rankings', callback_data: 'partner_rankings' }
        ],
        [
          { text: '🔥 Streak Rankings', callback_data: 'streak_rankings' }
        ],
        [
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleStart1v1Callback(message, db, env) {
  const telegramId = message.from.id;
  
  // Set user state to wait for opponent input
  await db.setUserState(telegramId, '1v1_waiting_opponent', {
    initiated_at: new Date().toISOString()
  });
  
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🎮 **Starting 1v1 Challenge...**\n\n*Please enter the username or ID of the player you want to challenge:*\n\nExample: @username or 123456789\n\nOr type /cancel to go back.'
  );
}

async function handleViewRankingsCallback(message, db, env) {
  await handleArenaRankingsCallback(message, env);
}

async function handleFindPartnerCallback(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🔍 **Finding Partners...**\n\nSearching for available players looking for partners...\n\n*Feature coming soon!*\n\nIn the meantime, share your referral code to invite friends!'
  );
}

async function handleCreatePartnershipCallback(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '👥 **Create Partnership**\n\n*Please enter the username or ID of your partner:*\n\nExample: @username or 123456789\n\nOr type /cancel to go back.'
  );
}

async function handleFindSquadCallback(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🔍 **Browse Available Squads**\n\nSearching for active squads...\n\n*Feature coming soon!*\n\nIn the meantime, create your own squad and invite friends!'
  );
}

async function handleCreateSquadCallback(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '👥 **Create New Squad**\n\n*Please enter your squad name:*\n\nExample: Ghana Warriors, Quiz Masters, etc.\n\n(3-20 characters, letters and spaces only)\n\nOr type /cancel to go back.'
  );
}

/**
 * Handle accept challenge callback
 */
async function handleAcceptChallengeCallback(message, db, challengeId, env) {
  const opponentId = message.from.id;
  
  try {
    // Get challenge details
    const result = await db.executeQuery(
      'SELECT * FROM challenges WHERE id = ? AND opponent_id = ? AND status = \'pending\'',
      [challengeId, opponentId]
    );
    
    if (result.length === 0) {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        '❌ Challenge not found or already expired.'
      );
      return;
    }
    
    const challenge = result[0];
    
    // Update challenge status to active
    await db.executeQuery(
      'UPDATE challenges SET status = \'active\', started_at = CURRENT_TIMESTAMP WHERE id = ?',
      [challengeId]
    );
    
    // Get challenger info
    const challenger = await db.getUser(challenge.challenger_id);
    const opponent = await db.getUser(opponentId);
    
    // Notify opponent (accepter)
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      `✅ Challenge accepted!\\n\\n🎮 Starting 1v1 battle with ${challenger.full_name || challenger.username}...\\n\\n⚠️ Feature under development. You'll be notified when the battle interface is ready!`,
      createMainMenuKeyboard()
    );
    
    // Notify challenger
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      challenge.challenger_id,
      `🎉 ${opponent.full_name || opponent.username} accepted your challenge!\\n\\n⚠️ Battle feature coming soon. Stay tuned!`
    );
    
  } catch (error) {
    logger.error('Error accepting challenge:', error);
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ Something went wrong. Please try again.'
    );
  }
}

/**
 * Handle decline challenge callback
 */
async function handleDeclineChallengeCallback(message, db, challengeId, env) {
  const opponentId = message.from.id;
  
  try {
    // Get challenge details
    const result = await db.executeQuery(
      'SELECT * FROM challenges WHERE id = ? AND opponent_id = ? AND status = \'pending\'',
      [challengeId, opponentId]
    );
    
    if (result.length === 0) {
      await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        message.chat.id,
        '❌ Challenge not found or already expired.'
      );
      return;
    }
    
    const challenge = result[0];
    
    // Update challenge status to declined
    await db.executeQuery(
      'UPDATE challenges SET status = \'declined\', ended_at = CURRENT_TIMESTAMP WHERE id = ?',
      [challengeId]
    );
    
    // Get opponent info
    const opponent = await db.getUser(opponentId);
    
    // Notify opponent (decliner)
    await sendMessageWithKeyboard(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ Challenge declined.',
      createMainMenuKeyboard()
    );
    
    // Notify challenger
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      challenge.challenger_id,
      `😔 ${opponent.full_name || opponent.username} declined your challenge.\\n\\nDon't give up! Challenge someone else!`
    );
    
  } catch (error) {
    logger.error('Error declining challenge:', error);
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '❌ Something went wrong. Please try again.'
    );
  }
}

// ==========================================
// SECONDARY CALLBACK HANDLERS
// ==========================================

async function handleMainMenuCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '👋 Welcome to **I-Crush Quiz Game**!\n\nTest your knowledge and win prizes!\n\n*Powered by G-NEX*',
    {
      inline_keyboard: [
        [
          { text: '▶️ Play Quiz', callback_data: 'play_continuous' },
          { text: '👤 My Stats', callback_data: 'show_stats' }
        ],
        [
          { text: '🏆 Leaderboard', callback_data: 'show_leaderboard' },
          { text: '🏟️ Arena', callback_data: 'arena' }
        ],
        [
          { text: '💰 Wallet', callback_data: 'wallet' },
          { text: '🎁 Rewards', callback_data: 'rewards' }
        ],
        [
          { text: '🔥 Streak', callback_data: 'streak' },
          { text: '🤝 Referral', callback_data: 'referral' }
        ]
      ]
    }
  );
}

async function handleIndividualRankingsCallback(message, db, env) {
  const topUsers = await db.getTopUsers(10);

  let rankingsText = '👤 **Individual Rankings**\n\n🏆 **Weekly Top Players**\n\n';

  if (topUsers.length === 0) {
    rankingsText += 'No players yet! Be the first to play and climb the ranks!\n';
  } else {
    topUsers.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}️⃣`;
      const name = user.full_name || user.username || `Player${user.telegram_id}`;
      const tierEmoji = user.tier === 'Elite' ? '👑' : user.tier === 'Diamond' ? '💎' : user.tier === 'Gold' ? '🥇' : user.tier === 'Silver' ? '🥈' : '🥉';
      rankingsText += `${medal} ${tierEmoji} **${name}** - ${(user.weekly_points || 0).toLocaleString()} pts\n`;
    });
  }

  rankingsText += '\n*Rankings update every hour*';

  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    rankingsText,
    {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'individual_rankings' },
          { text: '◀️ Back', callback_data: 'arena_rankings' }
        ]
      ]
    }
  );
}

async function handleBattleRankingsCallback(message, db, env) {
  const topBattlePlayers = await db.getTopBattlePlayers(10);

  let rankingsText = '⚔️ **1v1 Battle Rankings**\n\n🏆 **Top Battle Champions**\n\n';

  if (topBattlePlayers.length === 0) {
    rankingsText += 'No battles yet! Challenge other players to start climbing the ranks!\n\nUse /arena to challenge someone!';
  } else {
    topBattlePlayers.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}️⃣`;
      const name = player.full_name || player.username || `Player${player.telegram_id}`;
      const tierEmoji = player.tier === 'Elite' ? '👑' : player.tier === 'Diamond' ? '💎' : player.tier === 'Gold' ? '🥇' : player.tier === 'Silver' ? '🥈' : '🥉';
      const rating = player.battle_rating || 1000;
      const wins = player.battles_won || 0;
      const winPct = player.win_percentage || 0;
      rankingsText += `${medal} ${tierEmoji} **${name}** - ${rating} ELO\n   ${wins}W | ${winPct.toFixed(1)}% WR\n\n`;
    });
  }

  rankingsText += '\n*Rankings based on battle rating (ELO)*';

  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    rankingsText,
    {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'battle_rankings' },
          { text: '◀️ Back', callback_data: 'arena_rankings' }
        ]
      ]
    }
  );
}

async function handleSquadRankingsCallback(message, db, env) {
  const topSquads = await db.getTopSquads(10);

  let rankingsText = '👥 **Squad Rankings**\n\n🏆 **Weekly Top Squads**\n\n';

  if (topSquads.length === 0) {
    rankingsText += 'No squads yet! Create or join a squad to compete!\n\nUse /squad to get started!';
  } else {
    topSquads.forEach((squad, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}️⃣`;
      const memberCount = squad.members_count || squad.active_members || 0;
      const tierEmoji = squad.squad_tier === 'Elite' ? '👑' : squad.squad_tier === 'Diamond' ? '💎' : squad.squad_tier === 'Gold' ? '🥇' : squad.squad_tier === 'Silver' ? '🥈' : '🥉';
      const winPct = squad.win_percentage || 0;
      rankingsText += `${medal} ${tierEmoji} **${squad.name}**\n   ${(squad.weekly_points || 0).toLocaleString()} pts | ${memberCount} members | ${winPct.toFixed(0)}% WR\n\n`;
    });
  }

  rankingsText += '\n*Rankings update every hour*';

  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    rankingsText,
    {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'squad_rankings' },
          { text: '◀️ Back', callback_data: 'arena_rankings' }
        ]
      ]
    }
  );
}

async function handlePartnerRankingsCallback(message, db, env) {
  const topPartnerships = await db.getTopPartnerships(10);

  let rankingsText = '🤝 **Partner Rankings**\n\n🏆 **Weekly Top Partners**\n\n';

  if (topPartnerships.length === 0) {
    rankingsText += 'No partnerships yet! Find a partner and dominate together!\n\nUse /partner to get started!';
  } else {
    topPartnerships.forEach((partnership, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}️⃣`;
      const name1 = partnership.user1_name || 'Player 1';
      const name2 = partnership.user2_name || 'Player 2';
      const tierEmoji = partnership.tier === 'Elite' ? '👑' : partnership.tier === 'Diamond' ? '💎' : partnership.tier === 'Gold' ? '🥇' : partnership.tier === 'Silver' ? '🥈' : '🥉';
      const winPct = partnership.win_percentage || 0;
      const streak = partnership.current_streak || 0;
      rankingsText += `${medal} ${tierEmoji} **${name1}** & **${name2}**\n   ${(partnership.weekly_points || 0).toLocaleString()} pts | ${streak} streak | ${winPct.toFixed(0)}% WR\n\n`;
    });
  }

  rankingsText += '\n*Rankings update every hour*';

  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    rankingsText,
    {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'partner_rankings' },
          { text: '◀️ Back', callback_data: 'arena_rankings' }
        ]
      ]
    }
  );
}

async function handleStreakRankingsCallback(message, db, env) {
  const topStreaks = await db.getTopStreaks(10);

  let rankingsText = '🔥 **Streak Rankings**\n\n🏆 **Current Streak Champions**\n\n';

  if (topStreaks.length === 0) {
    rankingsText += 'No active streaks yet! Start playing daily to build your streak!\n\nPlay at least 1 question per day to maintain your streak!';
  } else {
    topStreaks.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}️⃣`;
      const name = user.full_name || user.username || `Player${user.telegram_id}`;
      const tierEmoji = user.tier === 'Elite' ? '👑' : user.tier === 'Diamond' ? '💎' : user.tier === 'Gold' ? '🥇' : user.tier === 'Silver' ? '🥈' : '🥉';
      const streakDays = user.streak || 0;
      rankingsText += `${medal} ${tierEmoji} **${name}** - ${streakDays} day${streakDays !== 1 ? 's' : ''} 🔥\n`;
    });
  }

  rankingsText += '\n*Streaks reset after 24 hours of inactivity*';

  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    rankingsText,
    {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'streak_rankings' },
          { text: '◀️ Back', callback_data: 'arena_rankings' }
        ]
      ]
    }
  );
}

// ==========================================
// ADDITIONAL CALLBACK HANDLERS
// ==========================================

async function handleHelpCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '📚 **I-Crush Help Center**\n\n**How to Play:**\n• Answer questions to earn points\n• Build daily streaks for bonuses\n• Compete on leaderboards\n• Win real rewards\n\n**Commands:**\n/start - Begin your journey\n/play - Answer a question\n/stats - View your statistics\n/leaderboard - See top players\n\n**Need more help?**\nContact: @icrush_support\n\n*Powered by G-NEX*',
    {
      inline_keyboard: [
        [
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleSubscribeCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '💎 **Go Premium**\n\n**Premium Benefits:**\n• 40 questions/hour (vs 20 free)\n• +7 speed bonus points\n• Exclusive premium questions\n• Priority support\n• Special tournaments\n\n**Pricing:**\n🇬🇭 Ghana: 5 GHS/month\n🌍 International: $3/month\n\nReady to upgrade? Contact @gnex_support',
    {
      inline_keyboard: [
        [
          { text: '💬 Contact Support', callback_data: 'help' },
          { text: '◀️ Back', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleWalletCallback(message, db, env) {
  const telegramId = message.from?.id || message.chat.id;
  const user = await db.getUser(telegramId);
  
  if (!user) {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '⚠️ Please use /start to register first!'
    );
    return;
  }

  const walletText = `💰 **My Wallet**\n\n**Current Balance:**\n• Arena Points: ${(user.ap || 0).toLocaleString()} AP\n• Prize Points: ${(user.pp || 0).toLocaleString()} PP\n• Total Earned: ${(user.total_ap || 0).toLocaleString()} AP | ${(user.total_pp || 0).toLocaleString()} PP\n\n**Weekly Progress:**\n• This Week: ${(user.weekly_points || 0).toLocaleString()} pts\n• Streak: ${user.streak || 0} days 🔥\n\n**Earn Points:**\n• Answer questions correctly\n• Build daily streaks\n• Win prize rounds\n• Refer friends`;

  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    walletText,
    {
      inline_keyboard: [
        [
          { text: '🎮 Play to Earn', callback_data: 'play_continuous' },
          { text: '🤝 Refer Friends', callback_data: 'referral' }
        ],
        [
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleRewardsCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🎁 **Rewards Center**\n\n**Available Rewards:**\n\n📱 **Data Bundles**\n• 100MB - 50 PP\n• 500MB - 200 PP\n• 1GB - 350 PP\n\n🎮 **Game Items**\n• Extra Life - 30 PP\n• Skip Question - 20 PP\n• 50/50 Help - 15 PP\n\n💰 **Cash Prizes**\n• Weekly Top 10: 100-1000 PP\n\nComing soon! Check back for available rewards.',
    {
      inline_keyboard: [
        [
          { text: '🏆 View Rankings', callback_data: 'show_leaderboard' },
          { text: '🎮 Play Now', callback_data: 'play_continuous' }
        ],
        [
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleStreakCallback(message, db, env) {
  const telegramId = message.from?.id || message.chat.id;
  const user = await db.getUser(telegramId);
  
  if (!user) {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '⚠️ Please use /start to register first!'
    );
    return;
  }

  const currentStreak = user.streak || 0;
  let nextMilestone = '3 days: +50 bonus points';
  
  if (currentStreak >= 30) {
    nextMilestone = 'Max milestone reached! 🏆';
  } else if (currentStreak >= 14) {
    nextMilestone = '30 days: +1000 bonus points + Guaranteed 100MB data';
  } else if (currentStreak >= 7) {
    nextMilestone = '14 days: +300 bonus points + 1.2x multiplier';
  } else if (currentStreak >= 3) {
    nextMilestone = '7 days: +150 bonus points + Data draw entry';
  }

  const streakText = `🔥 **My Streak**\n\n**Current Streak:** ${currentStreak} day${currentStreak !== 1 ? 's' : ''} 🔥\n\n**Next Milestone:**\n${nextMilestone}\n\n**Streak Milestones:**\n🔥 3 days: +50 bonus points\n🔥 7 days: +150 bonus points + Data draw\n🔥 14 days: +300 bonus points + 1.2x multiplier\n🔥 30 days: +1000 bonus points + 100MB data\n\n**Streak Rules:**\n• Answer at least 1 question daily\n• Streak resets after 24h inactivity\n• Bonus points auto-credited\n\nKeep your streak alive! Play daily!`;

  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    streakText,
    {
      inline_keyboard: [
        [
          { text: '▶️ Play Now', callback_data: 'play_continuous' },
          { text: '📊 My Stats', callback_data: 'show_stats' }
        ],
        [
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleReferralCallback(message, db, env) {
  const telegramId = message.from?.id || message.chat.id;
  const user = await db.getUser(telegramId);
  
  if (!user) {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      message.chat.id,
      '⚠️ Please use /start to register first!'
    );
    return;
  }

  // Get actual referral code from user record or generate from telegram ID
  const referralCode = user.referral_code || `GNEX${telegramId}`;
  const botUsername = 'codecadencebot';
  const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;

  // Get referral count
  const referralCount = await db.getReferralCount(telegramId);

  const referralText = `🤝 **Invite Friends**\n\n**Your Referral Code:**\n\`${referralCode}\`\n\n**Referral Link:**\n${referralLink}\n\n**Your Stats:**\n• Friends Referred: ${referralCount || 0}\n\n**Referral Rewards:**\n• Friend joins: +50 AP + 50MB data\n• Friend plays 10 games: +100 AP\n• Friend reaches Silver tier: +200 AP + 50 PP\n\n**Milestones:**\n• 5 referrals: +250 AP bonus\n• 10 referrals: +500 AP + 100MB data\n• 20 referrals: +1000 AP + 200 PP\n\n**How it works:**\n1. Share your referral link\n2. Friend uses /start ${referralCode}\n3. Earn rewards when they play!`;

  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    referralText,
    {
      inline_keyboard: [
        [
          { text: '📋 Copy Link', url: referralLink },
          { text: '📤 Share', url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(`Join me on G-NEX Quiz Arena! Use my code ${referralCode} to get bonus points!`)}` }
        ],
        [
          { text: '🏆 Leaderboard', callback_data: 'show_leaderboard' },
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

async function handleArenaCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🏟️ **G-NEX Arena**\n\nChoose your battle mode:',
    {
      inline_keyboard: [
        [
          { text: '⚔️ 1v1 Challenge', callback_data: 'arena_1v1' },
          { text: '🤝 Find Partner', callback_data: 'arena_partner' }
        ],
        [
          { text: '👥 Join Squad', callback_data: 'arena_squad' },
          { text: '🏆 View Rankings', callback_data: 'arena_rankings' }
        ],
        [
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}
