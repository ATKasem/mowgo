import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

const LANGUAGE_STORAGE_KEY = 'mowgo-language';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    supportedLngs: ['en', 'es'],
    fallbackLng: 'en',
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false,
    },
  });

i18n.on('languageChanged', (language) => {
  const normalizedLanguage = language?.startsWith('es') ? 'es' : 'en';
  document.documentElement.lang = normalizedLanguage;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
});

document.documentElement.lang = i18n.resolvedLanguage?.startsWith('es') ? 'es' : 'en';

export { LANGUAGE_STORAGE_KEY };
export default i18n;
