from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

from config.settings import settings
from config.constants import MESSAGES
from game.leaderboard import leaderboard_manager

logger = logging.getLogger(__name__)


class PrizeRoundScheduler:
    def __init__(self, bot):
        """Initialize the prize round scheduler.
        
        Args:
            bot: Telegram Bot instance
        """
        self.bot = bot
        self.scheduler = AsyncIOScheduler(timezone=settings.TIMEZONE)
        self.is_prize_round_active = False
        self.current_round_type = None
    
    def start(self):
        self.scheduler.add_job(
            self._start_morning_round,
            CronTrigger(
                hour=settings.PRIZE_ROUND_MORNING_HOUR,
                minute=0,
                timezone=settings.TIMEZONE
            ),
            id="morning_prize_round"
        )
        
        self.scheduler.add_job(
            self._start_evening_round,
            CronTrigger(
                hour=settings.PRIZE_ROUND_EVENING_HOUR,
                minute=0,
                timezone=settings.TIMEZONE
            ),
            id="evening_prize_round"
        )
        
        self.scheduler.add_job(
            self._weekly_reset,
            CronTrigger(
                day_of_week="sun",
                hour=23,
                minute=59,
                timezone=settings.TIMEZONE
            ),
            id="weekly_reset"
        )
        
        morning_warning_hour = settings.PRIZE_ROUND_MORNING_HOUR
        evening_warning_hour = settings.PRIZE_ROUND_EVENING_HOUR
        
        # Warning 5 minutes before prize round (55 minutes of the hour before)
        morning_warning_hour_actual = (settings.PRIZE_ROUND_MORNING_HOUR - 1) % 24
        evening_warning_hour_actual = (settings.PRIZE_ROUND_EVENING_HOUR - 1) % 24
        
        self.scheduler.add_job(
            self._send_prize_round_warning,
            CronTrigger(
                hour=morning_warning_hour_actual,
                minute=55,
                timezone=settings.TIMEZONE
            ),
            kwargs={"round_type": "morning"},
            id="morning_warning"
        )
        
        self.scheduler.add_job(
            self._send_prize_round_warning,
            CronTrigger(
                hour=evening_warning_hour_actual,
                minute=55,
                timezone=settings.TIMEZONE
            ),
            kwargs={"round_type": "evening"},
            id="evening_warning"
        )
        
        self.scheduler.start()
        logger.info("Prize round scheduler started")
    
    def stop(self):
        self.scheduler.shutdown()
        logger.info("Prize round scheduler stopped")
    
    async def _start_morning_round(self):
        await self._start_prize_round("morning")
    
    async def _start_evening_round(self):
        await self._start_prize_round("evening")
    
    async def _start_prize_round(self, round_type: str):
        """Start a prize round and broadcast to users.
        
        Args:
            round_type: "morning" or "evening"
        """
        self.is_prize_round_active = True
        self.current_round_type = round_type
        
        logger.info(f"Starting {round_type} prize round")
        
        leaderboard_preview = leaderboard_manager.get_leaderboard_preview_for_prize_round()
        
        message = (
            f"🏆 **{round_type.upper()} PRIZE ROUND STARTED!**\n\n"
            f"Compete for the top spots and win rewards!\n\n"
            f"**Duration:** 30 minutes\n"
            f"**Questions:** 10 special questions\n"
            f"**Higher Points:** PP (Prize Points)\n\n"
            f"**Current Leaders:**\n{leaderboard_preview}\n\n"
            f"Tap /play to join now! ⚡"
        )
        
        await self._broadcast_to_all_users(message)
        
        self.scheduler.add_job(
            self._end_prize_round,
            "date",
            run_date=datetime.now(settings.TIMEZONE) + timedelta(minutes=30),
            kwargs={"round_type": round_type},
            id=f"end_{round_type}_round"
        )
    
    async def _end_prize_round(self, round_type: str):
        self.is_prize_round_active = False
        self.current_round_type = None
        
        logger.info(f"Ending {round_type} prize round")
        
        leaderboard = leaderboard_manager.get_current_leaderboard(limit=10)
        leaderboard_text = leaderboard_manager.format_leaderboard_text(leaderboard)
        
        if round_type == "morning":
            next_round = "Evening (9:00 PM UTC)"
        else:
            next_round = "Tomorrow Morning (9:00 AM UTC)"
        
        message = (
            f"🏁 **{round_type.upper()} PRIZE ROUND ENDED!**\n\n"
            f"{leaderboard_text}\n\n"
            f"Great work everyone! Keep playing to maintain your rank.\n\n"
            f"**Next Prize Round:** {next_round}"
        )
        
        await self._broadcast_to_all_users(message)
    
    async def _send_prize_round_warning(self, round_type: str):
        logger.info(f"Sending {round_type} prize round warning")
        
        message = MESSAGES["prize_round_starting"]
        
        await self._broadcast_to_all_users(message)
    
    async def _weekly_reset(self):
        logger.info("Starting weekly reset")
        
        leaderboard = leaderboard_manager.get_full_leaderboard()
        
        if leaderboard:
            announcement = leaderboard_manager.format_rewards_announcement(leaderboard)
            
            await self._broadcast_to_all_users(announcement)
        
        success, summary = leaderboard_manager.process_weekly_rewards()
        
        if success:
            logger.info(f"Weekly reset completed: {summary}")
            
            for admin_id in settings.ADMIN_TELEGRAM_IDS:
                try:
                    await self.bot.send_message(
                        chat_id=admin_id,
                        text=f"📊 **Weekly Reset Summary**\n\n{summary}",
                        parse_mode="Markdown"
                    )
                except Exception as e:
                    logger.error(f"Failed to notify admin {admin_id}: {e}")
        else:
            logger.error(f"Weekly reset failed: {summary}")
    
    async def _broadcast_to_all_users(self, message: str):
        """Broadcast a message to all users.
        
        Args:
            message: Message text to send
        """
        from database.supabase_client import db

        try:
            users = db.get_users_for_notifications()

            sent_count = 0
            failed_count = 0

            for user in users:
                telegram_id = user.get("telegram_id")
                if not telegram_id:
                    continue

                try:
                    await self.bot.send_message(
                        chat_id=telegram_id,
                        text=message,
                        parse_mode="Markdown"
                    )
                    sent_count += 1
                except Exception as e:
                    failed_count += 1
                    logger.warning(f"Failed to send to {telegram_id}: {e}")

            logger.info(f"Broadcast complete: {sent_count} sent, {failed_count} failed")

        except Exception as e:
            logger.error(f"Broadcast failed: {e}")
    
    def is_prize_round_active_now(self) -> bool:
        return self.is_prize_round_active
