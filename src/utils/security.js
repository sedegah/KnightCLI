/**
 * Security Utilities
 */

import crypto from 'node:crypto';

/**
 * Verify Telegram webhook request using proper secret validation
 */
export function verifyTelegramRequest(request, secret) {
  try {
    // Telegram sends X-Telegram-Bot-Api-Secret-Token header for webhook verification
    const telegramSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    
    if (!secret) {
      console.warn('No webhook secret configured - allowing requests in development mode');
      return true; // Allow if no secret is configured (development)
    }
    
    if (!telegramSecret) {
      console.warn('Missing X-Telegram-Bot-Api-Secret-Token header');
      return false;
    }
    
    // Direct string comparison for webhook tokens (not hex)
    return telegramSecret === secret;
  } catch (error) {
    console.error('Error verifying Telegram request:', error);
    return false;
  }
}

/**
 * Hash sensitive data
 */
export function hashData(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Validate Telegram user ID
 */
export function isValidTelegramId(id) {
  return Number.isInteger(id) && id > 0;
}

/**
 * Check if user is admin
 */
export function isAdmin(telegramId, env) {
  const adminIds = env.ADMIN_TELEGRAM_IDS?.split(',').map(id => parseInt(id.trim())) || [];
  return adminIds.includes(telegramId);
}
