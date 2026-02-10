from datetime import datetime, timedelta
from typing import Tuple, Optional
import logging

from config.constants import RATE_LIMITS, UserType, ANTI_CHEAT
from config.settings import settings
from database.models import User
from database.supabase_client import db

logger = logging.getLogger(__name__)


class EligibilityChecker:
    @staticmethod
    def check_play_eligibility(user: User) -> Tuple[bool, Optional[str]]:
        """Check if user can play right now.
        
        Returns:
            Tuple of (is_eligible, error_message)
        """
        if user.is_banned:
            return False, "⛔ Your account has been banned. Contact @admin."
        
        hourly_attempts = db.get_user_hourly_attempts(user.telegram_id)
        user_type = user.user_type
        hourly_limit = RATE_LIMITS[user_type]["hourly"]
        
        if hourly_attempts >= hourly_limit:
            wait_time = EligibilityChecker._get_wait_time(hourly_attempts, user.telegram_id)
            
            upgrade_message = ""
            if user_type == UserType.FREE:
                upgrade_message = "\n\n💎 Premium users get 40 questions/hour!\nTap /subscribe to upgrade."
            
            return False, (
                f"⏳ **Rate Limit Reached**\n\n"
                f"You've answered {hourly_attempts} questions in the past hour.\n\n"
                f"**Your Limit:** {hourly_limit} questions/hour\n"
                f"{upgrade_message}\n\n"
                f"Try again in {wait_time} minutes."
            )
        
        if user.suspicious_flags >= 3:
            return False, (
                "⚠️ **Account Under Review**\n\n"
                "Your account has been flagged for suspicious activity. "
                "A moderator will review your account.\n\n"
                "If this is an error, please contact @admin."
            )
        
        return True, None
    
    @staticmethod
    def check_prize_round_eligibility(user: User) -> Tuple[bool, Optional[str]]:
        """Check if user is eligible for prize rounds."""
        if user.is_banned:
            return False, "⛔ Your account has been banned."

        if user.suspicious_flags >= 3:
            return False, "⚠️ Your account is under review."

        if user.ap < settings.PRIZE_ROUND_MIN_AP:
            return False, (
                "⚠️ You are not eligible for this prize round yet.\n"
                f"Minimum AP required: {settings.PRIZE_ROUND_MIN_AP}."
            )

        if user.total_questions < settings.PRIZE_ROUND_MIN_QUESTIONS:
            return False, (
                "⚠️ You are not eligible for this prize round yet.\n"
                f"Minimum answered questions required: {settings.PRIZE_ROUND_MIN_QUESTIONS}."
            )

        return True, None

    @staticmethod
    def check_question_attempts(user: User, question_id: str, question_type: str = "continuous") -> Tuple[bool, Optional[str], int]:
        """Check if user can attempt this specific question.

        Rules:
        - Continuous mode: max 1 attempt for everyone.
        - Prize mode: free users get 1 attempt.
        - Prize mode: subscribers can get a 2nd attempt only if first was wrong.

        Returns:
            Tuple of (can_attempt, error_message, current_attempt_number)
        """
        attempts = db.get_user_question_attempts(user.telegram_id, question_id)
        attempt_count = len(attempts)

        if question_type != "prize_round":
            if attempt_count >= 1:
                return False, "You've already answered this question.", attempt_count
            return True, None, 1

        if not user.is_subscriber:
            if attempt_count >= 1:
                return False, "You've used all attempts for this prize question.", attempt_count
            return True, None, 1

        # Subscriber prize logic.
        if attempt_count == 0:
            return True, None, 1
        if attempt_count >= 2:
            return False, "You've used both attempts for this prize question.", attempt_count

        first_attempt = attempts[0]
        if first_attempt.is_correct:
            return False, "Second attempt is only available if your first attempt was wrong.", attempt_count

        return True, None, 2
    
    @staticmethod
    def _get_wait_time(hourly_attempts: int, telegram_id: int) -> int:
        """Calculate estimated wait time in minutes before user can play again."""
        try:
            oldest_attempt = db.get_oldest_attempt_within_hour(telegram_id)
            if oldest_attempt:
                time_until_reset = oldest_attempt + timedelta(hours=1) - datetime.utcnow()
                return max(1, int(time_until_reset.total_seconds() / 60))
        except Exception as e:
            logger.error(f"Error calculating wait time: {e}")
        
        return 60
    
    @staticmethod
    def validate_answer_timing(response_time: float) -> Tuple[bool, Optional[str]]:
        """Validate that answer timing is legitimate.
        
        Returns:
            Tuple of (is_valid, warning_message)
        """
        min_time = ANTI_CHEAT["min_answer_time_seconds"]
        
        if response_time < min_time:
            logger.warning(f"Suspiciously fast answer: {response_time}s")
            return False, "⚠️ Answer submitted too quickly. This attempt won't count."
        
        if response_time < 0 or response_time > 120:
            logger.warning(f"Invalid response time: {response_time}s")
            return False, "⚠️ Invalid response time detected."
        
        return True, None
    
    @staticmethod
    def check_and_flag_suspicious_behavior(user: User) -> User:
        """Check for suspicious patterns and update flags if needed."""
        try:
            user_attempts = db.get_recent_attempt_correctness(user.telegram_id, limit=20)
            
            if len(user_attempts) >= 20:
                correct_count = sum(user_attempts[:20])
                if correct_count >= 19:
                    user.suspicious_flags += 1
                    logger.warning(f"Suspicious accuracy for user {user.telegram_id}: {correct_count}/20")
            
            consecutive_correct = 0
            for is_correct in user_attempts:
                if is_correct:
                    consecutive_correct += 1
                else:
                    break
            
            if consecutive_correct >= ANTI_CHEAT["max_correct_streak_before_review"]:
                user.suspicious_flags += 1
                logger.warning(f"Suspicious streak for user {user.telegram_id}: {consecutive_correct}")
        
        except Exception as e:
            logger.error(f"Error checking suspicious behavior: {e}")
        
        return user


eligibility_checker = EligibilityChecker()
