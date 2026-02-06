from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
import logging

from database.sheets_client import db
from database.models import User
from config.constants import MESSAGES, BUTTON_LABELS
from config.settings import settings
from bot.keyboards import Keyboards
from game.questions import question_manager
from game.leaderboard import leaderboard_manager

logger = logging.getLogger(__name__)


class BotHandlers:
    @staticmethod
    async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_data = update.effective_user
        telegram_id = user_data.id
        username = user_data.username or f"user_{telegram_id}"
        full_name = user_data.full_name or username
        
        user = db.get_user(telegram_id)
        
        if user:
            await update.message.reply_text(
                f"Welcome back, {user.full_name}! 👋\n\n"
                f"Your Points: {user.ap} AP | {user.pp} PP\n"
                f"Streak: {user.streak} days 🔥\n\n"
                f"Ready to play?",
                reply_markup=Keyboards.main_menu(),
                parse_mode=ParseMode.MARKDOWN
            )
        else:
            referred_by = ""
            if context.args and len(context.args) > 0:
                referral_code = context.args[0]
                referrer = db.get_user_by_referral_code(referral_code)
                if referrer:
                    referred_by = referral_code
                    logger.info(f"New user {telegram_id} referred by code: {referral_code}")
            
            user = db.create_user(
                telegram_id=telegram_id,
                username=username,
                full_name=full_name,
                referred_by=referred_by
            )
            
            if referred_by:
                from database.models import Referral
                referrer = db.get_user_by_referral_code(referred_by)
                if referrer:
                    referral = Referral(
                        referrer_telegram_id=referrer.telegram_id,
                        referred_telegram_id=telegram_id,
                        referral_code=referred_by
                    )
                    db.create_referral(referral)
            
            await update.message.reply_text(
                MESSAGES["welcome"],
                reply_markup=Keyboards.main_menu(),
                parse_mode=ParseMode.MARKDOWN
            )
        
        logger.info(f"User {telegram_id} ({username}) started the bot")
    
    @staticmethod
    async def play_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        telegram_id = update.effective_user.id
        user = db.get_user(telegram_id)
        
        if not user:
            await update.message.reply_text(
                "Please use /start to register first!",
                reply_markup=Keyboards.main_menu()
            )
            return
        
        question, error = question_manager.get_question_for_user(user, is_prize_round=False)
        
        if error:
            await update.message.reply_text(
                error,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=Keyboards.subscribe_prompt() if "Rate Limit" in error else Keyboards.main_menu()
            )
            return
        
        question_text = question_manager.format_question_text(question)
        await update.message.reply_text(
            question_text,
            reply_markup=Keyboards.question_options(question),
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        telegram_id = update.effective_user.id
        user = db.get_user(telegram_id)
        
        if not user:
            await update.message.reply_text("Please use /start to register first!")
            return
        
        rank = db.get_user_rank(telegram_id)
        rank_text = f"
        
        user_type = "💎 Premium Subscriber" if user.is_subscriber else "Free User"
        
        stats_text = MESSAGES["stats_template"].format(
            ap=f"{user.ap:,}",
            pp=f"{user.pp:,}",
            weekly_points=f"{user.weekly_points:,}",
            streak=user.streak,
            total_questions=user.total_questions,
            correct_answers=user.correct_answers,
            accuracy=user.accuracy,
            user_type=user_type,
            rank=rank_text
        )
        
        await update.message.reply_text(
            stats_text,
            reply_markup=Keyboards.stats_actions(),
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def leaderboard_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        telegram_id = update.effective_user.id
        
        leaderboard = leaderboard_manager.get_current_leaderboard(limit=10)
        
        if not leaderboard:
            await update.message.reply_text(
                "🏆 **Leaderboard**\n\n"
                "No players yet this week. Be the first!",
                reply_markup=Keyboards.leaderboard_actions(),
                parse_mode=ParseMode.MARKDOWN
            )
            return
        
        leaderboard_text = leaderboard_manager.format_leaderboard_text(
            leaderboard,
            highlight_user_id=telegram_id
        )
        
        user = db.get_user(telegram_id)
        if user:
            rank = db.get_user_rank(telegram_id)
            if rank > 10:
                user_position = leaderboard_manager.get_user_position_text(user)
                leaderboard_text += f"\n\n---\n{user_position}"
        
        await update.message.reply_text(
            leaderboard_text,
            reply_markup=Keyboards.leaderboard_actions(),
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def invite_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        telegram_id = update.effective_user.id
        user = db.get_user(telegram_id)
        
        if not user:
            await update.message.reply_text("Please use /start to register first!")
            return
        
        bot_username = (await context.bot.get_me()).username
        referral_link = f"https://t.me/{bot_username}?start={user.referral_code}"
        
        referral_count = db.get_referral_count(telegram_id)
        
        invite_text = MESSAGES["invite_message"].format(
            referral_link=referral_link,
            referral_count=referral_count
        )
        
        await update.message.reply_text(
            invite_text,
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def subscribe_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text(
            MESSAGES["subscribe_info"],
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        help_text = """🎮 **Quiz Bot Help**

**Commands:**
/start - Start the bot and register
/play - Play a quiz question
/stats - View your statistics
/leaderboard - View weekly rankings
/invite - Get your referral link
/subscribe - Upgrade to premium
/help - Show this help message

**How to Play:**
1. Tap "▶️ Play Quiz" to get a question
2. Select your answer (A, B, C, or D)
3. Earn points for correct answers
4. Build your streak by playing daily
5. Compete for top spots on the leaderboard

**Prize Rounds:**
• 9:00 AM UTC - Morning Round
• 9:00 PM UTC - Evening Round

Top players win prizes! 🏆

**Need Support?**
Contact @admin for help.
        await update.message.reply_text(
            help_text,
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
        text = update.message.text
        
        if text == BUTTON_LABELS["play"]:
            await BotHandlers.play_command(update, context)
        elif text == BUTTON_LABELS["stats"]:
            await BotHandlers.stats_command(update, context)
        elif text == BUTTON_LABELS["leaderboard"]:
            await BotHandlers.leaderboard_command(update, context)
        elif text == BUTTON_LABELS["invite"]:
            await BotHandlers.invite_command(update, context)
        elif text == BUTTON_LABELS["subscribe"]:
            await BotHandlers.subscribe_command(update, context)
        else:
            await update.message.reply_text(
                "I didn't understand that. Please use the menu buttons or /help for commands.",
                reply_markup=Keyboards.main_menu()
            )


bot_handlers = BotHandlers()
