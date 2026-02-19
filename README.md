# I-Crush Quiz Platform

**A scalable, competitive Telegram quiz game built on Cloudflare Workers - Powered by G-NEX**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sedegah/KnightCLI)

## Overview

I-Crush is a production-ready Telegram quiz game featuring:
- **Daily Quizzes** with streak tracking and bonus points
- **Prize Rounds** (2x daily) with real rewards
- **1v1 Battles** for competitive play (coming soon)
- **Squad Mode** for team competitions (coming soon)
- **Partner Mode** for duo gameplay (coming soon)
- **Global Leaderboards** with weekly rankings

## Key Features

- **Sub-200ms response times** globally via Cloudflare edge network
- **Serverless architecture** - automatic scaling from 0 to thousands of users
- **Free to start** - Generous Cloudflare free tier
- **Secure** - Built-in rate limiting, anti-cheat, and spam protection
- **Real-time leaderboards** with D1 database
- **Fair gameplay** - Deterministic scoring and validation

## Quick Start

**Full setup guide:** [SETUP.md](SETUP.md)

```bash
# 1. Install dependencies
npm install

# 2. Login to Cloudflare
npx wrangler login

# 3. Create resources (follow SETUP.md for detailed steps)
npx wrangler d1 create gnex-db
npx wrangler kv:namespace create "GNEX_KV"

# 4. Update wrangler.toml with IDs from step 3

# 5. Initialize database
npx wrangler d1 execute gnex-db --file=./src/database/schema.sql

# 6. Set secrets
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put ADMIN_TELEGRAM_IDS

# 7. Deploy
npm run deploy
```

## Project Structure

```
KnightCLI/
├── python/                    # Legacy Python implementation (reference)
├── src/                       # NEW JavaScript/Cloudflare implementation
│   ├── index.js              # Main Worker entry point
│   ├── bot/                  # Telegram bot handlers
│   │   ├── updateHandler.js  # Update router
│   │   └── keyboards.js      # Inline keyboards
│   ├── config/               # Configuration
│   │   ├── config.js         # App config
│   │   └── constants.js      # Constants & messages
│   ├── database/             # Database layer
│   │   ├── client.js         # D1 + KV client
│   │   └── schema.sql        # Database schema
│   ├── game/                 # Game logic
│   │   ├── scoring.js        # Points calculation
│   │   ├── questionManager.js # Question handling
│   │   └── eligibility.js    # Eligibility checks
│   └── utils/                # Utilities
├── package.json
├── wrangler.toml             # Cloudflare Workers config
├── SETUP.md                  # Detailed setup guide
└── README.md
```


## How It Works

### Continuous Play
- Answer questions anytime to earn **Accumulated Points (AP)**
- Build daily streaks for bonus points (3, 7, 30 day milestones)
- Rate-limited to prevent abuse (20/hr free, 40/hr premium)

### Prize Rounds
- 9:00 AM & 9:00 PM UTC daily
- Earn **Prize Points (PP)** with speed bonuses
- Win real rewards based on weekly rankings

### Scoring System

| User Type | Continuous | Prize Round | Speed Bonus |
|-----------|------------|-------------|-------------|
| Free      | 5 AP       | 10 PP       | +0 to +5    |
| Premium   | 8 AP       | 15 PP       | +0 to +7    |

**Streak Bonuses:**
- 3 days: +5 points
- 7 days: +15 points
- 30 days: +50 points

## Technology Stack

- **Runtime**: Cloudflare Workers (V8 isolates, edge execution)
- **Framework**: Hono (lightweight, fast web framework)
- **Database**: Cloudflare D1 (distributed SQLite)
- **Cache**: Cloudflare KV (key-value store)
- **API**: Telegram Bot API (webhook-based)

## Database Schema

**D1 (Relational):**
- `users` - Player profiles, points, streaks
- `questions` - Quiz question bank
- `attempts` - Answer history
- `squads` - Team data (future)
- `partnerships` - Duo mode (future)
- `battles` - 1v1 matches (future)
- `rewards` - Prize distribution
- `referrals` - Referral tracking

**KV (Fast Cache):**
- Active questions (5-min TTL)
- Rate limits (1-hour TTL)
- Session data

## Security Features

- Telegram webhook verification
- Rate limiting (20-40 requests/hour per user)
- Anti-cheat detection (min answer time, accuracy flags)
- Admin authentication
- Request validation
- Abuse prevention

## Scalability

Designed for:
- **Thousands of concurrent users**
- **Sub-200ms response times globally**
- **Automatic scaling** (0 to infinity)
- **Zero-downtime deployments**
- **Edge execution** in 300+ cities worldwide

## Cost Estimates

**Cloudflare Free Tier:**
- 100k requests/day (Workers)
- 5M reads/day (D1)
- 100k reads/day (KV)

**Handles ~1,000 daily active users for FREE**

**Scaling:** $5/mo Workers Paid = 10M requests/month

## Bot Commands

- `/start` - Register and begin
- `/play` - Answer a question
- `/stats` - View your statistics
- `/leaderboard` - See top players
- `/help` - How to play

## Development

```bash
# Run locally
npm run dev
# Worker available at http://localhost:8787

# View logs
npm run tail

# Deploy
npm run deploy
```

## Roadmap

### Phase 1 (Complete)
- Core quiz gameplay
- Streak system
- Leaderboards
- Rate limiting
- Anti-cheat basics

### Phase 2 (Q2 2026)
- 1v1 Battle mode
- Squad competitions
- Partner/Duo mode
- Enhanced rewards system

### Phase 3 (Q3 2026)
- Tournament system
- Advanced analytics
- Multi-language support
- Mobile data rewards (Ghana)

## Deployment Options

### Cloudflare Workers (Recommended)
```bash
npm run deploy
```

### Custom Domain
Add to `wrangler.toml`:
```toml
routes = [
  { pattern = "bot.yourdomain.com", custom_domain = true }
]
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## Documentation

- **Setup Guide**: [SETUP.md](SETUP.md)
- **Python Reference**: [python/README-python.md](python/README-python.md)
- **Cloudflare Docs**: https://developers.cloudflare.com/workers
- **Telegram Bot API**: https://core.telegram.org/bots/api

## License

MIT License - see [LICENSE](LICENSE) file

## Support

- **Issues**: [GitHub Issues](https://github.com/sedegah/KnightCLI/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sedegah/KnightCLI/discussions)
- **Email**: support@gnex-quiz.com

## Why Cloudflare Workers?

| Feature | Traditional Server | Cloudflare Workers |
|---------|-------------------|-------------------|
| Cold Start | 1-3 seconds | 0ms |
| Global Latency | 100-500ms | <50ms |
| Scaling | Manual | Automatic |
| Cost (1k users) | $10-50/mo | FREE |
| Maintenance | High | Zero |

## Migration from Python

The original Python implementation is preserved in `/python` for reference. Key improvements:

- **50x faster** cold starts
- **10x lower** latency globally  
- **100x cheaper** at scale
- **Zero** server maintenance

See [python/README-python.md](python/README-python.md) for the original implementation.

---

**Built with passion for competitive gaming communities worldwide**

[Star this repo](https://github.com/sedegah/KnightCLI) | [Report Bug](https://github.com/sedegah/KnightCLI/issues) | [Request Feature](https://github.com/sedegah/KnightCLI/issues)
