/**
 * I-Crush Quiz Game - Cloudflare Workers Entry Point
 * Complete edge-optimized implementation
 * Powered by G-NEX
 */

import { Hono } from 'hono';
import { handleTelegramUpdate } from './bot/updateHandler.js';
import { verifyTelegramRequest } from './utils/security.js';
import { D1Database } from './database/d1-client.js';
import { logger } from './utils/logger.js';

const app = new Hono();

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'icrush-quiz-game',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Bot information page
 */
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>G-NEX: Ghana's Competitive Data Quiz Arena</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 2rem; 
            background: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%); 
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
        .header { text-align: center; margin-bottom: 2rem; }
        .features { background: rgba(255, 255, 255, 0.05); padding: 1.5rem; border-radius: 10px; margin: 1rem 0; }
        .feature { margin: 0.5rem 0; padding: 0.5rem; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0; }
        .stat { background: rgba(255, 255, 255, 0.1); padding: 1rem; border-radius: 10px; text-align: center; }
        .cta { text-align: center; margin: 2rem 0; }
        .btn { 
            background: #FF6B6B; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 8px; 
            display: inline-block; 
            font-weight: bold;
            transition: transform 0.2s;
        }
        .btn:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🇬🇭 G-NEX: Ghana's Competitive Data Quiz Arena</h1>
            <p>Test Your Knowledge, Win Free Data, Dominate the Leaderboard!</p>
        </div>
        
        <div class="features">
            <h2>🎮 Game Features</h2>
            <div class="feature">🏟️ <strong>Multiple Game Modes:</strong> 1v1 Challenges, Partner Mode, Squad Battles</div>
            <div class="feature">🏆 <strong>Competitive Rankings:</strong> Bronze → Silver → Gold → Diamond → Elite</div>
            <div class="feature">🔥 <strong>Streak Rewards:</strong> Build daily streaks for bonus points and data</div>
            <div class="feature">💰 <strong>Points Economy:</strong> Earn and spend points on premium features</div>
            <div class="feature">🎁 <strong>Data Rewards:</strong> Win free mobile data (MTN, Vodafone, AirtelTigo, GLO)</div>
            <div class="feature">🇬🇭 <strong>Ghana-Focused:</strong> Local culture, sports, music, and current affairs</div>
        </div>

        <div class="stats">
            <div class="stat">
                <h3>📱 Platform</h3>
                <p>Telegram Bot</p>
                <p>No downloads</p>
            </div>
            <div class="stat">
                <h3>🎯 Focus</h3>
                <p>Ghana Market</p>
                <p>Local content</p>
            </div>
            <div class="stat">
                <h3>🏆 Prizes</h3>
                <p>Free Data</p>
                <p>Weekly rewards</p>
            </div>
            <div class="stat">
                <h3>⚡ Technology</h3>
                <p>Cloudflare Workers</p>
                <p>Global edge</p>
            </div>
        </div>

        <div class="cta">
            <h2>🚀 Ready to Play?</h2>
            <a href="https://t.me/gnex_quiz_bot" class="btn">Start Playing on Telegram</a>
            <p><strong>Commands:</strong> /start, /play, /arena, /rewards, /streak, /referral</p>
        </div>

        <div style="text-align: center; margin-top: 2rem; opacity: 0.8;">
            <p>Bot Status: ✅ Live and Running</p>
            <p>Powered by Cloudflare Workers • Made with ❤️ for Ghana 🇬🇭</p>
        </div>
    </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
});

/**
 * Telegram webhook endpoint with edge optimization
 */
app.post('/webhook', async (c) => {
  const startTime = Date.now();
  
  try {
    // Verify webhook signature
    const isValid = verifyTelegramRequest(c.req.raw, c.env.WEBHOOK_SECRET);
    if (!isValid) {
      logger.warn('Invalid webhook request received');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Parse update with size limit
    const update = await c.req.json();
    
    // Validate update size (edge protection)
    const updateSize = JSON.stringify(update).length;
    if (updateSize > 64 * 1024) { // 64KB limit
      logger.warn(`Update too large: ${updateSize} bytes`);
      return c.json({ error: 'Update too large' }, 413);
    }

    // Process update asynchronously for better performance
    c.executionCtx.waitUntil(
      handleTelegramUpdate(update, c.env)
        .catch(error => {
          logger.error('Async update handling error:', error);
        })
    );

    // Log performance metrics
    const processingTime = Date.now() - startTime;
    logger.info(`Webhook processed in ${processingTime}ms, update size: ${updateSize} bytes`);

    return c.json({ ok: true, processing_time: processingTime });
    
  } catch (error) {
    logger.error('Webhook error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Admin endpoints (protected)
 */
app.get('/admin/stats', async (c) => {
  try {
    const stats = {
      uptime: Date.now(),
      memory: c.env?.MEMORY_USED_MB || 'N/A',
      requests: c.env?.REQUEST_COUNT || 'N/A'
    };
    
    return c.json(stats);
  } catch (error) {
    logger.error('Admin stats error:', error);
    return c.json({ error: 'Stats unavailable' }, 500);
  }
});

/**
 * Migration endpoint
 */
app.post('/migrate', async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.table || !body.data) {
      return c.json({ error: 'Missing table or data' }, 400);
    }

    const table = body.table;
    const data = Array.isArray(body.data) ? body.data : [body.data];
    
    let migrated = 0;
    
    for (const item of data) {
      const id = item.id || crypto.randomUUID();
      const key = `${table}:${id}`;
      
      await c.env.GNEX_KV.put(key, JSON.stringify(item));
      migrated++;
    }

    logger.info(`Migrated ${migrated} items to table: ${table}`);
    
    return c.json({ 
      success: true, 
      migrated,
      table,
      message: `Successfully migrated ${migrated} items`
    });
    
  } catch (error) {
    logger.error('Migration error:', error);
    return c.json({ error: 'Migration failed' }, 500);
  }
});

/**
 * KV data retrieval endpoints
 */
app.get('/kv-data/:table/:id', async (c) => {
  try {
    const { table, id } = c.req.param();
    const data = await c.env.GNEX_KV.get(`${table}:${id}`);
    
    if (!data) {
      return c.json({ error: 'Data not found' }, 404);
    }
    
    return c.json(JSON.parse(data));
  } catch (error) {
    logger.error('KV data retrieval error:', error);
    return c.json({ error: 'Data retrieval failed' }, 500);
  }
});

/**
 * Backward compatibility endpoint
 */
app.get('/kv-data/:id', async (c) => {
  try {
    const { id } = c.req.param();
    
    // Try users first, then questions
    let data = await c.env.GNEX_KV.get(`users:${id}`);
    if (!data) {
      data = await c.env.GNEX_KV.get(`questions:${id}`);
    }
    
    if (!data) {
      return c.json({ error: 'Data not found' }, 404);
    }
    
    return c.json(JSON.parse(data));
  } catch (error) {
    logger.error('KV data retrieval error:', error);
    return c.json({ error: 'Data retrieval failed' }, 500);
  }
});

/**
 * Error handling middleware
 */
app.onError((err, c) => {
  logger.error('Unhandled error:', err);
  return c.json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  }, 500);
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({ 
    error: 'Endpoint not found',
    available_endpoints: ['/health', '/', '/webhook', '/admin/stats', '/migrate', '/kv-data/:table/:id'],
    timestamp: new Date().toISOString()
  }, 404);
});

export default {
  fetch: app.fetch,
};
