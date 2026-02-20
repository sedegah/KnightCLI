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
        { text: '💎 Go Premium' }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

/**
 * Create question options keyboard (InlineKeyboard - callback buttons)
 * @param {string} questionId - The question ID
 * @param {object} question - Optional question object to detect True/False questions
 */
export function createQuestionKeyboard(questionId, question = null) {
  // Check if this is a True/False question (options C and D are N/A or empty)
  const isTrueFalse = question && 
    (question.option_c === 'N/A' || !question.option_c) && 
    (question.option_d === 'N/A' || !question.option_d);
  
  if (isTrueFalse) {
    // Show only 2 options for True/False questions
    return {
      inline_keyboard: [
        [
          { text: `A) ${question.option_a}`, callback_data: `answer_A_${questionId}` },
          { text: `B) ${question.option_b}`, callback_data: `answer_B_${questionId}` }
        ]
      ]
    };
  }
  
  // Show all 4 options for multiple choice questions
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
        { text: '📊 View Leaderboard', callback_data: 'show_leaderboard' }
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
