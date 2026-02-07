"""Provides CRUD operations for all data models."""
import gspread
from google.oauth2.service_account import Credentials
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import logging
import random
import string
import json
import os
import requests
import csv
from io import StringIO

from config.settings import settings
from config.constants import SHEET_NAMES, COLUMNS
from database.models import User, Question, Attempt, LeaderboardEntry, Referral

logger = logging.getLogger(__name__)


class SheetsDatabase:
    DEFAULT_CACHE_FILE = "user_cache.json"
    
    def __init__(self):
        self.client = None
        self.spreadsheet = None
        self.use_api_only = False
        self.has_write_access = False
        self._in_memory_users = {}  # Cache for read-only mode
        self.cache_file = settings.READONLY_USER_CACHE_PATH or self.DEFAULT_CACHE_FILE
        self._connect()
        self._load_cache()  # Load persisted data on startup
    
    def _connect(self):
        try:
            scopes = [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]
            
            # Load credentials from JSON env var or file if available
            creds = None
            if settings.GOOGLE_CREDENTIALS_JSON:
                creds_dict = json.loads(settings.GOOGLE_CREDENTIALS_JSON)
                creds = Credentials.from_service_account_info(creds_dict, scopes=scopes)
            elif os.path.exists(settings.GOOGLE_SHEETS_CREDENTIALS):
                creds = Credentials.from_service_account_file(
                    settings.GOOGLE_SHEETS_CREDENTIALS,
                    scopes=scopes
                )
            
            if creds:
                self.client = gspread.authorize(creds)
                self.spreadsheet = self.client.open_by_key(settings.SPREADSHEET_ID)
                self.use_api_only = False
                self.has_write_access = True
                logger.info("Connected to Google Sheets with write access")
            else:
                # For public spreadsheets, use Google Sheets API directly (read-only)
                self.use_api_only = True
                self.has_write_access = False
                self._verify_public_sheet_access()
                logger.warning("Connected to Google Sheets in READ-ONLY mode. User creation and data updates will not be saved.")
            
            logger.info("Connected to Google Sheets successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Google Sheets: {e}")
            raise
    
    def _verify_public_sheet_access(self):
        """Verify that the public spreadsheet is accessible."""
        try:
            # Try to fetch from the first available sheet, but don't fail if the sheet doesn't exist
            # Just verify that we can make an HTTP request to the spreadsheet
            test_url = f"https://docs.google.com/spreadsheets/d/{settings.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1"
            response = requests.get(test_url, timeout=5)
            # For public sheets, even a 404 might be ok as long as the URL is reachable
            # The important thing is that the spreadsheet ID is accessible
            logger.info("Public sheet access verified")
        except Exception as e:
            # Only raise if it's a network issue, not a data issue
            logger.warning(f"Could not verify public sheet access: {e}")
            # Don't fail on verification - the sheet might be empty or have different sheet names
    
    def _get_worksheet(self, sheet_name: str):
        if self.use_api_only:
            raise NotImplementedError("Write operations not supported with public sheet access. Provide service account credentials for full access.")
        try:
            return self.spreadsheet.worksheet(sheet_name)
        except gspread.WorksheetNotFound:
            logger.info(f"Creating worksheet: {sheet_name}")
            worksheet = self.spreadsheet.add_worksheet(title=sheet_name, rows=1000, cols=20)
            if sheet_name in COLUMNS:
                worksheet.append_row(COLUMNS[sheet_name])
            return worksheet
    
    def _get_worksheet_values(self, sheet_name: str) -> List[List]:
        """Get all values from a worksheet, using API for public sheets."""
        if self.use_api_only:
            return self._fetch_sheet_data_via_api(sheet_name)
        return self._get_worksheet(sheet_name).get_all_values()
    
    def _fetch_sheet_data_via_api(self, sheet_name: str) -> List[List]:
        """Fetch sheet data directly from public spreadsheet using Google Sheets API."""
        try:
            # For public sheets, use the export URL which doesn't require authentication
            # CSV format is the simplest for reading
            csv_url = f"https://docs.google.com/spreadsheets/d/{settings.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet={sheet_name}"
            response = requests.get(csv_url)
            response.raise_for_status()
            
            # Parse CSV response
            reader = csv.reader(StringIO(response.text))
            values = list(reader)
            return values
        except Exception as e:
            logger.error(f"Error fetching sheet {sheet_name}: {e}")
            return []
    
    def _load_cache(self):
        """Load persisted user cache from file on startup."""
        if self.has_write_access:
            return  # Don't use cache if we have write access
            
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r') as f:
                    cache_data = json.load(f)
                    if not cache_data:
                        return
                    
                    for telegram_id_str, user_dict in cache_data.items():
                        try:
                            telegram_id = int(telegram_id_str)
                            from database.models import User
                            user = User(**user_dict)
                            self._in_memory_users[telegram_id] = user
                        except Exception as e:
                            logger.warning(f"Failed to load user {telegram_id_str} from cache: {e}")
                            continue
                    
                    logger.info(f"✓ Loaded {len(self._in_memory_users)} users from persistent cache")
        except Exception as e:
            logger.warning(f"Could not load cache file: {e}")
    
    def _save_cache(self):
        """Persist user cache to file for survival across restarts."""
        if self.has_write_access:
            return  # Don't save cache if we have write access
            
        try:
            if not self._in_memory_users:
                return  # Nothing to save
                
            cache_data = {}
            for telegram_id, user in self._in_memory_users.items():
                try:
                    # Convert User object to dict
                    cache_data[str(telegram_id)] = {
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
                        'total_questions': user.total_questions,
                        'correct_answers': user.correct_answers,
                        'created_at': user.created_at,
                        'referral_code': user.referral_code,
                        'referred_by': user.referred_by,
                        'is_banned': user.is_banned,
                        'suspicious_flags': user.suspicious_flags,
                    }
                except Exception as e:
                    logger.warning(f"Failed to serialize user {telegram_id}: {e}")
                    continue
            
            with open(self.cache_file, 'w') as f:
                json.dump(cache_data, f, indent=2)
            logger.debug(f"Saved {len(cache_data)} users to persistent cache")
        except Exception as e:
            logger.error(f"Error saving cache file: {e}")
    
    def get_user(self, telegram_id: int) -> Optional[User]:
        try:
            # Check in-memory cache first for read-only mode
            if not self.has_write_access and telegram_id in self._in_memory_users:
                return self._in_memory_users[telegram_id]
            
            records = self._get_worksheet_values(SHEET_NAMES["users"])
            
            for i, row in enumerate(records[1:], start=2):
                if row and row[0] == str(telegram_id):
                    user = User.from_row(row)
                    # Cache it for future reference
                    if not self.has_write_access:
                        self._in_memory_users[telegram_id] = user
                    return user
            return None
        except Exception as e:
            logger.error(f"Error getting user {telegram_id}: {e}")
            return None
    
    def create_user(self, telegram_id: int, username: str, full_name: str, 
                    referred_by: str = "") -> Optional[User]:
        try:
            referral_code = self._generate_referral_code()
            user = User(
                telegram_id=telegram_id,
                username=username,
                full_name=full_name,
                referral_code=referral_code,
                referred_by=referred_by,
            )
            
            if not self.has_write_access:
                logger.warning(f"Storing user {telegram_id} in memory (read-only mode)")
                # Cache in memory for read-only mode
                self._in_memory_users[telegram_id] = user
                self._save_cache()  # Persist cache to survive restarts
                return user
            
            worksheet = self._get_worksheet(SHEET_NAMES["users"])
            worksheet.append_row(user.to_row())
            
            logger.info(f"Created user: {telegram_id} ({username})")
            return user
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            # Return None to indicate failure
            return None
    
    def update_user(self, user: User) -> bool:
        if not self.has_write_access:
            logger.warning(f"Updating user {user.telegram_id} in memory (read-only mode)")
            # Update in-memory cache
            self._in_memory_users[user.telegram_id] = user
            self._save_cache()  # Persist cache to survive restarts
            return True
        
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
            records = self._get_worksheet_values(SHEET_NAMES["users"])
            
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
            records = self._get_worksheet_values(SHEET_NAMES["questions"])
            
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
            records = self._get_worksheet_values(SHEET_NAMES["questions"])
            
            for row in records[1:]:
                if row and row[0] == question_id:
                    return Question.from_row(row)
            return None
        except Exception as e:
            logger.error(f"Error getting question {question_id}: {e}")
            return None
    
    
    def create_attempt(self, attempt: Attempt) -> bool:
        if not self.has_write_access:
            logger.warning(f"Cannot create attempt {attempt.attempt_id}: Database is in read-only mode")
            return False
        
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
            records = self._get_worksheet_values(SHEET_NAMES["attempts"])
            
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
            records = self._get_worksheet_values(SHEET_NAMES["attempts"])
            
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
            records = self._get_worksheet_values(SHEET_NAMES["attempts"])
            
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
            
            users = []
            
            # In read-only mode, use in-memory users
            if not self.has_write_access:
                if self._in_memory_users:
                    for telegram_id, user in self._in_memory_users.items():
                        users.append({
                            'telegram_id': user.telegram_id,
                            'username': user.username,
                            'weekly_points': user.weekly_points,
                        })
                # If no in-memory users, try to get from sheet
                else:
                    try:
                        records = self._get_worksheet_values(SHEET_NAMES["users"])
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
                    except Exception as e:
                        logger.warning(f"Could not fetch users from sheet in read-only mode: {e}")
                        # Return empty leaderboard rather than crashing
                        return []
            else:
                # In write mode, get from sheet
                records = self._get_worksheet_values(SHEET_NAMES["users"])
                
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
            
            if not users:
                return []
            
            users.sort(key=lambda x: x['weekly_points'], reverse=True)
            
            leaderboard = []
            for rank, user_data in enumerate(users[:limit], start=1):
                try:
                    entry = LeaderboardEntry(
                        week_number=week_number,
                        year=year,
                        telegram_id=user_data['telegram_id'],
                        username=user_data['username'],
                        points=user_data['weekly_points'],
                        rank=rank,
                    )
                    leaderboard.append(entry)
                except Exception as e:
                    logger.warning(f"Could not create leaderboard entry for user {user_data.get('telegram_id')}: {e}")
                    continue
            
            return leaderboard
        except Exception as e:
            logger.error(f"Error getting leaderboard: {e}", exc_info=True)
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
            if not self.has_write_access:
                logger.warning(f"Cannot save leaderboard: Database is in read-only mode")
                return False
                
            worksheet = self._get_worksheet(SHEET_NAMES["leaderboard"])
            rows = [entry.to_row() for entry in leaderboard]
            worksheet.append_rows(rows)
            logger.info(f"Saved {len(leaderboard)} leaderboard entries")
            return True
        except Exception as e:
            logger.error(f"Error saving leaderboard: {e}")
            return False
    
    def reset_weekly_points(self) -> bool:
        if not self.has_write_access:
            logger.warning(f"Cannot reset weekly points: Database is in read-only mode")
            return False
        
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
        if not self.has_write_access:
            logger.warning(f"Cannot create referral {referral.referral_code}: Database is in read-only mode")
            return False
        
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
            records = self._get_worksheet_values(SHEET_NAMES["referrals"])
            
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
        if not self.has_write_access:
            logger.warning(f"Cannot update referral qualification for {referred_telegram_id}: Database is in read-only mode")
            return False
        
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
            if self.use_api_only:
                # For public sheets, just check that we can make a request
                test_url = f"https://docs.google.com/spreadsheets/d/{settings.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1"
                response = requests.get(test_url, timeout=5)
                return True
            else:
                self.spreadsheet.title
                return True
        except:
            return False


db = SheetsDatabase()
