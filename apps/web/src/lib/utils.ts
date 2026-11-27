import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getActiveLocale } from '../i18n/I18nProvider';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency?: string): string {
  const locale = getActiveLocale();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency ?? (locale === 'bn-BD' ? 'BDT' : 'INR'),
  }).format(amount);
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date)
    return getActiveLocale() === 'bn-BD'
      ? 'তথ্য উপলভ্য নয়'
      : getActiveLocale() === 'hi-IN'
        ? 'उपलब्ध नहीं'
        : 'Not available';
  return new Intl.DateTimeFormat(getActiveLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatLocalizedDate(
  value: string | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  if (!value)
    return getActiveLocale() === 'bn-BD'
      ? 'তথ্য উপলভ্য নয়'
      : getActiveLocale() === 'hi-IN'
        ? 'उपलब्ध नहीं'
        : 'Not available';
  const dateValue = typeof value === 'string' && value.length === 10 ? `${value}T12:00:00` : value;
  return new Intl.DateTimeFormat(getActiveLocale(), options).format(new Date(dateValue));
}
