/**
 * Telegram API Utilities
 */

import { logger } from './logger.js';

/**
 * Send a text message
 */
export async function sendMessage(botToken, chatId, text, parseMode = 'Markdown') {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      logger.error('Telegram API error:', result);
    }

    return result;
  } catch (error) {
    logger.error('Error sending message:', error);
    return null;
  }
}

/**
 * Send an animation (GIF/MP4)
 */
export async function sendAnimation(botToken, chatId, animation, caption = '', parseMode = 'Markdown') {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendAnimation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        animation,
        caption,
        parse_mode: parseMode
      })
    });

    const result = await response.json();

    if (!result.ok) {
      logger.error('Telegram API animation error:', result);
    }

    return result;
  } catch (error) {
    logger.error('Error sending animation:', error);
    return null;
  }
}

/**
 * Send a message with inline keyboard
 */
/**
 * Send a message with keyboard (ReplyKeyboard or InlineKeyboard)
 */
export async function sendMessageWithKeyboard(botToken, chatId, text, keyboard, parseMode = 'Markdown') {
  try {
    const requestBody = {
      chat_id: chatId,
      text,
      parse_mode: parseMode
    };

    // Handle different keyboard types
    if (keyboard.keyboard) {
      // ReplyKeyboardMarkup (regular keyboard buttons)
      requestBody.reply_markup = {
        keyboard: keyboard.keyboard,
        resize_keyboard: keyboard.resize_keyboard || true,
        one_time_keyboard: keyboard.one_time_keyboard || false
      };
    } else if (keyboard.inline_keyboard) {
      // InlineKeyboardMarkup (callback buttons)
      requestBody.reply_markup = {
        inline_keyboard: keyboard.inline_keyboard
      };
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    
    if (!result.ok) {
      logger.error('Telegram API error:', result);
    }

    return result;
  } catch (error) {
    logger.error('Error sending message with keyboard:', error);
    return null;
  }
}

/**
 * Edit message text
 */
export async function editMessageText(botToken, chatId, messageId, text, keyboard = null, parseMode = 'Markdown') {
  try {
    const requestBody = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode
    };

    // Add keyboard if provided
    if (keyboard) {
      if (keyboard.keyboard) {
        // ReplyKeyboardMarkup (regular keyboard buttons)
        requestBody.reply_markup = {
          keyboard: keyboard.keyboard,
          resize_keyboard: keyboard.resize_keyboard || true,
          one_time_keyboard: keyboard.one_time_keyboard || false
        };
      } else if (keyboard.inline_keyboard) {
        // InlineKeyboardMarkup (callback buttons)
        requestBody.reply_markup = {
          inline_keyboard: keyboard.inline_keyboard
        };
      }
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    
    if (!result.ok) {
      logger.error('Telegram API error editing message:', result);
    }

    return result;
  } catch (error) {
    logger.error('Error editing message:', error);
    return null;
  }
}

/**
 * Answer callback query
 */
export async function answerCallbackQuery(botToken, callbackQueryId, text = '', showAlert = false) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert
      })
    });

    return await response.json();
  } catch (error) {
    logger.error('Error answering callback query:', error);
    return null;
  }
}

/**
 * Set bot commands (interface menu)
 */
export async function setMyCommands(botToken, commands) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      logger.error('Error setting bot commands:', result);
    } else {
      logger.info('Bot commands registered successfully');
    }

    return result;
  } catch (error) {
    logger.error('Error setting bot commands:', error);
    return null;
  }
}
