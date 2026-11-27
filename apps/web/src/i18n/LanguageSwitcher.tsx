import { localeOptions } from './catalog';
import { useI18n } from './I18nProvider';
import { apiPatch } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';

export function LanguageSwitcher({
  compact = false,
  onChange,
}: {
  compact?: boolean;
  onChange?: (locale: (typeof localeOptions)[number]['locale']) => void;
}) {
  const { locale, setLocale, t } = useI18n();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
      <span className={compact ? 'sr-only' : undefined}>{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        className="min-h-11 rounded-md border bg-background px-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        value={locale}
        onChange={(event) => {
          const next = event.target.value as (typeof localeOptions)[number]['locale'];
          setLocale(next);
          if (isAuthenticated) {
            void apiPatch('/users/me', { locale: next }).catch(() => undefined);
          }
          onChange?.(next);
        }}
      >
        {localeOptions.map((option) => (
          <option key={option.locale} value={option.locale}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
