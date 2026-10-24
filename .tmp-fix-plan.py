from pathlib import Path
p = Path("lib/analysis/plan-sections.ts")
text = p.read_text(encoding="utf-8")
old = '''export type PlanSectionId =
  | BusinessPlanField
  | "overview"
  | "targetUsers"
  | "features"
  | "flows"
  | "data"
  | "auth"
  | "seo"
'''
new = '''export type PlanSectionId =
  | BusinessPlanField
  | "overview"
  | "targetUsers"
  | "features"
  | "flows"
  | "data"
  | "auth"
  | "seo"
  | "brandIdentity"
  | "themePreferences"
'''
if old not in text:
    raise SystemExit("pattern not found")
p.write_text(text.replace(old, new, 1), encoding="utf-8")
print("ok")
