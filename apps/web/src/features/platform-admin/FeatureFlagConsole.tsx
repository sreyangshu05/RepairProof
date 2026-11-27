import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch, apiPost, apiPut, getApiErrorMessage } from '../../lib/api';
import { Button } from '../../components/ui/button';

type Variant = { key: string; weight: number; enabled: boolean };
type Experiment = {
  key: string;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  allocationPercentage: number;
  variants: Variant[];
  metricKeys: string[];
};
type Flag = {
  key: string;
  description: string;
  enabled: boolean;
  emergencyDisabled: boolean;
  rolloutPercentage: number;
  rolloutScope: 'PROFILE' | 'ORGANIZATION';
  allowedRoles: string[];
  organizationIds: string[];
  experiment?: Experiment | null;
};
type FlagResponse = { assignmentKeyConfigured: boolean; experimentMeasurementConfigured: boolean; flags: Flag[] };
const roles = ['SHOP_OWNER', 'TECHNICIAN'] as const;

export function FeatureFlagConsole() {
  const [data, setData] = useState<FlagResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [description, setDescription] = useState('');
  const [rolloutPercentage, setRolloutPercentage] = useState(0);
  const [rolloutScope, setRolloutScope] = useState<'PROFILE' | 'ORGANIZATION'>('PROFILE');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [organizationIds, setOrganizationIds] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiGet<FlagResponse>('/platform/admin/feature-flags'));
      setError(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not load feature flags.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const mutate = async (key: string, action: () => Promise<unknown>, message: string): Promise<boolean> => {
    setBusyKey(key);
    setError(null);
    setStatus(null);
    try {
      await action();
      await refresh();
      setStatus(message);
      return true;
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The feature flag change was not saved.'));
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const createFlag = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await mutate(newKey || 'new-flag', async () => {
      await apiPost('/platform/admin/feature-flags', {
        key: newKey.trim(),
        description: description.trim(),
        enabled: false,
        rolloutPercentage: Number(rolloutPercentage),
        rolloutScope,
        allowedRoles,
        organizationIds: organizationIds.split(/\r?\n/).map((id) => id.trim()).filter(Boolean),
      });
    }, 'Feature flag created in the off state.');
    if (saved) {
      setNewKey('');
      setDescription('');
    }
  };

  return (
    <section aria-labelledby="feature-flags-title" className="space-y-6">
      <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
        <h2 className="font-semibold">Safe-use boundary</h2>
        <p className="mt-1 text-muted-foreground">
          Flags may gate presentation or reversible, non-critical experiences. Never use them for authentication, permissions, tenant isolation, approvals, evidence access, repair lifecycle transitions, or data writes.
        </p>
        <p className="mt-2 text-muted-foreground">
          Assignment hashing is {data?.assignmentKeyConfigured ? 'configured' : 'not configured'}. Until the server has a secret of at least 32 characters, evaluation fails closed and all flags remain off.
        </p>
        <p className="mt-1 text-muted-foreground">
          Experiment measurement is {data?.experimentMeasurementConfigured ? 'configured' : 'not configured'}; it also requires product analytics to be enabled and each participant to have opted in.
        </p>
      </div>

      <form onSubmit={(event) => void createFlag(event)} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div>
          <h2 id="feature-flags-title" className="text-lg font-semibold">Create a feature flag</h2>
          <p className="mt-1 text-sm text-muted-foreground">New flags are created disabled. Activation and rollout are separate controls.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">Flag key
            <input required pattern="[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*" maxLength={100} value={newKey} onChange={(e) => setNewKey(e.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3" placeholder="dashboard.new-summary" />
          </label>
          <label className="space-y-1 text-sm">Description
            <input required maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3" placeholder="Describe the user-visible, reversible change" />
          </label>
          <label className="space-y-1 text-sm">Rollout percentage
            <input type="number" min={0} max={100} value={rolloutPercentage} onChange={(e) => setRolloutPercentage(Number(e.target.value))} className="min-h-11 w-full rounded-md border bg-background px-3" />
          </label>
          <label className="space-y-1 text-sm">Stable rollout unit
            <select value={rolloutScope} onChange={(e) => setRolloutScope(e.target.value as typeof rolloutScope)} className="min-h-11 w-full rounded-md border bg-background px-3">
              <option value="PROFILE">Individual profile</option>
              <option value="ORGANIZATION">Whole organization</option>
            </select>
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Role targeting (empty means shop roles; platform administrators are excluded)</legend>
          <div className="flex flex-wrap gap-4">
            {roles.map((role) => <label key={role} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={allowedRoles.includes(role)} onChange={(e) => setAllowedRoles((current) => e.target.checked ? [...current, role] : current.filter((value) => value !== role))} />
              {role === 'SHOP_OWNER' ? 'Shop administrator' : 'Technician'}
            </label>)}
          </div>
        </fieldset>
        <label className="block space-y-1 text-sm">Optional organization IDs, one per line
          <textarea rows={3} value={organizationIds} onChange={(e) => setOrganizationIds(e.target.value)} className="w-full rounded-md border bg-background p-3" placeholder="Validated against active organizations when saved" />
        </label>
        <Button type="submit" disabled={busyKey !== null}>Create disabled flag</Button>
      </form>

      {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {status && <p role="status" aria-live="polite" className="rounded-md border border-success/30 p-3 text-sm">{status}</p>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading feature flags…</p>
        : !data?.flags.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No feature flags are configured.</div>
          : <div className="space-y-4">{data.flags.map((flag) => <FlagCard key={flag.key} flag={flag} busy={busyKey === flag.key} mutate={mutate} />)}</div>}
    </section>
  );
}

function FlagCard({ flag, busy, mutate }: { flag: Flag; busy: boolean; mutate: (key: string, action: () => Promise<unknown>, message: string) => Promise<boolean> }) {
  const [percentage, setPercentage] = useState(flag.rolloutPercentage);
  const [experimentKey, setExperimentKey] = useState(flag.experiment?.key ?? `${flag.key}.experiment`);
  const [experimentStatus, setExperimentStatus] = useState<Experiment['status']>(flag.experiment?.status ?? 'DRAFT');
  const [allocation, setAllocation] = useState(flag.experiment?.allocationPercentage ?? 0);
  const [variants, setVariants] = useState(JSON.stringify(flag.experiment?.variants ?? [
    { key: 'control', weight: 50, enabled: false },
    { key: 'treatment', weight: 50, enabled: true },
  ], null, 2));
  const [metricKeys, setMetricKeys] = useState((flag.experiment?.metricKeys ?? []).join(', '));
  const [metricReport, setMetricReport] = useState<string | null>(null);
  const [experimentError, setExperimentError] = useState<string | null>(null);

  const saveExperiment = async () => {
    let parsed: Variant[];
    try { parsed = JSON.parse(variants) as Variant[]; }
    catch { setExperimentError('Variants must be valid JSON.'); return; }
    setExperimentError(null);
    await mutate(flag.key, () => apiPut(`/platform/admin/feature-flags/${encodeURIComponent(flag.key)}/experiment`, {
      key: experimentKey.trim(),
      status: experimentStatus,
      allocationPercentage: allocation,
      variants: parsed,
      metricKeys: metricKeys.split(',').map((value) => value.trim()).filter(Boolean),
    }), 'Experiment configuration saved.');
  };

  return <article className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="break-all font-mono text-sm font-semibold">{flag.key}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{flag.description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {flag.enabled ? 'Enabled' : 'Off'} · {flag.rolloutPercentage}% · {flag.rolloutScope.toLowerCase()} scope · Roles: {flag.allowedRoles.length ? flag.allowedRoles.join(', ') : 'all'}
        </p>
        {flag.emergencyDisabled && <p className="mt-2 font-semibold text-destructive">Emergency disabled</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={flag.enabled ? 'outline' : 'default'} disabled={busy} onClick={() => void mutate(flag.key, () => apiPatch(`/platform/admin/feature-flags/${encodeURIComponent(flag.key)}`, { enabled: !flag.enabled }), flag.enabled ? 'Feature deactivated.' : 'Feature activated.')}>{flag.enabled ? 'Deactivate' : 'Activate'}</Button>
        {flag.emergencyDisabled
          ? <Button type="button" variant="outline" disabled={busy} onClick={() => void mutate(flag.key, () => apiPost(`/platform/admin/feature-flags/${encodeURIComponent(flag.key)}/restore`), 'Emergency disable cleared. Feature still requires normal activation and targeting.')}>Restore kill switch</Button>
          : <Button type="button" variant="destructive" disabled={busy} onClick={() => void mutate(flag.key, () => apiPost(`/platform/admin/feature-flags/${encodeURIComponent(flag.key)}/emergency-disable`), 'Feature emergency-disabled across API instances.')}>Emergency disable</Button>}
      </div>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="space-y-1 text-sm">Rollout percentage
        <input type="number" min={0} max={100} value={percentage} onChange={(e) => setPercentage(Number(e.target.value))} className="min-h-11 w-full rounded-md border bg-background px-3 sm:w-36" />
      </label>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void mutate(flag.key, () => apiPatch(`/platform/admin/feature-flags/${encodeURIComponent(flag.key)}`, { rolloutPercentage: percentage }), 'Rollout percentage updated.')}>Save rollout</Button>
    </div>
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer py-2 text-sm font-medium">Experiment setup and metrics {flag.experiment ? `(${flag.experiment.status})` : ''}</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">Experiment key
          <input value={experimentKey} onChange={(e) => setExperimentKey(e.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3" />
        </label>
        <label className="space-y-1 text-sm">Status
          <select value={experimentStatus} onChange={(e) => setExperimentStatus(e.target.value as Experiment['status'])} className="min-h-11 w-full rounded-md border bg-background px-3">
            {(['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED'] as const).map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">Experiment allocation %
          <input type="number" min={0} max={100} value={allocation} onChange={(e) => setAllocation(Number(e.target.value))} className="min-h-11 w-full rounded-md border bg-background px-3" />
        </label>
        <label className="space-y-1 text-sm">Metric keys (comma-separated)
          <input value={metricKeys} onChange={(e) => setMetricKeys(e.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3" placeholder="repair_case_created, diagnostic_submitted" />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">Variants JSON (weights must total 100)
          <textarea rows={6} value={variants} onChange={(e) => setVariants(e.target.value)} className="w-full rounded-md border bg-background p-3 font-mono text-xs" />
        </label>
      </div>
      <p className="my-3 text-xs text-muted-foreground">Assignments are stable and pseudonymous. Variant definitions become immutable after assignment. Pause before changing eligible configuration; create a new experiment after completion.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void saveExperiment()}>Save experiment</Button>
        {flag.experiment && <Button type="button" variant="outline" onClick={async () => {
          try { const result = await apiGet<unknown>(`/platform/admin/feature-flags/${encodeURIComponent(flag.key)}/experiment/metrics`); setMetricReport(JSON.stringify(result, null, 2)); }
          catch (cause) { setMetricReport(getApiErrorMessage(cause, 'Could not load experiment metrics.')); }
        }}>Refresh metrics</Button>}
      </div>
      {experimentError && <p role="alert" className="mt-2 text-sm text-destructive">{experimentError}</p>}
      {flag.experiment && <p className="mt-2 text-xs text-muted-foreground">Experiment summaries suppress groups smaller than 20. Open privacy-preserved experiment metrics to review aggregate results.</p>}
      {metricReport && <pre aria-label="Experiment aggregate metrics" className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">{metricReport}</pre>}
    </details>
  </article>;
}
