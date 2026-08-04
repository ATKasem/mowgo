import json, re, unicodedata

def text_key(value):
    v = unicodedata.normalize('NFD', value.lower())
    v = ''.join(c for c in v if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '_', v).strip('_')[:72]

for lang in ['en', 'es']:
    path = f'client/src/i18n/locales/{lang}.json'
    data = json.load(open(path))
    renamed = 0
    for sec_name in ['settings', 'reviewPrompt']:
        sec = data.get(sec_name, {})
        literal = [k for k in sec if ' ' in k]
        new_sec = {}
        for k, v in sec.items():
            if ' ' in k:
                new_sec[text_key(k)] = v
                renamed += 1
            else:
                new_sec[k] = v
        data[sec_name] = new_sec
    json.dump(data, open(path, 'w'), ensure_ascii=False, indent=2)
    print(lang, 'renamed:', renamed)
