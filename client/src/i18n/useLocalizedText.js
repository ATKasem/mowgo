import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function textKey(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
}

export default function useLocalizedText(section) {
  const { t, i18n } = useTranslation();

  const tr = useCallback((value, options = {}) => {
    if (value === null || value === undefined || value === '') return value;
    return t(`${section}.${textKey(value)}`, { defaultValue: String(value), ...options });
  }, [section, t]);

  return { t, tr, i18n };
}
