import json, re, unicodedata, glob

def text_key(value):
    v = unicodedata.normalize('NFD', value.lower())
    v = ''.join(c for c in v if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '_', v).strip('_')[:72]

def unescape_js(s):
    # JS string escapes: \u2019 \u2014 \u201c \u201d \u2026 \" \\ \n
    def repl(m):
        h = m.group(1)
        if h: return chr(int(h, 16))
        return {'"': '"', '\\': '\\', 'n': '\n', 't': '\t'}.get(m.group(0)[1], m.group(0)[1])
    return re.sub(r'\\u([0-9a-fA-F]{4})|\\("|\\|\\n|\\t)', repl, s)

en = json.load(open('client/src/i18n/locales/en.json'))
es = json.load(open('client/src/i18n/locales/es.json'))

print('=== EN==ES key parity ===')
for sec in en:
    if isinstance(en[sec], dict) and isinstance(es.get(sec), dict):
        if set(en[sec]) != set(es[sec]):
            oe = set(en[sec]) - set(es[sec]); oes = set(es[sec]) - set(en[sec])
            print(f'{sec}: only-EN={len(oe)} only-ES={len(oes)}')

print()
print('=== tr() resolvability (all files, all namespaces) ===')
TR_CALL = re.compile(r'\btr\(\s*"((?:[^"\\]|\\.)*)"', re.S)
NS_CALL = re.compile(r"useLocalizedText\(\s*'([a-zA-Z]+)'\s*\)")
total_bad = 0
for path in sorted(glob.glob('client/src/**/*.jsx', recursive=True)) + sorted(glob.glob('client/src/**/*.js', recursive=True)):
    src = open(path, encoding='utf-8').read()
    nss = set(NS_CALL.findall(src))
    if not nss: continue
    bad = []
    for s in set(TR_CALL.findall(src)):
        s2 = unescape_js(s)
        k = text_key(s2)
        if not any(k in en.get(ns, {}) for ns in nss):
            bad.append(s2[:60])
    if bad:
        total_bad += len(bad)
        print(f'{path} nss={sorted(nss)}:')
        for b in bad: print('   ', b)
print('TOTAL unresolved:', total_bad)
