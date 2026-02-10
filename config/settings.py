import os
from typing import List
from dotenv import load_dotenv
import pytz
import json

load_dotenv()


class Settings:
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    
    # Legacy Google Sheets settings (kept only for migration scripts)
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

    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    # Legacy PostgreSQL connection (deprecated - use Supabase instead)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "5"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", "1800"))
    DB_POOL_PRE_PING: bool = os.getenv("DB_POOL_PRE_PING", "True").lower() == "true"
    DB_CONNECT_TIMEOUT: int = int(os.getenv("DB_CONNECT_TIMEOUT", "10"))
    DB_TCP_KEEPALIVES: bool = os.getenv("DB_TCP_KEEPALIVES", "True").lower() == "true"
    DB_KEEPALIVES_IDLE: int = int(os.getenv("DB_KEEPALIVES_IDLE", "30"))
    DB_KEEPALIVES_INTERVAL: int = int(os.getenv("DB_KEEPALIVES_INTERVAL", "10"))
    DB_KEEPALIVES_COUNT: int = int(os.getenv("DB_KEEPALIVES_COUNT", "5"))

    # Read-only mode cache (persist across restarts when using Render disk)
    READONLY_USER_CACHE_PATH: str = os.getenv("READONLY_USER_CACHE_PATH", "user_cache.json")
    
    # Server configuration for health checks
    PORT: int = int(os.getenv("PORT", "8080"))
    
    @classmethod
    def validate(cls) -> List[str]:
        errors = []
        
        if not cls.TELEGRAM_BOT_TOKEN:
            errors.append("TELEGRAM_BOT_TOKEN is required")
        
        if not cls.SUPABASE_URL:
            errors.append("SUPABASE_URL is required")

        if not cls.SUPABASE_KEY:
            errors.append("SUPABASE_KEY is required")
        
        return errors
    
    @classmethod
    def is_admin(cls, telegram_id: int) -> bool:
        return telegram_id in cls.ADMIN_TELEGRAM_IDS


settings = Settings()

validation_errors = settings.validate()
if validation_errors and not settings.DEBUG:
    raise ValueError(f"Configuration errors: {', '.join(validation_errors)}")
