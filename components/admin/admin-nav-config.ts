import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Coins,
  CreditCard,
  Database,
  FileText,
  Gauge,
  Scale,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Package,
  Receipt,
  Route,
  Settings,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
  Webhook,
  Workflow,
  X,
} from "lucide-react"

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
  description: string
}

export type AdminNavGroup = {
  id: string
  label: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/admin", label: "Command center", icon: LayoutDashboard, description: "Every admin page, live demand, and shortcuts." },
      { href: "/admin/tools", label: "Admin tools", icon: Coins, description: "Self-credit and operator utilities." },
    ],
  },
  {
    id: "operate",
    label: "Operate",
    items: [
      { href: "/admin/runtime", label: "Runtime", icon: Route, description: "Usage, financials, and founder control." },
      { href: "/admin/runtime/pricing", label: "Runtime pricing", icon: BarChart3, description: "Runtime plan and usage pricing." },
      { href: "/admin/infrastructure", label: "Infrastructure", icon: Database, description: "Storage, plans, sync, and cost." },
      { href: "/admin/planning-runs", label: "Planning runs", icon: Workflow, description: "Build-planning pipeline observability." },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, description: "Accounts, credits, suspend, and access." },
      { href: "/admin/referrals", label: "Referrals", icon: UserPlus, description: "Referral rewards and fraud flags." },
      { href: "/admin/cancellations", label: "Cancellations", icon: X, description: "Subscription cancellation requests." },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { href: "/admin/billing", label: "Billing", icon: Receipt, description: "Revenue, credits, and billing overview." },
      { href: "/admin/billing/configuration", label: "Billing configuration", icon: Settings, description: "Credit costs and billing settings." },
      { href: "/admin/billing/plans", label: "Plans", icon: Package, description: "Subscription plans." },
      { href: "/admin/billing/credit-packs", label: "Credit packs", icon: Wallet, description: "One-time credit products." },
      { href: "/admin/billing/subscriptions", label: "Subscriptions", icon: CreditCard, description: "Live subscriptions." },
      { href: "/admin/billing/user-billing", label: "User billing", icon: Users, description: "Per-user billing state." },
      { href: "/admin/billing/webhooks", label: "Webhooks", icon: Webhook, description: "Payment webhook log." },
      { href: "/admin/billing/audit", label: "Billing audit", icon: FileText, description: "Billing audit trail." },
      { href: "/admin/billing/reconciliation", label: "Reconciliation", icon: Scale, description: "Payments vs credits vs entitlements." },
      { href: "/admin/payments", label: "Payments", icon: ShoppingCart, description: "Mobile money top-up review." },
      { href: "/admin/transactions", label: "Transactions", icon: CreditCard, description: "Credit activity across users." },
      { href: "/admin/ledger", label: "Ledger", icon: FileText, description: "Detailed credit ledger." },
      { href: "/admin/dodo-products", label: "Dodo products", icon: Package, description: "Dodo Payments catalog." },
    ],
  },
  {
    id: "product",
    label: "Product",
    items: [
      { href: "/admin/feature-requests", label: "Feature requests", icon: Lightbulb, description: "Demand, review, and status." },
      { href: "/admin/feedback", label: "Doc feedback", icon: MessageSquare, description: "Documentation thumbs and comments." },
    ],
  },
]

export const ADMIN_LEAVE: AdminNavItem[] = [
  { href: "/dashboard", label: "Founder home", icon: Gauge, description: "Leave admin and return to Atai." },
  { href: "/settings", label: "Settings", icon: Settings, description: "Your account settings." },
  { href: "/settings/billing", label: "Your billing", icon: Wallet, description: "Your personal billing history." },
  { href: "/settings/profile", label: "Your profile", icon: Users, description: "Name, avatar, and account details." },
  { href: "/settings/security", label: "Your security", icon: Settings, description: "Password, sessions, and email." },
]

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function allAdminNavItems() {
  return ADMIN_NAV.flatMap((group) => group.items)
}
