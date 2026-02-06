"""Provides CRUD operations for all data models."""
import gspread
from google.oauth2.service_account import Credentials
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import logging
import random
import string
import json

from config.settings import settings
from config.constants import SHEET_NAMES, COLUMNS
from database.models import User, Question, Attempt, LeaderboardEntry, Referral

logger = logging.getLogger(__name__)


class SheetsDatabase:
    def __init__(self):
        self.client = None
        self.spreadsheet = None
        self._connect()
    
    def _connect(self):
        try:
            scopes = [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
            
            # Load credentials from JSON env var or file
            if settings.GOOGLE_CREDENTIALS_JSON:
                creds_dict = json.loads(settings.GOOGLE_CREDENTIALS_JSON)
                creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
            else:
                creds = Credentials.from_service_account_file(
                    settings.GOOGLE_SHEETS_CREDENTIALS,
                    scopes=scopes
                )
            
            self.client = gspread.authorize(creds)
            self.spreadsheet = self.client.open_by_key(settings.SPREADSHEET_ID)
            logger.info("Connected to Google Sheets successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Google Sheets: {e}")
            raise
    
    def _get_worksheet(self, sheet_name: str):
        try:
            return self.spreadsheet.worksheet(sheet_name)
        except gspread.WorksheetNotFound:
            logger.info(f"Creating worksheet: {sheet_name}")
            worksheet = self.spreadsheet.add_worksheet(title=sheet_name, rows=1000, cols=20)
            if sheet_name in COLUMNS:
                worksheet.append_row(COLUMNS[sheet_name])
            return worksheet
    
    
    def get_user(self, telegram_id: int) -> Optional[User]:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["users"])
            records = worksheet.get_all_values()
            
            for i, row in enumerate(records[1:], start=2):
                if row and row[0] == str(telegram_id):
                    return User.from_row(row)
            return None
        except Exception as e:
            logger.error(f"Error getting user {telegram_id}: {e}")
            return None
    
    def create_user(self, telegram_id: int, username: str, full_name: str, 
                    referred_by: str = "") -> User:
        try:
            referral_code = self._generate_referral_code()
            user = User(
                telegram_id=telegram_id,
                username=username,
                full_name=full_name,
                referral_code=referral_code,
                referred_by=referred_by,
            )
            
            worksheet = self._get_worksheet(SHEET_NAMES["users"])
            worksheet.append_row(user.to_row())
            
            logger.info(f"Created user: {telegram_id} ({username})")
            return user
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise
    
    def update_user(self, user: User) -> bool:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["users"])
            records = worksheet.get_all_values()
            
            for i, row in enumerate(records[1:], start=2):
                if row and row[0] == str(user.telegram_id):
                    worksheet.update(f'A{i}:Q{i}', [user.to_row()])
                    logger.info(f"Updated user: {user.telegram_id}")
                    return True
            
            logger.warning(f"User not found for update: {user.telegram_id}")
            return False
        except Exception as e:
            logger.error(f"Error updating user: {e}")
            return False
    
    def get_user_by_referral_code(self, code: str) -> Optional[User]:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["users"])
            records = worksheet.get_all_values()
            
            for row in records[1:]:
                if row and len(row) > 13 and row[13] == code:
                    return User.from_row(row)
            return None
        except Exception as e:
            logger.error(f"Error getting user by referral code: {e}")
            return None
    
    
    def get_random_question(self, question_type: str, 
                           user_telegram_id: int,
                           exclude_answered: bool = True) -> Optional[Question]:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["questions"])
            records = worksheet.get_all_values()
            
            answered_ids = set()
            if exclude_answered:
                answered_ids = self._get_answered_question_ids(user_telegram_id)
            
            available = []
            for row in records[1:]:
                if not row or len(row) < 10:
                    continue
                
                is_used = row[12].upper() == "TRUE" if len(row) > 12 and row[12] else False
                
                if not is_used and row[0] not in answered_ids:
                    available.append(Question.from_row(row))
            
            if not available:
                logger.warning(f"No available questions for type: {question_type}")
                return None
            
            return random.choice(available)
        except Exception as e:
            logger.error(f"Error getting random question: {e}")
            return None
    
    def get_question(self, question_id: str) -> Optional[Question]:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["questions"])
            records = worksheet.get_all_values()
            
            for row in records[1:]:
                if row and row[0] == question_id:
                    return Question.from_row(row)
            return None
        except Exception as e:
            logger.error(f"Error getting question {question_id}: {e}")
            return None
    
    
    def create_attempt(self, attempt: Attempt) -> bool:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["attempts"])
            worksheet.append_row(attempt.to_row())
            logger.info(f"Created attempt: {attempt.attempt_id}")
            return True
        except Exception as e:
            logger.error(f"Error creating attempt: {e}")
            return False
    
    def get_user_attempts_count(self, telegram_id: int, question_id: str) -> int:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["attempts"])
            records = worksheet.get_all_values()
            
            count = 0
            for row in records[1:]:
                if row and len(row) >= 3:
                    if row[1] == str(telegram_id) and row[2] == question_id:
                        count += 1
            return count
        except Exception as e:
            logger.error(f"Error getting attempt count: {e}")
            return 0
    
    def get_user_hourly_attempts(self, telegram_id: int) -> int:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["attempts"])
            records = worksheet.get_all_values()
            
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            count = 0
            
            for row in records[1:]:
                if row and len(row) >= 11:
                    if row[1] == str(telegram_id):
                        try:
                            timestamp = datetime.fromisoformat(row[10])
                            if timestamp > one_hour_ago:
                                count += 1
                        except:
                            continue
            return count
        except Exception as e:
            logger.error(f"Error getting hourly attempts: {e}")
            return 0
    
    def _get_answered_question_ids(self, telegram_id: int) -> set:
        """Get all questions answered by a user."""
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["attempts"])
            records = worksheet.get_all_values()
            
            answered = set()
            for row in records[1:]:
                if row and len(row) >= 3:
                    if row[1] == str(telegram_id):
                        answered.add(row[2])
            return answered
        except Exception as e:
            logger.error(f"Error getting answered questions: {e}")
            return set()
    
    
    def get_weekly_leaderboard(self, limit: int = 50) -> List[LeaderboardEntry]:
        try:
            now = datetime.utcnow()
            week_number = now.isocalendar()[1]
            year = now.year
            
            worksheet = self._get_worksheet(SHEET_NAMES["users"])
            records = worksheet.get_all_values()
            
            users = []
            for row in records[1:]:
                if row and len(row) >= 6:
                    try:
                        users.append({
                            'telegram_id': int(row[0]),
                            'username': row[1],
                            'weekly_points': int(row[5]),
                        })
                    except:
                        continue
            
            users.sort(key=lambda x: x['weekly_points'], reverse=True)
            
            leaderboard = []
            for rank, user_data in enumerate(users[:limit], start=1):
                entry = LeaderboardEntry(
                    week_number=week_number,
                    year=year,
                    telegram_id=user_data['telegram_id'],
                    username=user_data['username'],
                    points=user_data['weekly_points'],
                    rank=rank,
                )
                leaderboard.append(entry)
            
            return leaderboard
        except Exception as e:
            logger.error(f"Error getting leaderboard: {e}")
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
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["leaderboard"])
            rows = [entry.to_row() for entry in leaderboard]
            worksheet.append_rows(rows)
            logger.info(f"Saved {len(leaderboard)} leaderboard entries")
            return True
        except Exception as e:
            logger.error(f"Error saving leaderboard: {e}")
            return False
    
    def reset_weekly_points(self) -> bool:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["users"])
            records = worksheet.get_all_values()
            
            for i in range(2, len(records) + 1):
                worksheet.update(f'F{i}', '0')
            
            logger.info("Reset weekly points for all users")
            return True
        except Exception as e:
            logger.error(f"Error resetting weekly points: {e}")
            return False
    
    
    def create_referral(self, referral: Referral) -> bool:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["referrals"])
            worksheet.append_row(referral.to_row())
            logger.info(f"Created referral: {referral.referral_code}")
            return True
        except Exception as e:
            logger.error(f"Error creating referral: {e}")
            return False
    
    def get_referral_count(self, telegram_id: int) -> int:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["referrals"])
            records = worksheet.get_all_values()
            
            count = 0
            for row in records[1:]:
                if row and len(row) >= 5:
                    if row[0] == str(telegram_id) and row[4].lower() == "true":
                        count += 1
            return count
        except Exception as e:
            logger.error(f"Error getting referral count: {e}")
            return 0
    
    def update_referral_qualification(self, referred_telegram_id: int) -> bool:
        try:
            worksheet = self._get_worksheet(SHEET_NAMES["referrals"])
            records = worksheet.get_all_values()
            
            for i, row in enumerate(records[1:], start=2):
                if row and row[1] == str(referred_telegram_id):
                    worksheet.update(f'E{i}', 'true')
                    return True
            return False
        except Exception as e:
            logger.error(f"Error updating referral qualification: {e}")
            return False
    
    
    def _generate_referral_code(self) -> str:
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    
    def health_check(self) -> bool:
        try:
            self.spreadsheet.title
            return True
        except:
            return False


db = SheetsDatabase()
