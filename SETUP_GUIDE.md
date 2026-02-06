# Telegram Quiz Mini-App - Complete Implementation Guide

## 🎯 Quick Start

### Prerequisites

1. **Python 3.10+**
2. **Telegram Bot Token** - Get from [@BotFather](https://t.me/BotFather)
3. **Google Account** - For Google Sheets database
4. **Google Sheets API Credentials** - Follow setup below

---

## 📋 Step-by-Step Setup

### 1. Get Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow prompts to name your bot
4. Copy the API token (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
5. Send `/setcommands` to BotFather and paste:
```
start - Start the bot and register
play - Play a quiz question
stats - View your statistics
leaderboard - View weekly rankings
invite - Get your referral link
subscribe - Upgrade to premium
help - Show help message
```

### 2. Set Up Google Sheets

#### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Google Sheets API**:
   - Click "Enable APIs and Services"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create credentials:
   - Go to "Credentials" → "Create Credentials" → "Service Account"
   - Name it "telegram-quiz-bot"
   - Click "Create and Continue"
   - Skip optional steps
5. Download credentials:
   - Click on the service account email
   - Go to "Keys" tab
   - "Add Key" → "Create new key" → "JSON"
   - Save as `credentials.json` in project root

#### Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/)
2. Create a new blank spreadsheet
3. Name it "Telegram Quiz Bot Database"
4. Copy the Spreadsheet ID from URL:
   - URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`
   - Copy the `SPREADSHEET_ID_HERE` part
5. Share the sheet:
   - Click "Share"
   - Paste the service account email (from credentials.json: `client_email`)
   - Give it "Editor" permissions

### 3. Install Bot

```bash
# Clone/navigate to project directory
cd /workspaces/KnightCLI

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
```

### 4. Configure Environment

Edit `.env` file:

```env
# Your bot token from BotFather
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Path to your Google credentials
GOOGLE_SHEETS_CREDENTIALS=credentials.json

# Your spreadsheet ID
SPREADSHEET_ID=1a2b3c4d5e6f7g8h9i0j

# Your Telegram ID (get from @userinfobot)
ADMIN_TELEGRAM_IDS=123456789

# Prize round times (UTC)
PRIZE_ROUND_MORNING_HOUR=9
PRIZE_ROUND_EVENING_HOUR=21

# Timezone
TIMEZONE=UTC
```

### 5. Initialize Database

```bash
python scripts/setup_sheets.py
```

This will:
- Create all required sheets (users, questions, attempts, etc.)
- Add column headers
- Optionally add sample questions for testing

### 6. Run the Bot

```bash
python main.py
```

You should see:
```
==================================================
🚀 Bot is running!
==================================================
```

### 7. Test the Bot

1. Open Telegram
2. Search for your bot (@yourbotname)
3. Send `/start`
4. You should see the welcome message with buttons
5. Click "▶️ Play Quiz" to test

---

## 🎮 Core Features

### User Experience

**Continuous Play (All Day)**
- Answer questions anytime
- Earn Accumulated Points (AP)
- Build daily streaks
- 20 questions/hour (free) or 40/hour (premium)

**Prize Rounds (2x Daily)**
- 9:00 AM & 9:00 PM UTC (configurable)
- 30-minute competition windows
- Earn Prize Points (PP)
- Higher stakes, bigger rewards

### Scoring System

| User Type | Continuous (AP) | Prize Round (PP) | Speed Bonus | Attempts |
|-----------|----------------|------------------|-------------|----------|
| Free      | +5 per correct | +10 per correct  | +0-5        | 1        |
| Premium   | +8 per correct | +15 per correct  | +0-7        | 2        |

**Streak Bonuses:**
- 3 days → +5 points
- 7 days → +15 points
- 30 days → +50 points

### Anti-Cheat

- One account per Telegram ID
- Hourly rate limits (enforced)
- Answer locking (no changes after submission)
- Response time validation (min 2 seconds)
- Suspicious behavior flagging
- Manual review queue for admins

---

## 📊 Managing Questions

### Add Questions via Google Sheets

Open your Google Sheet → "questions" tab

Required columns:
- `question_id`: Unique ID (e.g., "q001")
- `question_text`: The question
- `option_a`, `option_b`, `option_c`, `option_d`: Answer options
- `correct_option`: Letter (A, B, C, or D)
- `category`: Category name
- `difficulty`: easy/medium/hard
- `question_type`: continuous or prize_round
- `is_active`: true/false

**Example:**
```
q006 | What is Python? | A programming language | A snake | A food | A game | A | Technology | easy | continuous | | | true
```

### Bulk Import Questions

1. Prepare CSV with same column structure
2. Open Google Sheet
3. File → Import → Upload CSV
4. Append to "questions" sheet

---

## 🔧 Configuration Options

### Rate Limits

Edit [config/constants.py](config/constants.py):

```python
RATE_LIMITS = {
    UserType.FREE: {
        "hourly": 20,  # Questions per hour
        "daily": 200,  # Questions per day
    },
    UserType.SUBSCRIBER: {
        "hourly": 40,
        "daily": 400,
    },
}
```

### Scoring

```python
SCORING = {
    UserType.FREE: {
        QuestionType.CONTINUOUS: {
            "correct": 5,  # Points per correct answer
            # ...
        },
    },
}
```

### Prize Schedule

Edit `.env`:
```env
PRIZE_ROUND_MORNING_HOUR=9   # 9 AM UTC
PRIZE_ROUND_EVENING_HOUR=21  # 9 PM UTC
TIMEZONE=UTC
```

Or adjust in [config/settings.py](config/settings.py) for more complex schedules.

---

## 👑 Admin Commands

### Monitor Bot Activity

Check Google Sheets:
- **users** - All registered users and stats
- **attempts** - All question attempts
- **leaderboard_weekly** - Historical leaderboards
- **referrals** - Referral tracking

### Broadcast Messages

Add to [scheduler/prize_rounds.py](scheduler/prize_rounds.py):

```python
# In PrizeRoundScheduler class
async def send_custom_broadcast(self, message: str):
    await self._broadcast_to_all_users(message)
```

### Ban Users

Edit Google Sheets → "users" tab → Set `is_banned` column to `true`

### Review Suspicious Accounts

Filter "users" sheet by `suspicious_flags` > 0

---

## 🚀 Deployment

### Option 1: Docker (Recommended)

```bash
# Build image
docker-compose build

# Run bot
docker-compose up -d

# View logs
docker-compose logs -f

# Stop bot
docker-compose down
```

### Option 2: Systemd Service (Linux)

```bash
# Edit service file with your paths
nano telegram-quiz-bot.service

# Copy to systemd
sudo cp telegram-quiz-bot.service /etc/systemd/system/

# Enable and start
sudo systemctl enable telegram-quiz-bot
sudo systemctl start telegram-quiz-bot

# Check status
sudo systemctl status telegram-quiz-bot

# View logs
sudo journalctl -u telegram-quiz-bot -f
```

### Option 3: Screen Session (Simple)

```bash
# Start screen session
screen -S quiz-bot

# Run bot
python main.py

# Detach: Ctrl+A then D
# Reattach: screen -r quiz-bot
```

---

## 📈 Scaling to Mini-App

### Migration Path

| Component      | MVP (Current)    | Scale (Future)      |
|----------------|------------------|---------------------|
| Interface      | Telegram Bot     | Bot + Mini-App      |
| Database       | Google Sheets    | PostgreSQL          |
| Caching        | None             | Redis               |
| API            | Direct DB calls  | REST API            |
| Frontend       | None             | React/Vue           |

### Phase 2 Setup (PostgreSQL)

1. Install PostgreSQL
2. Update [database/models.py](database/models.py) to use SQLAlchemy
3. Create migration scripts
4. Deploy API layer (FastAPI/Express)
5. Build Mini-App frontend

This codebase is designed to migrate smoothly - game logic, scoring, and models remain unchanged.

---

## 🐛 Troubleshooting

### Bot doesn't start

**Check:**
1. `.env` file exists and has correct values
2. `credentials.json` exists
3. Spreadsheet is shared with service account
4. Bot token is valid

**Test connection:**
```bash
python -c "from database.sheets_client import db; print('OK' if db.health_check() else 'FAIL')"
```

### Questions not appearing

**Check:**
1. "questions" sheet has data
2. `is_active` column is "true"
3. Questions have correct `question_type`

### Rate limits not working

**Verify:**
- System time is correct (UTC)
- User hasn't changed Telegram ID
- Check "attempts" sheet for logged attempts

### Prize rounds not firing

**Check:**
1. Timezone in `.env` matches server timezone
2. Bot has been running continuously
3. Check logs for scheduler errors

---

## 📞 Support & Customization

### Get Your Telegram ID

1. Open [@userinfobot](https://t.me/userinfobot) in Telegram
2. Send any message
3. Copy your ID
4. Add to `.env` as `ADMIN_TELEGRAM_IDS`

### Customize Messages

Edit [config/constants.py](config/constants.py) → `MESSAGES` dictionary

### Add New Features

Modular structure:
- **Bot logic**: [bot/](bot/)
- **Game mechanics**: [game/](game/)
- **Database**: [database/](database/)
- **Scheduler**: [scheduler/](scheduler/)

---

## ✅ Final Checklist

Before going live:

- [ ] Bot token configured
- [ ] Google Sheets API set up
- [ ] Database initialized (setup_sheets.py)
- [ ] Sample questions added
- [ ] Bot tested with /start → /play → answer flow
- [ ] Admin Telegram ID added
- [ ] Prize round times configured
- [ ] Deployment method chosen
- [ ] Monitoring set up (logs, sheets checks)
- [ ] Backup strategy (Google Sheets auto-saves)

---

## 🎉 You're Ready!

Your Telegram Quiz Bot is now fully operational with:

✅ Continuous play mechanics
✅ Prize round scheduling
✅ Fair scoring system
✅ Anti-cheat protection
✅ Leaderboard tracking
✅ Referral system
✅ Admin tools
✅ Production-ready deployment options

**Next steps:**
1. Add more questions
2. Test with real users
3. Monitor performance
4. Gather feedback
5. Plan Mini-App migration

Good luck! 🚀
