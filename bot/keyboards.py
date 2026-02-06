from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton
from config.constants import BUTTON_LABELS
from database.models import Question


class Keyboards:
    @staticmethod
    def main_menu() -> ReplyKeyboardMarkup:
        keyboard = [
            [KeyboardButton(BUTTON_LABELS["play"])],
            [KeyboardButton(BUTTON_LABELS["leaderboard"]), KeyboardButton(BUTTON_LABELS["stats"])],
            [KeyboardButton(BUTTON_LABELS["invite"]), KeyboardButton(BUTTON_LABELS["subscribe"])],
        ]
        return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    
    @staticmethod
    def question_options(question: Question) -> InlineKeyboardMarkup:
        keyboard = [
            [InlineKeyboardButton(f"A. {question.option_a[:40]}", callback_data=f"answer_A_{question.question_id}")],
            [InlineKeyboardButton(f"B. {question.option_b[:40]}", callback_data=f"answer_B_{question.question_id}")],
            [InlineKeyboardButton(f"C. {question.option_c[:40]}", callback_data=f"answer_C_{question.question_id}")],
            [InlineKeyboardButton(f"D. {question.option_d[:40]}", callback_data=f"answer_D_{question.question_id}")],
        ]
        return InlineKeyboardMarkup(keyboard)
    
    @staticmethod
    def continue_playing() -> InlineKeyboardMarkup:
        keyboard = [
            [InlineKeyboardButton("▶️ Next Question", callback_data="play_continuous")],
            [InlineKeyboardButton("🏆 View Leaderboard", callback_data="show_leaderboard")],
        ]
        return InlineKeyboardMarkup(keyboard)
    
    @staticmethod
    def retry_or_continue(has_attempts_left: bool = False) -> InlineKeyboardMarkup:
        keyboard = []
        
        if has_attempts_left:
            keyboard.append([InlineKeyboardButton("🔄 Try Again (2nd attempt)", callback_data="retry_question")])
        
        keyboard.extend([
            [InlineKeyboardButton("▶️ Next Question", callback_data="play_continuous")],
            [InlineKeyboardButton("📊 My Stats", callback_data="show_stats")],
        ])
        
        return InlineKeyboardMarkup(keyboard)
    
    @staticmethod
    def subscribe_prompt() -> InlineKeyboardMarkup:
        keyboard = [
            [InlineKeyboardButton("💎 Learn More", callback_data="subscribe_info")],
            [InlineKeyboardButton("▶️ Continue as Free", callback_data="play_continuous")],
        ]
        return InlineKeyboardMarkup(keyboard)
    
    @staticmethod
    def leaderboard_actions() -> InlineKeyboardMarkup:
        keyboard = [
            [InlineKeyboardButton("🔄 Refresh", callback_data="show_leaderboard")],
            [InlineKeyboardButton("▶️ Play Now", callback_data="play_continuous")],
        ]
        return InlineKeyboardMarkup(keyboard)
    
    @staticmethod
    def stats_actions() -> InlineKeyboardMarkup:
        keyboard = [
            [InlineKeyboardButton("▶️ Play Quiz", callback_data="play_continuous")],
            [InlineKeyboardButton("🏆 Leaderboard", callback_data="show_leaderboard")],
            [InlineKeyboardButton("💎 Go Premium", callback_data="subscribe_info")],
        ]
        return InlineKeyboardMarkup(keyboard)
