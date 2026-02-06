from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

from config.settings import settings
from config.constants import MESSAGES
from database.sheets_client import db

logger = logging.getLogger(__name__)


class ReminderScheduler:
    def __init__(self, bot):
        Initialize the reminder scheduler.
        
        Args:
            bot: Telegram Bot instance
        self.bot = bot
        self.scheduler = AsyncIOScheduler(timezone=settings.TIMEZONE)
    
    def start(self):
        self.scheduler.add_job(
            self._send_daily_reminders,
            CronTrigger(
                hour=settings.DAILY_REMINDER_HOUR,
                minute=0,
                timezone=settings.TIMEZONE
            ),
            id="daily_reminders"
        )
        
        self.scheduler.start()
        logger.info("Reminder scheduler started")
    
    def stop(self):
        self.scheduler.shutdown()
        logger.info("Reminder scheduler stopped")
    
    async def _send_daily_reminders(self):
        logger.info("Starting daily reminder process")
        
        try:
            worksheet = db._get_worksheet("users")
            records = worksheet.get_all_values()
            
            today = datetime.utcnow().date()
            sent_count = 0
            
            for row in records[1:]:
                if not row or len(row) < 8:
                    continue
                
                try:
                    telegram_id = int(row[0])
                    username = row[1]
                    streak = int(row[6]) if row[6] else 0
                    last_played = row[7]
                    
                    if last_played:
                        try:
                            last_played_date = datetime.fromisoformat(last_played).date()
                            if last_played_date >= today:
                                continue
                        except:
                            pass
                    
                    reminder_text = MESSAGES["daily_reminder"].format(
                        streak=streak
                    )
                    
                    await self.bot.send_message(
                        chat_id=telegram_id,
                        text=reminder_text,
                        parse_mode="Markdown"
                    )
                    
                    sent_count += 1
                    logger.info(f"Sent reminder to {telegram_id} ({username})")
                
                except Exception as e:
                    logger.warning(f"Failed to send reminder: {e}")
            
            logger.info(f"Daily reminders sent: {sent_count}")
        
        except Exception as e:
            logger.error(f"Daily reminder process failed: {e}")
    
    async def send_custom_reminder(self, telegram_id: int, message: str):
        Send a custom reminder to a specific user.
        
        Args:
            telegram_id: User's Telegram ID
            message: Message text
        try:
            await self.bot.send_message(
                chat_id=telegram_id,
                text=message,
                parse_mode="Markdown"
            )
            logger.info(f"Sent custom reminder to {telegram_id}")
        except Exception as e:
            logger.error(f"Failed to send custom reminder to {telegram_id}: {e}")
