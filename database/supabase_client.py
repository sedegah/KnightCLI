"""Supabase database client for managing all data operations."""
import logging
from typing import Optional, List, Dict, Any
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
    
    def create_user(self, user: User) -> bool:
        """Create a new user."""
        try:
            data = self._user_to_dict(user)
            self.client.table('users').insert(data).execute()
            logger.info(f"✓ Created user: {user.telegram_id}")
            return True
        except APIError as e:
            if 'duplicate key' in str(e).lower():
                logger.warning(f"User {user.telegram_id} already exists")
                return False
            logger.error(f"Error creating user: {e}")
            return False
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return False
    
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
    
    def record_attempt(self, attempt: Attempt) -> bool:
        """Record a quiz attempt."""
        try:
            data = {
                'telegram_id': attempt.telegram_id,
                'question_id': attempt.question_id,
                'selected_option': attempt.selected_option,
                'is_correct': attempt.is_correct,
                'time_taken': attempt.time_taken,
                'points_earned': attempt.points_earned,
                'timestamp': attempt.timestamp
            }
            self.client.table('attempts').insert(data).execute()
            logger.debug(f"Recorded attempt for user {attempt.telegram_id}")
            return True
        except Exception as e:
            logger.error(f"Error recording attempt: {e}")
            return False
    
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
            # Supabase doesn't support update all directly, but we can use a stored procedure
            # For now, we'll get all users and update them
            response = self.client.table('users').select('telegram_id').execute()
            user_ids = [row['telegram_id'] for row in response.data]
            
            for user_id in user_ids:
                self.client.table('users').update({'weekly_points': 0}).eq('telegram_id', user_id).execute()
            
            logger.info("✓ Reset weekly points for all users")
            return True
        except Exception as e:
            logger.error(f"Error resetting weekly points: {e}")
            return False
    
    # ===== REFERRAL OPERATIONS =====
    
    def create_referral(self, referral: Referral) -> bool:
        """Record a referral."""
        try:
            data = {
                'referrer_id': referral.referrer_id,
                'referred_id': referral.referred_id,
                'referral_code': referral.referral_code,
                'created_at': referral.created_at,
                'reward_claimed': referral.reward_claimed
            }
            self.client.table('referrals').insert(data).execute()
            logger.info(f"✓ Created referral: {referral.referrer_id} -> {referral.referred_id}")
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
    
    # ===== HELPER METHODS =====
    
    def _user_to_dict(self, user: User) -> Dict[str, Any]:
        """Convert User object to dictionary for Supabase."""
        return {
            'telegram_id': user.telegram_id,
            'username': user.username,
            'full_name': user.full_name,
            'ap': user.ap,
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
            'explanation': question.explanation,
            'difficulty': question.difficulty,
            'tags': question.tags
        }
    
    def _dict_to_question(self, data: Dict[str, Any]) -> Question:
        """Convert Supabase dictionary to Question object."""
        return Question(
            question_id=data['question_id'],
            category=data['category'],
            question_text=data['question_text'],
            image_url=data.get('image_url'),
            option_a=data['option_a'],
            option_b=data['option_b'],
            option_c=data['option_c'],
            option_d=data['option_d'],
            correct_option=data['correct_option'],
            explanation=data.get('explanation', ''),
            difficulty=data.get('difficulty', 'medium'),
            tags=data.get('tags', '')
        )
    
    def _dict_to_attempt(self, data: Dict[str, Any]) -> Attempt:
        """Convert Supabase dictionary to Attempt object."""
        return Attempt(
            telegram_id=data['telegram_id'],
            question_id=data['question_id'],
            selected_option=data['selected_option'],
            is_correct=data['is_correct'],
            time_taken=data.get('time_taken', 0),
            points_earned=data.get('points_earned', 0),
            timestamp=data.get('timestamp', datetime.utcnow().isoformat())
        )
    
    def _dict_to_referral(self, data: Dict[str, Any]) -> Referral:
        """Convert Supabase dictionary to Referral object."""
        return Referral(
            referrer_id=data['referrer_id'],
            referred_id=data['referred_id'],
            referral_code=data['referral_code'],
            created_at=data.get('created_at', datetime.utcnow().isoformat()),
            reward_claimed=data.get('reward_claimed', False)
        )


# Global database instance
db = SupabaseDatabase()
