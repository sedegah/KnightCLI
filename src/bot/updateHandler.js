/**
 * Telegram Update Handler
 * Routes and processes all Telegram updates
 */

import { GNEXDatabase } from '../database/gnex-client.js';
import { QuestionManager } from '../game/questionManager.js';
import { ArenaManager } from '../game/arena.js';
import { RankingSystem } from '../game/ranking.js';
import { StreakManager } from '../game/streaks.js';
import { EconomyManager } from '../game/economy.js';
import { GhanaQuestionManager } from '../game/ghanaQuestions.js';
import { DataRewardManager } from '../game/dataRewards.js';
import { ViralGrowthManager } from '../growth/viral.js';
import { logger } from '../utils/logger.js';
import { sendMessage, sendMessageWithKeyboard } from '../utils/telegram.js';
import { createMainMenuKeyboard, createQuestionKeyboard } from './keyboards.js';
import { MESSAGES } from '../config/constants.js';

export async function handleTelegramUpdate(update, env) {
  const db = new GNEXDatabase(env.GNEX_KV);
  const questionManager = new QuestionManager(db);
  
  // Initialize all game systems with the same database instance
  const arenaManager = new ArenaManager(env.GNEX_KV);
  const rankingSystem = new RankingSystem(env.GNEX_KV);
  const streakManager = new StreakManager(env.GNEX_KV);
  const economyManager = new EconomyManager(env.GNEX_KV);
  const ghanaQuestions = new GhanaQuestionManager(env.GNEX_KV);
  const dataRewardManager = new DataRewardManager(env.GNEX_KV);
  const viralGrowth = new ViralGrowthManager(env.GNEX_KV);

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
  const text = message.text || '';

  // Handle commands
  if (text.startsWith('/start')) {
    await handleStartCommand(message, db, env);
  } else if (text === '/play' || text === '▶️ Play Quiz') {
    await handlePlayCommand(message, db, questionManager, env);
  } else if (text === '/stats') {
    await handleStatsCommand(message, db, env);
  } else if (text === '/leaderboard' || text === '🏆 Leaderboard') {
    await handleLeaderboardCommand(message, db, env);
  } else if (text === '/help') {
    await handleHelpCommand(message, env);
  } else if (text === '/arena') {
    await handleArenaCommand(message, env);
  } else if (text === '/challenge') {
    await handleChallengeCommand(message, env);
  } else if (text === '/partner') {
    await handlePartnerCommand(message, env);
  } else if (text === '/squad') {
    await handleSquadCommand(message, env);
  } else if (text === '/rewards') {
    await handleRewardsCommand(message, env);
  } else if (text === '/wallet') {
    await handleWalletCommand(message, env);
  } else if (text === '/streak') {
    await handleStreakCommand(message, env);
  } else if (text === '/referral') {
    await handleReferralCommand(message, env);
  } else if (text === '/share') {
    await handleShareCommand(message, env);
  } else if (text === '/invite') {
    await handleInviteCommand(message, env);
  } else if (text.trim() === '') {
    // Handle empty messages (like button presses without text)
    await handleUnknownMessage(message, db, env);
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
  const data = query.callback_data || '';

  // Acknowledge the callback
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: query.id })
  });

  // Parse callback data
  if (data === 'play_continuous') {
    await handlePlayCallback(query.message, db, questionManager, env);
  } else if (data === 'show_stats') {
    await handleStatsCallback(query.message, db, env);
  } else if (data === 'show_leaderboard') {
    await handleLeaderboardCallback(query.message, db, env);
  } else if (data.startsWith('answer_')) {
    await handleAnswerCallback(query, data, db, questionManager, env);
  } else if (data === 'arena_1v1') {
    await handleArena1v1Callback(query.message, env);
  } else if (data === 'arena_partner') {
    await handleArenaPartnerCallback(query.message, env);
  } else if (data === 'arena_squad') {
    await handleArenaSquadCallback(query.message, env);
  } else if (data === 'arena_rankings') {
    await handleArenaRankingsCallback(query.message, env);
  } else if (data === 'main_menu') {
    await handleMainMenuCallback(query.message, env);
  } else if (data === 'individual_rankings') {
    await handleIndividualRankingsCallback(query.message, env);
  } else if (data === 'squad_rankings') {
    await handleSquadRankingsCallback(query.message, env);
  } else if (data === 'partner_rankings') {
    await handlePartnerRankingsCallback(query.message, env);
  } else if (data === 'streak_rankings') {
    await handleStreakRankingsCallback(query.message, env);
  } else {
    // Handle unknown callback data
    console.warn('Unknown callback data:', data);
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

  // Parse answer: "answer_<option>_<questionId>" (Python format)
  const parts = data.split('_');
  if (parts.length < 3) {
    console.error('Invalid answer format:', data);
    return;
  }
  
  const selectedOption = parts[1]; // A, B, C, or D
  const questionId = parts.slice(2).join('_'); // Handle question IDs with underscores

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

/**
 * Handle unknown messages with main menu
 */
async function handleUnknownMessage(message, db, env) {
  const telegramId = message.from.id;
  
  // Check if user exists
  let user = await db.getUser(telegramId);
  
  if (!user) {
    // Create new user
    user = await db.createUser({
      telegramId: telegramId,
      username: message.from.username,
      fullName: message.from.first_name + (message.from.last_name ? ' ' + message.from.last_name : '')
    });
  }
  
  // Show main menu
  const welcomeText = user 
    ? `👋 Welcome back, **${user.fullName}**!\n\nReady to test your knowledge?`
    : `👋 Welcome to **G-NEX Quiz Bot**!\n\nTest your knowledge and win prizes!`;
    
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    welcomeText,
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

async function handleChallengeCommand(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '⚔️ **Challenge Mode**\n\nUse /arena to access 1v1 challenges and battle other players!\n\nChallenge types:\n• Standard Battle\n• Speed Challenge\n• Streak Challenge'
  );
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

async function handleWalletCommand(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '💰 **Points Wallet**\n\nEarn and spend points!\n\nEarn points by:\n• Answering questions\n• Daily login bonus\n• Winning battles\n• Referring friends\n\nSpend points on:\n• Premium battles\n• Mystery boxes\n• Streak protection\n• Squad boosts'
  );
}

async function handleStreakCommand(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🔥 **Streak Rewards**\n\nBuild daily streaks for amazing rewards!\n\nMilestones:\n• 3 days: +50 points\n• 7 days: Data draw entry\n• 14 days: 1.2x multiplier\n• 30 days: Guaranteed 100MB data\n\nProtect your streak with points!'
  );
}

async function handleReferralCommand(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🤝 **Referral System**\n\nInvite friends and earn rewards!\n\nYou get:\n• 50 points + 50MB data per referral\n• Bonus rewards at 5, 10, 20 referrals\n\nYour friend gets:\n• 25 points + 25MB data bonus\n\nUse /share to get your referral link!'
  );
}

async function handleShareCommand(message, env) {
  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '📤 **Share Your Success**\n\nCreate shareable cards for:\n• Rank achievements\n• Streak milestones\n• Squad victories\n• Battle wins\n\nShare your progress and invite friends to compete!'
  );
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
          { text: '👥 Squad Rankings', callback_data: 'squad_rankings' }
        ],
        [
          { text: '🤝 Partner Rankings', callback_data: 'partner_rankings' },
          { text: '🔥 Streak Rankings', callback_data: 'streak_rankings' }
        ],
        [
          { text: '◀️ Back to Menu', callback_data: 'main_menu' }
        ]
      ]
    }
  );
}

// ==========================================
// SECONDARY CALLBACK HANDLERS
// ==========================================

async function handleMainMenuCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🎮 **G-NEX Main Menu**\n\nChoose your adventure:',
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

async function handleIndividualRankingsCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '👤 **Individual Rankings**\n\n🏆 **Weekly Top Players**\n\n1. 🥇 Player1 - 250 pts\n2. 🥈 Player2 - 230 pts\n3. 🥉 Player3 - 210 pts\n4. 4️⃣ Player4 - 195 pts\n5. 5️⃣ Player5 - 180 pts\n\n*Rankings update every hour*\n\n◀️ Back to Rankings',
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

async function handleSquadRankingsCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '👥 **Squad Rankings**\n\n🏆 **Weekly Top Squads**\n\n1. 🥇 Ghana Champions - 850 pts\n2. 🥈 Quiz Masters - 720 pts\n3. 🥉 Brain Trust - 650 pts\n4. 4️⃣ Data Kings - 580 pts\n5. 5️⃣ Quiz Warriors - 520 pts\n\n*Rankings update every hour*\n\n◀️ Back to Rankings',
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

async function handlePartnerRankingsCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🤝 **Partner Rankings**\n\n🏆 **Weekly Top Partners**\n\n1. 🥇 Dream Team - 420 pts\n2. 🥈 Power Pair - 380 pts\n3. 🥉 Quiz Buddies - 350 pts\n4. 4️⃣ Smart Squad - 320 pts\n5. 5️⃣ Knowledge Kings - 290 pts\n\n*Rankings update every hour*\n\n◀️ Back to Rankings',
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

async function handleStreakRankingsCallback(message, env) {
  await sendMessageWithKeyboard(
    env.TELEGRAM_BOT_TOKEN,
    message.chat.id,
    '🔥 **Streak Rankings**\n\n🏆 **Current Streak Champions**\n\n1. 🥇 Fire Starter - 45 days\n2. 🥈 Quiz Master - 30 days\n3. 🥉 Daily Player - 21 days\n4. 4️⃣ Week Warrior - 14 days\n5. 5️⃣ Rising Star - 7 days\n\n*Streaks reset after 24 hours of inactivity*\n\n◀️ Back to Rankings',
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
