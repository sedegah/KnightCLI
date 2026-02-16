/**
 * Telegram Keyboards
 * Creates inline keyboards for bot interactions
 */

/**
 * Create main menu keyboard
 */
export function createMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🎮 Play Now', callback_data: 'play' },
        { text: '📊 My Stats', callback_data: 'stats' }
      ],
      [
        { text: '🏆 Leaderboard', callback_data: 'leaderboard' },
        { text: '❓ Help', callback_data: 'help' }
      ]
    ]
  };
}

/**
 * Create question options keyboard
 */
export function createQuestionKeyboard(questionId) {
  return {
    inline_keyboard: [
      [
        { text: 'A', callback_data: `answer_${questionId}_A` },
        { text: 'B', callback_data: `answer_${questionId}_B` }
      ],
      [
        { text: 'C', callback_data: `answer_${questionId}_C` },
        { text: 'D', callback_data: `answer_${questionId}_D` }
      ]
    ]
  };
}

/**
 * Create subscribe/upgrade keyboard
 */
export function createSubscribeKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '💎 Upgrade to Premium', callback_data: 'subscribe' }
      ],
      [
        { text: '◀️ Back', callback_data: 'main_menu' }
      ]
    ]
  };
}
