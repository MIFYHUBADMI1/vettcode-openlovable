import os, re, json

PATTERNS = [
    ('private-key-block', re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----')),
    ('aws-access-key-id', re.compile(r'\b(?:AKIA|ASIA)[0-9A-Z]{16}\b')),
    ('github-token', re.compile(r'\bgh[pousr]_[A-Za-z0-9]{20,}\b')),
    ('slack-token', re.compile(r'\bxox[abprs]-[A-Za-z0-9-]{10,}\b')),
    ('google-api-key', re.compile(r'\bAIza[0-9A-Za-z_\-]{35}\b')),
    ('stripe-live-key', re.compile(r'\bsk_live_[A-Za-z0-9]{10,}\b')),
    ('openai-key', re.compile(r'\bsk-[A-Za-z0-9]{32,}\b')),
    ('dodo-whsec', re.compile(r'\bwhsec_[A-Za-z0-9+/=_-]{16,}\b')),
    ('jwt', re.compile(r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b')),
    ('hardcoded-bearer', re.compile(r'["\']Bearer\s+[A-Za-z0-9._\-]{20,}["\']')),
    ('assigned-secret-literal', re.compile(r'(?:apiKey|api_key|secret|password|token|passwd)\s*[:=]\s*["\'][^"\'\n]{12,}["\']', re.I)),
]

SKIP_DIRS = {'node_modules', '.git', '.next', '.kiro', 'mirror-site-import', 'packages', '.tmp-audit', 'dist', 'out'}
EXTS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.env', '.sh'}

hits = []
for r, d, files in os.walk('.'):
    d[:] = [x for x in d if x not in SKIP_DIRS]
    for f in files:
        p = os.path.normpath(os.path.join(r, f))
        if os.path.splitext(f)[1].lower() not in EXTS:
            continue
        if f.startswith('.env'):
            hits.append((p, 'env-file', 0, 'env file present'))
            continue
        try:
            src = open(p, encoding='utf8', errors='replace').read()
        except Exception:
            continue
        for name, rx in PATTERNS:
            for m in rx.finditer(src):
                line = src.count('\n', 0, m.start()) + 1
                hits.append((p.replace('\\', '/'), name, line, ''))

seen = set()
for p, name, line, _ in hits:
    key = (p, name, line)
    if key in seen:
        continue
    seen.add(key)
    print(f'{p}:{line}  [{name}]')

print()
print('total pattern hits:', len(seen))

# .env files present in the working tree?
print()
print('env-ish files in the tree:')
for r, d, files in os.walk('.'):
    d[:] = [x for x in d if x not in SKIP_DIRS]
    for f in files:
        if f.startswith('.env'):
            print('  ', os.path.normpath(os.path.join(r, f)).replace('\\', '/'))
