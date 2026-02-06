# Telegram Quiz Mini-App

A gamified quiz platform on Telegram with continuous play mechanics and scheduled prize rounds.

## 🎯 Current Status: MVP Phase

**What We Have:**
- ✅ Buildable MVP (Ready to launch)
- ✅ Scalable architecture (Migration-ready)
- ✅ Clear roadmap (Phase 1-3 planned)
- ✅ Defensible product story

**Launch Timeline:** 30 days to production

## Features

### Core Gameplay
- **Continuous Play**: Answer questions throughout the day to earn Accumulated Points (AP)
- **Prize Rounds**: Compete in twice-daily high-stakes rounds for rewards
- **Two Player Tiers**: Free users and Premium subscribers with different benefits
- **Leaderboards**: Weekly rankings with rewards
- **Streak System**: Bonus points for consistent daily engagement

### Anti-Cheat (MVP-Level, Phase 1)
✅ **Implemented:**
- One question per ID (prevents duplicate answers)
- Answer locking (timestamp-based validation)
- Suspicious speed detection (minimum 2-second answer time)
- Accuracy-based flagging (automatic review triggers)
- **Manual reward approval** (admin verification before payout)

**Protection Level:** Effective for early rewards without complexity

### Monetization Strategy

#### Phase 1 (Current - MVP)
- ✅ **Sponsored Questions**: Brand tags displayed on questions
- ✅ **Brand Display**: Sponsor names shown prominently
- ✅ **Premium Subscriptions**: $4.99/month
  - Higher points per answer
  - Increased hourly limits
  - Speed bonuses

#### Phase 2 (Post-Launch)
- 🔜 **Premium Features**:
  - Streak freeze (preserve streak when missed)
  - Extra daily quiz
  - Advanced statistics
- 🔜 **Enhanced Analytics**

#### Phase 3 (Scale)
- 🔮 **Paid Tournaments**
- 🔮 **Brand Dashboards** (sponsor analytics)
- 🔮 **Mini-App Ads**

## Architecture

### Current Stack (MVP)
- **Bot Interface**: python-telegram-bot
- **Database**: Google Sheets (MVP-friendly, quick setup)
- **Scheduler**: APScheduler for prize rounds and reminders
- **Integration**: Make.com automation ready
- **Deployment**: Docker containerized, Render hosting

### Migration Path (When Scaling)

| Component | MVP (Now) | Scaled (Future) |
|-----------|-----------|-----------------|
| Database | Google Sheets | PostgreSQL |
| Backend | Make.com | FastAPI/Node.js Backend API |
| Interface | Bot only | Bot + Mini-App |
| Payments | Manual payouts | Automated payment system |
| Logic | ✅ Ready | ✅ Already designed for migration |

**Key Insight:** Logic stays the same. Only the engine changes.

### Why This Approach Works
1. **Fast MVP Launch**: Get to market in 30 days
2. **Validate Product-Market Fit**: Test with real users before heavy investment
3. **Scale When Ready**: Migrate components as user base grows
4. **Preserve Investment**: Business logic remains intact during migration

## Setup

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed installation instructions.

## Deployment

The bot is containerized and ready for deployment on:
- Render (current)
- Heroku
- Railway
- Any Docker-compatible platform

## Roadmap

### Immediate (Week 1-4)
- [x] Core gameplay functionality
- [x] Anti-cheat system (MVP level)
- [x] Manual reward approval
- [x] Sponsored question support
- [ ] Launch to first 100 users

### Short-term (Month 2-3)
- [ ] Premium feature: Streak freeze
- [ ] Premium feature: Bonus quizzes
- [ ] Enhanced analytics dashboard
- [ ] First brand partnership

### Medium-term (Month 4-6)
- [ ] Migration to PostgreSQL
- [ ] Backend API development
- [ ] Mini-App interface
- [ ] Automated payment processing

### Long-term (Month 7+)
- [ ] Tournament system
- [ ] Brand dashboard
- [ ] Advanced analytics
- [ ] Multi-language support

## Business Model

### Revenue Streams
1. **Premium Subscriptions**: $4.99/month recurring revenue
2. **Sponsored Questions**: Brand partnerships
3. **Tournament Entry**: Paid competitive events (Phase 3)
4. **Platform Ads**: Mini-App advertising (Phase 3)

### Go-to-Market
- **Organic Growth**: Telegram Bot Discovery
- **Referral System**: Built-in viral mechanics
- **Brand Partnerships**: Sponsored content from day 1
- **Community Building**: Engagement through daily prizes

## Contributing

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for development setup.

## License

Proprietary - All rights reserved

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
