import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Code2,
  Compass,
  Database,
  Download,
  FileText,
  FolderKanban,
  Globe,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LifeBuoy,
  Lightbulb,
  Megaphone,
  Pencil,
  Server,
  Settings,
  Sparkles,
  Swords,
  TrendingUp,
  Wallet,
} from "lucide-react"

export type AtaiNavKind = "link" | "soon" | "cofounder"

export interface AtaiNavItem {
  href: string
  label: string
  icon: LucideIcon
  kind: AtaiNavKind
  match?: (pathname: string) => boolean
}

export interface AtaiNavGroup {
  label: string
  items: AtaiNavItem[]
}

export function workspaceProjectNav(projectId: string): AtaiNavItem[] {
  const root = `/project/${projectId}`
  return [
    { href: root, label: "Workspace", icon: LayoutDashboard, kind: "link", match: (pathname) => pathname === root },
    { href: `${root}/progress`, label: "Team progress", icon: ListChecks, kind: "link" },
    { href: `${root}/collaborate`, label: "Collaborate", icon: Sparkles, kind: "link" },
    { href: `${root}/plan`, label: "Plan", icon: FileText, kind: "link" },
    { href: `${root}/edit`, label: "Edit plan", icon: Pencil, kind: "link" },
    { href: `${root}/source`, label: "Source", icon: Code2, kind: "link" },
    { href: `${root}/runtime`, label: "Runtime", icon: Server, kind: "link" },
    { href: `${root}/database`, label: "Database", icon: Database, kind: "link" },
    { href: `${root}/env`, label: "Environment", icon: Settings, kind: "link" },
    { href: `${root}/hosting`, label: "Hosting", icon: Globe, kind: "link" },
    { href: `/api/projects/${projectId}/export`, label: "Export snapshot", icon: Download, kind: "link", match: () => false },
  ]
}

export function workspaceGrowNav(projectId: string): AtaiNavItem[] {
  return [
    { href: `/project/${projectId}/market`, label: "Market & grow", icon: TrendingUp, kind: "soon" },
    { href: `/project/${projectId}/ads`, label: "Ads & marketing", icon: Megaphone, kind: "soon" },
    { href: `/project/${projectId}/finances`, label: "Business finances", icon: Wallet, kind: "soon" },
    { href: `/project/${projectId}/lessons`, label: "Business lessons", icon: GraduationCap, kind: "soon" },
    { href: `/project/${projectId}/resources`, label: "Resources", icon: BookOpen, kind: "soon" },
    { href: `/project/${projectId}/competition`, label: "Competition", icon: Swords, kind: "soon" },
  ]
}

export function ataiNav(projectId?: string): AtaiNavGroup[] {
  const competitionHref = projectId ? `/project/${projectId}/competition` : "/competition"
  const hostingHref = projectId ? `/project/${projectId}/hosting` : "/hosting"

  return [
    {
      label: "Atai",
      items: [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard, kind: "link", match: (p) => p === "/dashboard" },
        { href: "/explore", label: "Explore", icon: Compass, kind: "link" },
        { href: "/feature-requests", label: "Feature requests", icon: Lightbulb, kind: "link" },
        { href: "#cofounder", label: "Co-founder", icon: Sparkles, kind: "cofounder" },
      ],
    },
    {
      label: "My business",
      items: [
        { href: "/projects", label: "All projects", icon: FolderKanban, kind: "link", match: (p) => p === "/projects" || p.startsWith("/project/") },
        { href: competitionHref, label: "Competition", icon: Swords, kind: "soon" },
      ],
    },
    {
      label: "Business & growth",
      items: [
        { href: "/market", label: "Market & grow", icon: TrendingUp, kind: "soon" },
        { href: "/ads", label: "Ads & marketing", icon: Megaphone, kind: "soon" },
        { href: "/finances", label: "Business finances", icon: Wallet, kind: "soon" },
        { href: "/lessons", label: "Business lessons", icon: GraduationCap, kind: "soon" },
        { href: "/resources", label: "Resources", icon: BookOpen, kind: "link" },
      ],
    },
    {
      label: "Infrastructure",
      items: [{ href: hostingHref, label: "Hosting", icon: Server, kind: projectId ? "link" : "soon" }],
    },
    {
      label: "Account",
      items: [
        { href: "/settings", label: "Settings", icon: Settings, kind: "link" },
        { href: "/docs", label: "Help & support", icon: LifeBuoy, kind: "link" },
      ],
    },
  ]
}
