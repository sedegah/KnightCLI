import os
from typing import List
from dotenv import load_dotenv
import pytz
import json

load_dotenv()


class Settings:
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    
    GOOGLE_SHEETS_CREDENTIALS: str = os.getenv("GOOGLE_SHEETS_CREDENTIALS", "credentials.json")
    GOOGLE_CREDENTIALS_JSON: str = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
    SPREADSHEET_ID: str = os.getenv("SPREADSHEET_ID", "")
    
    ADMIN_TELEGRAM_IDS: List[int] = [
        int(id.strip()) for id in os.getenv("ADMIN_TELEGRAM_IDS", "").split(",") if id.strip()
    ]
    
    PRIZE_ROUND_MORNING_HOUR: int = int(os.getenv("PRIZE_ROUND_MORNING_HOUR", "9"))
    PRIZE_ROUND_EVENING_HOUR: int = int(os.getenv("PRIZE_ROUND_EVENING_HOUR", "21"))
    TIMEZONE = pytz.timezone(os.getenv("TIMEZONE", "UTC"))
    
    FREE_USER_HOURLY_LIMIT: int = int(os.getenv("FREE_USER_HOURLY_LIMIT", "20"))
    SUBSCRIBER_HOURLY_LIMIT: int = int(os.getenv("SUBSCRIBER_HOURLY_LIMIT", "40"))
    DAILY_REMINDER_HOUR: int = int(os.getenv("DAILY_REMINDER_HOUR", "18"))
    
    FREE_AP_PER_CORRECT: int = int(os.getenv("FREE_AP_PER_CORRECT", "5"))
    SUBSCRIBER_AP_PER_CORRECT: int = int(os.getenv("SUBSCRIBER_AP_PER_CORRECT", "8"))
    FREE_PP_PER_CORRECT: int = int(os.getenv("FREE_PP_PER_CORRECT", "10"))
    SUBSCRIBER_PP_PER_CORRECT: int = int(os.getenv("SUBSCRIBER_PP_PER_CORRECT", "15"))
    
    MONTHLY_SUBSCRIPTION_PRICE_USD: float = float(os.getenv("MONTHLY_SUBSCRIPTION_PRICE_USD", "4.99"))
    
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Server configuration for health checks
    PORT: int = int(os.getenv("PORT", "8080"))
    
    @classmethod
    def validate(cls) -> List[str]:
        errors = []
        
        if not cls.TELEGRAM_BOT_TOKEN:
            errors.append("TELEGRAM_BOT_TOKEN is required")
        
        if not cls.SPREADSHEET_ID:
            errors.append("SPREADSHEET_ID is required")
        
        return errors
    
    @classmethod
    def is_admin(cls, telegram_id: int) -> bool:
        return telegram_id in cls.ADMIN_TELEGRAM_IDS


settings = Settings()

validation_errors = settings.validate()
if validation_errors and not settings.DEBUG:
    raise ValueError(f"Configuration errors: {', '.join(validation_errors)}")
