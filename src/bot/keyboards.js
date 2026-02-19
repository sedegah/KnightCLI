/**
 * Telegram Keyboards
 * Creates keyboards for bot interactions
 */

/**
 * Create main menu keyboard (ReplyKeyboard - regular buttons)
 */
export function createMainMenuKeyboard() {
  return {
    keyboard: [
      [
        { text: '▶️ Play Quiz' }
      ],
      [
        { text: '🏆 Leaderboard' },
        { text: '👤 My Stats' }
      ],
      [
        { text: '🤝 Invite Friends' },
        { text: '� Go Premium' }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

/**
 * Create question options keyboard (InlineKeyboard - callback buttons)
 */
export function createQuestionKeyboard(questionId) {
  return {
    inline_keyboard: [
      [
        { text: 'A', callback_data: `answer_A_${questionId}` },
        { text: 'B', callback_data: `answer_B_${questionId}` }
      ],
      [
        { text: 'C', callback_data: `answer_C_${questionId}` },
        { text: 'D', callback_data: `answer_D_${questionId}` }
      ]
    ]
  };
}

/**
 * Create continue playing keyboard (InlineKeyboard)
 */
export function createContinuePlayingKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '▶️ Next Question', callback_data: 'play_continuous' },
        { text: '� View Leaderboard', callback_data: 'show_leaderboard' }
      ]
    ]
  };
}

/**
 * Create retry or continue keyboard (InlineKeyboard)
 */
export function createRetryOrContinueKeyboard(hasAttemptsLeft = false) {
  const keyboard = [];
  
  if (hasAttemptsLeft) {
    keyboard.push([
      { text: '� Try Again (2nd attempt)', callback_data: 'retry_question' }
    ]);
  }
  
  keyboard.push(
    [
      { text: '▶️ Next Question', callback_data: 'play_continuous' }
    ],
    [
      { text: '📊 My Stats', callback_data: 'show_stats' }
    ]
  );
  
  return {
    inline_keyboard: keyboard
  };
}

/**
 * Create subscribe prompt keyboard (InlineKeyboard)
 */
export function createSubscribePromptKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '💎 Learn More', callback_data: 'subscribe_info' },
        { text: '▶️ Continue as Free', callback_data: 'play_continuous' }
      ]
    ]
  };
}

/**
 * Create leaderboard actions keyboard (InlineKeyboard)
 */
export function createLeaderboardActionsKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔄 Refresh', callback_data: 'show_leaderboard' },
        { text: '▶️ Play Now', callback_data: 'play_continuous' }
      ]
    ]
  };
}

/**
 * Create stats actions keyboard (InlineKeyboard)
 */
export function createStatsActionsKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '▶️ Play Quiz', callback_data: 'play_continuous' },
        { text: '🏆 Leaderboard', callback_data: 'show_leaderboard' },
        { text: '💎 Go Premium', callback_data: 'subscribe_info' }
      ]
    ]
  };
}
