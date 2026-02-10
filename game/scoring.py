"""Calculates points based on mode, user tier, speed, and streaks."""
from datetime import datetime
from typing import Tuple
import logging

from config.constants import (
    SCORING,
    STREAK_BONUSES,
    UserType,
    QuestionType,
    PointType,
)
from database.models import User, Question

logger = logging.getLogger(__name__)


class ScoringEngine:
    @staticmethod
    def calculate_points(
        user: User,
        question: Question,
        is_correct: bool,
        response_time_seconds: float,
        attempt_number: int = 1,
        is_prize_round: bool = False,
    ) -> Tuple[int, dict]:
        """Calculate points for an attempt."""
        question_mode = QuestionType.PRIZE_ROUND if is_prize_round else QuestionType.CONTINUOUS
        config = SCORING[user.user_type][question_mode]

        if not is_correct:
            return 0, {"base": 0, "speed_bonus": 0, "streak_bonus": 0, "total": 0}

        base_points = int(config["correct"])

        # Subscriber second attempt in prize rounds earns 80% of base points.
        if (
            question_mode == QuestionType.PRIZE_ROUND
            and user.user_type == UserType.SUBSCRIBER
            and attempt_number == 2
        ):
            multiplier = float(config.get("second_attempt_multiplier", 1.0))
            base_points = int(base_points * multiplier)

        speed_bonus = 0
        if question_mode == QuestionType.PRIZE_ROUND:
            speed_bonus = ScoringEngine._calculate_speed_bonus(
                response_time=response_time_seconds,
                time_limit_seconds=question.time_limit_seconds,
                max_bonus=int(config.get("speed_bonus_max", 0)),
            )

        streak_bonus = ScoringEngine._get_streak_bonus(user.streak)
        total_points = base_points + speed_bonus + streak_bonus

        breakdown = {
            "base": base_points,
            "speed_bonus": speed_bonus,
            "streak_bonus": streak_bonus,
            "total": total_points,
        }

        logger.info(f"Calculated points for user {user.telegram_id}: {breakdown}")
        return total_points, breakdown

    @staticmethod
    def _calculate_speed_bonus(response_time: float, time_limit_seconds: int, max_bonus: int) -> int:
        """Linear speed bonus from max at fastest response down to 0 at time limit."""
        if response_time <= 0 or time_limit_seconds <= 0 or max_bonus <= 0:
            return 0

        ratio = min(max(response_time / float(time_limit_seconds), 0.0), 1.0)
        return int(round(max_bonus * (1.0 - ratio)))

    @staticmethod
    def _get_streak_bonus(streak: int) -> int:
        bonus = 0
        for milestone, points in sorted(STREAK_BONUSES.items(), reverse=True):
            if streak >= milestone:
                bonus = points
                break
        return bonus

    @staticmethod
    def update_user_streak(user: User) -> Tuple[User, bool]:
        today = datetime.utcnow().date()
        streak_broken = False

        if not user.last_played_date:
            user.streak = 1
            user.last_played_date = today.isoformat()
            return user, False

        try:
            last_played = datetime.fromisoformat(user.last_played_date).date()
            days_diff = (today - last_played).days

            if days_diff == 0:
                pass
            elif days_diff == 1:
                user.streak += 1
                user.last_played_date = today.isoformat()
            else:
                user.streak = 1
                user.last_played_date = today.isoformat()
                streak_broken = True
                logger.info(f"Streak broken for user {user.telegram_id}")

        except Exception as e:
            logger.error(f"Error updating streak for user {user.telegram_id}: {e}")
            user.streak = 1
            user.last_played_date = today.isoformat()

        return user, streak_broken

    @staticmethod
    def get_point_type(is_prize_round: bool) -> str:
        return PointType.PP.value if is_prize_round else PointType.AP.value

    @staticmethod
    def apply_points_to_user(user: User, points: int, point_type: str) -> User:
        if point_type == PointType.PP.value:
            user.pp += points
            user.weekly_points += points
        else:
            user.ap += points
            user.weekly_points += points
        return user

    @staticmethod
    def format_points_breakdown(breakdown: dict, point_type: str) -> str:
        lines = []
        if breakdown["base"] > 0:
            lines.append(f"Base: +{breakdown['base']} {point_type}")
        if breakdown["speed_bonus"] > 0:
            lines.append(f"⚡ Speed Bonus: +{breakdown['speed_bonus']}")
        if breakdown["streak_bonus"] > 0:
            lines.append(f"🔥 Streak Bonus: +{breakdown['streak_bonus']}")
        lines.append(f"\n**Total: +{breakdown['total']} {point_type}**")
        return "\n".join(lines)


scoring_engine = ScoringEngine()
