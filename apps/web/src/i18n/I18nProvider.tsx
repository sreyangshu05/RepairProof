import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentLocale,
  setActiveLocale,
  translate,
  type Locale,
  type MessageKey,
} from './catalog';

const STORAGE_KEY = 'repairproof.locale';
const supportedLocales: Locale[] = ['en-IN', 'bn-BD', 'hi-IN'];

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en-IN';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && supportedLocales.includes(saved as Locale)) return saved as Locale;
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
  return 'en-IN';
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  setActiveLocale(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
    document.documentElement.dataset.locale = locale;
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Locale selection still works for this session when storage is unavailable.
    }
  }, [locale]);

  useEffect(() => {
    const syncProfileLocale = (event: Event) => {
      const next = (event as CustomEvent<Locale>).detail;
      if (supportedLocales.includes(next)) setLocale(next);
    };
    window.addEventListener('repairproof:locale', syncProfileLocale);
    return () => window.removeEventListener('repairproof:locale', syncProfileLocale);
  }, []);

  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      formatDate: (date, options = { year: 'numeric', month: 'short', day: 'numeric' }) =>
        new Intl.DateTimeFormat(locale, options).format(new Date(date)),
      formatNumber: (number, options) => new Intl.NumberFormat(locale, options).format(number),
      formatCurrency: (amount, currency) =>
        new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: currency ?? (locale === 'bn-BD' ? 'BDT' : 'INR'),
        }).format(amount),
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}

export function getActiveLocale(): Locale {
  return getCurrentLocale();
}
