# Refi Radar

A mortgage refinance monitoring web app that emails users when it's a good time to shop for refinancing based on benchmark rate data and user-defined thresholds.

## Features

- **Multi-step onboarding**: Collects loan details, time horizon, closing costs, and alert thresholds
- **Automated monitoring**: Daily checks against Optimal Blue 30-Year Fixed Rate Mortgage Index (FRED)
- **Smart alerts**: Triggered by benchmark rate thresholds or break-even period thresholds
- **Status dashboard**: Real-time view of monitoring status, rate history, and evaluation history
- **Full control**: Pause, resume, stop, start over, or run immediate checks
- **Email notifications**: Deduped, idempotent email alerts via Resend

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Database**: Vercel Postgres with Drizzle ORM
- **Authentication**: Auth.js (NextAuth v5) with Google OAuth
- **Email**: Resend
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Hosting**: Vercel

## Data Source

**Optimal Blue 30-Year Fixed Rate Mortgage Index (OBMMIFR30YF)**
- Source: Federal Reserve Economic Data (FRED)
- Update frequency: Daily (weekdays)
- Access: Free API (optional API key for higher limits)

## Project Structure

```
rates-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/
│   │   │   ├── auth/           # Auth.js API routes
│   │   │   └── workflow/       # Workflow execution endpoint
│   │   ├── login/              # Login page
│   │   ├── onboarding/         # Multi-step onboarding wizard
│   │   ├── settings/           # User settings page
│   │   ├── status/             # Monitoring dashboard
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing page
│   ├── components/             # React components
│   │   ├── ui/                 # UI primitives (Button, Input, Card)
│   │   └── navbar.tsx          # Navigation bar
│   ├── lib/
│   │   ├── actions/            # Server actions
│   │   ├── db/                 # Database schema and client
│   │   ├── services/           # Business logic services
│   │   └── auth.ts             # Auth.js configuration
│   ├── middleware.ts           # Auth middleware
│   └── types/                  # TypeScript type declarations
├── drizzle/                    # Database migrations
├── .env.example                # Environment variables template
├── drizzle.config.ts           # Drizzle ORM configuration
└── package.json
```

## Setup Instructions

### 1. Clone and Install

```bash
cd rates-app
npm install
```

### 2. Create Vercel Project

```bash
vercel link
```

### 3. Set Up Vercel Postgres

1. Go to your Vercel project dashboard
2. Navigate to Storage → Create Database → Postgres
3. Copy the environment variables to `.env.local`

### 4. Run Database Migration

Option A: Using Drizzle Kit (recommended for development)
```bash
npm run db:push
```

Option B: Using raw SQL in Vercel Postgres console
- Copy contents of `drizzle/0000_initial_schema.sql`
- Paste and execute in Vercel Postgres SQL console

### 5. Configure OAuth

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-app.vercel.app/api/auth/callback/google`
4. Copy Client ID and Secret to environment variables

**Apple Sign-In (Optional):**
1. Register at [Apple Developer Portal](https://developer.apple.com)
2. Create a Services ID for Sign in with Apple
3. Configure web authentication
4. Add environment variables and set `NEXT_PUBLIC_APPLE_ENABLED=true`

### 6. Configure Resend

1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain
3. Create an API key
4. Add to `RESEND_API_KEY` environment variable

### 7. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

Required variables:
- `POSTGRES_URL` - Vercel Postgres connection string
- `AUTH_SECRET` - Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `RESEND_API_KEY` - Resend API key
- `WORKFLOW_SECRET` - Generate with `openssl rand -hex 32`
- `NEXT_PUBLIC_APP_URL` - Your app's public URL

### 8. Deploy to Vercel

```bash
vercel deploy --prod
```

Or push to your Git repository for automatic deployments.

### 9. Add Environment Variables to Vercel

In Vercel project settings → Environment Variables, add all variables from `.env.local`.

## How It Works

### Monitor Lifecycle

1. **Onboarding**: User enters loan details and alert thresholds
2. **Session Created**: A new monitor session starts in `active` status
3. **Daily Checks**: Workflow fetches latest rate, evaluates thresholds
4. **Alert Triggered**: When criteria met, email sent, session marked `completed`

### Session States

| Status | Description |
|--------|-------------|
| `active` | Monitoring in progress, daily checks running |
| `paused` | Temporarily stopped, can be resumed |
| `completed` | Alert was triggered and sent |
| `stopped` | Permanently stopped by user |
| `error` | An error occurred during monitoring |

### User Controls

- **Pause**: Stop checks temporarily (active → paused)
- **Resume**: Restart checks (paused → active)
- **Stop**: Permanently stop monitoring
- **Start Over**: Create new session (resets alert state)
- **Run Now**: Immediate evaluation without waiting

### Refinance Calculation

The break-even calculation uses standard amortization:

```
Monthly Payment = P × [r(1+r)^n] / [(1+r)^n - 1]

Where:
  P = Principal (loan balance)
  r = Monthly interest rate (annual rate ÷ 12)
  n = Number of payments (term in months)

Monthly Savings = Current Payment - New Payment
Break-Even Months = Closing Costs ÷ Monthly Savings
```

## Cost and Reliability

### Costs

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Vercel Hosting | Hobby plan free | Sufficient for personal use |
| Vercel Postgres | 256MB free | ~100K user sessions |
| Resend | 3,000 emails/month | One email per user trigger |
| FRED API | Unlimited | Free, no API key required |

### Reliability Considerations

1. **Idempotent Operations**
   - Rate snapshots use unique constraint on (series, date)
   - Email alerts are deduped by session ID
   - Workflow restarts are safe

2. **Error Handling**
   - Failed rate fetches mark session as `error`
   - Users can retry via "Start Over"
   - All errors are logged

3. **Vercel Workflow Limitations**
   - Hobby plan: 10-second function timeout
   - Background functions may have cold starts
   - For production, consider Vercel Pro for longer timeouts

## Known Limitations

1. **Workflow Durability**: The current implementation uses `waitUntil` for background execution. For truly durable workflows that survive restarts, consider:
   - Vercel Cron Jobs (Pro plan)
   - External scheduler (e.g., QStash, Inngest)
   - Self-hosted cron service

2. **Rate Data Freshness**: FRED data may have a 1-2 day delay from real-time market rates. The benchmark is a proxy, not actual lender rates.

3. **No Lender Integration**: App uses benchmark rates only. Users must shop for actual rates themselves after receiving alerts.

4. **Single Alert Model**: Once triggered, the session completes. Users must "Start Over" to monitor again (by design to prevent alert fatigue).

5. **Apple Sign-In**: Requires Apple Developer account ($99/year) and domain verification.

## Next Steps (Post-MVP)

1. **Enhanced Durability**: Migrate to Vercel Cron or external scheduler
2. **Multiple Scenarios**: Support monitoring different loan terms (15yr, 7/1 ARM)
3. **Rate Comparison**: Show comparison with multiple lenders
4. **Mobile App**: Push notifications via native app
5. **Historical Analysis**: Trend analysis and rate predictions
6. **Rate Alerts Widget**: Embeddable widget for partner sites

## Development

```bash
# Start development server
npm run dev

# Open Drizzle Studio (database viewer)
npm run db:studio

# Generate migrations
npm run db:generate

# Push schema changes
npm run db:push
```

## License

MIT
