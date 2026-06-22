# Mini Vercel

A self-hosted frontend deployment platform inspired by Vercel. Deploy, preview, and manage frontend applications with automatic builds, custom domains, SSL certificates, edge functions, and real-time analytics.

## Features

- **Multi-Framework Support** — Auto-detection and builds for Next.js, Vite, Nuxt, Remix, Gatsby, Astro, SvelteKit, React App, Vue CLI, and generic Node.js
- **Preview Deployments** — Every branch push creates a unique preview URL
- **Custom Domains** — Map any domain with automatic DNS verification
- **SSL Certificates** — Self-signed certificate generation with auto-renewal
- **Edge Functions** — Run serverless functions in a V8 sandbox with cold-start tracking
- **Environment Variables** — AES-256-GCM encrypted env var storage per project
- **Real-time Build Logs** — SSE-based log streaming during builds
- **Analytics** — Traffic stats, performance metrics (TTFB/FCP/LCP), and error tracking
- **Authentication** — JWT-based auth with access + refresh token rotation
- **GitHub/GitLab Integration** — Webhook-driven deployments from connected repositories

## Prerequisites

- **Node.js** ≥ 20
- **PostgreSQL** ≥ 14 (or use Docker Compose)
- **npm** ≥ 10

## Quick Start

```bash
# Clone the repo
git clone <repo-url> mini-vercel && cd mini-vercel

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed demo data
npx ts-node prisma/seed.ts

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`.

## Docker Deployment

```bash
# Start all services (API + PostgreSQL)
docker compose up -d

# Run database migrations
docker compose exec app npx prisma db push

# Seed demo data
docker compose exec app npx ts-node prisma/seed.ts

# View logs
docker compose logs -f app

# Stop services
docker compose down
```

## API Endpoints

### Authentication

| Method | Endpoint                      | Description              |
| ------ | ----------------------------- | ------------------------ |
| POST   | `/api/auth/register`          | Register new user        |
| POST   | `/api/auth/login`             | Login                    |
| POST   | `/api/auth/refresh`           | Refresh access token     |
| GET    | `/api/auth/me`                | Get current user profile |

### Projects

| Method | Endpoint                  | Description           |
| ------ | ------------------------- | --------------------- |
| POST   | `/api/projects`           | Create project        |
| GET    | `/api/projects`           | List projects         |
| GET    | `/api/projects/:id`       | Get project           |
| PATCH  | `/api/projects/:id`       | Update project        |
| DELETE | `/api/projects/:id`       | Delete project        |

### Deployments

| Method | Endpoint                              | Description               |
| ------ | ------------------------------------- | ------------------------- |
| POST   | `/api/deployments`                    | Create deployment         |
| GET    | `/api/deployments/:id`                | Get deployment            |
| GET    | `/api/projects/:id/deployments`       | List project deployments  |
| DELETE | `/api/deployments/:id`                | Delete deployment         |

### Domains

| Method | Endpoint                          | Description          |
| ------ | --------------------------------- | -------------------- |
| POST   | `/api/domains`                    | Add custom domain    |
| GET    | `/api/domains`                    | List domains         |
| POST   | `/api/domains/:id/verify`         | Trigger DNS verify   |

### Environment Variables

| Method | Endpoint                       | Description            |
| ------ | ------------------------------ | ---------------------- |
| POST   | `/api/env`                     | Set env variable       |
| GET    | `/api/env`                     | List env variables     |
| DELETE | `/api/env/:id`                 | Delete env variable    |

### Edge Functions

| Method | Endpoint                            | Description             |
| ------ | ----------------------------------- | ----------------------- |
| POST   | `/api/functions`                    | Create edge function    |
| POST   | `/api/functions/:id/invoke`         | Invoke edge function    |
| GET    | `/api/functions/:id/logs`           | Get function logs       |

### Analytics

| Method | Endpoint                          | Description            |
| ------ | --------------------------------- | ---------------------- |
| GET    | `/api/analytics/traffic`          | Traffic stats          |
| GET    | `/api/analytics/performance`      | Performance metrics    |
| GET    | `/api/analytics/errors`           | Error statistics       |

### Health

| Method | Endpoint           | Description  |
| ------ | ------------------ | ------------ |
| GET    | `/api/health`      | Health check |

## Testing

### Unit Tests (Vitest)

```bash
# Run all unit tests
npm test

# Run with coverage
npx vitest run --coverage

# Run in watch mode
npx vitest
```

### E2E Tests (Playwright)

```bash
# Install Playwright browsers
npx playwright install chromium

# Run E2E tests (starts dev server automatically)
npx playwright test

# Run with UI mode
npx playwright test --ui

# View HTML report
npx playwright show-report e2e-report
```

## Project Structure

```
mini-vercel/
├── src/
│   ├── generated/          # Prisma generated client
│   ├── lib/                # Database client
│   ├── middleware/          # Auth middleware
│   ├── routes/             # Express route handlers
│   ├── services/           # Business logic
│   ├── types/              # TypeScript types
│   ├── app.ts              # Express app setup
│   └── index.ts            # Server entry point
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Demo data seeder
├── src/__tests__/          # Unit tests (Vitest)
├── e2e/                    # E2E tests (Playwright)
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # App + PostgreSQL
├── vitest.config.ts        # Vitest configuration
├── playwright.config.ts    # Playwright configuration
└── tsconfig.json           # TypeScript configuration
```

## Environment Variables

See `.env.example` for all configuration options. Key variables:

| Variable             | Description                          | Default                        |
| -------------------- | ------------------------------------ | ------------------------------ |
| `DATABASE_URL`       | PostgreSQL connection string         | `postgresql://...`             |
| `JWT_SECRET`         | Secret for JWT signing               | (required)                     |
| `JWT_EXPIRES_IN`     | Access token lifetime                | `7d`                           |
| `ENV_ENCRYPTION_KEY` | 32-byte hex key for env var encryption | (required)                  |
| `CORS_ORIGIN`        | Allowed CORS origin                  | `http://localhost:3001`        |
| `PORT`               | Server port                          | `3000`                         |

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express 5
- **Database**: PostgreSQL 16 + Prisma ORM 7
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Sandbox**: Node.js `vm` module for edge functions
- **SSL**: Self-signed certificates via Node.js `crypto`
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Deployment**: Multi-stage Docker + Docker Compose

## License

ISC
