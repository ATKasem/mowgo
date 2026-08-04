import json, re, unicodedata, glob

def text_key(value):
    v = unicodedata.normalize('NFD', value.lower())
    v = ''.join(c for c in v if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '_', v).strip('_')[:72]

en = json.load(open('client/src/i18n/locales/en.json'))

# First: which sections still have literal keys without snake twin?
print('=== Sections with unresolvable literal keys ===')
for sec_name, sec in en.items():
    if not isinstance(sec, dict): continue
    literal = [k for k in sec if ' ' in k]
    no_twin = [k for k in literal if text_key(k) not in sec]
    if no_twin:
        print(f'{sec_name}: {len(no_twin)} literal keys no twin:', [k[:40] for k in no_twin[:4]])

print()
print('=== tr() calls per file (all namespaces in file) ===')
# scan each file: collect namespaces used, then tr() strings; check each string resolves in at least one of the file's namespaces
TR_CALL = re.compile(r'\btr\(\s*"((?:[^"\\]|\\.)*)"', re.S)
NS_CALL = re.compile(r"useLocalizedText\(\s*'([a-zA-Z]+)'\s*\)")

for path in sorted(glob.glob('client/src/**/*.jsx', recursive=True)) + sorted(glob.glob('client/src/**/*.js', recursive=True)):
    src = open(path, encoding='utf-8').read()
    nss = set(NS_CALL.findall(src))
    if not nss: continue
    bad = []
    for s in set(TR_CALL.findall(src)):
        # unescape simple escapes
        s2 = s.replace('\\"', '"').replace("\\'", "'").replace('\\\\', '\\')
        k = text_key(s2)
        if not any(k in en.get(ns, {}) for ns in nss):
            bad.append(s2[:55])
    if bad:
        print(f'{path} nss={sorted(nss)}:')
        for b in bad: print('   ', b)
print('done')
