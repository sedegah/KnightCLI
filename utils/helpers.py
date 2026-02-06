from datetime import datetime, timedelta
import re
import logging

logger = logging.getLogger(__name__)


def format_duration(seconds: float) -> str:
    Format duration in seconds to human-readable string.
    
    Args:
        seconds: Duration in seconds
    
    Returns:
        Formatted string (e.g., "2m 30s", "45s")
    if seconds < 60:
        return f"{int(seconds)}s"
    
    minutes = int(seconds // 60)
    remaining_seconds = int(seconds % 60)
    
    if remaining_seconds == 0:
        return f"{minutes}m"
    
    return f"{minutes}m {remaining_seconds}s"


def sanitize_username(username: str) -> str:
    Sanitize username for display.
    
    Args:
        username: Raw username
    
    Returns:
        Sanitized username
    if not username:
        return "Anonymous"
    
    username = username.lstrip("@")
    
    if len(username) > 20:
        username = username[:17] + "..."
    
    return username


def parse_referral_code(text: str) -> str:
    Extract referral code from start command.
    
    Args:
        text: Command text (e.g., "/start ABC123")
    
    Returns:
        Referral code or empty string
    parts = text.split()
    if len(parts) > 1:
        return parts[1].strip()
    return ""


def calculate_week_number() -> tuple:
    Calculate current week number and year.
    
    Returns:
        Tuple of (week_number, year)
    now = datetime.utcnow()
    week_number = now.isocalendar()[1]
    year = now.year
    return week_number, year


def is_valid_option(option: str) -> bool:
    Validate if option is A, B, C, or D.
    
    Args:
        option: Option string
    
    Returns:
        True if valid
    return option.upper() in ["A", "B", "C", "D"]


def escape_markdown(text: str) -> str:
    Escape special characters for Telegram MarkdownV2.
    
    Args:
        text: Text to escape
    
    Returns:
        Escaped text
    special_chars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '
    for char in special_chars:
        text = text.replace(char, f'\\{char}')
    return text


def format_points(points: int) -> str:
    Format points with commas for better readability.
    
    Args:
        points: Point value
    
    Returns:
        Formatted string (e.g., "1,234")
    return f"{points:,}"


def get_time_until_next_hour() -> int:
    Get minutes until the next hour.
    
    Returns:
        Minutes remaining
    now = datetime.utcnow()
    next_hour = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    delta = next_hour - now
    return int(delta.total_seconds() / 60)


def validate_telegram_id(telegram_id: any) -> bool:
    Validate if a value is a valid Telegram ID.
    
    Args:
        telegram_id: Value to validate
    
    Returns:
        True if valid
    try:
        tid = int(telegram_id)
        return tid > 0
    except:
        return False


def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    Truncate text to maximum length.
    
    Args:
        text: Text to truncate
        max_length: Maximum length
        suffix: Suffix to add if truncated
    
    Returns:
        Truncated text
    if len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix


def get_ordinal_suffix(number: int) -> str:
    Get ordinal suffix for a number (1st, 2nd, 3rd, etc.).
    
    Args:
        number: Number
    
    Returns:
        Ordinal string (e.g., "1st", "42nd")
    if 10 <= number % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(number % 10, "th")
    
    return f"{number}{suffix}"
