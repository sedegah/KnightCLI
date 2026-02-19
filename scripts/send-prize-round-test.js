/**
 * Send a test prize round notification to all users in D1.
 */

import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID || '752a111e-1154-4a5b-9854-7784320dc6db';

if (!BOT_TOKEN || !CF_TOKEN || !CF_ACCOUNT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN, CLOUDFLARE_API_TOKEN, or CLOUDFLARE_ACCOUNT_ID in env.');
  process.exit(1);
}

const MESSAGE = `🎊 *G-NEX Prize Round Test!*

This is a test broadcast for the 9:00 AM / 9:00 PM UTC prize rounds.

🏆 Keep playing to qualify
📱 Free data rewards
🇬🇭 Powered by G-NEX`;

async function queryD1(sql, params = []) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql, params })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D1 query failed: ${text}`);
  }

  const data = await response.json();
  return data.result?.[0]?.results || [];
}

async function sendMessage(chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram send failed for ${chatId}: ${err}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    limit: null,
    orderBy: null
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value > 0) {
        config.limit = value;
      }
    } else if (arg.startsWith('--order-by=')) {
      config.orderBy = arg.split('=')[1];
    }
  }

  return config;
}

async function run() {
  const { limit, orderBy } = parseArgs();
  console.log('Fetching users from D1...');

  let sql = 'SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL';
  const params = [];

  if (orderBy) {
    sql += ` ORDER BY ${orderBy} DESC`;
  }

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const users = await queryD1(sql, params);

  console.log(`Found ${users.length} users. Sending test notification...`);
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await sendMessage(user.telegram_id, MESSAGE);
      sent += 1;
      await sleep(40); // basic rate limiting
    } catch (error) {
      failed += 1;
      console.error(error.message);
      await sleep(100);
    }
  }

  console.log(`Done. Sent: ${sent}, Failed: ${failed}`);
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
