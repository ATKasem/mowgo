import json, re, unicodedata

def text_key(value):
    v = unicodedata.normalize('NFD', value.lower())
    v = ''.join(c for c in v if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '_', v).strip('_')[:72]

# (string in code, EN value, ES value) — same key = text_key(string)
ADD_RUUNLY = [
    ("* Based on Ruunly's published platform fee percentages applied to monthly revenue. MowGo Solo is $39 flat — no percentage fees.",
     "* Based on Ruunly's published platform fee percentages applied to monthly revenue. MowGo Solo is $39 flat — no percentage fees.",
     "* Basado en los porcentajes de tarifa de plataforma publicados por Ruunly aplicados a ingresos mensuales. MowGo Solo cuesta $39 fijos — sin tarifas porcentuales."),
    ('/mo', '/mo', '/mes'),
    ('/year', '/year', '/año'),
    ('Monthly revenue slider', 'Monthly revenue slider', 'Control deslizante de ingresos mensuales'),
    ('MowGo', 'MowGo', 'MowGo'),
    ('MowGo Solo: $39/mo flat. No platform fees. Free rain delay. Try it free.',
     'MowGo Solo: $39/mo flat. No platform fees. Free rain delay. Try it free.',
     'MowGo Solo: $39/mes fijos. Sin tarifas de plataforma. Retraso por lluvia gratis. Pruébalo gratis.'),
    ('On every plan — including Free. One tap moves your whole schedule. Clients get notified automatically.',
     'On every plan — including Free. One tap moves your whole schedule. Clients get notified automatically.',
     'En todos los planes — incluido el Gratis. Un toque mueve todo tu horario. Los clientes reciben aviso automáticamente.'),
    ('Platform Fee Exposé', 'Platform Fee Exposé', 'Exposición de tarifas de plataforma'),
    ('See what Ruunly actually costs vs MowGo. No asterisks, no fine print — just the numbers.',
     'See what Ruunly actually costs vs MowGo. No asterisks, no fine print — just the numbers.',
     'Mira cuánto cuesta Ruunly realmente vs MowGo. Sin asteriscos, sin letra pequeña — solo los números.'),
    ("You must upgrade to the Pro plan ($59/mo) just to get rain delay. Starter plan doesn't include it.",
     "You must upgrade to the Pro plan ($59/mo) just to get rain delay. Starter plan doesn't include it.",
     "Debes actualizar al plan Pro ($59/mes) solo para tener retraso por lluvia. El plan Starter no lo incluye."),
]

for lang, pick in [('en', 1), ('es', 2)]:
    path = f'client/src/i18n/locales/{lang}.json'
    data = json.load(open(path))
    sec = data['ruunlyComparison']
    # remove old AI hero key
    old = [k for k in sec if 'unlimited_ai' in k]
    for k in old: del sec[k]
    # add new keys
    for code_str, en_val, es_val in ADD_RUUNLY:
        val = en_val if lang == 'en' else es_val
        sec[text_key(code_str)] = val
    data['ruunlyComparison'] = sec
    # remove dead ai_assistant key (top-level 'app' section, unused in code)
    if 'ai_assistant' in data.get('app', {}):
        del data['app']['ai_assistant']
    json.dump(data, open(path, 'w'), ensure_ascii=False, indent=2)
    print(lang, 'ruunly:', len(sec), 'keys; removed old AI keys:', old)
