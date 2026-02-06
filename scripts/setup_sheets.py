"""Run this once before starting the bot."""
import sys
import logging
from database.sheets_client import db
from config.constants import SHEET_NAMES, COLUMNS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def setup_sheets():
    try:
        logger.info("Starting Google Sheets setup...")
        
        if not db.health_check():
            logger.error("Failed to connect to Google Sheets")
            return False
        
        logger.info("Connected to Google Sheets successfully")
        
        for sheet_key, sheet_name in SHEET_NAMES.items():
            logger.info(f"Setting up sheet: {sheet_name}")
            
            try:
                worksheet = db._get_worksheet(sheet_name)
                
                headers = worksheet.row_values(1)
                expected_headers = COLUMNS[sheet_key]
                
                if not headers or headers != expected_headers:
                    worksheet.clear()
                    worksheet.append_row(expected_headers)
                    logger.info(f"✓ Headers set for {sheet_name}")
                else:
                    logger.info(f"✓ Sheet {sheet_name} already configured")
            
            except Exception as e:
                logger.error(f"Error setting up {sheet_name}: {e}")
                return False
        
        logger.info("\n" + "="*50)
        logger.info("✅ Google Sheets setup completed successfully!")
        logger.info("="*50)
        logger.info("\nSheets created:")
        for sheet_name in SHEET_NAMES.values():
            logger.info(f"  - {sheet_name}")
        
        logger.info("\nYou can now run the bot with: python main.py")
        return True
    
    except Exception as e:
        logger.error(f"Setup failed: {e}")
        return False


def add_sample_questions():
    logger.info("\nAdding sample questions...")
    
    from database.models import Question
    
    sample_questions = [
        Question(
            question_id="q1",
            category="Geography",
            question_text="What is the capital of France?",
            image_url=None,
            option_a="London",
            option_b="Berlin",
            option_c="Paris",
            option_d="Madrid",
            correct_option="C",
            difficulty="Easy",
            time_limit_seconds=20
        ),
        Question(
            question_id="q2",
            category="Math",
            question_text="What is 2 + 2?",
            image_url=None,
            option_a="3",
            option_b="4",
            option_c="5",
            option_d="6",
            correct_option="B",
            difficulty="Easy",
            time_limit_seconds=20
        ),
        Question(
            question_id="q3",
            category="Art",
            question_text="Who painted the Mona Lisa?",
            image_url=None,
            option_a="Vincent van Gogh",
            option_b="Pablo Picasso",
            option_c="Leonardo da Vinci",
            option_d="Michelangelo",
            correct_option="C",
            difficulty="Medium",
            time_limit_seconds=25
        ),
        Question(
            question_id="q4",
            category="Science",
            question_text="What is the largest planet in our solar system?",
            image_url=None,
            option_a="Earth",
            option_b="Mars",
            option_c="Jupiter",
            option_d="Saturn",
            correct_option="C",
            difficulty="Easy",
            time_limit_seconds=20
        ),
        Question(
            question_id="q5",
            category="History",
            question_text="In which year did World War II end?",
            image_url=None,
            option_a="1943",
            option_b="1944",
            option_c="1945",
            option_d="1946",
            correct_option="C",
            difficulty="Medium",
            time_limit_seconds=25
        ),
    ]
    
    try:
        worksheet = db._get_worksheet(SHEET_NAMES["questions"])
        
        for question in sample_questions:
            worksheet.append_row(question.to_row())
        
        logger.info(f"✓ Added {len(sample_questions)} sample questions")
        return True
    
    except Exception as e:
        logger.error(f"Error adding sample questions: {e}")
        return False


if __name__ == "__main__":
    logger.info("="*50)
    logger.info("Telegram Quiz Bot - Database Setup")
    logger.info("="*50)
    
    success = setup_sheets()
    
    if success:
        response = input("\nWould you like to add sample questions for testing? (y/n): ")
        if response.lower() == 'y':
            add_sample_questions()
    else:
        logger.error("\nSetup failed. Please check your configuration and try again.")
        sys.exit(1)
