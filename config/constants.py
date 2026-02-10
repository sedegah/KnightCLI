from enum import Enum


class UserType(Enum):
    FREE = "free"
    SUBSCRIBER = "subscriber"


class QuestionType(Enum):
    CONTINUOUS = "continuous"
    PRIZE_ROUND = "prize_round"


class PointType(Enum):
    AP = "ap"
    PP = "pp"

SCORING = {
    UserType.FREE: {
        QuestionType.CONTINUOUS: {
            "correct": 5,
            "wrong": 0,
            "speed_bonus_max": 0,
        },
        QuestionType.PRIZE_ROUND: {
            "correct": 10,
            "wrong": 0,
            "speed_bonus_max": 5,
            "attempts": 1,
        },
    },
    UserType.SUBSCRIBER: {
        QuestionType.CONTINUOUS: {
            "correct": 8,
            "wrong": 0,
            "speed_bonus_max": 0,
        },
        QuestionType.PRIZE_ROUND: {
            "correct": 15,
            "wrong": 0,
            "speed_bonus_max": 7,
            "attempts": 2,
            "second_attempt_multiplier": 0.8,
        },
    },
}

STREAK_BONUSES = {
    3: 5,
    7: 15,
    30: 50,
}

RATE_LIMITS = {
    UserType.FREE: {
        "hourly": 20,
        "daily": 200,
    },
    UserType.SUBSCRIBER: {
        "hourly": 40,
        "daily": 400,
    },
}

QUESTION_TIME_LIMIT_SECONDS = 30
SPEED_BONUS_THRESHOLD_SECONDS = 10

PRIZE_ROUND_DURATION_MINUTES = 30
PRIZE_ROUND_QUESTION_COUNT = 10

ANTI_CHEAT = {
    "min_answer_time_seconds": 2,
    "max_correct_streak_before_review": 50,
    "max_hourly_requests": 100,
}

LEADERBOARD_TOP_COUNT = 50
LEADERBOARD_DISPLAY_COUNT = 10

WEEKLY_REWARDS = {
    1: {"type": "cash", "amount_usd": 100},
    2: {"type": "cash", "amount_usd": 50},
    3: {"type": "cash", "amount_usd": 25},
    **{rank: {"type": "subscription", "months": 1} for rank in range(4, 11)},
}

MESSAGES = {
    "welcome": """🎮 **Welcome to Telegram Quiz Game!**

Play quizzes, earn points, and win prizes!

**Two Ways to Play:**

📚 **Continuous Play** (All Day)
• Answer questions anytime
• Earn Accumulated Points (AP)
• Build your streak
• Climb the leaderboard

🏆 **Prize Rounds** (2x Daily)
• 9:00 AM & 9:00 PM UTC
• Compete for real rewards
• Earn Prize Points (PP)
• Top players win!

**Your Status:** Free User
• +5 AP per correct answer
• 20 questions per hour

💎 **Upgrade to Premium** for:
• +8 AP per correct answer
• +15 PP in prize rounds
• 40 questions per hour
• 2 attempts per prize question
• Higher speed bonuses

Tap /play to start!""",
    
    "subscribe_info": """💎 **Premium Subscription Benefits**

**Higher Points:**
• +8 AP per correct answer (vs 5 free)
• +15 PP in prize rounds (vs 10 free)

**More Attempts:**
• 2 attempts per prize question
• 40 questions per hour (vs 20 free)

**Better Bonuses:**
• Up to +7 speed bonus (vs +5 free)
• 80% points on 2nd attempt

**Price:** $4.99/month

Ready to upgrade? Contact @admin to subscribe!""",
    
    "stats_template": """📊 **Your Statistics**

**Points:**
• Current Week AP: {ap}
• Lifetime AP: {total_ap}
• Prize Points (PP): {pp}
• Weekly Points: {weekly_points}

**Activity:**
• Current Streak: {streak} days
• Questions Answered: {total_questions}
• Correct Answers: {correct_answers}
• Accuracy: {accuracy}%

**Status:** {user_type}
**Weekly Rank:**

Keep playing to climb the leaderboard! 🚀""",
    
    "leaderboard_header": """🏆 **Weekly Leaderboard**

Top players this week:
You've answered {count} questions in the past hour.

**Your Limit:** {limit} questions/hour

{upgrade_message}

Try again in {wait_minutes} minutes.""",
    
    "question_template": """❓ **Question {number}**

{question_text}

{sponsor_tag}

⏱️ Answer within {time_limit} seconds for max points!""",
    
    "correct_answer": """✅ **Correct!**

**Points Earned:** +{points}
{speed_bonus_text}
{streak_bonus_text}

**Your Total:** {total_points} {point_type}
**Weekly Rank:**

{next_action}""",
    
    "wrong_answer": """❌ **Incorrect**

The correct answer was: {correct_answer}

{attempts_remaining_text}

Keep practicing! Tap /play to continue.""",
    
    "prize_round_starting": """🚨 **PRIZE ROUND STARTING!**

Get ready! Prize round begins in 5 minutes.

**Details:**
• Duration: 30 minutes
• Questions: 10
• Top players win rewards!

Good luck! 🍀""",
    
    "prize_round_active": """🏆 **PRIZE ROUND ACTIVE!**

**Time Remaining:** {minutes} minutes

Current leaders:
{leaderboard_preview}

Tap /play to compete!""",
    
    "prize_round_ended": """🏁 **Prize Round Ended!**

**Final Leaderboard:**
{final_leaderboard}

**Rewards will be distributed within 24 hours.**

Next prize round: {next_round_time}""",
    
    "invite_message": """🤝 **Invite Friends!**

Share this link with friends:
{referral_link}

**Referral Bonus:** +10 AP for each friend who joins and plays 5 questions!

**Your Referrals:** {referral_count}""",
    
    "daily_reminder": """👋 **Daily Reminder**

You haven't played today! Your streak is at risk.

Current Streak: {streak} days
Don't break it! 🔥

Tap /play to continue your streak.""",
    
    "suspicious_activity": """⚠️ **Account Review**

Your account has been flagged for suspicious activity. A moderator will review your account.

If this is an error, please contact @admin.""",
}

BUTTON_LABELS = {
    "play": "▶️ Play Quiz",
    "leaderboard": "🏆 Leaderboard",
    "stats": "👤 My Stats",
    "invite": "🤝 Invite Friends",
    "subscribe": "💎 Go Premium",
    "help": "❓ Help",
}

SHEET_NAMES = {
    "users": "users",
    "questions": "questions",
    "attempts": "attempts",
    "leaderboard": "leaderboard_weekly",
    "rewards": "rewards",
    "referrals": "referrals",
}

COLUMNS = {
    "users": [
        "telegram_id", "username", "full_name", "ap", "pp", "weekly_points",
        "streak", "last_played_date", "subscription_status", "subscription_expires",
        "total_questions", "correct_answers", "created_at", "referral_code",
        "referred_by", "is_banned", "suspicious_flags"
    ],
    "questions": [
        "question_id", "category", "question_text", "image_url", "option_a", "option_b",
        "option_c", "option_d", "correct_option", "difficulty", "time_limit_seconds",
        "scheduled_date", "used", "sponsor_name"
    ],
    "attempts": [
        "attempt_id", "telegram_id", "question_id", "selected_option",
        "is_correct", "response_time_seconds", "points_awarded", "point_type",
        "attempt_number", "timestamp"
    ],
    "leaderboard": [
        "week_number", "year", "telegram_id", "username", "points", "rank",
        "reward_type", "reward_value", "reward_status"
    ],
    "rewards": [
        "reward_id", "period_type", "period_value", "rank_min", "rank_max",
        "reward_type", "reward_value", "status"
    ],
    "referrals": [
        "referrer_telegram_id", "referred_telegram_id", "referral_code",
        "signup_date", "qualified", "bonus_awarded"
    ],
}
