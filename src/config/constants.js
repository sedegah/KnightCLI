/**
 * Application Constants and Messages
 */

export const UserType = {
  FREE: 'free',
  SUBSCRIBER: 'subscriber'
};

export const QuestionType = {
  CONTINUOUS: 'continuous',
  PRIZE_ROUND: 'prize_round'
};

export const PointType = {
  AP: 'ap',
  PP: 'pp'
};

export const MESSAGES = {
  welcome: `👋 Welcome to **I-Crush Quiz Game**!

Test your knowledge and win prizes!

*Powered by G-NEX*`,

  stats_template: `📊 **Your Stats**

**Points**
• Arena Points: {ap} (Total: {totalAp})
• Prize Points: {pp}
• Weekly: {weeklyPoints}

**Performance**
• Streak: {streak} days 🔥
• Questions: {totalQuestions}
• Correct: {correctAnswers}
• Accuracy: {accuracy}%

**User Type:** {userType}
**Rank:** {rank}`,

  subscribe_info: `💎 **Go Premium**

**Premium Benefits:**
• 40 questions/hour (vs 20 free)
• +7 speed bonus points
• Exclusive premium questions
• Priority support
• Special tournaments

**Pricing:**
🇬🇭 Ghana: 5 GHS/month
🌍 International: $3/month

Ready to upgrade? Contact @icrush_support`,

  invite_message: `🤝 **Share Your Referral Link**

Your unique referral code: {referral_code}

**How it works:**
1. Share this link with friends
2. They use /start {referral_code}
3. You earn rewards when they play!

**Your Referral Stats:**
• Total Referrals: {referral_count}
• Pending Rewards: {pending_rewards}

**Share Options:**
• Copy your code above
• Share in groups and social media
• Invite friends directly

Start referring and earning today! 🚀`,

  prizeRoundActive: `🏆 **PRIZE ROUND ACTIVE!**

Prize Round is now live for {duration} minutes!

• Earn Prize Points
• Speed bonuses active
• Win real rewards

Play now to compete!`,

  rateLimit: `⏱️ **Rate Limit Reached**

You've reached your hourly question limit.

**Your Limits:**
• Free: 20 questions/hour
• Premium: 40 questions/hour

⏰ Try again in a few minutes or upgrade to Premium!`,

  correctAnswer: `✅ **Correct!**

{breakdown}

Keep up the great work! 🎉`,

  wrongAnswer: `❌ **Incorrect**

The correct answer was: {correctAnswer}

Don't give up! Keep playing to improve! 💪`,

  streakBroken: `💔 **Streak Broken**

Your {streak}-day streak has ended.

Don't worry! Start a new streak by playing today!`,

  leaderboard: `🏆 **Weekly Leaderboard**

{entries}

{userPosition}

Keep playing to climb the rankings!`,

  help: `🇬🇭 *G-NEX: Ghana's Competitive Data Quiz Arena*
Test Your Knowledge, Win Free Data, Dominate the Leaderboard!

🎮 *Game Features*
🏟️ Multiple Game Modes: 1v1 Challenges, Partner Mode, Squad Battles
🏆 Competitive Rankings: Bronze → Silver → Gold → Diamond → Elite
🔥 Streak Rewards: Build daily streaks for bonus points and data
💰 Points Economy: Earn and spend points on premium features
🎁 Data Rewards: Win free mobile data (MTN, Vodafone, AirtelTigo, GLO)
🇬🇭 Ghana-Focused: Local culture, sports, music, and current affairs

📱 *Platform*
Telegram Bot • No downloads • Instant play

🎯 *Focus*
Ghana Market • Local content • Free data prizes

⚡ *Technology*
Cloudflare Workers • Global edge • High performance

*Commands:*
/start - Register and begin your journey
/play - Answer a question and earn points
/arena - Challenge another player
/rewards - Claim your data rewards
/streak - Check your daily streak
/referral - Invite friends and earn bonuses
/stats - View your personal statistics
/leaderboard - See top players globally
/help - Show this help message

*How to Play:*
1. Tap "▶️ Play Quiz" to get a question
2. Select your answer (A, B, C, or D)
3. Earn points for correct answers
4. Build your streak by playing daily
5. Compete for top spots on the leaderboard
6. Win free mobile data weekly!

*Prize Rounds:*
• 9:00 AM UTC - Morning Round
• 9:00 PM UTC - Evening Round
Top players win prizes! 🏆

🚀 *Ready to Play?*
Start Playing on Telegram

*Bot Status:* ✅ Live and Running
Powered by Cloudflare Workers • Made with ❤️ for Ghana 🇬🇭

*Need Support?*
Contact @admin for help.`,

  subscribe_prompt: `💎 **Upgrade to Premium**

Get more from your quiz experience!

**Premium Benefits:**
• 40 questions/hour (vs 20 free)
• +7 speed bonus points
• Exclusive premium questions
• Priority support
• Special tournaments

**Ready to upgrade?** Contact @icrush_support`
};

export const BUTTON_LABELS = {
  play: '🎮 Play Now',
  stats: '📊 My Stats',
  leaderboard: '🏆 Leaderboard',
  help: '❓ Help',
  subscribe: '💎 Upgrade to Premium',
  back: '◀️ Back'
};
