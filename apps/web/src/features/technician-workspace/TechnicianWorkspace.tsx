import { tx } from '../../i18n/catalog';
import { useI18n } from '../../i18n/I18nProvider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckCheck,
  ClipboardList,
  FileCheck2,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { PageEmptyState } from '../../components/ui/page-empty-state';
import { Skeleton } from '../../components/ui/skeleton';
import { getApiErrorMessage } from '../../lib/api';
import { cn } from '../../lib/utils';
import { CaseQueue } from './CaseQueue';
import { queueFilterForPath, statusLabel, statusTone } from './case-queue-utils';
import { CaseWorkflowPanel, type TechnicianView } from './CaseWorkflowPanels';
import {
  isTechnicianDemoMode,
  useTechnicianAction,
  useTechnicianEvidenceUpload,
  useTechnicianWorkspace,
} from './hooks';
import type { CaseStatus, TechnicianCase } from './types';

const routeViews: Record<string, TechnicianView> = {
  '/technician/dashboard': 'dashboard',
  '/technician/inbox': 'inbox',
  '/technician/new-case': 'new-case',
  '/technician/diagnostics': 'diagnostics',
  '/technician/evidence': 'evidence',
  '/technician/quotes': 'quotes',
  '/technician/execution': 'execution',
  '/technician/testing': 'testing',
  '/technician/certificates': 'certificates',
  '/technician/warranties': 'warranties',
};

const views: Array<{ id: string; label: string; href: string; icon: typeof Wrench }> = [
  { id: 'diagnostics', label: 'Diagnostics', href: '/technician/diagnostics', icon: ClipboardList },
  { id: 'evidence', label: 'Evidence', href: '/technician/evidence', icon: FileCheck2 },
  { id: 'quotes', label: 'Quotation', href: '/technician/quotes', icon: ClipboardList },
  { id: 'execution', label: 'Repair log', href: '/technician/execution', icon: Wrench },
  { id: 'testing', label: 'Tests', href: '/technician/testing', icon: CheckCheck },
  { id: 'warranties', label: 'Warranty', href: '/technician/warranties', icon: ShieldCheck },
];

export function TechnicianWorkspace() {
  const location = useLocation();
  const view = routeViews[location.pathname] ?? 'dashboard';
  const { data, isLoading, isError, error, refetch, isFetching } = useTechnicianWorkspace();
  const action = useTechnicianAction();
  const upload = useTechnicianEvidenceUpload();
  const [selectedId, setSelectedId] = useState(
    () => new URLSearchParams(location.search).get('caseId') ?? '',
  );
  const [announcement, setAnnouncement] = useState('');
  const cases = useMemo(() => data?.cases ?? [], [data?.cases]);

  useEffect(() => {
    setSelectedId('');
  }, [view]);

  const selectedCase = useMemo(() => {
    if (selectedId)
      return cases.find((item) => item.id === selectedId) ?? preferredCase(cases, view);
    return preferredCase(cases, view);
  }, [cases, selectedId, view]);
  const sendAction = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      const result = await action.mutateAsync({
        path,
        body,
        method: path.endsWith('/status') ? 'PATCH' : 'POST',
      });
      setAnnouncement('Repair record updated by the server.');
      return result;
    },
    [action],
  );
  const uploadEvidence = useCallback(
    async (
      caseId: string,
      file: File,
      category: 'DIAGNOSTIC' | 'DURING_REPAIR' | 'POST_REPAIR',
    ) => {
      const result = await upload.mutateAsync({ caseId, file, category });
      setAnnouncement('Evidence uploaded and attached to the repair case.');
      return result;
    },
    [upload],
  );
  const createCase = useCallback(
    async (body: Record<string, unknown>) => {
      const result = await action.mutateAsync({
        path: '/cases/intake',
        body: {
          category: body.category,
          make: body.manufacturer,
          model: body.model,
          serialLast4: body.serialLast4 || undefined,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerEmail: body.customerEmail || undefined,
          problemDescription: body.issueSummary,
          priority: 'NORMAL',
        },
      });
      setAnnouncement('Repair case created and added to the queue.');
      return result;
    },
    [action],
  );

  if (isLoading) return <WorkspaceLoading />;
  if (isError)
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5" role="alert">
        <AlertTitle>{tx('Technician workspace unavailable')}</AlertTitle>
        <AlertDescription className="mt-2">
          {getApiErrorMessage(error, 'The repair queue could not be loaded.')}
        </AlertDescription>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <LoaderCircle className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          {tx('Retry loading queue ')}
        </Button>
      </div>
    );
  if (!data)
    return (
      <PageEmptyState
        title={tx('No technician workspace is available')}
        description={tx('Connect this account to a repair organization to load assigned work.')}
      />
    );

  if (view === 'new-case')
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <DemoBanner />
        {data.cases.length === 0 && !isTechnicianDemoMode && (
          <p className="text-sm text-muted-foreground">
            {tx('Your queue is currently empty. Create a case to begin documenting a repair. ')}
          </p>
        )}
        <CaseWorkflowPanel
          view={view}
          onAction={sendAction}
          onUpload={uploadEvidence}
          isPending={action.isPending || upload.isPending}
          actionError={action.error ?? upload.error}
          onCreateCase={createCase}
        />
      </div>
    );

  const counts = countCases(cases);
  return (
    <div className="space-y-5 sm:space-y-6">
      <DemoBanner />
      {view === 'dashboard' && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <QueueMetric
            label={tx('Incoming')}
            count={counts.incoming}
            href="/technician/inbox"
            tone="text-info"
          />
          <QueueMetric
            label={tx('Pending approval')}
            count={counts.pending_approval}
            href="/technician/quotes"
            tone="text-warning"
          />
          <QueueMetric
            label={tx('Active repairs')}
            count={counts.active}
            href="/technician/execution"
            tone="text-primary"
          />
          <QueueMetric
            label={tx('Completed')}
            count={counts.completed}
            href="/technician/certificates"
            tone="text-success"
          />
        </div>
      )}

      {view === 'dashboard' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
              {tx('Assigned to ')}
              {data.technician.displayName}
            </p>
            <h2 className="mt-1 text-base font-semibold">{tx('Your repair queue')}</h2>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/technician/new-case">
              <Plus className="h-4 w-4" />
              {tx('Start a repair ')}
            </Link>
          </Button>
        </div>
      )}
      {view !== 'dashboard' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
              {data.technician.organizationName}
            </p>
            <h2 className="mt-1 text-base font-semibold">{tx(viewHeading(view))}</h2>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
            {cases.length} {tx(' total cases ')}
          </span>
        </div>
      )}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <CaseQueue
          key={view}
          cases={cases}
          selectedId={selectedCase?.id ?? ''}
          onSelect={(id) => {
            setSelectedId(id);
            setAnnouncement(
              `Selected repair case ${cases.find((item) => item.id === id)?.reference ?? ''}`,
            );
          }}
          initialFilter={queueFilterForPath(location.pathname)}
        />
        <div className="min-w-0 space-y-4">
          {selectedCase && (
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="rp-code text-[10px] font-semibold text-primary">
                  {selectedCase.reference}
                </p>
                <h2 className="mt-1 truncate text-base font-semibold">
                  {selectedCase.device.manufacturer} {selectedCase.device.model}
                </h2>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {selectedCase.customerName}
                  {' · '}
                  {selectedCase.issueSummary}
                </p>
              </div>
              <span
                className={cn(
                  'self-start rounded-full px-2.5 py-1.5 text-xs font-medium sm:self-auto',
                  statusTone(selectedCase.status),
                )}
              >
                {tx(statusLabel(selectedCase.status))}
              </span>
            </div>
          )}
          {selectedCase && (
            <nav
              aria-label={tx('Selected case workflow')}
              className="grid grid-cols-3 gap-2 sm:grid-cols-6"
            >
              {views.map(({ id, label, href, icon: Icon }) => (
                <Link
                  key={id}
                  aria-current={view === id ? 'page' : undefined}
                  to={href}
                  className={cn(
                    'flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring',
                    view === id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  <span className="truncate">{tx(label)}</span>
                </Link>
              ))}
            </nav>
          )}
          <CaseWorkflowPanel
            view={view}
            repairCase={selectedCase}
            onAction={sendAction}
            onUpload={uploadEvidence}
            isPending={action.isPending || upload.isPending}
            actionError={action.error ?? upload.error}
            onCreateCase={createCase}
          />
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

function DemoBanner() {
  if (!isTechnicianDemoMode) return null;
  return (
    <Alert variant="warning">
      <AlertTitle>{tx('Development mock data')}</AlertTitle>
      <AlertDescription>
        {tx(
          'All cases shown are fictional local examples. They are not verified real-world repairs. Case transitions, evidence uploads, and workflow submissions are disabled in this preview. ',
        )}
      </AlertDescription>
    </Alert>
  );
}

function QueueMetric({
  label,
  count,
  href,
  tone,
}: {
  label: string;
  count: number;
  href: string;
  tone: string;
}) {
  const { formatNumber } = useI18n();
  return (
    <Link
      to={href}
      className="rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn('mt-2 block text-2xl font-semibold tabular-nums', tone)}>
        {formatNumber(count)}
      </span>
    </Link>
  );
}

function WorkspaceLoading() {
  return (
    <div aria-busy="true" aria-label={tx('Loading technician workspace')} className="space-y-5">
      <span className="sr-only">{tx('Loading repair cases')}</span>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Skeleton className="h-[560px] rounded-xl" />
        <Skeleton className="h-[560px] rounded-xl" />
      </div>
    </div>
  );
}

function preferredCase(cases: TechnicianCase[], view: TechnicianView) {
  const priorities: Record<TechnicianView, CaseStatus[]> = {
    dashboard: [
      'pending_approval',
      'in_repair',
      'incoming',
      'assigned',
      'diagnosing',
      'testing',
      'completed',
      'approved',
    ],
    inbox: [
      'incoming',
      'assigned',
      'diagnosing',
      'pending_approval',
      'approved',
      'in_repair',
      'testing',
      'completed',
    ],
    'new-case': [],
    diagnostics: [
      'assigned',
      'diagnosing',
      'incoming',
      'pending_approval',
      'approved',
      'in_repair',
      'testing',
      'completed',
    ],
    evidence: [
      'diagnosing',
      'assigned',
      'in_repair',
      'incoming',
      'pending_approval',
      'approved',
      'testing',
      'completed',
    ],
    quotes: [
      'pending_approval',
      'diagnosing',
      'assigned',
      'incoming',
      'approved',
      'in_repair',
      'testing',
      'completed',
    ],
    execution: [
      'in_repair',
      'approved',
      'testing',
      'assigned',
      'diagnosing',
      'pending_approval',
      'incoming',
      'completed',
    ],
    testing: [
      'testing',
      'in_repair',
      'approved',
      'assigned',
      'diagnosing',
      'pending_approval',
      'incoming',
      'completed',
    ],
    certificates: [
      'completed',
      'testing',
      'in_repair',
      'approved',
      'assigned',
      'diagnosing',
      'pending_approval',
      'incoming',
    ],
    warranties: [
      'completed',
      'testing',
      'in_repair',
      'approved',
      'assigned',
      'diagnosing',
      'pending_approval',
      'incoming',
    ],
  };
  for (const status of priorities[view]) {
    const found = cases.find((item) => item.status === status);
    if (found) return found;
  }
  return cases[0];
}

function countCases(cases: TechnicianCase[]) {
  return {
    incoming: cases.filter((item) => item.status === 'incoming').length,
    pending_approval: cases.filter((item) => item.status === 'pending_approval').length,
    active: cases.filter((item) => ['approved', 'in_repair', 'testing'].includes(item.status))
      .length,
    completed: cases.filter((item) => item.status === 'completed').length,
  };
}

function viewHeading(view: TechnicianView) {
  const headings: Record<TechnicianView, string> = {
    dashboard: 'Workbench',
    inbox: 'Repair inbox',
    'new-case': 'New repair case',
    diagnostics: 'Diagnostic workspace',
    evidence: 'Evidence upload',
    quotes: 'Quotation builder',
    execution: 'Repair execution',
    testing: 'Post-repair testing',
    certificates: 'Completed repairs & certificates',
    warranties: 'Warranty documentation',
  };
  return headings[view];
}
