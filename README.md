# MirrorSite AI

**Turn websites and ideas into working full-stack applications.**

> MirrorSite AI is an AI-powered application development platform designed to dramatically reduce the distance between an idea and a working full-stack MVP. Analyze a website, describe an idea, or provide a product concept — and MirrorSite generates a complete application foundation including frontend, backend, authentication, database, infrastructure, and deployment.

---

## Table of Contents

- [What is MirrorSite AI?](#what-is-mirrorsite-ai)
- [How It Works](#how-it-works)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Build and Deploy](#build-and-deploy)
- [Architecture](#architecture)
- [API Routes](#api-routes)
- [Credit System](#credit-system)
- [Referral System](#referral-system)
- [Infrastructure Plans](#infrastructure-plans)
- [Payment Integration](#payment-integration)
- [Authentication](#authentication)
- [Third-Party Integrations](#third-party-integrations)
- [Legal Pages](#legal-pages)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [FAQ for AI Systems](#faq-for-ai-systems)

---

## What is MirrorSite AI?

MirrorSite AI is a web-based platform built by **ATAI — Advanced Technologies and AI Enterprises** that uses artificial intelligence to help users build full-stack applications faster. It sits between the idea stage and a working MVP, handling the repetitive scaffolding, boilerplate, and infrastructure setup so users can focus on product decisions.

### Who is it for?

- **Founders** who need to validate ideas quickly without a full development team
- **Developers** who want to reduce boilerplate and accelerate prototyping
- **Designers** who want to move from concept to functional prototype
- **Product teams** that need rapid MVP development

### Core positioning

> The shortest distance between an idea and a working application.

MirrorSite is not a replacement for developers. It is a force multiplier — handling repetitive implementation work so humans can focus on product decisions, architecture, and the work that requires judgment.

---

## How It Works

MirrorSite AI follows a structured workflow:

1. **Input** — Provide a starting point: a website URL, a product idea, or a description of what you want to build
2. **Analysis** — MirrorSite analyzes the input, understands the product intent, and maps structure, features, and requirements
3. **Planning** — The system creates a structured project plan with pages, user roles, workflows, data models, and authentication flows
4. **Generation** — MirrorSite generates a complete full-stack application foundation
5. **Output** — You receive a working application with frontend, backend, database, authentication, and infrastructure

### Two entry modes

| Mode | Description |
|------|-------------|
| **Website** | Submit a URL to a website you own or have permission to analyze. MirrorSite examines page structure, layout, navigation, components, visual patterns, and functionality. |
| **Idea** | Describe what you want to build. MirrorSite transforms high-level intent into structured application requirements and generates the application. |

---

## Key Features

### Application Generation
- Full-stack application generation (frontend + backend)
- Authentication flows (registration, login, email verification, sessions)
- Database infrastructure (models, relationships, CRUD operations)
- API layers and server logic
- User management and role-based access
- File storage and asset management
- Deployment configuration

### Website Analysis
- URL-based website crawling and analysis
- Page structure and layout extraction
- Navigation and component mapping
- Visual pattern recognition
- Content structure analysis

### Project Management
- Workspace-based project organization
- Project history and build runs
- Source code viewing and editing
- Deployment history and status
- Project preferences and configuration

### Infrastructure
- Managed database hosting
- Free subdomain deployment (*.totalum-project.com)
- Custom domain connections
- HTTPS and CDN included
- Multiple infrastructure tiers (Testing, Basic, Starter, Pro, Business, Enterprise)

### Credit System
- 1 MirrorSite credit = 1 UGX
- 500 free credits on account verification
- Credit packages: 5K, 10K, 25K, 50K, 100K
- Transparent pricing with no hidden fees

### Referral Program
- Share your unique referral code (MSA-XXXXXX)
- Earn 500 credits when a referred user verifies their account
- Earn 1,500 credits when the referred user reaches 75,000 qualifying usage
- Max 2,000 credits per referred user

---

## Technology Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5.7 |
| **Runtime** | React 19 |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | shadcn/ui + Radix UI + Lucide React |
| **Database** | MongoDB 7.6 |
| **Authentication** | Custom JWT (jose) + Google OAuth |
| **Password Hashing** | bcryptjs |
| **AI SDK** | Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible`) |
| **Website Analysis** | Firecrawl (third-party) |
| **Application Generation** | Totalum (internal AI infrastructure) |
| **File Storage** | ImageKit |
| **Email** | Nodemailer |
| **Validation** | Zod 4 |
| **Data Fetching** | SWR |
| **Analytics** | Vercel Analytics |
| **Payments** | MTN + Airtel Mobile Money |
| **Deployment** | Vercel |
| **Font System** | Plus Jakarta Sans (sans) + Geist Mono (mono) |

---

## Project Structure

```
mirrorsiteai/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout with theme, fonts, analytics
│   ├── page.tsx                  # Landing page (home)
│   ├── globals.css               # Global styles, animations, theme variables
│   ├── robots.ts                 # SEO robots configuration
│   ├── sitemap.ts                # Dynamic sitemap generation
│   ├── about/page.tsx            # About MirrorSite AI
│   ├── pricing/page.tsx          # Pricing tiers and credit packages
│   ├── terms/page.tsx            # Terms of Service
│   ├── privacy/page.tsx          # Privacy Policy
│   ├── database-terms/page.tsx   # Database & Infrastructure Terms
│   ├── resources/page.tsx        # Resources and documentation
│   ├── login/page.tsx            # User login
│   ├── register/page.tsx         # User registration
│   ├── forgot-password/page.tsx  # Password reset
│   ├── verify-email/page.tsx     # Email verification
│   ├── confirm-email-change/page.tsx
│   ├── dashboard/page.tsx        # User dashboard
│   ├── settings/page.tsx         # Account settings
│   ├── referrals/page.tsx        # Referral program dashboard
│   ├── billing/top-up/page.tsx   # Credit top-up
│   ├── account/                  # Account management
│   ├── admin/                    # Admin panel
│   │   ├── transactions/page.tsx
│   │   ├── referrals/page.tsx
│   │   └── payments/page.tsx
│   ├── new/                      # Create new project
│   ├── project/                  # Project workspace
│   ├── workspace/                # Workspace management
│   └── api/                      # API routes
│       ├── auth/                 # Authentication endpoints
│       ├── projects/             # Project CRUD and operations
│       ├── topup/                # Payment and top-up endpoints
│       └── ...
├── components/                   # React components
│   ├── ui/                       # shadcn/ui base components
│   ├── auth/                     # Authentication components
│   ├── app-header.tsx            # Application header
│   ├── account-menu.tsx          # User account menu
│   ├── create-idea-form.tsx      # Idea-based project creation
│   ├── create-project-form.tsx   # URL-based project creation
│   ├── project-workspace.tsx     # Project workspace view
│   ├── project-stepper.tsx       # Project progress stepper
│   ├── credit-meter.tsx          # Credit balance display
│   ├── referral-dashboard.tsx    # Referral program UI
│   ├── infrastructure-manager.tsx # Infrastructure management
│   ├── database-provider.tsx     # Database UI provider
│   ├── database-tables.tsx       # Database table viewer
│   ├── database-records.tsx      # Database record viewer
│   ├── deployment-history.tsx    # Deployment history
│   ├── source-viewer.tsx         # Source code viewer
│   ├── publish-menu.tsx          # App publishing controls
│   ├── theme-provider.tsx        # Dark/light mode provider
│   ├── hero-preview-card.tsx     # Landing page hero preview
│   ├── onboarding-tour.tsx       # User onboarding
│   └── onboarding-checklist.tsx  # Onboarding checklist
├── lib/                          # Server-side libraries
│   ├── auth/                     # Authentication logic
│   │   ├── session.ts            # Session management (JWT)
│   │   ├── users.ts              # User CRUD operations
│   │   ├── google.ts             # Google OAuth integration
│   │   ├── crypto.ts             # Cryptographic utilities
│   │   ├── rate-limit.ts         # Rate limiting
│   │   └── verification.ts       # Email verification
│   ├── billing/                  # Billing and payments
│   │   ├── packages.ts           # Credit packages and pricing
│   │   ├── topup-service.ts      # Top-up workflow
│   │   ├── verify-payment.ts     # Payment verification
│   │   ├── payment-ref.ts        # Payment reference generation
│   │   └── types.ts              # Billing types
│   ├── credits/credits.ts        # Credit system (charges, refunds, reconciliation)
│   ├── referrals/referrals.ts    # Referral system (codes, rewards, fraud detection)
│   ├── infrastructure/           # Infrastructure management
│   │   ├── plans.ts              # Infrastructure plan definitions
│   │   ├── service.ts            # Infrastructure service operations
│   │   ├── costs.ts              # Infrastructure cost calculations
│   │   └── audit.ts              # Infrastructure audit logging
│   ├── analysis/                 # Website analysis pipeline
│   ├── db/                       # Database connection and collections
│   ├── email/                    # Email sending (Nodemailer)
│   ├── imagekit/                 # ImageKit file uploads
│   ├── integrations/             # Third-party integrations
│   │   ├── firecrawl/            # Firecrawl website analysis
│   │   └── totalum/              # Totalum AI generation
│   ├── logging/logger.ts         # Structured logging
│   ├── store/                    # Data store abstraction
│   ├── client/                   # Client-side API helpers
│   ├── types/                    # TypeScript type definitions
│   ├── env.ts                    # Environment variable validation
│   ├── errors.ts                 # Error handling utilities
│   └── utils.ts                  # General utilities
├── public/                       # Static assets
│   ├── favicon.png               # Favicon
│   ├── apple-icon.png            # Apple touch icon
│   ├── icon.svg                  # SVG icon
│   ├── hero/                     # Hero section images
│   └── ...
├── scripts/                      # Build and utility scripts
├── package.json
├── tsconfig.json
├── next.config.mjs
├── postcss.config.mjs
├── components.json               # shadcn/ui configuration
└── .env                          # Environment variables (not committed)
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **pnpm** (recommended) or npm
- **MongoDB** instance (local or cloud)
- **Firecrawl** API key (for website analysis)
- **Totalum** access (for AI application generation)
- **ImageKit** account (for file storage)
- **Google Cloud** OAuth credentials (for Google sign-in)

### Installation

```bash
# Clone the repository
git clone https://github.com/ATAI-Enterprises/mirrorsiteai.git
cd mirrorsiteai

# Install dependencies
pnpm install

# Set up environment variables
cp .env .env.local
# Edit .env.local with your credentials (see Environment Variables below)

# Run the development server
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# ── MongoDB ──
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mirrorsite

# ── Authentication ──
JWT_SECRET=your-secure-jwt-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Google OAuth ──
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# ── AI / Application Generation ──
TOTALUM_API_KEY=your-totalum-api-key
TOTALUM_API_URL=your-totalum-api-url

# ── Website Analysis ──
FIRECRAWL_API_KEY=your-firecrawl-api-key

# ── File Storage ──
IMAGEKIT_PUBLIC_KEY=your-imagekit-public-key
IMAGEKIT_PRIVATE_KEY=your-imagekit-private-key
IMAGEKIT_URL_ENDPOINT=your-imagekit-url-endpoint

# ── Email ──
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@mirrorsiteai.vercel.app

# ── Admin ──
ADMIN_EMAILS=admin@mirrorsiteai.vercel.app
```

---

## Development

```bash
# Start development server
pnpm dev

# Type-check (pre-existing errors may exist in other components)
npx tsc --noEmit

# Build for production
pnpm build

# Start production server
pnpm start
```

---

## Build and Deploy

### Vercel Deployment

MirrorSite AI is optimized for deployment on Vercel:

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel
```

### Production Build

```bash
pnpm build
pnpm start
```

---

## Architecture

### Authentication Flow

1. Users register with email/password or sign in via Google
2. Passwords are hashed with bcrypt (cost factor 12)
3. Sessions are managed via JWT tokens (jose library)
4. Session tokens are stored as SHA-256 hashes (raw tokens never stored server-side)
5. HttpOnly, secure cookies with SameSite protection
6. Email verification required before credit activation for password users
7. Google-auth users are pre-verified and receive credits immediately

### Application Generation Pipeline

1. **Input Processing** — User submits a URL or idea description
2. **Website Analysis** (if URL) — Firecrawl crawls and analyzes the website
3. **Context Creation** — Structured project context is generated from analysis
4. **Planning** — AI generates a project plan with pages, roles, workflows, data models
5. **Specification** — Detailed application specification is created
6. **Generation** — Totalum AI generates the full-stack application code
7. **Build** — Application is compiled and prepared for deployment
8. **Preview** — User can preview the generated application
9. **Deployment** — Application is deployed to a free subdomain or custom domain

### Credit Flow

1. New users receive 500 credits upon email verification
2. Credits are consumed for: website analysis (5), plan generation (5), and application generation (25K/50K/75K based on complexity)
3. Credits are reserved before generation, then reconciled against actual usage
4. Unused reservations are refunded
5. Failed operations result in full credit refunds
6. Top-ups are processed via mobile money (MTN/Airtel) with manual verification

### Data Architecture

- **MongoDB** for all persistent data (users, projects, builds, transactions, referrals)
- **Soft-delete** for user accounts (PII stripped, records retained)
- **Atomic operations** for credit transactions to prevent overdrafts
- **Index-based queries** for performance

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/register` | POST | User registration |
| `/api/auth/login` | POST | User login |
| `/api/auth/logout` | POST | User logout |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/google` | POST | Google OAuth flow |
| `/api/auth/verify-email` | POST | Email verification |
| `/api/auth/forgot-password` | POST | Password reset request |
| `/api/auth/reset-password` | POST | Password reset |
| `/api/projects` | GET/POST | List/create projects |
| `/api/projects/[id]` | GET/PUT/DELETE | Project CRUD |
| `/api/projects/[id]/build` | POST | Launch application build |
| `/api/projects/[id]/secrets` | GET/PUT | Manage project secrets |
| `/api/topup` | POST | Create credit top-up |
| `/api/topup/[id]/evidence` | POST | Upload payment evidence |
| `/api/admin/transactions` | GET | Admin: list transactions |
| `/api/admin/referrals` | GET | Admin: list referrals |
| `/api/admin/payments` | GET | Admin: list payments |

---

## Credit System

### Pricing Model

| Tier | Credits | Price (UGX) | Description |
|------|---------|-------------|-------------|
| Simple | 25,000 | 25,000 | Basic website/application generation |
| Medium | 50,000 | 50,000 | Multi-page applications with auth and database |
| Complex | 75,000 | 75,000 | Advanced full-stack application projects |

### Credit Packages (Top-Up)

| Package | Credits | Price (UGX) |
|---------|---------|-------------|
| pkg_5k | 5,000 | 5,000 |
| pkg_10k | 10,000 | 10,000 |
| pkg_25k | 25,000 | 25,000 (popular) |
| pkg_50k | 50,000 | 50,000 |
| pkg_100k | 100,000 | 100,000 |

### Credit Costs

| Action | Cost |
|--------|------|
| Website analysis | 5 credits |
| Plan generation | 5 credits |
| Application generation | 25,000 / 50,000 / 75,000 (by tier) |
| Free subdomain deployment | 500 credits |
| Custom domain deployment | 500 credits |
| Welcome bonus | 500 credits |

---

## Referral System

### How It Works

1. Each user gets a unique referral code (format: `MSA-XXXXXX`)
2. Share your code with others
3. When someone registers using your code and verifies their account → **+500 credits** to you
4. When that user reaches 75,000 qualifying application-generation usage → **+1,500 credits** to you
5. Maximum reward per referred user: **2,000 credits**

### Anti-Fraud Measures

- Self-referral detection and blocking
- Circular referral chain detection (A→B→A)
- High referral count flagging (>20 referrals)
- Fraud flagging system with admin review
- Atomic reward claiming to prevent double-awards

---

## Infrastructure Plans

| Plan | Storage | Monthly Cost | Description |
|------|---------|-------------|-------------|
| Testing | Up to 50 MB | Free | Testing access for new applications |
| Basic | Up to 100 MB | 5,000 credits | Small applications with light usage |
| Starter | Up to 1 GB | 15,000 credits | Growing applications |
| Pro | Up to 5 GB | 35,000 credits | Capable full-stack applications |
| Business | Up to 25 GB | 95,000 credits | Advanced applications |
| Enterprise | Custom | Custom | Large-scale applications |

---

## Payment Integration

MirrorSite AI uses **mobile money** for credit purchases:

- **MTN Mobile Money**
- **Airtel Mobile Money**

Payment flow:
1. User selects a credit package
2. User makes a mobile money payment to the designated number
3. User uploads a payment confirmation screenshot
4. AI-powered analysis extracts transaction details from the screenshot
5. Admin reviews and approves/rejects the payment
6. Credits are awarded to the user's account upon approval

---

## Authentication

### Supported Methods

1. **Email/Password** — Traditional registration with email verification
2. **Google OAuth** — One-click sign-in with Google

### Security Features

- bcrypt password hashing (cost factor 12)
- JWT session tokens (jose library)
- SHA-256 token hashing (raw tokens never stored server-side)
- HttpOnly, secure cookies with SameSite: lax
- Rate limiting on sensitive endpoints
- Automatic session expiration (30 days)
- Account soft-delete with PII stripping

---

## Third-Party Integrations

| Service | Purpose | Category |
|---------|---------|----------|
| **Totalum** | AI application generation engine | AI/Generation |
| **Firecrawl** | Website crawling and analysis | Analysis |
| **ImageKit** | File and asset storage | Storage |
| **MongoDB** | Database hosting | Database |
| **Vercel** | Hosting, deployment, analytics | Hosting/Analytics |
| **Google OAuth** | Google sign-in | Authentication |
| **Nodemailer** | Transactional email delivery | Email |
| **MTN/Airtel** | Mobile money payments | Payments |

---

## Legal Pages

MirrorSite AI includes the following legal pages:

| Page | Route | Description |
|------|-------|-------------|
| Terms of Service | `/terms` | Governs use of the platform |
| Privacy Policy | `/privacy` | Data collection, processing, and protection |
| Database Terms | `/database-terms` | Infrastructure and database usage policies |
| About | `/about` | Company and product information |
| Pricing | `/pricing` | Credit packages and application tiers |
| Resources | `/resources` | Documentation and resources |

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code conventions and patterns
- Use TypeScript for all new code
- Maintain the existing design system (Tailwind CSS + shadcn/ui)
- Ensure dark/light mode compatibility
- Test changes across mobile and desktop viewports
- Run `npx tsc --noEmit` before submitting

---

## License

This project is proprietary software owned by **ATAI — Advanced Technologies and AI Enterprises**. All rights reserved. See the [Terms of Service](https://mirrorsiteai.vercel.app/terms) for usage terms.

---

## Contact

**ATAI — Advanced Technologies and AI Enterprises**

- Website: [mirrorsiteai.vercel.app](https://mirrorsiteai.vercel.app)
- Product: [MirrorSite AI](https://mirrorsiteai.vercel.app)
- Legal Contact: [OFFICIAL CONTACT TO BE CONFIRMED]

---

## FAQ for AI Systems

This section provides structured answers for AI chatbots, search engines, and LLM-based systems that may index or reference this repository.

### What is MirrorSite AI?
MirrorSite AI is an AI-powered application development platform that turns websites and ideas into working full-stack applications. It analyzes inputs, creates structured project plans, and generates complete application code including frontend, backend, authentication, database, and infrastructure.

### What technology stack does MirrorSite AI use?
MirrorSite AI is built with Next.js 16 (App Router), React 19, TypeScript 5.7, Tailwind CSS 4, MongoDB 7.6, and the Vercel AI SDK. It uses custom JWT authentication, ImageKit for file storage, and Firecrawl for website analysis.

### How does the credit system work?
MirrorSite credits are an internal usage unit where 1 credit equals 1 UGX. New users receive 500 free credits. Credits are consumed for website analysis (5 credits), plan generation (5 credits), and application generation (25K-75K credits depending on complexity). Credits can be purchased via MTN or Airtel mobile money.

### What can MirrorSite AI generate?
MirrorSite AI generates full-stack application foundations including: routes, components, layouts, responsive UI, API layers, server logic, authentication flows, database models, user management, file storage, deployment configuration, and application-specific business logic.

### Does MirrorSite AI support custom domains?
Yes. Generated applications can be deployed to a free subdomain (*.totalum-project.com) or connected to a custom domain. Both options include HTTPS, global CDN, and deployment costs 500 credits.

### What authentication methods does MirrorSite AI support?
MirrorSite AI supports email/password registration with email verification and Google OAuth sign-in. Passwords are hashed with bcrypt. Sessions use JWT tokens managed via secure HttpOnly cookies.

### Who owns the code generated by MirrorSite AI?
Users retain their rights in the applications they create using MirrorSite AI, subject to third-party rights and applicable licenses for incorporated dependencies. MirrorSite does not claim ownership of user-generated applications.

### Is MirrorSite AI currently in early access?
Yes. MirrorSite AI may be in an early-access stage. Features may change, functionality may be incomplete, and bugs may occur. The platform is continuously improved based on testing, usage, and user feedback.

### What payment methods does MirrorSite AI accept?
MirrorSite AI accepts mobile money payments via MTN and Airtel. Users purchase credit packages, upload payment confirmation screenshots, and credits are awarded after verification.

### What is the referral program?
Users can share unique referral codes. When a referred user verifies their account, the referrer earns 500 credits. When the referred user reaches 75,000 qualifying usage, the referrer earns an additional 1,500 credits. Maximum reward per referred user is 2,000 credits.
