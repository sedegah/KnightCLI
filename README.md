# Telegram Quiz Mini-App

A gamified quiz platform on Telegram with continuous play mechanics and scheduled prize rounds.

## Features

- **Continuous Play**: Answer questions throughout the day to earn Accumulated Points (AP)
- **Prize Rounds**: Compete in twice-daily high-stakes rounds for rewards
- **Two Player Tiers**: Free users and Premium subscribers with different benefits
- **Leaderboards**: Weekly rankings with rewards
- **Anti-Cheat**: Rate limiting, answer locking, and suspicious behavior detection
- **Streak System**: Bonus points for consistent daily engagement
- **Sponsor Integration**: Branded questions and rewards

## Architecture

- **Bot Interface**: python-telegram-bot
- **Database**: Google Sheets (MVP) → PostgreSQL (Scale)
- **Scheduler**: APScheduler for prize rounds and reminders
- **Integration**: Ready for Make.com automation

## Quick Start

### Prerequisites

- Python 3.10+
- Telegram Bot Token (from @BotFather)
- Google Sheets API credentials

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Initialize Google Sheets database
python scripts/setup_sheets.py

# Run the bot
python main.py
```

## Configuration

Edit `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
GOOGLE_SHEETS_CREDENTIALS=path/to/credentials.json
SPREADSHEET_ID=your_spreadsheet_id
ADMIN_TELEGRAM_IDS=123456789,987654321
```

## Project Structure

```
telegram-quiz-bot/
├── main.py                 # Bot entry point
├── config/
│   ├── settings.py         # Configuration management
│   └── constants.py        # Game constants and scoring
├── bot/
│   ├── handlers.py         # Telegram command handlers
│   ├── callbacks.py        # Button callback handlers
│   └── keyboards.py        # Inline keyboard layouts
├── game/
│   ├── scoring.py          # Points calculation logic
│   ├── questions.py        # Question management
│   ├── eligibility.py      # Rate limiting and validation
│   └── leaderboard.py      # Ranking and rewards
├── database/
│   ├── sheets_client.py    # Google Sheets operations
│   └── models.py           # Data models
├── scheduler/
│   ├── prize_rounds.py     # Prize round automation
│   └── reminders.py        # Daily reminder system
├── utils/
│   ├── anti_cheat.py       # Anti-cheat measures
│   └── helpers.py          # Utility functions
└── scripts/
    └── setup_sheets.py     # Database initialization
```

## Game Mechanics

### Scoring System

#### Continuous Play (All Day)
- **Free Users**: +5 AP per correct answer, 20 questions/hour
- **Subscribers**: +8 AP per correct answer, 40 questions/hour

#### Prize Rounds (2x Daily)
- **Free Users**: +10 PP per correct answer, +0-5 speed bonus
- **Subscribers**: +15 PP per correct answer, +0-7 speed bonus, 2 attempts per question

### Streak Bonuses
- 3-day streak: +5 points
- 7-day streak: +15 points
- 30-day streak: +50 points

### Prize Round Schedule
- Morning Round: 9:00 AM UTC
- Evening Round: 9:00 PM UTC

## Commands

- `/start` - Register and start playing
- `/play` - Answer quiz questions
- `/stats` - View your statistics
- `/leaderboard` - View weekly rankings
- `/invite` - Get referral link
- `/subscribe` - Upgrade to premium

## Anti-Cheat Features

- One account per Telegram ID
- Hourly rate limits (20 free / 40 premium)
- Answer locking after submission
- Timestamp verification
- Diminishing returns detection
- Manual review flagging

## Deployment

### Development
```bash
python main.py
```

### Production (with systemd)
```bash
sudo cp telegram-quiz-bot.service /etc/systemd/system/
sudo systemctl enable telegram-quiz-bot
sudo systemctl start telegram-quiz-bot
```

### Docker
```bash
docker build -t telegram-quiz-bot .
docker run -d --env-file .env telegram-quiz-bot
```

## Migration Path

| MVP Component | Scaled Version |
|--------------|----------------|
| Google Sheets | PostgreSQL |
| APScheduler | Redis + Celery |
| Bot Only | Bot + Mini-App |
| Manual Payouts | Automated Payouts |

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

## License

MIT License
