/**
 * Security Utilities
 */

import crypto from 'crypto';

/**
 * Verify Telegram webhook request
 */
export function verifyTelegramRequest(request, secret) {
  try {
    // In production, implement proper webhook verification
    // For now, we'll just check if the secret is present
    
    // Telegram sends X-Telegram-Bot-Api-Secret-Token header
    const telegramSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    
    if (!secret || !telegramSecret) {
      return true; // Allow if no secret is configured (development)
    }
    
    return telegramSecret === secret;
  } catch (error) {
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
