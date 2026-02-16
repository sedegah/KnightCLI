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
  welcome: `🎮 **Welcome to G-NEX Quiz Game!**

Play quizzes, earn points, and win prizes!

**Two Ways to Play:**

📚 **Continuous Play** (All Day)
• Answer questions anytime
• Earn Accumulated Points (AP)
• Build your streak
• Climb the leaderboard

🏆 **Prize Rounds** (2x Daily)
• 9:00 AM & 9:00 PM UTC
• Earn Prize Points (PP)
• Win real rewards
• Speed matters!

Use the menu below to start playing or check your stats!`,

  stats: `📊 **Your Stats**

**Points**
• AP: {ap} (Total: {totalAp})
• PP: {pp}
• Weekly: {weeklyPoints}

**Performance**
• Streak: {streak} days 🔥
• Questions: {totalQuestions}
• Accuracy: {accuracy}%
• Rank: {rank}

**Status**: {userType}`,

  prizeRoundActive: `🏆 **PRIZE ROUND ACTIVE!**

Prize Round is now live for {duration} minutes!

• Earn Prize Points (PP)
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

The correct answer was: **{correctAnswer}**

Don't give up! Keep playing to improve! 💪`,

  streakBroken: `💔 **Streak Broken**

Your {streak}-day streak has ended.

Don't worry! Start a new streak by playing today!`,

  leaderboard: `🏆 **Weekly Leaderboard**

{entries}

{userPosition}

Keep playing to climb the rankings!`,

  help: `❓ **How to Play**

**Commands:**
/start - Register and begin
/play - Answer a question
/stats - View your statistics
/leaderboard - See top players
/help - Show this message

**Game Modes:**
• Continuous Play: Build streaks, earn AP
• Prize Rounds: Compete for real rewards

**Tips:**
• Answer quickly for speed bonuses
• Play daily to maintain your streak
• Upgrade for more attempts and points

Good luck! 🍀`
};

export const BUTTON_LABELS = {
  play: '🎮 Play Now',
  stats: '📊 My Stats',
  leaderboard: '🏆 Leaderboard',
  help: '❓ Help',
  subscribe: '💎 Upgrade to Premium',
  back: '◀️ Back'
};
