import logging
import sys
import signal
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
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
from bot.admin_commands import admin_commands
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


class HealthCheckHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler for health checks and bot info page."""
    
    def do_GET(self):
        if self.path == "/health":
            # JSON health check for Render
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')
        elif self.path == "/":
            # HTML info page at root
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            
            html = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram Quiz Bot - KnightCLI</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 700px;
            padding: 50px;
            text-align: center;
        }
        h1 {
            color: #667eea;
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            font-size: 1.2em;
            margin-bottom: 30px;
        }
        .features {
            text-align: left;
            margin: 30px 0;
        }
        .feature {
            margin: 15px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 4px solid #667eea;
        }
        .feature-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .feature-desc {
            color: #666;
            font-size: 0.95em;
        }
        .cta {
            margin-top: 40px;
        }
        .telegram-btn {
            display: inline-block;
            background: #0088cc;
            color: white;
            padding: 15px 40px;
            border-radius: 30px;
            text-decoration: none;
            font-size: 1.1em;
            font-weight: bold;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0,136,204,0.3);
        }
        .telegram-btn:hover {
            background: #006699;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,136,204,0.4);
        }
        .status {
            margin-top: 30px;
            padding: 10px;
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 5px;
            color: #155724;
        }
        .emoji { font-size: 1.3em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎮 Telegram Quiz Bot</h1>
        <p class="subtitle">Test Your Knowledge, Win Prizes!</p>
        
        <div class="features">
            <div class="feature">
                <div class="feature-title"><span class="emoji">📚</span> Continuous Play</div>
                <div class="feature-desc">Answer questions anytime, earn Accumulated Points (AP), and build your daily streak!</div>
            </div>
            
            <div class="feature">
                <div class="feature-title"><span class="emoji">🏆</span> Prize Rounds</div>
                <div class="feature-desc">Compete twice daily at 9:00 AM & 9:00 PM UTC for real rewards and Prize Points (PP).</div>
            </div>
            
            <div class="feature">
                <div class="feature-title"><span class="emoji">📊</span> Weekly Leaderboard</div>
                <div class="feature-desc">Climb the rankings and compete with players from around the world!</div>
            </div>
            
            <div class="feature">
                <div class="feature-title"><span class="emoji">💎</span> Premium Features</div>
                <div class="feature-desc">Upgrade for higher points, more attempts, and exclusive bonuses.</div>
            </div>
        </div>
        
        <div class="cta">
            <a href="https://t.me/knight_quiz_bot" class="telegram-btn">
                🚀 Start Playing on Telegram
            </a>
        </div>
        
        <div class="status">
            ✅ Bot Status: Live and Running
        </div>
    </div>
</body>
</html>
            """
            self.wfile.write(html.encode('utf-8'))
        else:
            self.send_response(404)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b'<h1>404 Not Found</h1>')
    
    def log_message(self, format, *args):
        # Suppress default HTTP server logging
        pass


def start_health_check_server():
    """Start HTTP server on configured port for Render health checks."""
    try:
        server = HTTPServer(("0.0.0.0", settings.PORT), HealthCheckHandler)
        logger.info(f"Health check server starting on port {settings.PORT}")
        
        # Run server in daemon thread so it doesn't block bot
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        
        logger.info(f"✓ Health check server running on port {settings.PORT}")
        return server
    except Exception as e:
        logger.error(f"Failed to start health check server: {e}")
        return None


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
    
    # Start health check server for port binding
    health_server = start_health_check_server()
    
    logger.info("Registering handlers...")
    
    application.add_handler(CommandHandler("start", bot_handlers.start_command))
    application.add_handler(CommandHandler("play", bot_handlers.play_command))
    application.add_handler(CommandHandler("stats", bot_handlers.stats_command))
    application.add_handler(CommandHandler("leaderboard", bot_handlers.leaderboard_command))
    application.add_handler(CommandHandler("invite", bot_handlers.invite_command))
    application.add_handler(CommandHandler("subscribe", bot_handlers.subscribe_command))
    application.add_handler(CommandHandler("help", bot_handlers.help_command))
    
    # Admin commands (Phase 1: Manual reward approval)
    application.add_handler(CommandHandler("approve_reward", admin_commands.approve_reward))
    application.add_handler(CommandHandler("pending_rewards", admin_commands.list_pending_rewards))
    application.add_handler(CommandHandler("mark_paid", admin_commands.mark_paid))
    
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
    
    # Set up signal handlers for graceful shutdown
    def signal_handler(sig, frame):
        logger.info(f"Received signal {sig}, stopping gracefully...")
        application.stop()
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    application.run_polling(allowed_updates=Update.ALL_TYPES, stop_signals=(signal.SIGTERM, signal.SIGINT))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n Bot stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
