from pathlib import Path

def patch(path, old, new, label):
    p = Path(path)
    t = p.read_text(encoding="utf-8")
    if old not in t:
        raise SystemExit(f"MISSING {label} in {path}")
    p.write_text(t.replace(old, new, 1), encoding="utf-8")
    print("ok", label)

patch(
    r"C:\Users\USER\Desktop\mirrorsiteai\lib\types\specification.ts",
    """  revenueModel: z.string().optional(),
  /** Atai Runtime capabilities the generated app will consume (@atai-group/sdk) —
   * planned in the Collaborate workspace, honored by the build prompt. */
  runtimeIntegrations: z.string().optional(),""",
    """  revenueModel: z.string().optional(),
  /** Product-facing plans, prices, limits, and upgrade paths — carried into the build. */
  pricingTiers: z.string().optional(),
  /** Visual system: theme, color tokens, density, light/dark — carried into the build. */
  appearance: z.string().optional(),
  /** Heading, body, and mono fonts the generated app must use. */
  typography: z.string().optional(),
  /** Atai Runtime capabilities the generated app will consume (@atai-group/sdk) —
   * planned in the Collaborate workspace, honored by the build prompt. */
  runtimeIntegrations: z.string().optional(),""",
    "spec fields",
)

patch(
    r"C:\Users\USER\Desktop\mirrorsiteai\lib\types\specification.ts",
    """  "revenueModel",
  "runtimeIntegrations",""",
    """  "revenueModel",
  "pricingTiers",
  "appearance",
  "typography",
  "runtimeIntegrations",""",
    "business fields",
)

patch(
    r"C:\Users\USER\Desktop\mirrorsiteai\lib\types\plan-analysis.ts",
    """  businessModel: ["revenueModel", "marketPositioning"],
  revenueModel: ["businessModel", "marketPositioning"],
  problem: ["solution", "valueProposition"],""",
    """  businessModel: ["revenueModel", "pricingTiers", "marketPositioning"],
  revenueModel: ["businessModel", "pricingTiers", "marketPositioning"],
  pricingTiers: ["revenueModel", "features", "businessModel"],
  appearance: ["typography", "features"],
  typography: ["appearance"],
  problem: ["solution", "valueProposition"],""",
    "deps",
)
print("done")
