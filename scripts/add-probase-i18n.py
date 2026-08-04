import json, re, unicodedata

def text_key(value):
    v = unicodedata.normalize('NFD', value.lower())
    v = ''.join(c for c in v if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '_', v).strip('_')[:72]

EN = {
    'Compare': 'Compare',
    'Log In': 'Log In',
    'The honest comparison': 'The honest comparison',
    'ProBase is free.': 'ProBase is free.',
    'Until it rains.': 'Until it rains.',
    'Free is a great price. But ProBase has no rain delay, no offline mode, no native app, and no accounting sync. When the storm hits at 6am, MowGo moves your whole route in one tap.': 'Free is a great price. But ProBase has no rain delay, no offline mode, no native app, and no accounting sync. When the storm hits at 6am, MowGo moves your whole route in one tap.',
    'See the real difference': 'See the real difference',
    'When MowGo isn\u2019t right': 'When MowGo isn\u2019t right',
    'The rain delay test': 'The rain delay test',
    'It\u2019s 6am. Storm\u2019s rolling in. What does your software do?': 'It\u2019s 6am. Storm\u2019s rolling in. What does your software do?',
    'ProBase has zero weather features. You\u2019re opening every client, rescheduling every stop by hand \u2014 20, 30, 40 texts \u2014 while the rain starts. MowGo users tap one button and the whole route shifts to tomorrow. Clients get notified automatically.': 'ProBase has zero weather features. You\u2019re opening every client, rescheduling every stop by hand \u2014 20, 30, 40 texts \u2014 while the rain starts. MowGo users tap one button and the whole route shifts to tomorrow. Clients get notified automatically.',
    'That\u2019s not a feature list difference. That\u2019s a whole day of revenue.': 'That\u2019s not a feature list difference. That\u2019s a whole day of revenue.',
    'ProBase \u2014 $0/mo': 'ProBase \u2014 $0/mo',
    'Open 22 client records. Reschedule each job by hand. Text each client. Pray you didn\u2019t miss one.': 'Open 22 client records. Reschedule each job by hand. Text each client. Pray you didn\u2019t miss one.',
    'MowGo \u2014 free tier': 'MowGo \u2014 free tier',
    'One button. Every job shifts to tomorrow. Clients notified. Done in 3 seconds.': 'One button. Every job shifts to tomorrow. Clients notified. Done in 3 seconds.',
    'Feature Comparison': 'Feature Comparison',
    'Verified August 2026. ProBase wins on free \u2014 we\u2019ll say it. Here\u2019s everything else.': 'Verified August 2026. ProBase wins on free \u2014 we\u2019ll say it. Here\u2019s everything else.',
    'Feature comparison table \u2014 scroll horizontally on mobile': 'Feature comparison table \u2014 scroll horizontally on mobile',
    'Feature': 'Feature',
    'MowGo': 'MowGo',
    'ProBase': 'ProBase',
    'MowGo only': 'MowGo only',
    'Honest answer: choose ProBase if\u2026': 'Honest answer: choose ProBase if\u2026',
    'You\u2019re a solo operator who never needs to reschedule for weather, and $0/mo forever matters more than anything else.': 'You\u2019re a solo operator who never needs to reschedule for weather, and $0/mo forever matters more than anything else.',
    'You want marketplace job leads \u2014 ProBase can feed you work from their marketplace (and takes a cut of those jobs).': 'You want marketplace job leads \u2014 ProBase can feed you work from their marketplace (and takes a cut of those jobs).',
    'You run a pool service \u2014 they cover chemical logging and water testing.': 'You run a pool service \u2014 they cover chemical logging and water testing.',
    'You never work in the rain, never lose signal, and don\u2019t need accounting sync.': 'You never work in the rain, never lose signal, and don\u2019t need accounting sync.',
    'If that\u2019s you \u2014 ProBase is legitimately free and you should use it. MowGo is built for the other 95%: crews who lose a day of revenue every time it rains, and who want software that isn\u2019t trying to be a marketplace.': 'If that\u2019s you \u2014 ProBase is legitimately free and you should use it. MowGo is built for the other 95%: crews who lose a day of revenue every time it rains, and who want software that isn\u2019t trying to be a marketplace.',
    'Works in the field': 'Works in the field',
    'Native apps with offline mode. ProBase is a PWA \u2014 dead without signal. MowGo keeps your whole day in your pocket.': 'Native apps with offline mode. ProBase is a PWA \u2014 dead without signal. MowGo keeps your whole day in your pocket.',
    'Real apps, real sync': 'Real apps, real sync',
    'iOS and Android on the App Store and Play Store. Push notifications for rain delays and payments.': 'iOS and Android on the App Store and Play Store. Push notifications for rain delays and payments.',
    'Flat fee, not a take-rate': 'Flat fee, not a take-rate',
    'ProBase makes money when you take marketplace jobs. MowGo charges a flat monthly fee \u2014 your revenue and your data aren\u2019t the product.': 'ProBase makes money when you take marketplace jobs. MowGo charges a flat monthly fee \u2014 your revenue and your data aren\u2019t the product.',
    'Try MowGo free. Rain delay included.': 'Try MowGo free. Rain delay included.',
    '5 clients free forever. No credit card. When it rains, you\u2019ll see why we built this.': '5 clients free forever. No credit card. When it rains, you\u2019ll see why we built this.',
    'Start free': 'Start free',
    'See all comparisons': 'See all comparisons',
}

ES = {
    'Compare': 'Comparar',
    'Log In': 'Iniciar sesión',
    'The honest comparison': 'La comparación honesta',
    'ProBase is free.': 'ProBase es gratis.',
    'Until it rains.': 'Hasta que llueve.',
    'Free is a great price. But ProBase has no rain delay, no offline mode, no native app, and no accounting sync. When the storm hits at 6am, MowGo moves your whole route in one tap.': 'Gratis es un gran precio. Pero ProBase no tiene retraso por lluvia, ni modo sin señal, ni app nativa, ni sincronización contable. Cuando llega la tormenta a las 6am, MowGo mueve toda tu ruta con un toque.',
    'See the real difference': 'Ve la diferencia real',
    'When MowGo isn\u2019t right': 'Cuando MowGo no es lo correcto',
    'The rain delay test': 'La prueba de lluvia',
    'It\u2019s 6am. Storm\u2019s rolling in. What does your software do?': 'Son las 6am. La tormenta llega. ¿Qué hace tu software?',
    'ProBase has zero weather features. You\u2019re opening every client, rescheduling every stop by hand \u2014 20, 30, 40 texts \u2014 while the rain starts. MowGo users tap one button and the whole route shifts to tomorrow. Clients get notified automatically.': 'ProBase no tiene funciones de clima. Abres cada cliente, reprogramas cada parada a mano — 20, 30, 40 mensajes — mientras empieza la lluvia. Los usuarios de MowGo tocan un botón y toda la ruta pasa a mañana. Los clientes reciben aviso automático.',
    'That\u2019s not a feature list difference. That\u2019s a whole day of revenue.': 'Eso no es una diferencia de funciones. Es un día completo de ingresos.',
    'ProBase \u2014 $0/mo': 'ProBase — $0/mes',
    'Open 22 client records. Reschedule each job by hand. Text each client. Pray you didn\u2019t miss one.': 'Abre 22 registros de clientes. Reprograma cada trabajo a mano. Escribe a cada cliente. Reza por no haberte olvidado de uno.',
    'MowGo \u2014 free tier': 'MowGo — plan gratis',
    'One button. Every job shifts to tomorrow. Clients notified. Done in 3 seconds.': 'Un botón. Todos los trabajos pasan a mañana. Clientes notificados. Listo en 3 segundos.',
    'Feature Comparison': 'Comparación de funciones',
    'Verified August 2026. ProBase wins on free \u2014 we\u2019ll say it. Here\u2019s everything else.': 'Verificado agosto 2026. ProBase gana en lo gratis — lo decimos claro. Aquí está todo lo demás.',
    'Feature comparison table \u2014 scroll horizontally on mobile': 'Tabla de comparación — desliza horizontalmente en el móvil',
    'Feature': 'Función',
    'MowGo': 'MowGo',
    'ProBase': 'ProBase',
    'MowGo only': 'Solo MowGo',
    'Honest answer: choose ProBase if\u2026': 'Respuesta honesta: elige ProBase si…',
    'You\u2019re a solo operator who never needs to reschedule for weather, and $0/mo forever matters more than anything else.': 'Eres un operador independiente que nunca necesita reprogramar por clima, y $0/mes para siempre importa más que cualquier otra cosa.',
    'You want marketplace job leads \u2014 ProBase can feed you work from their marketplace (and takes a cut of those jobs).': 'Quieres clientes de marketplace — ProBase puede darte trabajo de su marketplace (y se lleva un porcentaje de esos trabajos).',
    'You run a pool service \u2014 they cover chemical logging and water testing.': 'Manejas un servicio de albercas — cubren registro químico y análisis de agua.',
    'You never work in the rain, never lose signal, and don\u2019t need accounting sync.': 'Nunca trabajas bajo la lluvia, nunca pierdes señal y no necesitas sincronización contable.',
    'If that\u2019s you \u2014 ProBase is legitimately free and you should use it. MowGo is built for the other 95%: crews who lose a day of revenue every time it rains, and who want software that isn\u2019t trying to be a marketplace.': 'Si ese eres tú — ProBase es legítimamente gratis y deberías usarlo. MowGo está hecho para el otro 95%: cuadrillas que pierden un día de ingresos cada vez que llueve y quieren software que no intente ser un marketplace.',
    'Works in the field': 'Funciona en el campo',
    'Native apps with offline mode. ProBase is a PWA \u2014 dead without signal. MowGo keeps your whole day in your pocket.': 'Apps nativas con modo sin señal. ProBase es una PWA — muerta sin conexión. MowGo guarda todo tu día en tu bolsillo.',
    'Real apps, real sync': 'Apps reales, sincronización real',
    'iOS and Android on the App Store and Play Store. Push notifications for rain delays and payments.': 'iOS y Android en App Store y Play Store. Notificaciones push para lluvia y pagos.',
    'Flat fee, not a take-rate': 'Cuota fija, no porcentaje',
    'ProBase makes money when you take marketplace jobs. MowGo charges a flat monthly fee \u2014 your revenue and your data aren\u2019t the product.': 'ProBase gana dinero cuando tomas trabajos del marketplace. MowGo cobra una cuota mensual fija — tus ingresos y tus datos no son el producto.',
    'Try MowGo free. Rain delay included.': 'Prueba MowGo gratis. Retraso por lluvia incluido.',
    '5 clients free forever. No credit card. When it rains, you\u2019ll see why we built this.': '5 clientes gratis para siempre. Sin tarjeta. Cuando llueva, verás por qué lo construimos.',
    'Start free': 'Empieza gratis',
    'See all comparisons': 'Ver todas las comparaciones',
}

for lang, table in [('en', EN), ('es', ES)]:
    path = f'client/src/i18n/locales/{lang}.json'
    data = json.load(open(path))
    data['probaseComparison'] = {text_key(k): v for k, v in table.items()}
    json.dump(data, open(path, 'w'), ensure_ascii=False, indent=2)
    print(lang, 'probaseComparison added:', len(table), 'keys')
