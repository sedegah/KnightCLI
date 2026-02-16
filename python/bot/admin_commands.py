"""Admin commands for manual reward approval and system management."""
import logging
from datetime import datetime
from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from config.settings import settings
from database.supabase_client import db

logger = logging.getLogger(__name__)


class AdminCommands:
    """Anti-Cheat Phase 1: Manual Reward Approval System"""
    
    @staticmethod
    async def approve_reward(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Approve a pending reward for a user.
        
        Usage: /approve_reward <telegram_id> <week_number>
        """
        if not settings.is_admin(update.effective_user.id):
            await update.message.reply_text("⛔ Unauthorized. Admin access required.")
            return
        
        if len(context.args) < 2:
            await update.message.reply_text(
                "Usage: /approve_reward <telegram_id> <week_number>\\n"
                "Example: /approve_reward 123456789 6"
            )
            return
        
        try:
            telegram_id = int(context.args[0])
            week_number = int(context.args[1])
            
            # Get leaderboard entry
            worksheet = db._get_worksheet("leaderboard")
            records = worksheet.get_all_values()
            
            for i, row in enumerate(records[1:], start=2):
                if (row and len(row) >= 3 and 
                    row[2] == str(telegram_id) and 
                    row[0] == str(week_number)):
                    
                    # Update approval status
                    row[8] = "approved"  # reward_status
                    row[9] = str(update.effective_user.id)  # approved_by
                    row[10] = datetime.utcnow().isoformat()  # approval_date
                    
                    worksheet.update(f'A{i}:K{i}', [row])
                    
                    reward_type = row[6]
                    reward_value = row[7]
                    username = row[3]
                    
                    await update.message.reply_text(
                        f"✅ **Reward Approved**\\n\\n"
                        f"User: @{username} (ID: {telegram_id})\\n"
                        f"Week: {week_number}\\n"
                        f"Reward: {reward_type} - {reward_value}\\n\\n"
                        f"Status: **Approved, Pending Payment**",
                        parse_mode=ParseMode.MARKDOWN
                    )
                    return
            
            await update.message.reply_text("❌ No pending reward found for this user/week.")
            
        except Exception as e:
            logger.error(f"Error approving reward: {e}")
            await update.message.reply_text(f"❌ Error: {e}")
    
    @staticmethod
    async def list_pending_rewards(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """List all pending rewards for manual approval.
        
        Usage: /pending_rewards
        """
        if not settings.is_admin(update.effective_user.id):
            await update.message.reply_text("⛔ Unauthorized. Admin access required.")
            return
        
        try:
            worksheet = db._get_worksheet("leaderboard")
            records = worksheet.get_all_values()
            
            pending = []
            for row in records[1:]:
                if row and len(row) >= 9 and row[8] == "pending":
                    pending.append({
                        'week': row[0],
                        'telegram_id': row[2],
                        'username': row[3],
                        'rank': row[5],
                        'reward_type': row[6],
                        'reward_value': row[7],
                    })
            
            if not pending:
                await update.message.reply_text("✅ No pending rewards to review.")
                return
            
            text = "📋 **Pending Rewards for Approval**\\n\\n"
            for item in pending[:20]:  # Limit to 20 for readability
                text += f"Week {item['week']} - Rank #{item['rank']}\\n"
                text += f"@{item['username']} (ID: {item['telegram_id']})\\n"
                text += f"Reward: {item['reward_type']} - {item['reward_value']}\\n\\n"
            
            if len(pending) > 20:
                text += f"\\n_...and {len(pending) - 20} more_"
            
            await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)
            
        except Exception as e:
            logger.error(f"Error listing pending rewards: {e}")
            await update.message.reply_text(f"❌ Error: {e}")
    
    @staticmethod
    async def mark_paid(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Mark an approved reward as paid.
        
        Usage: /mark_paid <telegram_id> <week_number>
        """
        if not settings.is_admin(update.effective_user.id):
            await update.message.reply_text("⛔ Unauthorized. Admin access required.")
            return
        
        if len(context.args) < 2:
            await update.message.reply_text(
                "Usage: /mark_paid <telegram_id> <week_number>\\n"
                "Example: /mark_paid 123456789 6"
            )
            return
        
        try:
            telegram_id = int(context.args[0])
            week_number = int(context.args[1])
            
            worksheet = db._get_worksheet("leaderboard")
            records = worksheet.get_all_values()
            
            for i, row in enumerate(records[1:], start=2):
                if (row and len(row) >= 3 and 
                    row[2] == str(telegram_id) and 
                    row[0] == str(week_number)):
                    
                    row[8] = "paid"  # reward_status
                    worksheet.update(f'A{i}:K{i}', [row])
                    
                    await update.message.reply_text(
                        f"✅ Reward marked as **PAID** for @{row[3]}"
                    )
                    return
            
            await update.message.reply_text("❌ No reward found for this user/week.")
            
        except Exception as e:
            logger.error(f"Error marking reward as paid: {e}")
            await update.message.reply_text(f"❌ Error: {e}")


admin_commands = AdminCommands()
