import os, re, json, collections

def walk(root, exts):
    out = []
    for r, d, files in os.walk(root):
        d[:] = [x for x in d if x not in ('node_modules', '.git', '.next', '.kiro', 'mirror-site-import', 'packages')]
        for f in files:
            if any(f.endswith(e) for e in exts):
                out.append(os.path.normpath(os.path.join(r, f)).replace('\\', '/'))
    return out

pages = walk('app', ['.tsx'])
pages = [p for p in pages if not p.endswith(('layout.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx', 'template.tsx', 'global-error.tsx', 'route.ts'))]
libs = walk('lib', ['.ts'])
libs = [p for p in libs if not re.search(r'\.test\.ts$', p)]
components = walk('components', ['.tsx', '.ts'])
routes = walk('app/api', ['.ts'])
routes = [p for p in routes if p.endswith('route.ts')]
runtime = walk('runtime', ['.ts'])
runtime = [p for p in runtime if not re.search(r'\.test\.ts$', p)]

print('pages (app/*.tsx, excl. layout/loading/error):', len(pages))
print('api route handlers (route.ts):', len(routes))
print('lib modules (.ts, excl. tests):', len(libs))
print('components:', len([c for c in components if not c.endswith('.test.tsx')]))
print('runtime modules:', len(runtime))

# HTTP method surface
methods = collections.Counter()
for r in routes:
    src = open(r, encoding='utf8', errors='replace').read()
    for m in re.findall(r'export async function (GET|POST|PUT|PATCH|DELETE)', src):
        methods[m] += 1
print('HTTP handlers by method:', dict(methods), 'total', sum(methods.values()))

# DB collections
colls = set()
for p in walk('lib/db', ['.ts']):
    src = open(p, encoding='utf8', errors='replace').read()
    colls |= set(re.findall(r'export (?:async )?function (\w+Col)\(', src))
print('db collection accessors:', len(colls))

# external integrations
integ = collections.Counter()
for p in walk('lib/integrations', ['.ts']):
    integ[os.path.dirname(p)] += 1
print('integration modules:', dict(integ))

# env vars referenced
envs = set()
for p in walk('.', ['.ts', '.tsx']):
    if p.startswith(('node_modules', '.next')): continue
    src = open(p, encoding='utf8', errors='replace').read()
    envs |= set(re.findall(r'process\.env\.([A-Z0-9_]+)', src))
    envs |= set(re.findall(r'process\.env\.get\("([A-Z0-9_]+)"', src))
print('distinct env vars referenced:', len(envs))
print(json.dumps(sorted(envs), indent=0)[:3000])
