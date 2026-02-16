import logging
import sys
from typing import List

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def migrate():
    """Main migration function."""
    try:
        # Import old database client (SQLAlchemy)
        logger.info("📚 Importing old database client...")
        try:
            from database.db import session_scope, SessionLocal
            logger.info("✅ Old database client loaded")
        except Exception as e:
            logger.error(f"❌ Failed to load old database: {e}")
            logger.error("Make sure DATABASE_URL is set in your environment")
            return False
        
        # Import new database client (Supabase)
        logger.info("📚 Importing Supabase client...")
        try:
            from database.supabase_client import db as supabase_db
            logger.info("✅ Supabase client loaded")
        except Exception as e:
            logger.error(f"❌ Failed to load Supabase: {e}")
            logger.error("Make sure SUPABASE_URL and SUPABASE_KEY are set")
            return False
        
        # Import models
        from database.models import User, Attempt, Referral
        
        # Migrate Users
        logger.info("\n" + "="*50)
        logger.info("👥 MIGRATING USERS")
        logger.info("="*50)
        
        with session_scope() as session:
            # Get all users from old database
            users = session.query(User).all()
            logger.info(f"Found {len(users)} users in old database")
            
            success_count = 0
            skip_count = 0
            error_count = 0
            
            for i, user in enumerate(users, 1):
                try:
                    # Check if user already exists in Supabase
                    existing = supabase_db.get_user(user.telegram_id)
                    if existing:
                        logger.info(f"⏭️  [{i}/{len(users)}] User {user.telegram_id} already exists, skipping")
                        skip_count += 1
                        continue
                    
                    # Create user in Supabase
                    success = supabase_db.create_user(user)
                    if success:
                        logger.info(f"✅ [{i}/{len(users)}] Migrated user: {user.telegram_id} (@{user.username})")
                        success_count += 1
                    else:
                        logger.warning(f"⚠️  [{i}/{len(users)}] Failed to migrate user: {user.telegram_id}")
                        error_count += 1
                        
                except Exception as e:
                    logger.error(f"❌ [{i}/{len(users)}] Error migrating user {user.telegram_id}: {e}")
                    error_count += 1
            
            logger.info(f"\n📊 User Migration Summary:")
            logger.info(f"  ✅ Successfully migrated: {success_count}")
            logger.info(f"  ⏭️  Skipped (already exist): {skip_count}")
            logger.info(f"  ❌ Errors: {error_count}")
        
        # Migrate Attempts
        logger.info("\n" + "="*50)
        logger.info("📝 MIGRATING ATTEMPTS")
        logger.info("="*50)
        
        with session_scope() as session:
            attempts = session.query(Attempt).all()
            logger.info(f"Found {len(attempts)} attempts in old database")
            
            success_count = 0
            error_count = 0
            
            for i, attempt in enumerate(attempts, 1):
                try:
                    success = supabase_db.record_attempt(attempt)
                    if success:
                        if i % 100 == 0:  # Log every 100 attempts
                            logger.info(f"✅ [{i}/{len(attempts)}] Migrated attempts...")
                        success_count += 1
                    else:
                        error_count += 1
                        
                except Exception as e:
                    if error_count < 10:  # Only log first 10 errors
                        logger.error(f"❌ Error migrating attempt: {e}")
                    error_count += 1
            
            logger.info(f"\n📊 Attempt Migration Summary:")
            logger.info(f"  ✅ Successfully migrated: {success_count}")
            logger.info(f"  ❌ Errors: {error_count}")
        
        # Migrate Referrals
        logger.info("\n" + "="*50)
        logger.info("🔗 MIGRATING REFERRALS")
        logger.info("="*50)
        
        with session_scope() as session:
            referrals = session.query(Referral).all()
            logger.info(f"Found {len(referrals)} referrals in old database")
            
            success_count = 0
            error_count = 0
            
            for i, referral in enumerate(referrals, 1):
                try:
                    success = supabase_db.create_referral(referral)
                    if success:
                        logger.info(f"✅ [{i}/{len(referrals)}] Migrated referral")
                        success_count += 1
                    else:
                        error_count += 1
                        
                except Exception as e:
                    logger.error(f"❌ Error migrating referral: {e}")
                    error_count += 1
            
            logger.info(f"\n📊 Referral Migration Summary:")
            logger.info(f"  ✅ Successfully migrated: {success_count}")
            logger.info(f"  ❌ Errors: {error_count}")
        
        logger.info("\n" + "="*50)
        logger.info("🎉 MIGRATION COMPLETE!")
        logger.info("="*50)
        logger.info("\nNext steps:")
        logger.info("1. Verify data in Supabase dashboard")
        logger.info("2. Test your bot functionality")
        logger.info("3. Remove DATABASE_URL from environment once confirmed")
        logger.info("4. Update your code to use Supabase client")
        
        return True
        
    except Exception as e:
        logger.error(f"\n💥 Migration failed with error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


if __name__ == "__main__":
    logger.info("🚀 Starting database migration to Supabase...\n")
    
    # Confirmation prompt
    print("⚠️  WARNING: This will migrate all data from your old database to Supabase.")
    print("⚠️  Make sure you have backed up your old database first!")
    print()
    response = input("Do you want to continue? (yes/no): ")
    
    if response.lower() not in ['yes', 'y']:
        print("❌ Migration cancelled")
        sys.exit(0)
    
    print()
    success = migrate()
    
    if success:
        logger.info("\n✅ Migration completed successfully!")
        sys.exit(0)
    else:
        logger.error("\n❌ Migration failed. Check logs above for details.")
        sys.exit(1)
