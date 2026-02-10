"""Supabase database client for managing all data operations."""
import logging
import random
import string
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from supabase import create_client, Client
from postgrest.exceptions import APIError

from config.settings import settings
from database.models import User, Question, Attempt, LeaderboardEntry, Referral

logger = logging.getLogger(__name__)


class SupabaseDatabase:
    """Database client using Supabase for all operations."""
    
    def __init__(self):
        self.client: Optional[Client] = None
        self.has_write_access = True
        self._connect()
    
    def _connect(self):
        """Initialize Supabase client connection."""
        try:
            if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY are required")
            
            self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            logger.info("✓ Connected to Supabase successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Supabase: {e}")
            raise
    
    # ===== USER OPERATIONS =====
    
    def get_user(self, telegram_id: int) -> Optional[User]:
        """Get user by telegram ID."""
        try:
            response = self.client.table('users').select('*').eq('telegram_id', telegram_id).execute()
            
            if not response.data:
                return None
            
            return self._dict_to_user(response.data[0])
        except Exception as e:
            logger.error(f"Error getting user {telegram_id}: {e}")
            return None
    
    def create_user(
        self,
        telegram_id: Optional[int] = None,
        username: str = "",
        full_name: str = "",
        referred_by: str = "",
        user: Optional[User] = None,
    ) -> Optional[User]:
        """Create a new user (supports legacy signature)."""
        try:
            if isinstance(telegram_id, User):
                user = telegram_id
            elif user is None:
                referral_code = self._generate_referral_code()
                user = User(
                    telegram_id=telegram_id or 0,
                    username=username,
                    full_name=full_name,
                    referral_code=referral_code,
                    referred_by=referred_by,
                )

            if user is None:
                return None

            data = self._user_to_dict(user)
            self.client.table('users').insert(data).execute()
            logger.info(f"✓ Created user: {user.telegram_id}")
            return user
        except APIError as e:
            if 'duplicate key' in str(e).lower():
                logger.warning(f"User {user.telegram_id} already exists")
                return None
            logger.error(f"Error creating user: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return None

    def get_users_for_notifications(self) -> List[Dict[str, Optional[str]]]:
        """Return minimal user data for notifications."""
        try:
            response = self.client.table('users').select('telegram_id,username,streak,last_played_date').execute()
            users: List[Dict[str, Optional[str]]] = []
            for row in response.data:
                users.append(
                    {
                        "telegram_id": row.get("telegram_id"),
                        "username": row.get("username"),
                        "streak": row.get("streak", 0),
                        "last_played_date": row.get("last_played_date"),
                    }
                )
            return users
        except Exception as e:
            logger.error(f"Error getting users for notifications: {e}")
            return []
    
    def update_user(self, user: User) -> bool:
        """Update an existing user."""
        try:
            data = self._user_to_dict(user)
            # Remove telegram_id from update data as it's the primary key
            telegram_id = data.pop('telegram_id')
            
            self.client.table('users').update(data).eq('telegram_id', telegram_id).execute()
            logger.debug(f"Updated user: {telegram_id}")
            return True
        except Exception as e:
            logger.error(f"Error updating user {user.telegram_id}: {e}")
            return False
    
    def get_all_users(self) -> List[User]:
        """Get all users from database."""
        try:
            response = self.client.table('users').select('*').execute()
            return [self._dict_to_user(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting all users: {e}")
            return []
    
    def get_users_by_ids(self, telegram_ids: List[int]) -> List[User]:
        """Get multiple users by their telegram IDs."""
        try:
            response = self.client.table('users').select('*').in_('telegram_id', telegram_ids).execute()
            return [self._dict_to_user(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting users by IDs: {e}")
            return []
    
    def ban_user(self, telegram_id: int) -> bool:
        """Ban a user."""
        try:
            self.client.table('users').update({'is_banned': True}).eq('telegram_id', telegram_id).execute()
            logger.info(f"✓ Banned user: {telegram_id}")
            return True
        except Exception as e:
            logger.error(f"Error banning user {telegram_id}: {e}")
            return False
    
    def unban_user(self, telegram_id: int) -> bool:
        """Unban a user."""
        try:
            self.client.table('users').update({'is_banned': False}).eq('telegram_id', telegram_id).execute()
            logger.info(f"✓ Unbanned user: {telegram_id}")
            return True
        except Exception as e:
            logger.error(f"Error unbanning user {telegram_id}: {e}")
            return False
    
    # ===== QUESTION OPERATIONS =====
    
    def get_questions_by_category(self, category: str) -> List[Question]:
        """Get all questions for a specific category."""
        try:
            response = self.client.table('questions').select('*').eq('category', category).execute()
            return [self._dict_to_question(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting questions for category {category}: {e}")
            return []
    
    def get_question_by_id(self, question_id: str) -> Optional[Question]:
        """Get a specific question by ID."""
        try:
            response = self.client.table('questions').select('*').eq('question_id', question_id).execute()
            
            if not response.data:
                return None
            
            return self._dict_to_question(response.data[0])
        except Exception as e:
            logger.error(f"Error getting question {question_id}: {e}")
            return None
    
    def get_all_questions(self) -> List[Question]:
        """Get all questions from database."""
        try:
            response = self.client.table('questions').select('*').execute()
            return [self._dict_to_question(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting all questions: {e}")
            return []
    
    def create_question(self, question: Question) -> bool:
        """Create a new question."""
        try:
            data = self._question_to_dict(question)
            self.client.table('questions').insert(data).execute()
            logger.info(f"✓ Created question: {question.question_id}")
            return True
        except Exception as e:
            logger.error(f"Error creating question: {e}")
            return False
    
    # ===== ATTEMPT OPERATIONS =====
    
    def create_attempt(self, attempt: Attempt) -> bool:
        """Record a quiz attempt (legacy name)."""
        try:
            data = {
                'telegram_id': attempt.telegram_id,
                'question_id': attempt.question_id,
                'selected_option': attempt.selected_option,
                'is_correct': attempt.is_correct,
                'time_taken': attempt.response_time_seconds,
                'points_earned': attempt.points_awarded,
                'timestamp': attempt.timestamp,
            }
            self.client.table('attempts').insert(data).execute()
            logger.debug(f"Recorded attempt for user {attempt.telegram_id}")
            return True
        except Exception as e:
            logger.error(f"Error recording attempt: {e}")
            return False

    def record_attempt(self, attempt: Attempt) -> bool:
        """Backward-compatible alias for create_attempt."""
        return self.create_attempt(attempt)
    
    def get_user_attempts(self, telegram_id: int, limit: int = 100) -> List[Attempt]:
        """Get recent attempts for a user."""
        try:
            response = (self.client.table('attempts')
                       .select('*')
                       .eq('telegram_id', telegram_id)
                       .order('timestamp', desc=True)
                       .limit(limit)
                       .execute())
            
            return [self._dict_to_attempt(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting attempts for user {telegram_id}: {e}")
            return []
    
    def get_question_attempts(self, question_id: str) -> List[Attempt]:
        """Get all attempts for a specific question."""
        try:
            response = self.client.table('attempts').select('*').eq('question_id', question_id).execute()
            return [self._dict_to_attempt(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting attempts for question {question_id}: {e}")
            return []
    
    def get_user_attempts_count(self, telegram_id: int, question_id: str) -> int:
        try:
            response = (
                self.client.table('attempts')
                .select('id', count='exact')
                .eq('telegram_id', telegram_id)
                .eq('question_id', question_id)
                .execute()
            )
            if getattr(response, "count", None) is not None:
                return int(response.count)
            return len(response.data or [])
        except Exception as e:
            logger.error(f"Error getting attempt count: {e}")
            return 0

    def get_user_hourly_attempts(self, telegram_id: int) -> int:
        try:
            one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
            response = (
                self.client.table('attempts')
                .select('id', count='exact')
                .eq('telegram_id', telegram_id)
                .gte('timestamp', one_hour_ago)
                .execute()
            )
            if getattr(response, "count", None) is not None:
                return int(response.count)
            return len(response.data or [])
        except Exception as e:
            logger.error(f"Error getting hourly attempts: {e}")
            return 0

    def _get_answered_question_ids(self, telegram_id: int) -> set:
        try:
            response = self.client.table('attempts').select('question_id').eq('telegram_id', telegram_id).execute()
            # Convert all question_ids to strings for consistent comparison
            return {str(row.get('question_id')) for row in (response.data or []) if row.get('question_id')}
        except Exception as e:
            logger.error(f"Error getting answered questions: {e}")
            return set()

    def get_oldest_attempt_within_hour(self, telegram_id: int) -> Optional[datetime]:
        try:
            one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()
            response = (
                self.client.table('attempts')
                .select('timestamp')
                .eq('telegram_id', telegram_id)
                .gte('timestamp', one_hour_ago)
                .order('timestamp', desc=False)
                .limit(1)
                .execute()
            )
            if not response.data:
                return None
            ts = response.data[0].get('timestamp')
            if not ts:
                return None
            return datetime.fromisoformat(ts)
        except Exception as e:
            logger.error(f"Error getting oldest attempt: {e}")
            return None

    def get_recent_attempt_correctness(self, telegram_id: int, limit: int = 20) -> List[bool]:
        try:
            response = (
                self.client.table('attempts')
                .select('is_correct')
                .eq('telegram_id', telegram_id)
                .order('timestamp', desc=True)
                .limit(limit)
                .execute()
            )
            return [bool(row.get('is_correct')) for row in (response.data or [])]
        except Exception as e:
            logger.error(f"Error getting recent attempts: {e}")
            return []
        """Get all attempts for a specific question."""
        try:
            response = self.client.table('attempts').select('*').eq('question_id', question_id).execute()
            return [self._dict_to_attempt(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting attempts for question {question_id}: {e}")
            return []
    
    # ===== LEADERBOARD OPERATIONS =====
    
    def get_top_users_by_ap(self, limit: int = 100) -> List[User]:
        """Get top users by all-time points."""
        try:
            response = (self.client.table('users')
                       .select('*')
                       .order('ap', desc=True)
                       .limit(limit)
                       .execute())
            
            return [self._dict_to_user(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting top users by AP: {e}")
            return []
    
    def get_top_users_by_weekly_points(self, limit: int = 100) -> List[User]:
        """Get top users by weekly points."""
        try:
            response = (self.client.table('users')
                       .select('*')
                       .order('weekly_points', desc=True)
                       .limit(limit)
                       .execute())
            
            return [self._dict_to_user(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting top users by weekly points: {e}")
            return []
    
    def reset_weekly_points(self) -> bool:
        """Reset weekly points for all users."""
        try:
            self.client.table('users').update({'weekly_points': 0}).gt('telegram_id', 0).execute()
            
            logger.info("✓ Reset weekly points for all users")
            return True
        except Exception as e:
            logger.error(f"Error resetting weekly points: {e}")
            return False


    def rollover_weekly_ap(self) -> Tuple[bool, str]:
        """Archive current AP into total_ap and reset weekly counters for new week."""
        try:
            self.client.rpc('rollover_weekly_ap').execute()
            logger.info("✓ Rolled over AP and reset weekly counters")
            return True, "AP rolled into total_ap; AP and weekly_points reset"
        except Exception as e:
            logger.warning(f"RPC rollover_weekly_ap unavailable, using fallback updates: {e}")

        try:
            users_response = self.client.table('users').select('telegram_id,ap,total_ap').gt('telegram_id', 0).execute()
            updated_count = 0
            for row in users_response.data or []:
                telegram_id = row.get('telegram_id')
                ap = int(row.get('ap') or 0)
                total_ap = int(row.get('total_ap') or 0)
                payload = {'ap': 0, 'weekly_points': 0, 'total_ap': total_ap + ap}
                self.client.table('users').update(payload).eq('telegram_id', telegram_id).execute()
                updated_count += 1

            if updated_count == 0:
                self.client.table('users').update({'ap': 0, 'weekly_points': 0}).gt('telegram_id', 0).execute()

            logger.info(f"✓ Fallback rollover complete for {updated_count} users")
            return True, f"Rollover complete for {updated_count} users"
        except Exception as fallback_error:
            logger.error(f"Error during fallback AP rollover: {fallback_error}")
            return False, str(fallback_error)

    def get_weekly_leaderboard(self, limit: int = 50) -> List[LeaderboardEntry]:
        now = datetime.utcnow()
        week_number = now.isocalendar()[1]
        year = now.year

        def _build_leaderboard(rows: List[Dict[str, Any]]) -> List[LeaderboardEntry]:
            leaderboard: List[LeaderboardEntry] = []
            for rank, row in enumerate(rows, start=1):
                username = row.get('username') or row.get('full_name') or ""
                leaderboard.append(
                    LeaderboardEntry(
                        week_number=week_number,
                        year=year,
                        telegram_id=row.get('telegram_id'),
                        username=username,
                        points=int(row.get('weekly_points') or 0),
                        rank=rank,
                    )
                )
            return leaderboard

        try:
            response = (
                self.client.table('leaderboard_cache')
                .select('telegram_id,username,weekly_points')
                .order('weekly_points', desc=True)
                .gt('weekly_points', 0)
                .limit(limit)
                .execute()
            )
            leaderboard = _build_leaderboard(response.data or [])
            if leaderboard:
                return leaderboard
        except Exception as e:
            logger.warning(f"Error getting leaderboard from cache, falling back to users table: {e}")

        try:
            response = (
                self.client.table('users')
                .select('telegram_id,username,full_name,weekly_points')
                .order('weekly_points', desc=True)
                .gt('weekly_points', 0)
                .limit(limit)
                .execute()
            )
            return _build_leaderboard(response.data or [])
        except Exception as e:
            logger.error(f"Error getting leaderboard from users table: {e}")
            return []

    def get_user_rank(self, telegram_id: int) -> int:
        try:
            leaderboard = self.get_weekly_leaderboard(limit=1000)
            for entry in leaderboard:
                if entry.telegram_id == telegram_id:
                    return entry.rank
            return 0
        except Exception as e:
            logger.error(f"Error getting user rank: {e}")
            return 0

    def save_weekly_leaderboard(self, leaderboard: List[LeaderboardEntry]) -> bool:
        logger.info("Skipping leaderboard persistence: not stored in Supabase")
        return True
    
    # ===== REFERRAL OPERATIONS =====
    
    def create_referral(self, referral: Referral) -> bool:
        """Record a referral."""
        try:
            data = {
                'referrer_id': referral.referrer_telegram_id,
                'referred_id': referral.referred_telegram_id,
                'referral_code': referral.referral_code,
                'created_at': referral.signup_date,
                'reward_claimed': referral.qualified
            }
            self.client.table('referrals').insert(data).execute()
            logger.info(
                f"✓ Created referral: {referral.referrer_telegram_id} -> {referral.referred_telegram_id}"
            )
            return True
        except Exception as e:
            logger.error(f"Error creating referral: {e}")
            return False
    
    def get_referrals_by_referrer(self, telegram_id: int) -> List[Referral]:
        """Get all referrals made by a user."""
        try:
            response = self.client.table('referrals').select('*').eq('referrer_id', telegram_id).execute()
            return [self._dict_to_referral(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting referrals for user {telegram_id}: {e}")
            return []
    
    def get_referral_count(self, telegram_id: int) -> int:
        try:
            response = (
                self.client.table('referrals')
                .select('id', count='exact')
                .eq('referrer_id', telegram_id)
                .eq('reward_claimed', True)
                .execute()
            )
            if getattr(response, "count", None) is not None:
                return int(response.count)
            return len(response.data or [])
        except Exception as e:
            logger.error(f"Error getting referral count: {e}")
            return 0

    def update_referral_qualification(self, telegram_id: int, qualified: bool) -> bool:
        try:
            self.client.table('referrals').update({'reward_claimed': qualified}).eq('referred_id', telegram_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error updating referral qualification: {e}")
            return False

    def get_user_by_referral_code(self, code: str) -> Optional[User]:
        try:
            response = self.client.table('users').select('*').eq('referral_code', code).execute()
            if not response.data:
                return None
            return self._dict_to_user(response.data[0])
        except Exception as e:
            logger.error(f"Error getting user by referral code: {e}")
            return None

    def get_random_question(
        self,
        question_type: str,
        user_telegram_id: int,
        exclude_answered: bool = True,
    ) -> Optional[Question]:
        try:
            response = self.client.table('questions').select('*').execute()
            records = response.data or []
            answered_ids = self._get_answered_question_ids(user_telegram_id) if exclude_answered else set()
            available: List[Question] = []
            for row in records:
                question_id = str(row.get('question_id'))  # Convert to string for comparison
                if not question_id or question_id in answered_ids:
                    continue
                if row.get('used', False):
                    continue
                available.append(self._dict_to_question(row))
            if not available:
                return None
            return random.choice(available)
        except Exception as e:
            logger.error(f"Error getting random question: {e}")
            return None

    def get_question(self, question_id: str) -> Optional[Question]:
        return self.get_question_by_id(question_id)

    def health_check(self) -> bool:
        try:
            self.client.table('users').select('telegram_id').limit(1).execute()
            return True
        except Exception:
            return False
        """Get all referrals made by a user."""
        try:
            response = self.client.table('referrals').select('*').eq('referrer_id', telegram_id).execute()
            return [self._dict_to_referral(row) for row in response.data]
        except Exception as e:
            logger.error(f"Error getting referrals for user {telegram_id}: {e}")
            return []
    
    # ===== HELPER METHODS =====
    
    def _user_to_dict(self, user: User) -> Dict[str, Any]:
        """Convert User object to dictionary for Supabase."""
        return {
            'telegram_id': user.telegram_id,
            'username': user.username,
            'full_name': user.full_name,
            'ap': user.ap,
            'total_ap': user.total_ap,
            'pp': user.pp,
            'weekly_points': user.weekly_points,
            'streak': user.streak,
            'last_played_date': user.last_played_date,
            'subscription_status': user.subscription_status,
            'subscription_expires': user.subscription_expires,
            'streak_freezes_remaining': user.streak_freezes_remaining,
            'total_questions': user.total_questions,
            'correct_answers': user.correct_answers,
            'created_at': user.created_at,
            'referral_code': user.referral_code,
            'referred_by': user.referred_by,
            'is_banned': user.is_banned,
            'suspicious_flags': user.suspicious_flags
        }
    
    def _dict_to_user(self, data: Dict[str, Any]) -> User:
        """Convert Supabase dictionary to User object."""
        return User(
            telegram_id=data['telegram_id'],
            username=data.get('username', ''),
            full_name=data.get('full_name', ''),
            ap=data.get('ap', 0),
            total_ap=data.get('total_ap', 0),
            pp=data.get('pp', 0),
            weekly_points=data.get('weekly_points', 0),
            streak=data.get('streak', 0),
            last_played_date=data.get('last_played_date'),
            subscription_status=data.get('subscription_status', 'free'),
            subscription_expires=data.get('subscription_expires'),
            streak_freezes_remaining=data.get('streak_freezes_remaining', 0),
            total_questions=data.get('total_questions', 0),
            correct_answers=data.get('correct_answers', 0),
            created_at=data.get('created_at', datetime.utcnow().isoformat()),
            referral_code=data.get('referral_code', ''),
            referred_by=data.get('referred_by', ''),
            is_banned=data.get('is_banned', False),
            suspicious_flags=data.get('suspicious_flags', 0)
        )
    
    def _question_to_dict(self, question: Question) -> Dict[str, Any]:
        """Convert Question object to dictionary for Supabase."""
        return {
            'question_id': question.question_id,
            'category': question.category,
            'question_text': question.question_text,
            'image_url': question.image_url,
            'option_a': question.option_a,
            'option_b': question.option_b,
            'option_c': question.option_c,
            'option_d': question.option_d,
            'correct_option': question.correct_option,
            'difficulty': question.difficulty,
            'time_limit_seconds': question.time_limit_seconds,
            'scheduled_date': question.scheduled_date,
            'used': question.used,
            'sponsor_name': question.sponsor_name
        }
    
    def _dict_to_question(self, data: Dict[str, Any]) -> Question:
        """Convert Supabase dictionary to Question object."""
        return Question(
            question_id=str(data['question_id']),
            category=data['category'],
            question_text=data['question_text'],
            image_url=data.get('image_url') or None,
            option_a=data['option_a'],
            option_b=data['option_b'],
            option_c=data['option_c'],
            option_d=data['option_d'],
            correct_option=data['correct_option'],
            difficulty=data.get('difficulty', 'Easy'),
            time_limit_seconds=int(data.get('time_limit_seconds') or 20),
            scheduled_date=data.get('scheduled_date'),
            used=bool(data.get('used', False)),
            sponsor_name=data.get('sponsor_name')
        )
    
    def _dict_to_attempt(self, data: Dict[str, Any]) -> Attempt:
        """Convert Supabase dictionary to Attempt object."""
        return Attempt(
            attempt_id=str(data.get('attempt_id') or data.get('id') or ''),
            telegram_id=int(data['telegram_id']),
            question_id=data['question_id'],
            selected_option=data['selected_option'],
            is_correct=bool(data.get('is_correct')),
            response_time_seconds=float(data.get('time_taken', 0) or 0),
            points_awarded=int(data.get('points_earned', 0) or 0),
            point_type=str(data.get('point_type') or ''),
            attempt_number=int(data.get('attempt_number') or 1),
            timestamp=data.get('timestamp', datetime.utcnow().isoformat())
        )
    
    def _dict_to_referral(self, data: Dict[str, Any]) -> Referral:
        """Convert Supabase dictionary to Referral object."""
        return Referral(
            referrer_telegram_id=int(data['referrer_id']),
            referred_telegram_id=int(data['referred_id']),
            referral_code=data['referral_code'],
            signup_date=data.get('created_at', datetime.utcnow().isoformat()),
            qualified=bool(data.get('reward_claimed', False)),
            bonus_awarded=bool(data.get('bonus_awarded', False))
        )

    def _generate_referral_code(self) -> str:
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


# Global database instance
db = SupabaseDatabase()
