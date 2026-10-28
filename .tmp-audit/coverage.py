import os, re, collections

tests = []
for r, d, files in os.walk('.'):
    if any(x in r for x in ('node_modules', '.git', '.next', '.kiro')):
        continue
    for f in files:
        if re.match(r'.*\.test\.(ts|tsx)$', f):
            tests.append(os.path.normpath(os.path.join(r, f)))

print('total test files:', len(tests))

buckets = collections.Counter()
for t in tests:
    p = t.replace('\\', '/')
    if p.startswith('app/api'):
        b = 'app/api (route-level)'
    elif p.startswith('app/'):
        b = 'app/pages'
    elif p.startswith('lib/'):
        b = 'lib'
    elif p.startswith('components/'):
        b = 'components'
    else:
        b = 'other'
    buckets[b] += 1
for k, v in buckets.most_common():
    print(f'  {k}: {v}')

print()
print('lib subareas:')
sub = collections.Counter()
for t in tests:
    p = t.replace('\\', '/')
    if p.startswith('lib/'):
        parts = p.split('/')
        sub['/'.join(parts[1:3]) if len(parts) > 3 else '/'.join(parts[1:2])] += 1
for k, v in sub.most_common(40):
    print(f'  {k}: {v}')

print()
print('app/api subareas:')
sub2 = collections.Counter()
for t in tests:
    p = t.replace('\\', '/')
    if p.startswith('app/api'):
        parts = p.split('/')
        sub2['/'.join(parts[2:4]) if len(parts) > 4 else '/'.join(parts[2:3])] += 1
for k, v in sub2.most_common(30):
    print(f'  {k}: {v}')
