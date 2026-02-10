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
- **Database**: Supabase (PostgreSQL with built-in APIs, real-time, and dashboard)
- **Scheduler**: APScheduler for prize rounds and reminders
- **Integration**: Make.com automation ready
- **Deployment**: Docker containerized, Render hosting

### Database Architecture

**Current: Supabase** ✅
- PostgreSQL-based with automatic APIs
- Real-time data subscriptions
- Built-in authentication and storage
- Web dashboard for data management
- Automatic backups and scaling

### Migration Path (When Scaling)

| Component | MVP (Now) | Scaled (Future) |
|-----------|-----------|-----------------|
| Database | Supabase | Supabase (scaled tier) |
| Backend | Bot + Supabase | FastAPI/Node.js + Supabase |
| Interface | Bot only | Bot + Mini-App |
| Payments | Manual payouts | Automated payment system |
| Logic | ✅ Ready | ✅ Already designed for scale |

**Key Insight:** Supabase scales with you - start free, upgrade as you grow.

### Why This Approach Works
1. **Fast MVP Launch**: Get to market in 30 days
2. **Validate Product-Market Fit**: Test with real users before heavy investment
3. **Scale When Ready**: Migrate components as user base grows
4. **Preserve Investment**: Business logic remains intact during migration

## Setup

See Quick Start below for installation instructions.

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
- [x] Supabase database integration
- [ ] Launch to first 100 users

### Short-term (Month 2-3)
- [ ] Premium feature: Streak freeze
- [ ] Premium feature: Bonus quizzes
- [ ] Enhanced analytics dashboard
- [ ] First brand partnership

### Medium-term (Month 4-6)
- [ ] Scale Supabase (upgrade tier if needed)
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

## License

Proprietary - All rights reserved

## Quick Start

### Prerequisites

- Python 3.10+
- Telegram Bot Token (from @BotFather)
- Supabase project (URL + service key)

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Ensure Supabase schema is applied (see database/supabase_schema.sql)

# Run the bot
python main.py
```

## Configuration

Edit `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
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
│   ├── supabase_client.py  # Supabase operations
│   ├── sheets_client.py    # Legacy migration helper (not used at runtime)
│   └── models.py           # Data models
├── scheduler/
│   ├── prize_rounds.py     # Prize round automation
│   └── reminders.py        # Daily reminder system
├── utils/
│   ├── anti_cheat.py       # Anti-cheat measures
│   └── helpers.py          # Utility functions
└── scripts/
    ├── migrate_to_supabase.py # Sheets -> Supabase migration helper
    └── setup_sheets.py     # Legacy setup helper
```

## Game Mechanics

### A. Continuous Play Scoring (All Day)

| Action | Free User | Subscriber |
|---|---:|---:|
| Correct answer | +5 AP | +8 AP |
| Wrong answer | 0 | 0 |
| Timeout | 0 | 0 |

**Soft Limits**
- Free: 20 questions/hour
- Subscriber: 40 questions/hour

### B. Prize Round Scoring (High Stakes)

| Action | Free User | Subscriber |
|---|---:|---:|
| Correct answer | +10 PP | +15 PP |
| Speed bonus | +0 to +5 | +0 to +7 |
| Wrong answer | 0 | 0 |

### Attempt Advantage (Subscriber Edge)
- Free users: 1 attempt per prize question
- Subscribers: 2 attempts per prize question
  - Second attempt only if first attempt was wrong
  - Second attempt earns 80% of base points

### Streak Bonuses
- 3-day streak: +5
- 7-day streak: +15
- 30-day streak: +50

### 0.3 Play Frequency (Always-on + Events)
**Continuous Mode**
- Available all day
- Questions rotate automatically
- Category-balanced (roadmap)
- Lower difficulty

**Prize Mode**
- Happens 2x daily
- Time-limited (15 minutes)
- Higher difficulty
- Announced in advance

Missing a prize round means no penalty, but no reward chance for that event.

### 0.4 Reward Logic (Event-based & Sustainable)
1. Players accumulate AP all day.
2. At prize time, only eligible players compete.
3. Winners are determined by PP; AP can be used for seeding/tiebreakers.

### 0.5 Subscription (Power, not pay-to-win)
**Subscriber Benefits**
- Higher AP per question
- Higher PP per prize question
- Two attempts in prize rounds
- Higher hourly question limit
- Priority prize eligibility (roadmap)

**Subscribers do not get**
- Automatic wins
- Guaranteed prizes
- Unlimited attempts

### 0.6 Anti-cheat Rules
- One account per Telegram ID
- Hourly caps
- Question rotation memory
- PP only from prize rounds
- Manual payout approval
- Suspicious accounts flagged automatically

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
| Supabase | Supabase (scaled tier) |
| APScheduler | Redis + Celery |
| Bot Only | Bot + Mini-App |
| Manual Payouts | Automated Payouts |

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

## License

MIT License
