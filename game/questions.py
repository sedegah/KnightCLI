from datetime import datetime
from typing import Optional, Dict, Tuple
import logging
import uuid

from config.constants import QuestionType
from database.models import Question, User, Attempt
from database.supabase_client import db
from game.scoring import scoring_engine
from game.eligibility import eligibility_checker

logger = logging.getLogger(__name__)


class QuestionManager:
    active_questions: Dict[str, dict] = {}
    
    @staticmethod
    def get_question_for_user(user: User, is_prize_round: bool = False) -> Tuple[Optional[Question], Optional[str]]:
        """Get an appropriate question for the user.
        
        Returns:
            Tuple of (Question, error_message)
        """
        is_eligible, error = eligibility_checker.check_play_eligibility(user)
        if not is_eligible:
            return None, error
        
        question = db.get_random_question(
            question_type="",
            user_telegram_id=user.telegram_id,
            exclude_answered=True
        )
        
        if not question:
            if db.has_write_access:
                return None, (
                    "🎉 **You've answered all available questions!**\n\n"
                    "New questions are added daily. Check back soon!"
                )
            else:
                return None, (
                    "📚 **No questions available right now.**\n\n"
                    "It looks like the question bank is empty. "
                    "Please add questions to your Supabase `questions` table to start playing.\n\n"
                    "Required fields:\n"
                    "• question_id\n"
                    "• question_text\n"
                    "• option_a, option_b, option_c, option_d\n"
                    "• correct_option (A/B/C/D)\n"
                    "• difficulty, category\n"
                )
        
        can_attempt, error, attempt_num = eligibility_checker.check_question_attempts(
            user, question.question_id
        )
        
        if not can_attempt:
            return QuestionManager.get_question_for_user(user, is_prize_round)
        
        QuestionManager.active_questions[f"{user.telegram_id}_{question.question_id}"] = {
            "user_id": user.telegram_id,
            "question": question,
            "start_time": datetime.utcnow(),
            "attempt_number": attempt_num,
        }
        
        logger.info(f"Delivered question {question.question_id} to user {user.telegram_id}")
        return question, None
    
    @staticmethod
    def process_answer(
        user: User,
        question_id: str,
        selected_option: str,
        is_prize_round: bool = False
    ) -> Tuple[bool, dict]:
        """Process user's answer and calculate results.
        
        Returns:
            Tuple of (success, result_dict)
            result_dict contains: is_correct, points, breakdown, updated_user, streak_broken, etc.
        """
        active_key = f"{user.telegram_id}_{question_id}"
        active_data = QuestionManager.active_questions.get(active_key)
        
        if not active_data:
            return False, {"error": "Question not found or expired. Please request a new question."}
        
        question = active_data["question"]
        start_time = active_data["start_time"]
        attempt_number = active_data["attempt_number"]
        
        response_time = (datetime.utcnow() - start_time).total_seconds()
        
        is_valid, warning = eligibility_checker.validate_answer_timing(response_time)
        if not is_valid:
            del QuestionManager.active_questions[active_key]
            return False, {"error": warning}
        
        is_correct = selected_option.upper() == question.correct_option.upper()
        
        points, breakdown = scoring_engine.calculate_points(
            user=user,
            question=question,
            is_correct=is_correct,
            response_time_seconds=response_time,
            attempt_number=attempt_number,
            is_prize_round=is_prize_round
        )
        
        user, streak_broken = scoring_engine.update_user_streak(user)
        
        point_type = scoring_engine.get_point_type(is_prize_round)
        user = scoring_engine.apply_points_to_user(user, points, point_type)
        
        user.total_questions += 1
        if is_correct:
            user.correct_answers += 1
        
        user = eligibility_checker.check_and_flag_suspicious_behavior(user)
        
        attempt = Attempt(
            attempt_id=str(uuid.uuid4()),
            telegram_id=user.telegram_id,
            question_id=question_id,
            selected_option=selected_option,
            is_correct=is_correct,
            response_time_seconds=response_time,
            points_awarded=points,
            point_type=point_type,
            attempt_number=attempt_number,
        )
        
        # Try to save attempt, but don't fail if in read-only mode
        if not db.create_attempt(attempt):
            logger.warning(f"Could not persist attempt for user {user.telegram_id} (read-only mode)")
        
        # Try to update user, but don't fail if in read-only mode
        if not db.update_user(user):
            logger.warning(f"Could not persist user updates for {user.telegram_id} (read-only mode)")
        
        del QuestionManager.active_questions[active_key]
        
        user_rank = db.get_user_rank(user.telegram_id)
        
        result = {
            "is_correct": is_correct,
            "points": points,
            "breakdown": breakdown,
            "point_type": point_type,
            "user": user,
            "streak_broken": streak_broken,
            "correct_answer": question.correct_answer,
            "response_time": response_time,
            "attempt_number": attempt_number,
            "user_rank": user_rank,
            "question": question,
        }
        
        logger.info(f"Processed answer for user {user.telegram_id}: correct={is_correct}, points={points}")
        return True, result
    
    @staticmethod
    def cleanup_expired_questions(max_age_seconds: int = 120):
        now = datetime.utcnow()
        expired_keys = []
        
        for key, data in QuestionManager.active_questions.items():
            age = (now - data["start_time"]).total_seconds()
            if age > max_age_seconds:
                expired_keys.append(key)
        
        for key in expired_keys:
            del QuestionManager.active_questions[key]
            logger.info(f"Cleaned up expired question: {key}")
    
    @staticmethod
    def format_question_text(question: Question, question_number: int = 1) -> str:
        # Phase 1 Monetization: Sponsor branding
        sponsor_tag = ""
        if question.sponsor_name:
            sponsor_tag = f"\n\n💼 **Sponsored by {question.sponsor_name}**"
        
        text = f"❓ **Question {question_number}**\n\n"
        text += f"{question.question_text}\n\n"
        text += f"**A.** {question.option_a}\n"
        text += f"**B.** {question.option_b}\n"
        text += f"**C.** {question.option_c}\n"
        text += f"**D.** {question.option_d}\n"
        text += sponsor_tag
        text += f"\n\n⏱️ Answer within {question.time_limit_seconds} seconds for max points!"
        
        return text


question_manager = QuestionManager()


from typing import Tuple
