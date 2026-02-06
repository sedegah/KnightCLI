from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
import logging

from database.sheets_client import db
from config.constants import UserType
from bot.keyboards import Keyboards
from game.questions import question_manager
from game.leaderboard import leaderboard_manager
from game.scoring import scoring_engine
from config.constants import MESSAGES

logger = logging.getLogger(__name__)


class CallbackHandlers:
    @staticmethod
    async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()
        
        callback_data = query.data
        telegram_id = update.effective_user.id
        
        logger.info(f"Callback from {telegram_id}: {callback_data}")
        
        if callback_data.startswith("answer_"):
            await CallbackHandlers._handle_answer(update, context)
        elif callback_data == "play_continuous":
            await CallbackHandlers._handle_play_continuous(update, context)
        elif callback_data == "show_leaderboard":
            await CallbackHandlers._handle_show_leaderboard(update, context)
        elif callback_data == "show_stats":
            await CallbackHandlers._handle_show_stats(update, context)
        elif callback_data == "subscribe_info":
            await CallbackHandlers._handle_subscribe_info(update, context)
        elif callback_data == "retry_question":
            await CallbackHandlers._handle_retry_question(update, context)
        else:
            await query.edit_message_text("Unknown action. Please try again.")
    
    @staticmethod
    async def _handle_answer(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        telegram_id = update.effective_user.id
        
        parts = query.data.split("_")
        if len(parts) < 3:
            await query.edit_message_text("Invalid answer format.")
            return
        
        selected_option = parts[1]
        question_id = "_".join(parts[2:])
        
        user = db.get_user(telegram_id)
        if not user:
            await query.edit_message_text("Please use /start to register first!")
            return
        
        success, result = question_manager.process_answer(
            user=user,
            question_id=question_id,
            selected_option=selected_option
        )
        
        if not success:
            error_msg = result.get("error", "Failed to process answer")
            await query.edit_message_text(error_msg)
            return
        
        if result["is_correct"]:
            point_type = result["point_type"].upper()
            breakdown = result["breakdown"]
            
            response_text = "✅ **Correct!**\n\n"
            response_text += scoring_engine.format_points_breakdown(breakdown, point_type)
            response_text += f"\n\n**Your Total:** {result['user'].ap:,} AP | {result['user'].pp:,} PP\n"
            response_text += f"**Weekly Rank:**
            
            if result["streak_broken"]:
                response_text += "\n⚠️ Your streak was reset due to missed days."
            elif result["user"].streak > 1:
                response_text += f"\n🔥 Streak: {result['user'].streak} days!"
            
            if result["user"].user_type == UserType.FREE and result["user"].total_questions % 5 == 0:
                response_text += "\n\n💎 **Upgrade to Premium** for more points and extra attempts!"
                keyboard = Keyboards.subscribe_prompt()
            else:
                response_text += "\n\nKeep playing to climb the leaderboard! 🚀"
                keyboard = Keyboards.continue_playing()
            
            await query.edit_message_text(
                response_text,
                reply_markup=keyboard,
                parse_mode=ParseMode.MARKDOWN
            )
        else:
            response_text = "❌ **Incorrect**\n\n"
            response_text += f"The correct answer was: **{result['correct_answer']}**\n\n"
            
            question = result["question"]
            attempt_num = result["attempt_number"]
            has_2nd_attempt = False
            
            if has_2nd_attempt:
                response_text += "💎 **You have 1 more attempt!**\n"
                response_text += "Second attempt earns 80% of points.\n"
            else:
                response_text += "Keep practicing! Every question helps you learn. 📚\n"
            
            await query.edit_message_text(
                response_text,
                reply_markup=Keyboards.retry_or_continue(has_2nd_attempt),
                parse_mode=ParseMode.MARKDOWN
            )
    
    @staticmethod
    async def _handle_play_continuous(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        telegram_id = update.effective_user.id
        
        user = db.get_user(telegram_id)
        if not user:
            await query.edit_message_text("Please use /start to register first!")
            return
        
        question, error = question_manager.get_question_for_user(user, is_prize_round=False)
        
        if error:
            await query.edit_message_text(
                error,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=Keyboards.subscribe_prompt() if "Rate Limit" in error else None
            )
            return
        
        question_text = question_manager.format_question_text(question)
        await query.edit_message_text(
            question_text,
            reply_markup=Keyboards.question_options(question),
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def _handle_show_leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        telegram_id = update.effective_user.id
        
        leaderboard = leaderboard_manager.get_current_leaderboard(limit=10)
        
        if not leaderboard:
            await query.edit_message_text(
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
        
        await query.edit_message_text(
            leaderboard_text,
            reply_markup=Keyboards.leaderboard_actions(),
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def _handle_show_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        telegram_id = update.effective_user.id
        
        user = db.get_user(telegram_id)
        if not user:
            await query.edit_message_text("Please use /start to register first!")
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
        
        await query.edit_message_text(
            stats_text,
            reply_markup=Keyboards.stats_actions(),
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def _handle_subscribe_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        
        await query.edit_message_text(
            MESSAGES["subscribe_info"],
            parse_mode=ParseMode.MARKDOWN
        )
    
    @staticmethod
    async def _handle_retry_question(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        telegram_id = update.effective_user.id
        
        user = db.get_user(telegram_id)
        if not user or not user.is_subscriber:
            await query.edit_message_text(
                "This feature is only available for Premium subscribers.\n\n"
                "Tap /subscribe to learn more!",
                parse_mode=ParseMode.MARKDOWN
            )
            return
        
        await CallbackHandlers._handle_play_continuous(update, context)


callback_handlers = CallbackHandlers()
