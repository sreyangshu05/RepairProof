import { Alert, AlertDescription } from './alert';
import { Button } from './button';
import { useI18n } from '../../i18n/I18nProvider';

export function LocalDraftNotice({
  hasRecoveredDraft,
  isSaved,
  storageAvailable,
  onRestore,
  onDiscard,
}: {
  hasRecoveredDraft: boolean;
  isSaved: boolean;
  storageAvailable: boolean;
  onRestore?: () => void;
  onDiscard?: () => void;
}) {
  const { t } = useI18n();
  if (!storageAvailable) {
    return (
      <p className="mb-3 text-xs text-muted-foreground" role="status">
        {t('draft.storageUnavailable')}
      </p>
    );
  }
  if (hasRecoveredDraft) {
    return (
      <Alert className="mb-3" role="status">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span>{t('draft.localOnly')}</span>
          <span className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onRestore}>
              {t('draft.restore')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onDiscard}>
              {t('draft.discard')}
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    );
  }
  if (isSaved) {
    return (
      <p className="mb-3 text-xs text-muted-foreground" role="status" aria-live="polite">
        {t('draft.localOnly')}
      </p>
    );
  }
  return null;
}
