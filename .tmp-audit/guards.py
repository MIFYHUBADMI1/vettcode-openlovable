import os, re, collections

SKIP = {'node_modules', '.git', '.next', '.kiro', 'mirror-site-import', 'packages', '.tmp-audit'}

routes = []
for r, d, files in os.walk('app/api'):
    d[:] = [x for x in d if x not in SKIP]
    if 'route.ts' in files:
        routes.append(os.path.normpath(os.path.join(r, 'route.ts')).replace('\\', '/'))

GUARDS = {
    'requireUser': re.compile(r'\brequireUser\s*\('),
    'requireAdmin': re.compile(r'\brequireAdmin\s*\('),
    'getCurrentUser': re.compile(r'\bgetCurrentUser\s*\('),
    'internal-key': re.compile(r'authorizeInternalRequest'),
    'runtime-bearer': re.compile(r'authenticateRuntimeRequest|runtimeAuth'),
    'webhook-hmac': re.compile(r'verifyWebhookSignature'),
    'studio-guard': re.compile(r'requireStudioProject'),
    'owned-project': re.compile(r'requireOwnedProject'),
    'ownership': re.compile(r'checkProjectOwnership'),
    'rate-limit': re.compile(r'checkRateLimit'),
    'zod-validate': re.compile(r'\.safeParse\(|z\.object\('),
}

rows = []
for p in sorted(routes):
    src = open(p, encoding='utf8', errors='replace').read()
    guards = [k for k, rx in GUARDS.items() if rx.search(src)]
    methods = sorted(set(re.findall(r'export async function (GET|POST|PUT|PATCH|DELETE)', src)))
    mutating = [m for m in methods if m in ('POST', 'PUT', 'PATCH', 'DELETE')]
    rows.append((p, ','.join(methods), ','.join(guards), bool(mutating)))

print(f'{"route":<62} {"methods":<28} guards')
for p, m, g, mut in rows:
    flag = '' if g else '  <== NO GUARD MATCH'
    print(f'{p:<62} {m:<28} {g}{flag}')

print()
print('routes with NO guard match:',
      sum(1 for r in rows if not r[2]))
print('mutating routes (POST/PUT/PATCH/DELETE) with no rate-limit:',
      sum(1 for r in rows if r[3] and 'rate-limit' not in r[2]))
