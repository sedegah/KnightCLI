# Make.com Integration Guide

This guide explains how to integrate the Telegram Quiz Bot with Make.com (formerly Integromat) for additional automation and workflows.

## Overview

Make.com can enhance the bot by:
- Automatically adding questions from Google Forms
- Sending notifications to Slack/Discord
- Processing payments for subscriptions
- Generating analytics reports
- Managing sponsor campaigns

---

## Webhook Integration

### 1. Set Up Webhook in Make.com

1. Create a new scenario in Make.com
2. Add "Webhooks" → "Custom webhook"
3. Copy the webhook URL

### 2. Configure Bot to Send Events

Add to [utils/webhook.py](utils/webhook.py):

```python
import aiohttp
import logging

logger = logging.getLogger(__name__)

MAKECOM_WEBHOOK_URL = "https://hook.us1.make.com/your_webhook_id"

async def send_event(event_type: str, data: dict):
    """Send event to Make.com webhook."""
    try:
        payload = {
            "event": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(MAKECOM_WEBHOOK_URL, json=payload) as resp:
                if resp.status == 200:
                    logger.info(f"Sent {event_type} event to Make.com")
                else:
                    logger.error(f"Failed to send event: {resp.status}")
    except Exception as e:
        logger.error(f"Error sending event to Make.com: {e}")
```

### 3. Trigger Events from Bot

In [bot/handlers.py](bot/handlers.py), add event triggers:

```python
from utils.webhook import send_event

# After user registration
await send_event("user_registered", {
    "telegram_id": telegram_id,
    "username": username,
    "referral_code": user.referral_code
})

# After prize round completion
await send_event("prize_round_completed", {
    "round_type": round_type,
    "winner_telegram_id": winner_id,
    "winner_points": points
})
```

---

## Make.com Scenarios

### Scenario 1: New Question from Google Form

**Purpose:** Auto-add questions submitted via Google Form

**Modules:**
1. **Google Forms** → Watch Responses
2. **Google Sheets** → Add a Row
   - Spreadsheet: Your quiz database
   - Sheet: questions
   - Map form fields to columns

**Setup:**
1. Create Google Form with fields: question, options A-D, correct answer, category
2. Connect form to Make.com
3. Map responses to Sheets format

---

### Scenario 2: Weekly Report via Email

**Purpose:** Send weekly stats to admins

**Modules:**
1. **Schedule** → Every Week (Sunday 11:59 PM)
2. **Google Sheets** → Search Rows
   - Get leaderboard data
3. **Tools** → Set Variables
   - Calculate totals
4. **Email** → Send Email
   - To: Admin email
   - Subject: "Weekly Quiz Stats"
   - Body: Formatted statistics

**Email Template:**
```
📊 Weekly Quiz Bot Report

Total Players: {{totalPlayers}}
New Users: {{newUsers}}
Questions Answered: {{totalAttempts}}
Top Player: {{topPlayer}} ({{topPoints}} points)

Rewards Distributed:
- 1st Place: $100
- 2nd Place: $50
- 3rd Place: $25

Engagement Rate: {{engagementRate}}%
```

---

### Scenario 3: Slack Notification for Prize Rounds

**Purpose:** Notify team when prize rounds start

**Modules:**
1. **Webhooks** → Custom webhook (from bot)
2. **Router** → Filter by event_type = "prize_round_started"
3. **Slack** → Create a Message
   - Channel: #quiz-bot-alerts
   - Message: Prize round notification

**Slack Message:**
```
🏆 Prize Round Started!

Type: {{data.round_type}}
Time: {{data.timestamp}}
Active Players: {{data.player_count}}

Monitor: [View Leaderboard](https://sheets.google.com/...)
```

---

### Scenario 4: Payment Processing for Subscriptions

**Purpose:** Handle subscription payments

**Modules:**
1. **Webhooks** → Custom webhook
2. **Stripe** → Create Checkout Session
   - Amount: $4.99
   - Customer email
3. **Router** → Check payment status
4. **Google Sheets** → Update Row
   - Set subscription_status to "subscriber"
   - Set subscription_expires to +30 days
5. **Telegram Bot** → Send Message
   - Confirmation to user

---

### Scenario 5: Sponsor Campaign Manager

**Purpose:** Schedule and track sponsored questions

**Modules:**
1. **Google Sheets** → Watch Rows (sponsor_campaigns sheet)
2. **Router** → Filter by start_date = today
3. **Google Sheets** → Update Rows
   - questions sheet
   - Add sponsor_name and sponsor_logo_url
4. **Telegram Bot** → Send Message
   - Notify admins campaign is live

---

## Advanced Workflows

### Auto-Moderation

**Detect and handle inappropriate content:**

```
1. Webhook → User submitted question
2. OpenAI → Moderate Content
3. Router:
   - If flagged → Add to review queue
   - If clean → Add to questions sheet
4. Send notification to moderators
```

### Analytics Dashboard

**Generate daily analytics:**

```
1. Schedule → Daily at 9 AM
2. Google Sheets → Get all data
3. Tools → Aggregate data
4. Google Data Studio → Update dashboard
5. Email → Send link to stakeholders
```

### Referral Reward Automation

**Auto-reward successful referrals:**

```
1. Webhook → User qualified referral
2. Google Sheets → Update referrer bonus
3. Telegram Bot → Send notification
4. Tools → Check if milestone reached (10, 50, 100 referrals)
5. If milestone → Send special reward
```

---

## Make.com + Bot Communication

### Send Data from Bot to Make.com

```python
# In bot code
import aiohttp

async def notify_makecom(event: str, data: dict):
    webhook_url = "https://hook.us1.make.com/xyz123"
    async with aiohttp.ClientSession() as session:
        await session.post(webhook_url, json={
            "event": event,
            "data": data
        })

# Usage
await notify_makecom("user_won_prize", {
    "user_id": 12345,
    "prize": "$100"
})
```

### Trigger Bot Actions from Make.com

**Method 1: Direct Database Update**
- Make.com updates Google Sheets
- Bot reads changes on next cycle

**Method 2: API Endpoint** (Future)
- Bot exposes REST API
- Make.com calls endpoint
- Example: Force prize round start

---

## Cost Optimization

**Make.com Free Plan:**
- 1,000 operations/month
- 15-minute intervals

**Optimize Usage:**
1. Use filters to reduce unnecessary runs
2. Batch operations when possible
3. Use webhooks instead of polling
4. Upgrade to paid plan for production ($9/month)

---

## Testing Make.com Scenarios

1. **Manual Trigger:**
   - Right-click module → "Run this module only"

2. **Test Webhook:**
   ```bash
   curl -X POST https://hook.us1.make.com/xyz123 \
   -H "Content-Type: application/json" \
   -d '{"event":"test","data":{"test":true}}'
   ```

3. **Dry Run:**
   - Enable "Data recording" to see what data passes through

---

## Common Make.com Recipes

### Recipe 1: Question Auto-Publish

**Trigger:** New row in "pending_questions" sheet
**Actions:**
1. Review question format
2. Generate question_id
3. Move to "questions" sheet
4. Set is_active = true

### Recipe 2: User Milestone Rewards

**Trigger:** User stats updated
**Conditions:**
- Check if questions_answered is 10, 50, 100, 500
**Actions:**
- Add bonus points
- Send congratulations message
- Log milestone

### Recipe 3: Sponsor ROI Tracker

**Trigger:** Daily schedule
**Actions:**
1. Count sponsored question views
2. Calculate engagement rate
3. Update sponsor dashboard
4. Send report email

---

## Security Best Practices

1. **Webhook Security:**
   - Use HTTPS only
   - Validate webhook signatures
   - Keep webhook URLs private

2. **API Keys:**
   - Store in Make.com variables
   - Never log sensitive data
   - Rotate keys regularly

3. **Data Privacy:**
   - Only send necessary data
   - Anonymize when possible
   - Comply with GDPR

---

## Debugging

**Check Execution History:**
1. Open scenario
2. Click "History"
3. View successful/failed runs
4. Inspect data at each step

**Common Issues:**
- **Webhook not receiving data:** Check URL, test with curl
- **Google Sheets errors:** Verify permissions and sheet names
- **Rate limits:** Reduce polling frequency

---

## Next Steps

1. Set up basic webhook scenario
2. Test with sample events
3. Add email notifications
4. Expand to payment processing
5. Build analytics dashboard

Make.com documentation: https://www.make.com/en/help/
