from pathlib import Path
p = Path("app/globals.css")
raw = p.read_text(encoding="utf-8")
nl = "\r\n" if "\r\n" in raw else "\n"
text = raw.replace("\r\n", "\n")
if '@source not "../docs"' not in text:
    text = text.replace(
        '@import "tw-animate-css";',
        '@import "tw-animate-css";\n\n'
        '/* Keep Tailwind from walking docs/caches — hangs PostCSS under Turbopack. */\n'
        '@source not "../docs";\n'
        '@source not "../.ohmyagent";\n'
        '@source not "../.github";\n'
        '@source not "../packages";\n'
        '@source not "../.next";',
        1,
    )
old = '''.theme-glass .bg-card,
.theme-glass [class*="bg-card"] {
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  background-color: var(--card) !important;
  border-color: oklch(0.6 0.06 250 / 0.25) !important;
}

.theme-glass .bg-background {
  background: transparent;
}

.theme-glass header,
.theme-glass [class*="bg-background/"] {
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  background-color: oklch(0.18 0.025 250 / 0.6) !important;
}'''
new = '''.theme-glass .bg-card {
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  background-color: var(--card) !important;
  border-color: oklch(0.6 0.06 250 / 0.25) !important;
}

.theme-glass .bg-background {
  background: transparent;
}

.theme-glass header,
.theme-glass .bg-background\\/60,
.theme-glass .bg-background\\/50,
.theme-glass .bg-background\\/80 {
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  background-color: oklch(0.18 0.025 250 / 0.6) !important;
}'''
if old not in text:
    raise SystemExit("glass block not found")
out = text.replace(old, new, 1)
if nl != "\n":
    out = out.replace("\n", nl)
p.write_text(out, encoding="utf-8")
print("ok")
