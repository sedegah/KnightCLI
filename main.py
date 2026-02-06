import logging
import sys
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters
)

from config.settings import settings
from bot.handlers import bot_handlers
from bot.callbacks import callback_handlers
from scheduler.prize_rounds import PrizeRoundScheduler
from scheduler.reminders import ReminderScheduler
from database.sheets_client import db

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=getattr(logging, settings.LOG_LEVEL)
)
logger = logging.getLogger(__name__)


async def error_handler(update: Update, context):
    logger.error(f"Update {update} caused error {context.error}")
    
    try:
        if update and update.effective_message:
            await update.effective_message.reply_text(
                "⚠️ An error occurred. Please try again later."
            )
    except Exception as e:
        logger.error(f"Error in error handler: {e}")


async def post_init(application: Application):
    logger.info("Starting schedulers...")
    
    prize_scheduler = PrizeRoundScheduler(application.bot)
    prize_scheduler.start()
    application.bot_data["prize_scheduler"] = prize_scheduler
    
    reminder_scheduler = ReminderScheduler(application.bot)
    reminder_scheduler.start()
    application.bot_data["reminder_scheduler"] = reminder_scheduler
    
    logger.info("Schedulers started successfully")


async def post_shutdown(application: Application):
    logger.info("Stopping schedulers...")
    
    if "prize_scheduler" in application.bot_data:
        application.bot_data["prize_scheduler"].stop()
    
    if "reminder_scheduler" in application.bot_data:
        application.bot_data["reminder_scheduler"].stop()
    
    logger.info("Schedulers stopped")


def main():
    logger.info("="*50)
    logger.info("Telegram Quiz Bot Starting...")
    logger.info("="*50)
    
    validation_errors = settings.validate()
    if validation_errors:
        logger.error("Configuration errors:")
        for error in validation_errors:
            logger.error(f"  - {error}")
        logger.error("\nPlease fix configuration and try again.")
        sys.exit(1)
    
    logger.info("Checking database connection...")
    if not db.health_check():
        logger.error("Failed to connect to Google Sheets database")
        logger.error("Please run 'python scripts/setup_sheets.py' first")
        sys.exit(1)
    logger.info("✓ Database connection OK")
    
    if not db.has_write_access:
        logger.warning("")
        logger.warning("⚠️  READ-ONLY MODE ENABLED ⚠️")
        logger.warning("Database is operating in read-only mode because no service account credentials were provided.")
        logger.warning("User data will NOT be persisted. To enable full functionality:")
        logger.warning("  1. Create a service account in Google Cloud Console")
        logger.warning("  2. Share your Google Sheet with the service account email")
        logger.warning("  3. Provide credentials via GOOGLE_CREDENTIALS_JSON environment variable")
        logger.warning("")
    
    logger.info(f"Creating bot application...")
    application = (
        Application.builder()
        .token(settings.TELEGRAM_BOT_TOKEN)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )
    
    logger.info("Registering handlers...")
    
    application.add_handler(CommandHandler("start", bot_handlers.start_command))
    application.add_handler(CommandHandler("play", bot_handlers.play_command))
    application.add_handler(CommandHandler("stats", bot_handlers.stats_command))
    application.add_handler(CommandHandler("leaderboard", bot_handlers.leaderboard_command))
    application.add_handler(CommandHandler("invite", bot_handlers.invite_command))
    application.add_handler(CommandHandler("subscribe", bot_handlers.subscribe_command))
    application.add_handler(CommandHandler("help", bot_handlers.help_command))
    
    application.add_handler(CallbackQueryHandler(callback_handlers.handle_callback))
    
    application.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            bot_handlers.handle_text_message
        )
    )
    
    application.add_error_handler(error_handler)
    
    logger.info("✓ Handlers registered")
    
    logger.info("="*50)
    logger.info("Bot is running!")
    logger.info("="*50)
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"Prize rounds: {settings.PRIZE_ROUND_MORNING_HOUR}:00 & {settings.PRIZE_ROUND_EVENING_HOUR}:00 UTC")
    logger.info(f"Timezone: {settings.TIMEZONE}")
    logger.info("="*50)
    
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n Bot stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
