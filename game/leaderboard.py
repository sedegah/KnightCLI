from datetime import datetime
from typing import List, Tuple
import logging

from config.constants import LEADERBOARD_DISPLAY_COUNT, WEEKLY_REWARDS, LEADERBOARD_TOP_COUNT
from utils.helpers import escape_markdown
from database.models import User, LeaderboardEntry
from database.supabase_client import db

logger = logging.getLogger(__name__)


class LeaderboardManager:
    @staticmethod
    def get_current_leaderboard(limit: int = LEADERBOARD_DISPLAY_COUNT) -> List[LeaderboardEntry]:
        return db.get_weekly_leaderboard(limit=limit)
    
    @staticmethod
    def get_full_leaderboard() -> List[LeaderboardEntry]:
        return db.get_weekly_leaderboard(limit=LEADERBOARD_TOP_COUNT)
    
    @staticmethod
    def format_leaderboard_text(
        leaderboard: List[LeaderboardEntry],
        highlight_user_id: int = None,
        max_display: int = LEADERBOARD_DISPLAY_COUNT
    ) -> str:
        """Format leaderboard for display.
        
        Args:
            leaderboard: List of leaderboard entries
            highlight_user_id: User ID to highlight with an arrow
            max_display: Maximum number of entries to display
        """
        if not leaderboard:
            return "No players yet this week. Be the first!"
        
        text = "🏆 **Weekly Leaderboard**\n\n"
        
        medal_emojis = {1: "🥇", 2: "🥈", 3: "🥉"}
        
        for i, entry in enumerate(leaderboard[:max_display]):
            rank = entry.rank
            medal = medal_emojis.get(rank, f"{rank}.")
            
            highlight = "👉 " if entry.telegram_id == highlight_user_id else ""
            
            username = entry.username if entry.username else "Anonymous"
            username = escape_markdown(username)
            if len(username) > 15:
                username = username[:12] + "..."
            
            text += f"{highlight}{medal} **{username}** - {entry.points:,} pts\n"
        
        if len(leaderboard) > max_display:
            text += f"\n_...and {len(leaderboard) - max_display} more players_"
        
        return text
    
    @staticmethod
    def get_user_position_text(user: User) -> str:
        rank = db.get_user_rank(user.telegram_id)
        
        if rank == 0:
            return "You're not on the leaderboard yet. Start playing to earn your spot!"
        
        text = f"**Your Rank:** {rank}\n"
        text += f"**Your Points:** {user.weekly_points:,}\n\n"
        
        reward = WEEKLY_REWARDS.get(rank)
        if reward:
            if reward["type"] == "cash":
                text += f"🎁 **Potential Reward:** ${reward['amount_usd']:.2f}\n"
            elif reward["type"] == "subscription":
                text += f"🎁 **Potential Reward:** {reward['months']}-month Premium\n"
        
        return text
    
    @staticmethod
    def process_weekly_rewards() -> Tuple[bool, str]:
        """Process end-of-week rewards and reset.
        Should be called by scheduler at end of week.
        
        Returns:
            Tuple of (success, summary_message)
        """
        try:
            leaderboard = LeaderboardManager.get_full_leaderboard()
            
            if not leaderboard:
                return False, "No players this week"
            
            reward_count = 0
            for entry in leaderboard:
                if entry.rank in WEEKLY_REWARDS:
                    reward = WEEKLY_REWARDS[entry.rank]
                    entry.reward_type = reward["type"]
                    entry.reward_value = str(reward.get("amount_usd") or reward.get("months"))
                    entry.reward_status = "pending"
                    reward_count += 1
            
            db.save_weekly_leaderboard(leaderboard)
            
            db.reset_weekly_points()
            
            summary = (
                f"✅ Weekly reset completed!\n"
                f"Total players: {len(leaderboard)}\n"
                f"Rewards assigned: {reward_count}\n"
                f"Leaderboard saved and points reset."
            )
            
            logger.info(summary)
            return True, summary
        
        except Exception as e:
            error_msg = f"Error processing weekly rewards: {e}"
            logger.error(error_msg)
            return False, error_msg
    
    @staticmethod
    def format_rewards_announcement(leaderboard: List[LeaderboardEntry]) -> str:
        text = "🏁 **WEEK ENDED - FINAL STANDINGS**\n\n"
        
        medal_emojis = {1: "🥇", 2: "🥈", 3: "🥉"}
        
        for entry in leaderboard[:10]:
            medal = medal_emojis.get(entry.rank, f"{entry.rank}.")
            username = entry.username if entry.username else "Anonymous"
            username = escape_markdown(username)
            
            text += f"{medal} **{username}** - {entry.points:,} pts\n"
            
            if entry.reward_type == "cash":
                text += f"   💰 Reward: ${entry.reward_value}\n"
            elif entry.reward_type == "subscription":
                text += f"   💎 Reward: {entry.reward_value}-month Premium\n"
            
            text += "\n"
        
        text += "\n🎉 **Congratulations to all winners!**\n"
        text += "Rewards will be distributed within 24 hours.\n\n"
        text += "📅 New week starts now! Keep playing to win!"
        
        return text
    
    @staticmethod
    def get_leaderboard_preview_for_prize_round() -> str:
        leaderboard = LeaderboardManager.get_current_leaderboard(limit=3)
        
        if not leaderboard:
            return "No leaders yet!"
        
        text = ""
        medal_emojis = {1: "🥇", 2: "🥈", 3: "🥉"}
        
        for entry in leaderboard:
            medal = medal_emojis.get(entry.rank, f"{entry.rank}.")
            username = entry.username if entry.username else "Anonymous"
            username = escape_markdown(username)
            text += f"{medal} {username}: {entry.points:,} pts\n"
        
        return text.strip()


leaderboard_manager = LeaderboardManager()


import logging
logger = logging.getLogger(__name__)
