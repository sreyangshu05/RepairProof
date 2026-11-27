import { useEffect, useState } from 'react';
import { apiGet, apiPatch, getApiErrorMessage } from '../../lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

const NOTICE_VERSION = '2026-11-24-v1';
type ConsentState = {
  consented: boolean;
  noticeVersion: string | null;
  changedAt: string | null;
  collectionAvailable: boolean;
};

export function AnalyticsConsentSettings({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true);
    setError(null);
    apiGet<ConsentState>('/analytics/consent')
      .then((result) => {
        if (!current) return;
        setConsent(result);
        setEnabled(result.consented);
      })
      .catch((cause: unknown) => {
        if (current) setError(getApiErrorMessage(cause, 'Could not load analytics preferences.'));
      })
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [open]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const result = await apiPatch<ConsentState, { enabled: boolean; noticeVersion: string }>(
        '/analytics/consent',
        { enabled, noticeVersion: NOTICE_VERSION },
      );
      setConsent(result);
      setEnabled(result.consented);
      setStatus(result.consented ? 'Preference saved: optional analytics enabled.' : 'Preference saved: optional analytics disabled.');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not save analytics preferences.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="min-h-11 w-full rounded-md px-3 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        Product analytics preferences
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Product analytics preferences</DialogTitle>
            <DialogDescription>
                Optional first-party measurement helps RepairProof understand whether workshop workflows are being used. It does not measure customer value by itself.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">Loading preference…</p>
          ) : error && !consent ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="space-y-4 text-sm">
              <label className="flex min-h-11 items-start gap-3 rounded-md border p-3 leading-5">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                  aria-describedby="analytics-consent-details"
                />
                <span>Allow pseudonymous workshop product-use events and optional controlled product experiments.</span>
              </label>
              <div id="analytics-consent-details" className="space-y-2 text-muted-foreground">
                <p>Events may include registration, device or case creation, diagnostic submission, quotation delivery, documented completion, and warranty claim submission. Controlled experiments may store a stable pseudonymous variant assignment and the outcomes listed for that experiment.</p>
                <p>Names, contact details, serial numbers, case identifiers, repair notes, prices, uploaded files, and customer approval identities are excluded. Events use rotating service-held pseudonyms, UTC-day dates, and are deleted after 90 days.</p>
                <p>Turning this off withdraws consent and removes prior events associated with this account. Operational repair records are not affected.</p>
                {!consent?.collectionAvailable && (
                  <p className="rounded-md border p-3">Product analytics collection is currently disabled by the service. Your preference can be saved, but no events will be collected until the service is enabled.</p>
                )}
              </div>
              {error && <p role="alert" className="text-destructive">{error}</p>}
              {status && <p role="status">{status}</p>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button type="button" onClick={() => void save()} disabled={loading || saving || !consent}>
              {saving ? 'Saving…' : 'Save preference'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
