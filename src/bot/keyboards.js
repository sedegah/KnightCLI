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
        { text: '▶️ Play Quiz', callback_data: 'play_continuous' },
        { text: '� My Stats', callback_data: 'show_stats' }
      ],
      [
        { text: '🏆 Leaderboard', callback_data: 'show_leaderboard' },
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
