/**
 * G-NEX Telegram Bot - Cloudflare Workers Entry Point
 * 
 * This is the main webhook handler for the Telegram bot.
 * All requests are routed through this file.
 */

import { Hono } from 'hono';
import { handleTelegramUpdate } from './bot/updateHandler.js';
import { verifyTelegramRequest } from './utils/security.js';
import { logger } from './utils/logger.js';

const app = new Hono();

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'gnex-telegram-bot',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Bot information page
 */
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>G-NEX Quiz Platform</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          min-height: 100vh;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .tagline { font-size: 1.2rem; opacity: 0.9; margin-bottom: 2rem; }
        .feature {
          background: rgba(255, 255, 255, 0.1);
          padding: 1rem;
          border-radius: 10px;
          margin: 1rem 0;
        }
        .feature h3 { margin: 0 0 0.5rem 0; }
        .cta {
          display: inline-block;
          background: #fff;
          color: #667eea;
          padding: 1rem 2rem;
          border-radius: 50px;
          text-decoration: none;
          font-weight: bold;
          margin-top: 2rem;
          transition: transform 0.2s;
        }
        .cta:hover { transform: scale(1.05); }
        .status {
          display: inline-block;
          background: #10b981;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          margin-top: 1rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎮 G-NEX Quiz Platform</h1>
        <p class="tagline">Test Your Knowledge, Win Real Prizes!</p>
        
        <div class="feature">
          <h3>📚 Daily Quizzes</h3>
          <p>Answer questions anytime, earn Accumulated Points (AP), and build your streak!</p>
        </div>
        
        <div class="feature">
          <h3>🏆 Prize Rounds</h3>
          <p>Compete twice daily at 9:00 AM and 9:00 PM UTC for real rewards!</p>
        </div>
        
        <div class="feature">
          <h3>⚔️ 1v1 Battles</h3>
          <p>Challenge friends and climb the competitive rankings!</p>
        </div>
        
        <div class="feature">
          <h3>👥 Squad Mode</h3>
          <p>Team up with 3-10 players and compete for squad glory!</p>
        </div>
        
        <a href="https://t.me/gnex_quiz_bot" class="cta">Start Playing Now →</a>
        
        <div class="status">✓ Live and Running</div>
      </div>
    </body>
    </html>
  `);
});

/**
 * Telegram webhook endpoint
 */
app.post('/webhook', async (c) => {
  const env = c.env;
  
  try {
    // Verify the request came from Telegram
    const isValid = verifyTelegramRequest(c.req.raw, env.TELEGRAM_WEBHOOK_SECRET);
    if (!isValid) {
      logger.warn('Invalid webhook request received');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Parse the update
    const update = await c.req.json();
    
    // Process the update asynchronously
    c.executionCtx.waitUntil(
      handleTelegramUpdate(update, env).catch(error => {
        logger.error('Error handling update:', error);
      })
    );

    // Respond immediately to Telegram
    return c.json({ ok: true });

  } catch (error) {
    logger.error('Webhook error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Set webhook endpoint (admin only)
 */
app.post('/set-webhook', async (c) => {
  const env = c.env;
  const { url } = await c.req.json();

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          max_connections: 100,
          allowed_updates: ['message', 'callback_query', 'inline_query']
        })
      }
    );

    const result = await response.json();
    return c.json(result);

  } catch (error) {
    logger.error('Error setting webhook:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Export the Cloudflare Worker
 */
export default {
  fetch: app.fetch,
  
  /**
   * Scheduled event handler for cron jobs
   */
  async scheduled(event, env, ctx) {
    // Prize round scheduling
    ctx.waitUntil(handleScheduledTasks(event, env));
  }
};

/**
 * Handle scheduled tasks (prize rounds, reminders, etc.)
 */
async function handleScheduledTasks(event, env) {
  const hour = new Date().getUTCHours();
  
  // Prize round triggers
  if (hour === 9 || hour === 21) {
    logger.info('Prize round triggered at hour:', hour);
    // Prize round logic will be implemented in scheduler module
  }
  
  // Daily reminders at 6 PM UTC
  if (hour === 18) {
    logger.info('Daily reminder triggered');
    // Reminder logic will be implemented in scheduler module
  }
}
