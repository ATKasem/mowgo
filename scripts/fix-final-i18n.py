import json, re, unicodedata

def text_key(value):
    v = unicodedata.normalize('NFD', value.lower())
    v = ''.join(c for c in v if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '_', v).strip('_')[:72]

ENTRIES = [
    ("vs ProBase", "vs ProBase", "vs ProBase"),
    ("Feature comparison between MowGo and 9 competitors including pricing and availability of 14 key features",
     "Feature comparison between MowGo and 9 competitors including pricing and availability of 14 key features",
     "Comparación de funciones entre MowGo y 9 competidores, incluidos precios y disponibilidad de 14 funciones clave"),
    ("Some competitors charge a sign-up fee and hide their top tier behind a sales call — MowGo publishes $39/$79 and takes a card.",
     "Some competitors charge a sign-up fee and hide their top tier behind a sales call — MowGo publishes $39/$79 and takes a card.",
     "Algunos competidores cobran una tarifa de registro y ocultan su mejor plan detrás de una llamada de ventas — MowGo publica $39/$79 y acepta tarjeta."),
    ("Six apps now offer a permanent free tier — Grassly, MowStack, Yardbook, ProBase, LawnPro Solo, and SoloOp. Grassly skims 2% of every card payment. MowGo's free plan takes nothing.",
     "Six apps now offer a permanent free tier — Grassly, MowStack, Yardbook, ProBase, LawnPro Solo, and SoloOp. Grassly skims 2% of every card payment. MowGo's free plan takes nothing.",
     "Seis apps ya ofrecen un plan gratis permanente — Grassly, MowStack, Yardbook, ProBase, LawnPro Solo y SoloOp. Grassly se lleva el 2% de cada pago con tarjeta. El plan gratis de MowGo no cobra nada."),
    ("Updated August 2026. Based on public pricing pages and hands-on testing.",
     "Updated August 2026. Based on public pricing pages and hands-on testing.",
     "Actualizado agosto 2026. Basado en páginas públicas de precios y pruebas directas."),
    ("TurfHop's own pricing and features pages were down (500 errors) on Aug 3, 2026 — verify current features with them before you buy.",
     "TurfHop's own pricing and features pages were down (500 errors) on Aug 3, 2026 — verify current features with them before you buy.",
     "Las páginas de precios y funciones de TurfHop estaban caídas (errores 500) el 3 de agosto de 2026 — verifica sus funciones actuales antes de comprar."),
    ("You're already in the concierge queue.",
     "You're already in the concierge queue.",
     "Ya estás en la cola de configuración asistida."),
    ("App not installed?",
     "App not installed?",
     "¿App no instalada?"),
    ("Return to MowGo",
     "Return to MowGo",
     "Volver a MowGo"),
    ("Tap below to go back to the app",
     "Tap below to go back to the app",
     "Toca abajo para volver a la app"),
    ("Open MowGo",
     "Open MowGo",
     "Abrir MowGo"),
    ("Download from App Store",
     "Download from App Store",
     "Descargar desde App Store"),
    ("Stripe payments are live. Route optimization ships next — Oklahoma early adopters get new features at no price increase.",
     "Stripe payments are live. Route optimization ships next — Oklahoma early adopters get new features at no price increase.",
     "Los pagos con Stripe están activos. La optimización de rutas llega después — los primeros usuarios de Oklahoma reciben funciones nuevas sin aumento de precio."),
]

for lang, pick in [('en', 1), ('es', 2)]:
    path = f'client/src/i18n/locales/{lang}.json'
    data = json.load(open(path))
    for code_str, en_val, es_val in ENTRIES:
        val = en_val if lang == 'en' else es_val
        ns = 'concierge' if code_str.startswith("You're already") else ('portalReturn' if code_str.startswith('App not') else ('landing' if code_str.startswith('Stripe') else 'compare'))
        if ns not in data:
            data[ns] = {}
        data[ns][text_key(code_str)] = val
    json.dump(data, open(path, 'w'), ensure_ascii=False, indent=2)
    print(lang, 'done')
