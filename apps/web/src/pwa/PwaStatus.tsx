import { useEffect, useState } from 'react';
import { Download, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useI18n } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/catalog';
import { useNetworkStatus } from './use-network-status';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const localizedCopy: Record<Locale, Record<'offline' | 'reconnected' | 'update', string>> = {
  'en-IN': {
    offline: 'Offline. Any local drafts remain on this device; nothing has been submitted.',
    reconnected: 'Connection restored. Review local drafts and submit them when ready.',
    update: 'A RepairProof update is ready.',
  },
  'bn-BD': {
    offline: 'অফলাইন। স্থানীয় খসড়া এই ডিভাইসেই থাকবে; কিছুই জমা হয়নি।',
    reconnected: 'সংযোগ ফিরে এসেছে। স্থানীয় খসড়া পর্যালোচনা করে প্রস্তুত হলে জমা দিন।',
    update: 'RepairProof-এর একটি আপডেট প্রস্তুত।',
  },
  'hi-IN': {
    offline: 'ऑफ़लाइन। स्थानीय मसौदे इसी डिवाइस पर रहेंगे; कुछ भी जमा नहीं हुआ है।',
    reconnected: 'कनेक्शन बहाल हुआ। स्थानीय मसौदे देखें और तैयार होने पर जमा करें।',
    update: 'RepairProof का अपडेट तैयार है।',
  },
};

export function PwaStatus() {
  const { locale, t } = useI18n();
  const isOnline = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [applyingUpdate, setApplyingUpdate] = useState(false);

  useEffect(() => {
    if (!isOnline) setWasOffline(true);
  }, [isOnline]);

  useEffect(() => {
    let disposed = false;
    let checkForUpdate: (() => void) | undefined;
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', captureInstall);
    const registrationPromise = navigator.serviceWorker?.getRegistration('/');
    void registrationPromise?.then((registration) => {
      if (disposed || !registration) return;
      if (registration.waiting) setWaitingWorker(registration.waiting);
      checkForUpdate = () => {
        if (navigator.onLine && document.visibilityState === 'visible')
          void registration.update().catch(() => undefined);
      };
      window.addEventListener('online', checkForUpdate);
      document.addEventListener('visibilitychange', checkForUpdate);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller)
            setWaitingWorker(registration.waiting ?? null);
        });
      });
    });
    const controllerChanged = () => {
      if (applyingUpdate) window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', controllerChanged);
    return () => {
      disposed = true;
      window.removeEventListener('beforeinstallprompt', captureInstall);
      navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged);
      if (checkForUpdate) {
        window.removeEventListener('online', checkForUpdate);
        document.removeEventListener('visibilitychange', checkForUpdate);
      }
    };
  }, [applyingUpdate]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const applyUpdate = () => {
    if (!waitingWorker) return;
    setApplyingUpdate(true);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  const copy = localizedCopy[locale];
  const showReconnect = isOnline && wasOffline;
  if (!isOnline) {
    return (
      <div
        className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-50"
        role="status"
        aria-live="polite"
      >
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        {copy.offline}
      </div>
    );
  }

  return (
    <>
      {showReconnect && (
        <div
          className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-2 border-b border-primary/30 bg-primary/5 px-3 py-2 text-center text-xs font-medium text-foreground"
          role="status"
          aria-live="polite"
        >
          {copy.reconnected}
          <button
            type="button"
            className="min-h-11 px-2 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => setWasOffline(false)}
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}
      {(installPrompt || waitingWorker) && (
        <div className="fixed bottom-3 right-3 z-[100] flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-lg sm:bottom-5 sm:right-5">
          {waitingWorker && (
            <>
              <span className="text-sm font-medium">{copy.update}</span>
              <Button type="button" size="sm" onClick={applyUpdate}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('pwa.updateAction')}
              </Button>
            </>
          )}
          {!waitingWorker && installPrompt && (
            <Button type="button" size="sm" onClick={() => void install()}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('pwa.install')}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
