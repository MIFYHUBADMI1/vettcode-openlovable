# 🏗️ System Overview

**MirrorSite AI - Complete System Architecture**

---

## 🎯 What Does This System Do?

MirrorSite AI transforms any website into a fully functional Next.js application through an AI-powered pipeline.

### The Journey of a Website Clone

```
User enters URL
    ↓
Website Crawling (Firecrawl API)
    ↓
Evidence Collection (pages, screenshots, structure)
    ↓
AI Analysis (7-stage pipeline)
    ↓
Specification Generation (pages, flows, design system)
    ↓
Code Generation (Next.js components)
    ↓
Build & Deploy (Vercel)
    ↓
Live Website Clone
```

---

## 🏛️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  - Landing Page                                          │
│  - Dashboard (User Projects)                             │
│  - Admin Panel (Super Admin)                             │
│  - Project Detail Pages                                  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Next.js)                   │
│  - REST endpoints (/api/*)                               │
│  - Authentication (JWT sessions)                         │
│  - Authorization (role-based)                            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Business Logic (lib/)                  │
│  ┌──────────────┬──────────────┬──────────────┐         │
│  │   Analysis   │   Planning   │   Credits    │         │
│  │   Pipeline   │   Pipeline   │   System     │         │
│  └──────────────┴──────────────┴──────────────┘         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  External Services                       │
│  - MongoDB Atlas (Database)                              │
│  - Firecrawl (Website Crawling)                          │
│  - OpenRouter (AI Models)                                │
│  - Stripe (Payments)                                     │
│  - Vercel (Deployment)                                   │
│  - Resend (Emails)                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Core Workflows

### 1. User Registration & Credits

```
User signs up with email
    ↓
Account created in MongoDB
    ↓
100 free credits granted
    ↓
Confirmation email sent (Resend)
    ↓
User can start creating projects
```

### 2. Website Analysis (Smart Crawl)

```
User enters website URL
    ↓
Reserve 20 credits
    ↓
Firecrawl: Map URL (discover pages)
    ↓
Firecrawl: Scrape top pages (7 pages max)
    ↓
Extract: title, description, screenshots, structure
    ↓
Save evidence to database
    ↓
Charge 20 credits
    ↓
Analysis complete
```

### 3. Website Analysis (Deep Crawl)

```
User enters website URL + selects mode (legacy/heavy)
    ↓
Reserve credits (500 legacy / 1000 heavy)
    ↓
Firecrawl: Deep crawl (up to 50 pages, 15 min timeout)
    ↓
If < 5 pages: Supplement with web search
    ↓
Evidence collected (pages, screenshots, links)
    ↓
If heavy mode: Run 7-stage AI pipeline
    ↓
Save specification to database
    ↓
Charge credits
    ↓
Analysis complete
```

### 4. 7-Stage AI Pipeline (Heavy Mode)

```
Stage 1: Research Agent
    ↓ Analyze for gaps, security issues, UX problems
Stage 2: Primary Planner
    ↓ Generate initial specification
Stage 3: Independent Critic
    ↓ Review and critique spec quality
Stage 4: Repair Service (if needed)
    ↓ Fix issues found by critic
Stage 5: Semantic Validator
    ↓ Validate data consistency (non-blocking)
Stage 6: Sanitizer
    ↓ Clean and normalize data
Stage 7: Complexity Classifier
    ↓ Assign complexity level (simple/moderate/complex)

Output: Complete ApplicationSpecification
```

### 5. Code Generation & Build

```
User clicks "Build Project"
    ↓
Reserve 50 credits
    ↓
Generate Next.js components
    ↓
Generate pages from specification
    ↓
Generate design system (Tailwind)
    ↓
Create GitHub repository
    ↓
Deploy to Vercel
    ↓
Charge 50 credits
    ↓
Build complete → Live URL
```

---

## 💳 Credit System

### Credit Types

1. **Subscription Credits** (Monthly renewal)
   - Granted with paid plans
   - Expire at end of billing period
   - Used first (oldest-first)

2. **Permanent Credits** (Never expire)
   - Purchased as credit packs
   - Used after subscription credits
   - Can be gifted or refunded

### Credit Costs

| Action | Cost | Mode |
|--------|------|------|
| Smart Crawl | 20 credits | Fast analysis |
| Deep Crawl (Legacy) | 500 credits | Raw crawl data only |
| Deep Crawl (Heavy) | 1000 credits | Full AI pipeline |
| Build & Deploy | 50 credits | Code generation |
| AI Pipeline Only | 100 credits | Manual trigger |

### Credit Flow

```
User action → Reserve credits → Execute operation
                    ↓
            If success: Charge reserved credits
            If failure: Refund reserved credits
```

---

## 🗄️ Database Collections

### Core Collections

1. **users** - User accounts, credits, subscriptions
2. **projects** - Website analysis projects
3. **sessions** - JWT authentication sessions
4. **verification_tokens** - Email verification
5. **credit_ledger** - All credit transactions
6. **subscription_records** - Stripe subscriptions
7. **payment_records** - Stripe payments
8. **planning_runs** - AI pipeline execution logs
9. **firecrawl_cache** - Cached crawl results (7-day TTL)

See `DATABASE_SCHEMA.md` for complete schema details.

---

## 🔌 External Integrations

### 1. Firecrawl API
**Purpose**: Website crawling and scraping  
**Endpoints Used**:
- `/v2/scrape` - Single page scraping
- `/v2/map` - Discover subpages
- `/v2/crawl` - Deep recursive crawl
- `/v2/search` - Web search for blocked sites

### 2. OpenRouter API
**Purpose**: AI model access (multiple providers)  
**Models Used**:
- `nvidia/nemotron-3-super-120b-a12b:free` - Planning & Critique
- `poolside/laguna-s-2.1:free` - Research & Analysis
- Fallbacks available for each stage

### 3. Stripe API
**Purpose**: Payments and subscriptions  
**Features**:
- Credit pack purchases
- Subscription billing
- Webhook handling
- Customer portal

### 4. Vercel API
**Purpose**: Project deployment  
**Features**:
- Deploy generated code
- Custom domains
- Environment variables
- Build logs

### 5. Resend API
**Purpose**: Transactional emails  
**Use Cases**:
- Email verification
- Password reset
- Welcome emails
- Credit alerts

---

## 🔐 Security & Authentication

### Authentication Flow

```
User logs in with email/password
    ↓
Password hashed with bcrypt
    ↓
JWT session token generated
    ↓
Token stored in MongoDB (sessions collection)
    ↓
Token sent to client (httpOnly cookie)
    ↓
Client includes token in all requests
    ↓
Server validates token on each request
```

### Authorization Levels

1. **Public** - No auth required (landing page)
2. **User** - Requires valid session (dashboard)
3. **Admin** - Requires admin role (admin panel)

### Security Features

- Password hashing (bcrypt)
- JWT tokens (httpOnly cookies)
- CSRF protection
- Rate limiting
- Input validation
- SQL injection prevention (using MongoDB)
- XSS prevention (React escaping)

---

## 🚀 Deployment Architecture

### Production Environment

```
User Request
    ↓
Vercel Edge Network (CDN)
    ↓
Next.js App (Vercel Serverless)
    ↓
MongoDB Atlas (Cloud Database)
    ↓
External APIs (Firecrawl, OpenRouter, etc.)
```

### Environments

1. **Development** - Local (`npm run dev`)
2. **Production** - Vercel (`mirrorsiteai.vercel.app`)

### Environment Variables

See `.env.local` for complete list:
- `MONGODB_URI` - Database connection
- `FIRECRAWL_API_KEY` - Crawling service
- `OPENROUTER_API_KEY` - AI models
- `STRIPE_SECRET_KEY` - Payments
- `VERCEL_TOKEN` - Deployment
- `RESEND_API_KEY` - Emails

---

## 📊 Data Flow Example

### Example: User Creates a Project

```
1. User submits URL on dashboard
   POST /api/projects
   Body: { sourceUrl: "https://example.com", crawlMode: "smart" }

2. API validates user session
   - Check JWT token
   - Load user from database

3. API reserves credits
   - Check user balance (≥ 20 credits)
   - Create reservation in credit_ledger

4. API creates project record
   - Insert into projects collection
   - Status: "analyzing"

5. Background: Analysis pipeline starts
   - Call Firecrawl API
   - Collect evidence
   - Save to database

6. Background: Charge credits
   - Update credit_ledger
   - Deduct from user balance

7. Background: Update project
   - Status: "ready"
   - Add evidence data

8. User polls for status
   GET /api/projects/{id}/status
   Returns: { state: "ready" }

9. User views results
   GET /api/projects/{id}
   Returns: Full project data
```

---

## 🧩 Key Design Patterns

### 1. Pipeline Pattern
- Analysis pipeline (crawl → analyze → save)
- AI pipeline (research → plan → critique → repair)
- Sequential stages with clear inputs/outputs

### 2. Repository Pattern
- `lib/db/store.ts` - Centralized data access
- All database ops go through store
- Consistent error handling

### 3. Circuit Breaker Pattern
- API calls protected with circuit breakers
- Automatic retries on failure
- Fallback to alternative providers

### 4. Credit Reservation Pattern
- Reserve → Execute → Charge/Refund
- Prevents race conditions
- Idempotent operations

### 5. Event Sourcing (Partial)
- Activity events logged per project
- Audit trail for debugging
- Timeline view in UI

---

## 🎯 System Boundaries

### What This System Does
✅ Crawl and analyze websites  
✅ Generate specifications with AI  
✅ Build Next.js clones  
✅ Deploy to Vercel  
✅ Handle billing & credits  
✅ User authentication  
✅ Admin dashboard  

### What This System Does NOT Do
❌ Actually host user websites (Vercel does this)  
❌ Process payments directly (Stripe does this)  
❌ Train AI models (uses external APIs)  
❌ Provide customer support chat  
❌ SEO optimization (yet)  
❌ A/B testing (yet)  

---

## 🔮 Future Architecture Considerations

### Scalability
- Current: Monolithic Next.js app
- Future: Microservices for heavy operations
- Queue system for long-running jobs (BullMQ)
- Caching layer (Redis)

### Performance
- Current: Serverless functions
- Future: Dedicated workers for builds
- CDN for static assets
- Database read replicas

### Monitoring
- Current: Basic logging
- Future: Full observability stack
- Error tracking (Sentry)
- Performance monitoring (Datadog)
- User analytics (PostHog)

---

## 📚 Related Documentation

- **Technical Details**: See `TECHNICAL_ARCHITECTURE.md`
- **Current Status**: See `CURRENT_STATUS.md`
- **Database**: See `DATABASE_SCHEMA.md`
- **API**: See `API_ENDPOINTS.md`
- **Credits**: See `CREDIT_SYSTEM.md`
- **AI Pipeline**: See `AI_PIPELINE.md`

---

**Next**: Read `CURRENT_STATUS.md` to see what's implemented.
