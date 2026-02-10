"""Calculates points based on fair and transparent scoring rules."""
from datetime import datetime
from typing import Tuple
import logging

from config.constants import (
    BASE_CORRECT_POINTS,
    BASE_WRONG_POINTS,
    STREAK_BONUSES,
    PointType,
    SPEED_BONUS_FAST_THRESHOLD,
    SPEED_BONUS_MEDIUM_THRESHOLD,
    SPEED_BONUS_FAST_POINTS,
    SPEED_BONUS_MEDIUM_POINTS,
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
        """Calculate points for an attempt.

        Rules:
        - Correct answer: +10, wrong: +0
        - Speed bonus: +5 if <30% of time limit, +3 if <50%, else +0
        - Streak bonus: 3d +5, 7d +15, 30d +50
        """
        _ = attempt_number  # intentionally unused in the transparent scoring model
        _ = is_prize_round  # point type still differs elsewhere; score formula is universal

        base_points = BASE_CORRECT_POINTS if is_correct else BASE_WRONG_POINTS
        if base_points == 0:
            return 0, {"base": 0, "speed_bonus": 0, "streak_bonus": 0, "total": 0}

        speed_bonus = ScoringEngine._calculate_speed_bonus(
            response_time=response_time_seconds,
            time_limit_seconds=question.time_limit_seconds,
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
    def _calculate_speed_bonus(response_time: float, time_limit_seconds: int) -> int:
        """Apply speed bonus based on % of allowed time consumed."""
        if response_time <= 0 or time_limit_seconds <= 0:
            return 0

        ratio = response_time / float(time_limit_seconds)

        if ratio < SPEED_BONUS_FAST_THRESHOLD:
            return SPEED_BONUS_FAST_POINTS
        if ratio < SPEED_BONUS_MEDIUM_THRESHOLD:
            return SPEED_BONUS_MEDIUM_POINTS
        return 0

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
        """Update user's streak based on last played date.

        Returns:
            Tuple of (updated_user, streak_broken)
        """
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
        if is_prize_round:
            return PointType.PP.value
        return PointType.AP.value

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
