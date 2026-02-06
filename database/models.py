from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
from config.constants import UserType, PointType


@dataclass
class User:
    telegram_id: int
    username: str
    full_name: str
    ap: int = 0
    pp: int = 0
    weekly_points: int = 0
    streak: int = 0
    last_played_date: Optional[str] = None
    subscription_status: str = UserType.FREE.value
    subscription_expires: Optional[str] = None
    streak_freezes_remaining: int = 0  # Premium feature: preserve streak
    total_questions: int = 0
    correct_answers: int = 0
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    referral_code: str = ""
    referred_by: str = ""
    is_banned: bool = False
    suspicious_flags: int = 0
    
    @property
    def is_subscriber(self) -> bool:
        if self.subscription_status != UserType.SUBSCRIBER.value:
            return False
        if not self.subscription_expires:
            return False
        try:
            expires = datetime.fromisoformat(self.subscription_expires)
            return expires > datetime.utcnow()
        except:
            return False
    
    @property
    def user_type(self) -> UserType:
        return UserType.SUBSCRIBER if self.is_subscriber else UserType.FREE
    
    @property
    def accuracy(self) -> float:
        if self.total_questions == 0:
            return 0.0
        return round((self.correct_answers / self.total_questions) * 100, 1)
    
    def to_row(self) -> List:
        return [
            str(self.telegram_id),
            self.username,
            self.full_name,
            str(self.ap),
            str(self.pp),
            str(self.weekly_points),
            str(self.streak),
            self.last_played_date or "",
            self.subscription_status,
            self.subscription_expires or "",
            str(self.total_questions),
            str(self.correct_answers),
            self.created_at,
            self.referral_code,
            self.referred_by,
            str(self.is_banned),
            str(self.suspicious_flags),
        ]
    
    @classmethod
    def from_row(cls, row: List) -> "User":
        return cls(
            telegram_id=int(row[0]),
            username=row[1],
            full_name=row[2],
            ap=int(row[3]) if row[3] else 0,
            pp=int(row[4]) if row[4] else 0,
            weekly_points=int(row[5]) if row[5] else 0,
            streak=int(row[6]) if row[6] else 0,
            last_played_date=row[7] if row[7] else None,
            subscription_status=row[8] if row[8] else UserType.FREE.value,
            subscription_expires=row[9] if row[9] else None,
            total_questions=int(row[10]) if row[10] else 0,
            correct_answers=int(row[11]) if row[11] else 0,
            created_at=row[12],
            referral_code=row[13] if row[13] else "",
            referred_by=row[14] if row[14] else "",
            is_banned=row[15].lower() == "true" if len(row) > 15 and row[15] else False,
            suspicious_flags=int(row[16]) if len(row) > 16 and row[16] else 0,
        )


@dataclass
class Question:
    question_id: str
    category: str
    question_text: str
    image_url: Optional[str]
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    difficulty: str
    time_limit_seconds: int = 20
    scheduled_date: Optional[str] = None
    used: bool = False
    sponsor_name: Optional[str] = None
    
    @property
    def options(self) -> dict:
        return {
            "A": self.option_a,
            "B": self.option_b,
            "C": self.option_c,
            "D": self.option_d,
        }
    
    @property
    def correct_answer(self) -> str:
        return self.options.get(self.correct_option, "")
    
    def to_row(self) -> List:
        return [
            self.question_id,
            self.category,
            self.question_text,
            self.image_url or "",
            self.option_a,
            self.option_b,
            self.option_c,
            self.option_d,
            self.correct_option,
            self.difficulty,
            str(self.time_limit_seconds),
            self.scheduled_date or "",
            str(self.used).upper(),
            self.sponsor_name or "",
        ]
    
    @classmethod
    def from_row(cls, row: List) -> "Question":
        return cls(
            question_id=row[0],
            category=row[1],
            question_text=row[2],
            image_url=row[3] if len(row) > 3 and row[3] else None,
            option_a=row[4],
            option_b=row[5],
            option_c=row[6],
            option_d=row[7],
            correct_option=row[8],
            difficulty=row[9],
            time_limit_seconds=int(row[10]) if len(row) > 10 and row[10] else 20,
            scheduled_date=row[11] if len(row) > 11 and row[11] else None,
            used=row[12].upper() == "TRUE" if len(row) > 12 and row[12] else False,
            sponsor_name=row[13] if len(row) > 13 and row[13] else None,
        )


@dataclass
class Attempt:
    attempt_id: str
    telegram_id: int
    question_id: str
    selected_option: str
    is_correct: bool
    response_time_seconds: float
    points_awarded: int
    point_type: str
    attempt_number: int = 1
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    def to_row(self) -> List:
        return [
            self.attempt_id,
            str(self.telegram_id),
            self.question_id,
            self.selected_option,
            str(self.is_correct),
            str(self.response_time_seconds),
            str(self.points_awarded),
            self.point_type,
            str(self.attempt_number),
            self.timestamp,
        ]
    
    @classmethod
    def from_row(cls, row: List) -> "Attempt":
        return cls(
            attempt_id=row[0],
            telegram_id=int(row[1]),
            question_id=row[2],
            selected_option=row[3],
            is_correct=row[4].lower() == "true",
            response_time_seconds=float(row[5]),
            points_awarded=int(row[6]),
            point_type=row[7],
            attempt_number=int(row[8]) if len(row) > 8 and row[8] else 1,
            timestamp=row[9] if len(row) > 9 else datetime.utcnow().isoformat(),
        )


@dataclass
class LeaderboardEntry:
    week_number: int
    year: int
    telegram_id: int
    username: str
    points: int
    rank: int
    reward_type: Optional[str] = None
    reward_value: Optional[str] = None
    reward_status: str = "pending"  # pending, approved, paid
    approved_by: Optional[str] = None
    approval_date: Optional[str] = None
    
    def to_row(self) -> List:
        return [
            str(self.week_number),
            str(self.year),
            str(self.telegram_id),
            self.username,
            str(self.points),
            str(self.rank),
            self.reward_type or "",
            self.reward_value or "",
            self.reward_status,
            self.approved_by or "",
            self.approval_date or "",
        ]
    
    @classmethod
    def from_row(cls, row: List) -> "LeaderboardEntry":
        return cls(
            week_number=int(row[0]),
            year=int(row[1]),
            telegram_id=int(row[2]),
            username=row[3],
            points=int(row[4]),
            rank=int(row[5]),
            reward_type=row[6] if len(row) > 6 and row[6] else None,
            reward_value=row[7] if len(row) > 7 and row[7] else None,
            reward_status=row[8] if len(row) > 8 and row[8] else "pending",
            approved_by=row[9] if len(row) > 9 and row[9] else None,
            approval_date=row[10] if len(row) > 10 and row[10] else None,
        )


@dataclass
class Referral:
    referrer_telegram_id: int
    referred_telegram_id: int
    referral_code: str
    signup_date: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    qualified: bool = False
    bonus_awarded: bool = False
    
    def to_row(self) -> List:
        return [
            str(self.referrer_telegram_id),
            str(self.referred_telegram_id),
            self.referral_code,
            self.signup_date,
            str(self.qualified),
            str(self.bonus_awarded),
        ]
    
    @classmethod
    def from_row(cls, row: List) -> "Referral":
        return cls(
            referrer_telegram_id=int(row[0]),
            referred_telegram_id=int(row[1]),
            referral_code=row[2],
            signup_date=row[3],
            qualified=row[4].lower() == "true" if len(row) > 4 and row[4] else False,
            bonus_awarded=row[5].lower() == "true" if len(row) > 5 and row[5] else False,
        )
