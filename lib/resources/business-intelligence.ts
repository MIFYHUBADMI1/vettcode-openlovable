/**
 * Business Intelligence derivations for the project resources page.
 * All functions here are pure and FREE — they derive from the spec at
 * render time with zero API calls or credit costs.
 */

import type { ApplicationSpecification } from "@/lib/types/specification"
import type { ProjectState } from "@/lib/types/project"
import {
  allSummaries,
  LEARNING_PATHS,
  pathResources,
  type ResourceSummary,
} from "@/lib/resources"

// ─── Business Stage ───────────────────────────────────────────────────────────

export type BusinessStage = "planning" | "building" | "live" | "growing"

export function deriveBusinessStage(state: ProjectState): BusinessStage {
  if (["created", "analyzing", "analysis_complete", "specification_ready", "plan_ready", "pending_plan"].includes(state)) return "planning"
  if (["awaiting_build_confirmation", "building", "build_complete", "build_failed"].includes(state)) return "building"
  if (["ready", "deploying", "deployed", "deployment_failed"].includes(state)) return "live"
  return "growing"
}

// ─── Next Steps ───────────────────────────────────────────────────────────────

export interface NextStep {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  category: "product" | "market" | "growth" | "ops" | "finance"
  href?: string
  action?: string
}

export function getStageNextSteps(state: ProjectState, spec?: ApplicationSpecification): NextStep[] {
  const stage = deriveBusinessStage(state)

  const planningSteps: NextStep[] = [
    { id: "complete-plan", title: "Complete your business plan", description: "Fill in all sections of your collaborate plan — the more detail you give, the better your application will be.", priority: "high", category: "product", action: "collaborate" },
    { id: "define-audience", title: "Define your target customers", description: "Write down exactly who your first 10 customers are — their job, their pain, and how they currently solve the problem.", priority: "high", category: "market" },
    { id: "validate-idea", title: "Validate before you build", description: "Talk to 5 people in your target market before spending build credits. One conversation changes more than one week of building.", priority: "high", category: "market", href: "/resources/start/how-to-validate-a-business-idea" },
    { id: "price-model", title: "Decide your pricing model", description: "Freemium, subscription, per-use, or one-time? Your pricing model shapes everything — features, marketing, and growth.", priority: "medium", category: "finance", action: "pricingTiers" },
    { id: "pick-niche", title: "Narrow your niche", description: "The most successful products start very specific. Define the exact persona you are solving for first.", priority: "medium", category: "market", href: "/resources/start/founder-fundamentals" },
  ]

  const buildingSteps: NextStep[] = [
    { id: "review-plan", title: "Review your plan before the build", description: "Read every section of your collaborate plan. Mistakes in the plan become bugs in the product.", priority: "high", category: "product", action: "collaborate" },
    { id: "launch-checklist", title: "Prepare your launch checklist", description: "Domain, analytics, error tracking, payments, terms, privacy — get these ready before launch day.", priority: "high", category: "ops", href: "/resources/launch/launch-checklist" },
    { id: "find-beta-users", title: "Find 20 beta users now", description: "Build a waitlist while the app is building. A list of 20 real people matters more than a perfect product.", priority: "high", category: "market" },
    { id: "setup-analytics", title: "Set up your analytics", description: "Decide what the one metric that matters is and have a way to track it on day one.", priority: "medium", category: "ops" },
    { id: "write-copy", title: "Write your landing page copy", description: "Hero headline, sub-headline, and 3 key benefits. Write these now so they are ready to publish immediately.", priority: "medium", category: "market" },
  ]

  const liveSteps: NextStep[] = [
    { id: "first-customers", title: "Get your first 10 paying customers", description: "Do things that don't scale — reach out manually, offer onboarding calls, give discounts for feedback.", priority: "high", category: "growth", href: "/resources/grow/find-early-customers" },
    { id: "seo-foundation", title: "Build your SEO foundation", description: "Publish your first 3 articles targeting keywords your customers search for. Content compounds over time.", priority: "high", category: "growth", action: "market" },
    { id: "collect-feedback", title: "Run a feedback session this week", description: "Watch 3 real users use your product without helping them. You will learn more than a month of speculation.", priority: "high", category: "product" },
    { id: "activate-payments", title: "Activate your payment flow", description: "If you have not charged anyone yet, make your payment flow live and test it end-to-end today.", priority: "high", category: "finance" },
    { id: "set-retention-metric", title: "Define and track your retention metric", description: "What does a retained user look like? Log in weekly? Complete a key action? Define it and track it now.", priority: "medium", category: "product" },
    { id: "referral-loop", title: "Design a referral loop", description: "Build a simple mechanic that makes users want to share. Even a discount code for a referral works.", priority: "medium", category: "growth" },
  ]

  const growingSteps: NextStep[] = [
    { id: "double-down", title: "Double down on what already works", description: "Find your single best-performing acquisition channel and put 80% of your effort there.", priority: "high", category: "growth" },
    { id: "hire-first", title: "Make your first hire or contractor", description: "What single role would 2x your speed? Hire for that role, not the one you feel safest with.", priority: "high", category: "ops" },
    { id: "raise-prices", title: "Test a price increase", description: "Most early-stage products are underpriced. Try a 20% price increase on the next 10 sign-ups.", priority: "medium", category: "finance" },
    { id: "expand-market", title: "Identify an adjacent market", description: "Who else has the same problem? Which industry, role, or geography could you expand into next?", priority: "medium", category: "market" },
    { id: "build-moat", title: "Identify your competitive moat", description: "What would make it hard for a well-funded competitor to replicate what you have? Build that thing.", priority: "medium", category: "product" },
  ]

  const base = stage === "planning" ? planningSteps : stage === "building" ? buildingSteps : stage === "live" ? liveSteps : growingSteps

  // Inject spec-aware steps
  const extras: NextStep[] = []
  if (spec) {
    if (!spec.pricingTiers && stage !== "planning") {
      extras.push({ id: "define-pricing", title: "Define your pricing tiers", description: "You have no pricing model set. Add tiers in your collaborate plan — free, pro, or enterprise.", priority: "high", category: "finance", action: "pricingTiers" })
    }
    if (!spec.marketPositioning && stage === "live") {
      extras.push({ id: "market-position", title: "Define your market positioning", description: "Your positioning statement is missing. Write why customers choose you over every alternative.", priority: "medium", category: "market", action: "marketPositioning" })
    }
  }

  return [...extras, ...base].slice(0, 8)
}

// ─── Market Snapshot ──────────────────────────────────────────────────────────

export interface MarketCard {
  label: string
  value: string
  detail?: string
  icon: string
}

export function deriveMarketSnapshot(spec: ApplicationSpecification): MarketCard[] {
  const cards: MarketCard[] = []

  if (spec.targetUsers?.length) {
    cards.push({
      label: "Target Customers",
      value: spec.targetUsers.slice(0, 2).join(" & "),
      detail: spec.targetUsers.length > 2 ? `+${spec.targetUsers.length - 2} more segments` : undefined,
      icon: "Users",
    })
  }

  if (spec.businessModel) {
    cards.push({ label: "Business Model", value: spec.businessModel.slice(0, 80), icon: "Briefcase" })
  }

  if (spec.revenueModel) {
    cards.push({ label: "Revenue Model", value: spec.revenueModel.slice(0, 80), icon: "DollarSign" })
  }

  if (spec.marketPositioning) {
    cards.push({ label: "Positioning", value: spec.marketPositioning.slice(0, 120), icon: "Compass" })
  }

  if (spec.applicationType) {
    cards.push({ label: "Application Type", value: spec.applicationType, icon: "Layers" })
  }

  return cards
}

// ─── Marketing Channels ───────────────────────────────────────────────────────

export interface MarketingChannel {
  name: string
  fit: "high" | "medium" | "low"
  why: string
  difficulty: "easy" | "medium" | "hard"
  timeToResults: string
  tactics: string[]
  icon: string
}

export function getMarketingChannels(spec: ApplicationSpecification): MarketingChannel[] {
  const type = (spec.applicationType ?? "").toLowerCase()
  const bm = (spec.businessModel ?? "").toLowerCase()
  const users = (spec.targetUsers ?? []).join(" ").toLowerCase()

  const isB2B = bm.includes("b2b") || bm.includes("business") || users.includes("business") || users.includes("enterprise") || users.includes("company")
  const isConsumer = bm.includes("b2c") || bm.includes("consumer") || users.includes("individual") || users.includes("personal")
  const isMarketplace = type.includes("marketplace") || bm.includes("marketplace")
  const isSaaS = type.includes("saas") || bm.includes("subscription") || bm.includes("saas")
  const isEcommerce = type.includes("ecommerce") || type.includes("shop") || type.includes("store")
  const isCommunity = type.includes("community") || type.includes("social") || type.includes("forum")

  const channels: MarketingChannel[] = []

  // SEO — always relevant
  channels.push({
    name: "Search Engine Optimisation (SEO)",
    fit: "high",
    why: "Long-term organic traffic compounds over time. Every article you publish works for you permanently.",
    difficulty: "medium",
    timeToResults: "3–6 months",
    tactics: ["Publish 2 articles per week on problems your customers search for", "Target long-tail keywords first (easier to rank)", "Build backlinks by being quoted in industry publications"],
    icon: "Search",
  })

  if (isB2B) {
    channels.push({
      name: "LinkedIn & Outbound",
      fit: "high",
      why: "B2B buyers research on LinkedIn. A personal brand and direct outreach compound faster than ads.",
      difficulty: "medium",
      timeToResults: "1–3 months",
      tactics: ["Post daily insights from building your product", "Connect and message 10 ideal customers per day", "Share customer case studies and results"],
      icon: "Users",
    })
    channels.push({
      name: "Email Outreach",
      fit: "high",
      why: "Direct contact with decision makers. A 3-email sequence to the right list outperforms most ad spend.",
      difficulty: "medium",
      timeToResults: "2–6 weeks",
      tactics: ["Build a list of 200 ideal companies from LinkedIn or directories", "Write a 3-email sequence focused on the problem, not the product", "Offer a free audit, tool, or conversation — not a demo"],
      icon: "Mail",
    })
  }

  if (isConsumer || isMarketplace || isCommunity) {
    channels.push({
      name: "Social Media (organic)",
      fit: "high",
      why: "Consumer products grow through content. Show the product in use, share the story, build an audience.",
      difficulty: "medium",
      timeToResults: "1–4 months",
      tactics: ["Post 3x per week on the platform your audience uses most", "Behind-the-scenes content consistently outperforms polished ads", "Use trending formats — Reels, Shorts, TikToks depending on your audience"],
      icon: "Globe",
    })
    channels.push({
      name: "Referral Programme",
      fit: "high",
      why: "Consumer products grow fastest when users recruit other users. One viral mechanic changes the growth curve.",
      difficulty: "easy",
      timeToResults: "2–8 weeks",
      tactics: ["Give existing users a benefit for every new user they bring", "Make sharing a natural part of the product experience", "Show a leaderboard or progress bar to gamify the referral"],
      icon: "Share",
    })
  }

  if (isSaaS || isB2B) {
    channels.push({
      name: "Content Marketing",
      fit: "high",
      why: "High-quality guides rank on Google and build trust with buyers who research before purchasing.",
      difficulty: "medium",
      timeToResults: "2–5 months",
      tactics: ["Write one definitive guide on the core problem you solve", "Create comparison pages (Your Product vs Competitor)", "Publish a free tool or calculator to attract links"],
      icon: "FileText",
    })
  }

  if (isEcommerce || isMarketplace) {
    channels.push({
      name: "Paid Advertising",
      fit: "high",
      why: "Ecommerce and marketplaces can scale with paid ads once the unit economics work.",
      difficulty: "hard",
      timeToResults: "2–6 weeks",
      tactics: ["Start with $10/day to test creative and audiences", "Use retargeting before acquisition ads", "Calculate your customer acquisition cost (CAC) before scaling"],
      icon: "Zap",
    })
  }

  channels.push({
    name: "Community & Partnerships",
    fit: "medium",
    why: "Finding where your customers already gather and being genuinely useful there builds trust fast.",
    difficulty: "easy",
    timeToResults: "1–3 months",
    tactics: ["Join 3 communities where your target customers are already active", "Answer questions, share knowledge — never pitch directly", "Offer exclusive deals or early access to community members"],
    icon: "Handshake",
  })

  channels.push({
    name: "Product-Led Growth",
    fit: isSaaS ? "high" : "medium",
    why: "Let the product do the marketing. A free tier, viral feature, or shareable output brings users in organically.",
    difficulty: "hard",
    timeToResults: "3–12 months",
    tactics: ["Add a free tier or free trial to lower the barrier to entry", "Build a shareable output — a report, result, or creation users want to share", "Optimise your onboarding to get users to their 'aha moment' within 5 minutes"],
    icon: "Rocket",
  })

  return channels.slice(0, 6)
}

// ─── Valuation Snapshot ───────────────────────────────────────────────────────

export interface ValuationRange {
  methodology: string
  lowMultiple: string
  highMultiple: string
  valuationDriver: string
  exampleMetric: string
}

export interface GiantProfile {
  name: string
  niche: string
  founded: string
  lastValuation: string
  revenueRange: string
  whatMadeThem: string
}

export interface ValuationSnapshot {
  model: ValuationRange
  keyDrivers: string[]
  giants: GiantProfile[]
}

export function deriveValuationSnapshot(spec: ApplicationSpecification): ValuationSnapshot {
  const type = (spec.applicationType ?? "").toLowerCase()
  const bm = (spec.businessModel ?? "").toLowerCase()

  const isSaaS = type.includes("saas") || bm.includes("subscription")
  const isMarketplace = type.includes("marketplace")
  const isEcommerce = type.includes("ecommerce") || type.includes("shop")
  const isFintech = type.includes("fintech") || type.includes("payment") || type.includes("financial")
  const isHealthtech = type.includes("health") || type.includes("medical")
  const isEdtech = type.includes("education") || type.includes("learning") || type.includes("course")
  const isConsumer = bm.includes("b2c") || bm.includes("consumer")

  if (isSaaS) {
    return {
      model: {
        methodology: "ARR (Annual Recurring Revenue) Multiple",
        lowMultiple: "5x ARR",
        highMultiple: "15x ARR",
        valuationDriver: "Net Revenue Retention (NRR) and growth rate",
        exampleMetric: "If you reach $100k ARR, expect a $500k–$1.5M valuation range at early stages",
      },
      keyDrivers: [
        "Monthly Recurring Revenue (MRR) — predictability is valued over one-time revenue",
        "Churn rate — below 5% annually is considered excellent for B2B",
        "Net Revenue Retention — if customers expand (>100% NRR), valuation multiplies significantly",
        "Growth rate — doubling year-over-year commands premium multiples",
        "Gross margin — SaaS should target >70% gross margin",
      ],
      giants: [
        { name: "Slack", niche: "Team communication SaaS", founded: "2013", lastValuation: "$27.7B (Salesforce acquisition)", revenueRange: "$900M ARR at acquisition", whatMadeThem: "Viral adoption within companies, deep workflow integration, and a free tier that converted teams at scale" },
        { name: "Notion", niche: "Productivity / knowledge management SaaS", founded: "2016", lastValuation: "$10B", revenueRange: "$100M+ ARR", whatMadeThem: "Product-led growth, strong community, flexible blocks model that replaced multiple tools" },
        { name: "Figma", niche: "Design collaboration SaaS", founded: "2012", lastValuation: "$20B (Adobe acquisition attempt)", revenueRange: "$400M ARR at acquisition", whatMadeThem: "Real-time multiplayer collaboration in a space that was single-player, became the standard tool for product teams" },
      ],
    }
  }

  if (isMarketplace) {
    return {
      model: {
        methodology: "GMV (Gross Merchandise Value) Multiple or Revenue Multiple",
        lowMultiple: "1–3x GMV",
        highMultiple: "5–10x Revenue",
        valuationDriver: "Take rate, liquidity (supply/demand balance), and repeat purchase rate",
        exampleMetric: "A marketplace processing $1M GMV with a 15% take rate earns $150k revenue — valued at $750k–$1.5M early stage",
      },
      keyDrivers: [
        "Liquidity — can buyers reliably find what they need, and sellers reliably find buyers?",
        "Take rate — what percentage of each transaction do you capture?",
        "Repeat purchase rate — high frequency marketplaces (food, services) command higher multiples",
        "Supply concentration — is the marketplace defensible or can suppliers leave easily?",
        "NPS / trust score — trust is the core asset of any marketplace",
      ],
      giants: [
        { name: "Airbnb", niche: "Short-term rental marketplace", founded: "2008", lastValuation: "$75B (IPO)", revenueRange: "$9B revenue (2023)", whatMadeThem: "Solved a painful problem for both hosts and travellers simultaneously, with strong trust and review systems" },
        { name: "Fiverr", niche: "Freelance services marketplace", founded: "2010", lastValuation: "$1.5B (public)", revenueRange: "$350M revenue (2023)", whatMadeThem: "Standardised gig format lowered friction to buy, enabling impulse purchases of services" },
        { name: "Etsy", niche: "Handmade goods marketplace", founded: "2005", lastValuation: "$10B (public)", revenueRange: "$2.7B revenue (2023)", whatMadeThem: "Strong niche identity (handmade, vintage) created defensibility against Amazon" },
      ],
    }
  }

  if (isFintech) {
    return {
      model: {
        methodology: "Revenue Multiple or Assets Under Management (AUM)",
        lowMultiple: "5x Revenue",
        highMultiple: "20x Revenue",
        valuationDriver: "Regulatory moat, transaction volume, user trust, and network effects",
        exampleMetric: "Fintech companies with $1M revenue often trade at $5M–$20M depending on growth rate and regulatory positioning",
      },
      keyDrivers: [
        "Regulatory compliance — a licence or compliance infrastructure is a genuine moat",
        "Transaction volume — high volume creates data advantages and network effects",
        "User trust — financial products have very high switching costs once trust is established",
        "Gross margin — payment companies have thin margins but huge scale; neobanks vary widely",
        "Regulatory risk — valuation can be severely impacted by regulatory changes",
      ],
      giants: [
        { name: "Stripe", niche: "Payment infrastructure", founded: "2010", lastValuation: "$65B", revenueRange: "$14B revenue (2023)", whatMadeThem: "Developer-first approach made payment integration radically simpler, then expanded to financial infrastructure" },
        { name: "Flutterwave", niche: "African payment infrastructure", founded: "2016", lastValuation: "$3B", revenueRange: "$400M+ revenue", whatMadeThem: "Solved complex multi-country payment rails in Africa — a problem nobody else had properly solved" },
        { name: "Plaid", niche: "Financial data infrastructure", founded: "2013", lastValuation: "$13.4B", revenueRange: "$250M+ ARR", whatMadeThem: "Became the standard layer connecting bank accounts to apps — network effects via developer adoption" },
      ],
    }
  }

  if (isEdtech) {
    return {
      model: {
        methodology: "Revenue Multiple",
        lowMultiple: "3x Revenue",
        highMultiple: "12x Revenue",
        valuationDriver: "Completion rates, outcome data, and B2B enterprise contracts",
        exampleMetric: "Consumer edtech with $500k revenue valued at $1.5M–$6M; enterprise edtech commands much higher multiples",
      },
      keyDrivers: [
        "Learning outcomes — can you prove your product works? Outcome data is the most valuable asset",
        "Completion rates — low completion is the biggest challenge in edtech; high completion is a genuine differentiator",
        "B2B vs B2C — enterprise training contracts provide more predictable revenue than consumer subscriptions",
        "Content moat — proprietary curriculum or instructor relationships create defensibility",
        "Certification value — if your certification is recognised by employers, retention and virality both increase",
      ],
      giants: [
        { name: "Coursera", niche: "Online learning platform", founded: "2012", lastValuation: "$2B (IPO)", revenueRange: "$635M revenue (2023)", whatMadeThem: "University partnerships gave credentials real-world weight, differentiating from informal learning" },
        { name: "Duolingo", niche: "Language learning app", founded: "2011", lastValuation: "$7B (IPO)", revenueRange: "$531M revenue (2023)", whatMadeThem: "Gamification and daily streaks drove retention in a category with notoriously high churn" },
        { name: "Teachable", niche: "Course creation platform", founded: "2013", lastValuation: "$250M (acquired by Hotmart)", revenueRange: "$50M+ revenue", whatMadeThem: "Empowered creators to monetise expertise without technical knowledge — creator economy play" },
      ],
    }
  }

  // Default: general software/app
  return {
    model: {
      methodology: "Revenue Multiple",
      lowMultiple: "3x Revenue",
      highMultiple: "10x Revenue",
      valuationDriver: "Growth rate, gross margin, and defensibility",
      exampleMetric: "At $100k annual revenue, expect a $300k–$1M early-stage valuation range",
    },
    keyDrivers: [
      "Revenue growth rate — the biggest single driver of tech valuation multiples",
      "Gross margin — software should target >60%; services businesses trade at lower multiples",
      "Customer concentration — one customer = >20% revenue is a significant risk discount",
      "Defensibility — what prevents a well-funded competitor from replicating your product?",
      "Team — at early stages, investors often value the team as much as the product",
    ],
    giants: [
      { name: "Figma", niche: "Design tools", founded: "2012", lastValuation: "$20B", revenueRange: "$400M ARR", whatMadeThem: "Real-time multiplayer in a space that was single-player, then became the default tool for entire teams" },
      { name: "Linear", niche: "Issue tracking software", founded: "2019", lastValuation: "$400M", revenueRange: "$50M+ ARR", whatMadeThem: "Exceptionally fast, opinionated product in a category full of bloated tools — quality as a differentiator" },
      { name: "Loom", niche: "Video messaging", founded: "2015", lastValuation: "$1.5B (acquired by Atlassian)", revenueRange: "$100M+ ARR", whatMadeThem: "Created a new category of async communication, then embedded into remote team workflows deeply enough to achieve lock-in" },
    ],
  }
}

// ─── Filtered Resources ───────────────────────────────────────────────────────

export function getFilteredResources(spec: ApplicationSpecification | undefined, state: ProjectState): ResourceSummary[] {
  const stage = deriveBusinessStage(state)
  const all = allSummaries()

  const stageCategoryMap: Record<BusinessStage, string[]> = {
    planning: ["start", "atai", "ai"],
    building: ["build", "atai", "templates"],
    live: ["launch", "grow", "ai"],
    growing: ["grow", "ai", "templates"],
  }

  const preferred = stageCategoryMap[stage]
  const relevant = all.filter((r) => preferred.includes(r.category))

  // Sort: featured first, then by category priority
  const sorted = relevant.sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return preferred.indexOf(a.category) - preferred.indexOf(b.category)
  })

  return sorted.slice(0, 9)
}

export function getRelevantLearningPaths(state: ProjectState) {
  const stage = deriveBusinessStage(state)

  const pathMap: Record<BusinessStage, string[]> = {
    planning: ["start-with-atai", "idea-to-launch"],
    building: ["idea-to-launch", "build-with-ai"],
    live: ["idea-to-launch", "build-with-ai"],
    growing: ["build-with-ai", "idea-to-launch"],
  }

  return LEARNING_PATHS.filter((p) => pathMap[stage].includes(p.id)).map((path) => ({
    ...path,
    resources: pathResources(path.steps),
  }))
}
