/**
 * I-Crush Quiz Game - Cloudflare Workers Entry Point
 * Complete edge-optimized implementation
 * Powered by G-NEX
 */

import { Hono } from 'hono';
import { handleTelegramUpdate } from './bot/updateHandler.js';
import { D1Database } from './database/d1-client.js';
import { PrizeRoundManager } from './prize-rounds/prizeRoundManager.js';
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
    :root {
      --bg: #07090d;
      --panel: rgba(255, 255, 255, 0.04);
      --line: rgba(255, 255, 255, 0.14);
      --text: #f5f7ff;
      --muted: #a6adbb;
      --accent: #77f7d1;
      --accent-2: #86a9ff;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      color: var(--text);
      background:
        radial-gradient(60rem 30rem at 10% -10%, rgba(134, 169, 255, 0.20), transparent 55%),
        radial-gradient(50rem 30rem at 95% -5%, rgba(119, 247, 209, 0.20), transparent 50%),
        var(--bg);
      padding: 32px 18px;
    }

    .shell {
      max-width: 1040px;
      margin: 0 auto;
    }

    .hero {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    }

    .badge {
      width: fit-content;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
      background: rgba(119, 247, 209, 0.10);
      border: 1px solid rgba(119, 247, 209, 0.25);
      border-radius: 999px;
      padding: 6px 10px;
      margin-bottom: 14px;
    }

    h1 {
      margin: 0 0 10px;
      font-size: clamp(1.7rem, 4vw, 3rem);
      line-height: 1.08;
      letter-spacing: -0.02em;
      max-width: 18ch;
    }

    .lead {
      margin: 0;
      color: var(--muted);
      font-size: clamp(0.98rem, 1.6vw, 1.15rem);
      max-width: 58ch;
    }

    .actions {
      margin-top: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .btn {
      text-decoration: none;
      color: #041318;
      background: linear-gradient(90deg, var(--accent), #b9ffe6);
      padding: 11px 16px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .btn-secondary {
      text-decoration: none;
      color: var(--text);
      background: transparent;
      border: 1px solid var(--line);
      padding: 11px 16px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
    }

    .grid {
      margin-top: 16px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 12px;
    }

    .card {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
      background: var(--panel);
    }

    .card h3 {
      margin: 0 0 8px;
      font-size: 14px;
      color: #d8deea;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
      font-size: 14px;
    }

    .meta {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      color: #8d95a6;
      font-size: 13px;
    }

    .meta a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }

    .meta a:hover {
      text-decoration: underline;
    }

    .commands {
      margin-top: 14px;
      border: 1px dashed rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      padding: 10px 12px;
      color: #b8c0d0;
      font-size: 13px;
      background: rgba(255, 255, 255, 0.02);
    }

    code {
      color: var(--accent-2);
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="badge">Live on Cloudflare Workers</div>
      <h1>G-NEX: Ghana's Competitive Data Quiz Arena</h1>
      <p class="lead">Test your knowledge, build streaks, and compete for free data rewards across solo play and multiplayer challenge modes.</p>

      <div class="actions">
        <a href="https://t.me/codecadencebot" class="btn">Start on Telegram</a>
        <a href="/health" class="btn-secondary">Check System Health</a>
      </div>

      <div class="commands">
        Commands: <code>/start</code> · <code>/play</code> · <code>/arena</code> · <code>/rewards</code> · <code>/streak</code> · <code>/referral</code>
      </div>

      <div class="grid">
        <article class="card">
          <h3>Game Modes</h3>
          <p>1v1 challenges, partner mode, and squad battles keep competition fresh.</p>
        </article>
        <article class="card">
          <h3>Rankings</h3>
          <p>Climb from Bronze to Elite through weekly points, consistency, and skill.</p>
        </article>
        <article class="card">
          <h3>Rewards</h3>
          <p>Top players earn free data rewards across MTN, Vodafone, AirtelTigo, and GLO.</p>
        </article>
        <article class="card">
          <h3>Built for Ghana</h3>
          <p>Local-first questions, culture, and current affairs delivered via Telegram.</p>
        </article>
      </div>

      <div class="meta">
        <span>Bot Status: ✅ Live</span>
        <span>Developed by Kimathi Sedegah • <a href="https://www.kimathi.tech/" target="_blank" rel="noopener noreferrer">Portfolio</a></span>
      </div>
    </section>
  </main>
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
    // Temporarily disable verification for debugging
    // const isValid = verifyTelegramRequest(c.req.raw, c.env.WEBHOOK_SECRET);
    // if (!isValid) {
    //   logger.warn('Invalid webhook request received');
    //   return c.json({ error: 'Unauthorized' }, 401);
    // }

    // Parse update with size limit
    const update = await c.req.json();
    
    console.log('Webhook received:', { 
      messageType: update.message ? 'message' : update.callback_query ? 'callback' : 'unknown',
      text: update.message?.text || update.callback_query?.data,
      userId: update.message?.from?.id || update.callback_query?.from?.id
    });
    
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
 * Test endpoint to trigger prize round notification
 */
app.get('/admin/test-prize-round', async (c) => {
  try {
    const db = new D1Database(c.env);
    const prizeManager = new PrizeRoundManager(db, c.env.TELEGRAM_BOT_TOKEN);
    
    // Get the round type from query param (default: MORNING)
    const roundType = c.req.query('type')?.toUpperCase() || 'MORNING';
    
    logger.info(`📢 Manual Prize Round Test - Type: ${roundType}`);
    
    let result;
    if (roundType === 'MORNING') {
      result = await prizeManager.runMorningRound();
    } else if (roundType === 'EVENING') {
      result = await prizeManager.runEveningRound();
    } else {
      return c.json({ error: 'Invalid round type. Use MORNING or EVENING' }, 400);
    }
    
    return c.json({
      success: true,
      message: 'Prize round test completed',
      result
    });
  } catch (error) {
    logger.error('Test prize round error:', error);
    return c.json({ 
      error: 'Test failed', 
      message: error.message 
    }, 500);
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
  async scheduled(event, env, ctx) {
    try {
      const db = new D1Database(env);
      const prizeManager = new PrizeRoundManager(db, env.TELEGRAM_BOT_TOKEN);
      const scheduledTime = event?.scheduledTime ? new Date(event.scheduledTime) : new Date();
      const hour = scheduledTime.getUTCHours();

      if (hour === 9) {
        ctx.waitUntil(prizeManager.startRound('MORNING'));
      } else if (hour === 11) {
        ctx.waitUntil(prizeManager.endRound('MORNING'));
      } else if (hour === 12) {
        ctx.waitUntil(prizeManager.releaseRoundResults('MORNING', scheduledTime));
      } else if (hour === 21) {
        ctx.waitUntil(prizeManager.startRound('EVENING'));
      } else if (hour === 23) {
        ctx.waitUntil(prizeManager.endRound('EVENING'));
      } else if (hour === 0) {
        ctx.waitUntil(prizeManager.releaseRoundResults('EVENING', scheduledTime));
      } else {
        logger.info(`No prize round scheduled for hour ${hour} UTC`);
      }
    } catch (error) {
      logger.error('Prize round cron failed:', error);
    }
  }
};
