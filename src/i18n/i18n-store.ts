import { create } from 'zustand';
import { type Language, type Translations, getTranslations } from './translations';

interface I18nState {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
}

/**
 * Lightweight i18n store using Zustand.
 * Stores the active language and provides translated strings via `t`.
 */
export const useI18n = create<I18nState>((set) => ({
  language: 'en',
  t: getTranslations('en'),
  setLanguage: (lang: Language) => {
    set({ language: lang, t: getTranslations(lang) });
  },
}));
