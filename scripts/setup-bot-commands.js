/**
 * Setup Bot Commands Script
 * Registers commands with Telegram Bot API for interface menu
 * Run this once after setting up the bot
 */

import { setMyCommands } from '../src/utils/telegram.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const commands = [
  { command: 'start', description: 'Register and begin your journey' },
  { command: 'play', description: 'Answer a quiz question' },
  { command: 'arena', description: 'Access competitive game modes' },
  { command: 'rewards', description: 'View data rewards and prizes' },
  { command: 'streak', description: 'Check your daily streak rewards' },
  { command: 'referral', description: 'Get your referral link and rewards' },
  { command: 'stats', description: 'View your game statistics' },
  { command: 'leaderboard', description: 'See top players' },
  { command: 'help', description: 'Show help information' }
];

async function setupCommands() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN not found in environment variables');
    console.error('Please set TELEGRAM_BOT_TOKEN in your .env file');
    process.exit(1);
  }

  console.log('🤖 Setting up bot commands...');
  console.log('Commands to register:', commands.map(c => `/${c.command}`).join(', '));

  const result = await setMyCommands(botToken, commands);

  if (result && result.ok) {
    console.log('✅ Bot commands registered successfully!');
    console.log('Users can now see these commands in the Telegram interface.');
  } else {
    console.error('❌ Failed to register bot commands');
    console.error('Response:', result);
    process.exit(1);
  }
}

setupCommands();
