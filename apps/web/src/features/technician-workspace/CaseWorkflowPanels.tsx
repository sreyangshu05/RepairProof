import { getCurrentLocale, translateStatus, tx } from '../../i18n/catalog';
import { LocalDraftNotice } from '../../components/ui/local-draft-notice';
import { useLocalDraft } from '../../lib/local-drafts';
import { useNetworkStatus } from '../../pwa/use-network-status';
import { useAuthStore } from '../../stores/auth.store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  FileSearch,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { FormField } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { getApiErrorMessage } from '../../lib/api';
import { cn, formatLocalizedDate } from '../../lib/utils';
import { getActiveLocale, useI18n } from '../../i18n/I18nProvider';
import { isTechnicianDemoMode } from './hooks';
import { statusLabel, statusTone } from './case-queue-utils';
import type { CaseStatus, TechnicianCase } from './types';

export type TechnicianView =
  | 'dashboard'
  | 'inbox'
  | 'new-case'
  | 'diagnostics'
  | 'evidence'
  | 'quotes'
  | 'execution'
  | 'testing'
  | 'certificates'
  | 'warranties';
type ActionRunner = (path: string, body: Record<string, unknown>) => Promise<unknown>;
type UploadCategory = 'DIAGNOSTIC' | 'DURING_REPAIR' | 'POST_REPAIR';
type UploadRunner = (caseId: string, file: File, category: UploadCategory) => Promise<unknown>;

export function CaseWorkflowPanel({
  view,
  repairCase,
  onAction,
  onUpload,
  isPending,
  actionError,
  onCreateCase,
}: {
  view: TechnicianView;
  repairCase?: TechnicianCase;
  onAction: ActionRunner;
  onUpload: UploadRunner;
  isPending: boolean;
  actionError?: unknown;
  onCreateCase: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  useI18n();
  if (view === 'new-case')
    return <NewCaseForm onCreateCase={onCreateCase} isPending={isPending} error={actionError} />;
  if (!repairCase) return <EmptyCaseSelection view={view} />;

  const common = { repairCase, onAction, isPending, actionError };
  if (view === 'diagnostics') return <DiagnosticsPanel {...common} />;
  if (view === 'evidence')
    return (
      <EvidencePanel
        repairCase={repairCase}
        onUpload={onUpload}
        isPending={isPending}
        error={actionError}
      />
    );
  if (view === 'quotes') return <QuotationPanel {...common} />;
  if (view === 'execution') return <ExecutionPanel {...common} />;
  if (view === 'testing') return <TestingPanel {...common} />;
  if (view === 'warranties') return <WarrantyPanel {...common} />;
  if (view === 'certificates') return <CertificatePanel repairCase={repairCase} />;
  return (
    <CaseSummaryPanel
      repairCase={repairCase}
      onAction={onAction}
      isPending={isPending}
      actionError={actionError}
    />
  );
}

export function NewCaseForm({
  onCreateCase,
  isPending,
  error,
}: {
  onCreateCase: (body: Record<string, unknown>) => Promise<unknown>;
  isPending: boolean;
  error?: unknown;
}) {
  const [formError, setFormError] = useState('');
  const [created, setCreated] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validatedValues, setValidatedValues] = useState<z.infer<typeof newCaseSchema> | null>(
    null,
  );
  const [values, setValues] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    category: 'SMARTPHONE' as 'SMARTPHONE' | 'LAPTOP',
    manufacturer: '',
    model: '',
    serialLast4: '',
    issueSummary: '',
  });
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setCreated('');
    const parsed = newCaseSchema.safeParse(values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Review the required fields.');
      return;
    }
    setValidatedValues(parsed.data);
    setConfirmOpen(true);
  };
  const createConfirmed = async () => {
    if (!validatedValues) return;
    try {
      await onCreateCase({ ...validatedValues, customerLocale: getCurrentLocale() });
      setCreated('Repair case created. It was added to the incoming queue.');
      setValues({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        category: 'SMARTPHONE',
        manufacturer: '',
        model: '',
        serialLast4: '',
        issueSummary: '',
      });
      setValidatedValues(null);
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
    }
  };
  return (
    <PanelCard
      title={tx('Open a repair case')}
      eyebrow="NEW CASE · CUSTOMER INTAKE"
      icon={Plus}
      subtitle="Capture the essential details once. Add diagnostics and evidence in the case workspace."
    >
      {isTechnicianDemoMode && <DemoMutationNotice />}
      {created && (
        <Alert variant="success" className="mb-4">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{tx('Case created')}</AlertTitle>
          <AlertDescription>{created}</AlertDescription>
        </Alert>
      )}
      {formError || error ? <ActionError message={formError || getApiErrorMessage(error)} /> : null}
      <form onSubmit={submit} className="space-y-5" noValidate>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">{tx('Customer')}</legend>
          <FormField id="case-customer" label={tx('Customer name')} required>
            <Input
              value={values.customerName}
              onChange={(e) => setValues({ ...values, customerName: e.target.value })}
              autoComplete="name"
              placeholder={tx('Customer name')}
            />
          </FormField>
          <FormField id="case-phone" label={tx('Customer phone')} required>
            <Input
              value={values.customerPhone}
              onChange={(e) => setValues({ ...values, customerPhone: e.target.value })}
              autoComplete="tel"
              inputMode="tel"
              placeholder={tx('Phone number')}
            />
          </FormField>
          <FormField id="case-email" label={tx('Customer email')}>
            <Input
              type="email"
              value={values.customerEmail}
              onChange={(e) => setValues({ ...values, customerEmail: e.target.value })}
              autoComplete="email"
              placeholder="name@example.com"
            />
          </FormField>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">{tx('Device')}</legend>
          <FormField id="case-category" label={tx('Device type')} required>
            <Select
              value={values.category}
              onValueChange={(category: 'SMARTPHONE' | 'LAPTOP') =>
                setValues({ ...values, category })
              }
            >
              <SelectTrigger aria-label={tx('Device type')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SMARTPHONE">{tx('Smartphone')}</SelectItem>
                <SelectItem value="LAPTOP">{tx('Laptop')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="case-manufacturer" label={tx('Manufacturer')} required>
            <Input
              value={values.manufacturer}
              onChange={(e) => setValues({ ...values, manufacturer: e.target.value })}
              placeholder={tx('e.g. Apple')}
            />
          </FormField>
          <FormField id="case-model" label={tx('Model')} required>
            <Input
              value={values.model}
              onChange={(e) => setValues({ ...values, model: e.target.value })}
              placeholder={tx('e.g. iPhone 14 Pro')}
            />
          </FormField>
          <FormField id="case-serial" label={tx('Serial number ending')}>
            <Input
              maxLength={4}
              value={values.serialLast4}
              onChange={(e) => setValues({ ...values, serialLast4: e.target.value.slice(-4) })}
              inputMode="numeric"
              placeholder={tx('Last 4 characters')}
            />
          </FormField>
        </fieldset>
        <FormField
          id="case-issue"
          label={tx('Customer concern')}
          required
          hint="Describe the reported issue in the customer’s words where possible."
        >
          <Textarea
            maxLength={1000}
            value={values.issueSummary}
            onChange={(e) => setValues({ ...values, issueSummary: e.target.value })}
            placeholder={tx('What is the device doing, and when does it happen?')}
          />
        </FormField>
        <Button type="submit" disabled={isPending || isTechnicianDemoMode}>
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {tx('Create repair case ')}
        </Button>
        {isTechnicianDemoMode && (
          <p className="text-xs text-muted-foreground">
            {tx(
              'Creation is disabled in the fixture preview. Connect the API to create real cases. ',
            )}
          </p>
        )}
      </form>
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={tx('Create this repair case?')}
        description={`This creates a repair record for ${validatedValues?.customerName ?? 'the customer'} and adds it to the organization’s incoming queue.`}
        confirmLabel="Create repair case"
        isPending={isPending}
        disabled={isTechnicianDemoMode}
        onConfirm={() => void createConfirmed()}
      />
    </PanelCard>
  );
}

function CaseSummaryPanel({ repairCase, onAction, isPending, actionError }: SharedPanelProps) {
  return (
    <div className="space-y-4">
      <PanelCard
        title={tx('Case overview')}
        eyebrow="REPAIR RECORD"
        icon={FileText}
        subtitle="The case summary and next useful actions."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailField label={tx('Customer')} value={repairCase.customerName} />
          <DetailField
            label={tx('Device')}
            value={`${repairCase.device.manufacturer} ${repairCase.device.model}`}
          />
          <DetailField label={tx('Opened')} value={formatDate(repairCase.createdAt)} />
          <DetailField label={tx('Last updated')} value={formatDate(repairCase.updatedAt)} />
          <DetailField
            label={tx('Assigned technician')}
            value={repairCase.assignedTechnician ?? 'Unassigned'}
          />
          <DetailField
            label={tx('Serial ending')}
            value={repairCase.device.serialLast4 ?? 'Not recorded'}
          />
        </div>
        <div className="mt-5 rounded-lg bg-muted/50 p-4">
          <p className="text-xs font-semibold text-muted-foreground">{tx('Customer concern')}</p>
          <p className="mt-1 text-sm leading-6">{repairCase.issueSummary}</p>
        </div>
        <TransitionControl
          repairCase={repairCase}
          onAction={onAction}
          isPending={isPending}
          error={actionError}
        />
      </PanelCard>
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniSummary
          icon={FileSearch}
          title={tx('Diagnostic findings')}
          value={repairCase.diagnostics?.findings || 'Not submitted'}
        />
        <MiniSummary
          icon={ImagePlus}
          title={tx('Evidence attached')}
          value={`${repairCase.evidence.length} ${repairCase.evidence.length === 1 ? 'file' : 'files'}`}
        />
        <MiniSummary
          icon={FileText}
          title={tx('Quotation')}
          value={
            repairCase.quotation
              ? `${tx('Version')} ${repairCase.quotation.version} · ${translateStatus(repairCase.quotation.status)}`
              : 'Not prepared'
          }
        />
        <MiniSummary
          icon={ClipboardCheck}
          title={tx('Post-repair checks')}
          value={`${repairCase.tests.filter((test) => test.result === 'pass').length} passed · ${repairCase.tests.length} recorded`}
        />
      </div>
    </div>
  );
}

function DiagnosticsPanel({ repairCase, onAction, isPending, actionError }: SharedPanelProps) {
  const profileId = useAuthStore((state) => state.user?.id ?? 'anonymous');
  const initial = repairCase.diagnostics ?? {
    symptoms: '',
    findings: '',
    recommendedWork: '',
    safetyNotes: '',
  };
  const [values, setValues] = useState(initial);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const localDraft = useLocalDraft(
    `user:${profileId}:case:${repairCase.id}:diagnostics`,
    values,
    initial,
    setValues,
  );

  useEffect(() => {
    setValues(
      repairCase.diagnostics ?? {
        symptoms: '',
        findings: '',
        recommendedWork: '',
        safetyNotes: '',
      },
    );
  }, [repairCase.id, repairCase.diagnostics]);

  const update = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorText('');
    setSuccessText('');
    if (!navigator.onLine) {
      setErrorText(tx('draft.connectionRequired'));
      return;
    }
    const parsed = diagnosticSchema.safeParse(values);
    if (!parsed.success) {
      setErrorText(parsed.error.issues[0]?.message ?? 'Review diagnostic details.');
      return;
    }
    try {
      await onAction(`/cases/${repairCase.id}/diagnostics`, {
        findings: {
          symptoms: parsed.data.symptoms,
          findings: parsed.data.findings,
          recommendedWork: parsed.data.recommendedWork,
          safetyNotes: parsed.data.safetyNotes,
        },
        summary: parsed.data.recommendedWork,
        severity: 'MEDIUM',
      });
      await onAction(`/cases/${repairCase.id}/diagnostics/complete`, {
        notes: parsed.data.safetyNotes || parsed.data.findings,
      });
      localDraft.clearAfterConfirmation(values);
      setSuccessText('Diagnosis submitted and completed.');
    } catch {
      /* Mutation error is rendered from the action state below. */
    }
  };

  return (
    <PanelCard
      title={tx('Diagnostic workspace')}
      eyebrow={repairCase.reference}
      icon={FileSearch}
      subtitle="Record the reported symptoms, findings, recommendation, and safety context."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className={statusTone(repairCase.status)}>
          {tx(statusLabel(repairCase.status))}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {isTechnicianDemoMode
            ? 'Fixture preview · submissions disabled'
            : 'Edits stay on this screen until you submit. Submission creates the diagnostic record and completes the diagnosis.'}
        </span>
      </div>
      {isTechnicianDemoMode && <DemoMutationNotice />}
      <LocalDraftNotice
        hasRecoveredDraft={localDraft.recoveredDraft !== null}
        isSaved={localDraft.savedLocally}
        storageAvailable={localDraft.storageAvailable}
        onRestore={localDraft.restore}
        onDiscard={localDraft.discard}
      />
      {successText && (
        <Alert variant="success" className="mb-4">
          <AlertDescription>{successText}</AlertDescription>
        </Alert>
      )}
      {errorText || actionError ? (
        <ActionError message={errorText || getApiErrorMessage(actionError)} />
      ) : null}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormField
          id="diag-symptoms"
          label={tx('Reported symptoms')}
          required
          hint="Keep the customer’s report distinct from your findings."
        >
          <Textarea
            value={values.symptoms}
            onChange={update('symptoms')}
            maxLength={1500}
            placeholder={tx('What did the customer observe?')}
          />
        </FormField>
        <FormField id="diag-findings" label={tx('Diagnostic findings')} required>
          <Textarea
            value={values.findings}
            onChange={update('findings')}
            maxLength={3000}
            placeholder={tx('What did your inspection or tests show?')}
          />
        </FormField>
        <FormField id="diag-work" label={tx('Recommended work')} required>
          <Textarea
            value={values.recommendedWork}
            onChange={update('recommendedWork')}
            maxLength={2000}
            placeholder={tx('Describe the repair you recommend.')}
          />
        </FormField>
        <FormField id="diag-safety" label={tx('Safety and handling notes')}>
          <Textarea
            value={values.safetyNotes}
            onChange={update('safetyNotes')}
            maxLength={1000}
            placeholder={tx('Handling instructions or cautions')}
          />
        </FormField>
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {tx('Submit to save the diagnostic record and complete the diagnosis state. ')}
          </p>
          <Button type="submit" disabled={isPending || isTechnicianDemoMode}>
            {isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {tx('Submit and complete diagnosis ')}
          </Button>
        </div>
      </form>
    </PanelCard>
  );
}

function EvidencePanel({
  repairCase,
  onUpload,
  isPending,
  error,
}: {
  repairCase: TechnicianCase;
  onUpload: UploadRunner;
  isPending: boolean;
  error?: unknown;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<UploadCategory>(
    repairCase.status === 'in_repair' ? 'POST_REPAIR' : 'DIAGNOSTIC',
  );
  const [notice, setNotice] = useState('');
  const [uploadFailed, setUploadFailed] = useState(false);
  const isOnline = useNetworkStatus();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setFile(null);
    setNotice('');
    setUploadFailed(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [repairCase.id]);
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setNotice('Choose an image, video, or PDF to attach.');
      return;
    }
    setNotice('');
    if (!isOnline) {
      setNotice(tx('upload.offline'));
      setUploadFailed(true);
      return;
    }
    try {
      await onUpload(repairCase.id, file, category);
      setNotice('Evidence uploaded and attached to this case.');
      setUploadFailed(false);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      setNotice(tx('upload.failed'));
      setUploadFailed(true);
    }
  };
  return (
    <PanelCard
      title={tx('Evidence')}
      eyebrow={`${repairCase.reference} · ${repairCase.evidence.length} ATTACHED`}
      icon={ImagePlus}
      subtitle="Attach relevant intake, diagnostic, or repair evidence. Original files are uploaded to private object storage."
    >
      {isTechnicianDemoMode && <DemoMutationNotice />}
      {error ? <ActionError message={getApiErrorMessage(error)} /> : null}
      {notice && (
        <Alert variant={notice.startsWith('Evidence uploaded') ? 'success' : 'warning'}>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} className="rounded-xl border border-dashed bg-muted/20 p-4 sm:p-6">
        <label
          htmlFor="evidence-file"
          className="flex cursor-pointer flex-col items-center text-center"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-primary">
            <ImagePlus className="h-5 w-5" />
          </span>
          <span className="mt-3 text-sm font-semibold">{tx('Choose evidence file')}</span>
          <span className="mt-1 text-xs text-muted-foreground">
            {tx('JPEG, PNG, WebP, HEIC, MP4, QuickTime, or PDF · max 25 MB ')}
          </span>
        </label>
        <input
          ref={inputRef}
          id="evidence-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,application/pdf"
          className="sr-only"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setNotice('');
            setUploadFailed(false);
          }}
        />
        <FormField id="evidence-category" label={tx('Evidence stage')} required>
          <Select value={category} onValueChange={(value: UploadCategory) => setCategory(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DIAGNOSTIC">{tx('Diagnostic evidence')}</SelectItem>
              <SelectItem value="DURING_REPAIR">{tx('During repair')}</SelectItem>
              <SelectItem value="POST_REPAIR">{tx('Post-repair verification')}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <p className="mt-3 text-center text-xs font-medium">
          {file ? `${file.name} · ${formatBytes(file.size)}` : 'No file selected'}
        </p>
        {file && !isOnline && (
          <p className="mt-2 text-center text-xs text-amber-800 dark:text-amber-200" role="status">
            {tx('upload.offline')}
          </p>
        )}
        <div className="mt-4 flex justify-center">
          <Button
            type="submit"
            disabled={
              !file ||
              (file?.size ?? 0) > 25 * 1024 * 1024 ||
              isPending ||
              isTechnicianDemoMode ||
              !isOnline
            }
          >
            {isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {uploadFailed ? tx('upload.retry') : tx('Upload original ')}
          </Button>
        </div>
        {file && file.size > 25 * 1024 * 1024 && (
          <p className="mt-2 text-center text-xs text-destructive">
            {tx('Select a file smaller than 25 MB. ')}
          </p>
        )}
        {isTechnicianDemoMode && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {tx('Uploads are disabled in fixture preview. ')}
          </p>
        )}
      </form>
      <div className="mt-6">
        <h3 className="text-sm font-semibold">{tx('Case evidence')}</h3>
        {repairCase.evidence.length ? (
          <ul className="mt-2 divide-y rounded-lg border">
            {repairCase.evidence.map((item) => (
              <li className="flex items-center gap-3 p-3" key={item.id}>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary">
                  <FileCheck2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {item.kind}
                    {' · '}
                    {formatDate(item.addedAt)}
                  </span>
                </span>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-11 px-2 text-xs font-medium text-primary"
                  >
                    {tx('View ')}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
            {tx(
              'No evidence is attached yet. Add relevant files to support the diagnosis or repair actions. ',
            )}
          </p>
        )}
      </div>
    </PanelCard>
  );
}

type QuoteLine = {
  type: 'PART' | 'LABOR';
  description: string;
  quantity: number;
  unitPrice: number;
};
type QuotationDraft = {
  items: QuoteLine[];
  customerNote: string;
  diagnosedIssue: string;
  proposedRepair: string;
  laborCost: number;
  additionalCharges: number;
  taxRate: number;
  estimatedCompletionHours: number;
  warrantyTerms: string;
  validDays: number;
  supportingEvidenceIds: string[];
};
function QuotationPanel({ repairCase, onAction, isPending, actionError }: SharedPanelProps) {
  const profileId = useAuthStore((state) => state.user?.id ?? 'anonymous');
  const initialDraft = useMemo<QuotationDraft>(
    () => ({
      items: repairCase.quotation?.items.length
        ? repairCase.quotation.items.map((item) => ({ ...item, type: 'PART' as const }))
        : [{ type: 'PART' as const, description: '', quantity: 1, unitPrice: 0 }],
      customerNote: repairCase.quotation?.customerNote ?? '',
      diagnosedIssue: repairCase.diagnostics?.findings ?? '',
      proposedRepair: repairCase.diagnostics?.recommendedWork ?? '',
      laborCost: 0,
      additionalCharges: 0,
      taxRate: 0,
      estimatedCompletionHours: 24,
      warrantyTerms: repairCase.warranty?.terms ?? '',
      validDays: 7,
      supportingEvidenceIds: [] as string[],
    }),
    [
      repairCase.quotation?.items,
      repairCase.quotation?.customerNote,
      repairCase.diagnostics,
      repairCase.warranty,
    ],
  );
  const [items, setItems] = useState<QuoteLine[]>(initialDraft.items);
  const [customerNote, setCustomerNote] = useState(initialDraft.customerNote);
  const [diagnosedIssue, setDiagnosedIssue] = useState(initialDraft.diagnosedIssue);
  const [proposedRepair, setProposedRepair] = useState(initialDraft.proposedRepair);
  const [laborCost, setLaborCost] = useState(initialDraft.laborCost);
  const [additionalCharges, setAdditionalCharges] = useState(initialDraft.additionalCharges);
  const [taxRate, setTaxRate] = useState(initialDraft.taxRate);
  const [estimatedCompletionHours, setEstimatedCompletionHours] = useState(
    initialDraft.estimatedCompletionHours,
  );
  const [warrantyTerms, setWarrantyTerms] = useState(initialDraft.warrantyTerms);
  const [validDays, setValidDays] = useState(initialDraft.validDays);
  const [supportingEvidenceIds, setSupportingEvidenceIds] = useState<string[]>(
    initialDraft.supportingEvidenceIds,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const quotationDraft: QuotationDraft = {
    items,
    customerNote,
    diagnosedIssue,
    proposedRepair,
    laborCost,
    additionalCharges,
    taxRate,
    estimatedCompletionHours,
    warrantyTerms,
    validDays,
    supportingEvidenceIds,
  };
  const setQuotationDraft = useCallback(
    (draft: typeof initialDraft) => {
      setItems(draft.items);
      setCustomerNote(draft.customerNote);
      setDiagnosedIssue(draft.diagnosedIssue);
      setProposedRepair(draft.proposedRepair);
      setLaborCost(draft.laborCost);
      setAdditionalCharges(draft.additionalCharges);
      setTaxRate(draft.taxRate);
      setEstimatedCompletionHours(draft.estimatedCompletionHours);
      setWarrantyTerms(draft.warrantyTerms);
      setValidDays(draft.validDays);
      setSupportingEvidenceIds(draft.supportingEvidenceIds);
    },
    [],
  );
  const localDraft = useLocalDraft(
    `user:${profileId}:case:${repairCase.id}:quotation`,
    quotationDraft,
    initialDraft,
    setQuotationDraft,
  );
  const total = useMemo(() => {
    const subtotal =
      items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) +
      laborCost +
      additionalCharges;
    return subtotal + subtotal * taxRate;
  }, [items, laborCost, additionalCharges, taxRate]);
  useEffect(() => {
    setQuotationDraft(initialDraft);
  }, [initialDraft, setQuotationDraft]);
  const buildQuotation = () => ({
    diagnosedIssue,
    proposedRepair: customerNote.trim()
      ? `${proposedRepair}\n\nNote for customer: ${customerNote.trim()}`
      : proposedRepair,
    items,
    laborCost,
    additionalCharges,
    taxRate,
    estimatedCompletionHours,
    warrantyTerms,
    supportingEvidenceIds,
    currency: repairCase.quotation?.currency ?? 'USD',
    validDays,
  });
  const submit = async () => {
    const parsed = quoteSchema.safeParse(buildQuotation());
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Review quotation details.');
      setConfirmOpen(false);
      return;
    }
    setFormError('');
    if (!navigator.onLine) {
      setFormError(tx('draft.connectionRequired'));
      setConfirmOpen(false);
      return;
    }
    try {
      const created = (await onAction(`/cases/${repairCase.id}/quotations`, parsed.data)) as {
        id?: string;
      };
      if (!created.id)
        throw new Error(
          'The quotation was saved, but its reference was not returned. Reload the repair case before retrying.',
        );
      await onAction(`/cases/${repairCase.id}/quotations/${created.id}/send`, {});
      localDraft.clearAfterConfirmation(quotationDraft);
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
    }
  };
  return (
    <PanelCard
      title={tx('Quotation builder')}
      eyebrow={`${repairCase.reference} · VERSION ${(repairCase.quotation?.version ?? 0) + 1}`}
      icon={FileText}
      subtitle="Enter the work and cost transparently. The customer sees the submitted version and its line items."
    >
      {isTechnicianDemoMode && <DemoMutationNotice />}
      <LocalDraftNotice
        hasRecoveredDraft={localDraft.recoveredDraft !== null}
        isSaved={localDraft.savedLocally}
        storageAvailable={localDraft.storageAvailable}
        onRestore={localDraft.restore}
        onDiscard={localDraft.discard}
      />
      {formError || actionError ? (
        <ActionError message={formError || getApiErrorMessage(actionError)} />
      ) : null}
      {repairCase.quotation && (
        <Alert
          variant={repairCase.quotation.status === 'approved' ? 'success' : 'info'}
          className="mb-4"
        >
          <FileText className="h-4 w-4" />
          <AlertTitle>
            {tx('Current quotation · v')}
            {repairCase.quotation.version}
          </AlertTitle>
          <AlertDescription>
            {tx('Current state: ')}
            {translateStatus(repairCase.quotation.status)}
            {tx('. A new submission creates a versioned quotation record. ')}
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-3">
        {items.map((item, index) => (
          <fieldset
            key={index}
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_100px_130px_44px] sm:items-end"
          >
            <legend className="sr-only">
              {tx('Quotation item ')}
              {index + 1}
            </legend>
            <FormField id={`quote-description-${index}`} label={tx('Part or labor')}>
              <Input
                value={item.description}
                maxLength={160}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((line, lineIndex) =>
                      lineIndex === index ? { ...line, description: event.target.value } : line,
                    ),
                  )
                }
                placeholder={tx('e.g. Display assembly')}
              />
            </FormField>
            <FormField id={`quote-type-${index}`} label={tx('Line type')}>
              <Select
                value={item.type}
                onValueChange={(type: 'PART' | 'LABOR') =>
                  setItems((current) =>
                    current.map((line, lineIndex) =>
                      lineIndex === index ? { ...line, type } : line,
                    ),
                  )
                }
              >
                <SelectTrigger aria-label={`Quotation item ${index + 1} type`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PART">{tx('Part')}</SelectItem>
                  <SelectItem value="LABOR">{tx('Labor')}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField id={`quote-quantity-${index}`} label={tx('Quantity')}>
              <Input
                type="number"
                min="1"
                step="1"
                value={item.quantity}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((line, lineIndex) =>
                      lineIndex === index
                        ? { ...line, quantity: Number(event.target.value) }
                        : line,
                    ),
                  )
                }
              />
            </FormField>
            <FormField id={`quote-price-${index}`} label={tx('Unit price')}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((line, lineIndex) =>
                      lineIndex === index
                        ? { ...line, unitPrice: Number(event.target.value) }
                        : line,
                    ),
                  )
                }
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove quotation item ${index + 1}`}
              disabled={items.length === 1}
              onClick={() =>
                setItems((current) => current.filter((_, lineIndex) => lineIndex !== index))
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </fieldset>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setItems((current) => [
            ...current,
            { type: 'PART', description: '', quantity: 1, unitPrice: 0 },
          ])
        }
      >
        <Plus className="h-4 w-4" />
        {tx('Add line item ')}
      </Button>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="quote-diagnosed-issue" label={tx('Diagnosed issue')} required>
          <Textarea
            maxLength={3000}
            value={diagnosedIssue}
            onChange={(event) => setDiagnosedIssue(event.target.value)}
          />
        </FormField>
        <FormField id="quote-proposed-repair" label={tx('Proposed repair')} required>
          <Textarea
            maxLength={3000}
            value={proposedRepair}
            onChange={(event) => setProposedRepair(event.target.value)}
          />
        </FormField>
        <FormField id="quote-labor-cost" label={tx('Labour cost')} required>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={laborCost}
            onChange={(event) => setLaborCost(Number(event.target.value))}
          />
        </FormField>
        <FormField id="quote-extra-charges" label={tx('Additional charges')}>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={additionalCharges}
            onChange={(event) => setAdditionalCharges(Number(event.target.value))}
          />
        </FormField>
        <FormField id="quote-tax-rate" label={tx('Tax rate (0–1)')}>
          <Input
            type="number"
            min="0"
            max="1"
            step="0.0001"
            value={taxRate}
            onChange={(event) => setTaxRate(Number(event.target.value))}
          />
        </FormField>
        <FormField id="quote-completion-hours" label={tx('Estimated completion (hours)')} required>
          <Input
            type="number"
            min="1"
            max="8760"
            step="1"
            value={estimatedCompletionHours}
            onChange={(event) => setEstimatedCompletionHours(Number(event.target.value))}
          />
        </FormField>
        <FormField id="quote-valid-days" label={tx('Quotation validity (days)')} required>
          <Input
            type="number"
            min="1"
            max="90"
            step="1"
            value={validDays}
            onChange={(event) => setValidDays(Number(event.target.value))}
          />
        </FormField>
        <FormField id="quote-warranty-terms" label={tx('Warranty terms')} required>
          <Textarea
            maxLength={2000}
            value={warrantyTerms}
            onChange={(event) => setWarrantyTerms(event.target.value)}
          />
        </FormField>
      </div>
      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">
          {tx('Supporting evidence (select at least one) ')}
        </legend>
        {repairCase.evidence.length ? (
          repairCase.evidence.map((evidence) => (
            <label key={evidence.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={supportingEvidenceIds.includes(evidence.id)}
                onChange={(event) =>
                  setSupportingEvidenceIds((current) =>
                    event.target.checked
                      ? [...current, evidence.id]
                      : current.filter((id) => id !== evidence.id),
                  )
                }
              />
              <span>{evidence.name}</span>
            </label>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {tx('Upload and scan supporting evidence before sending a quotation. ')}
          </p>
        )}
      </fieldset>
      <FormField id="quote-note" label={tx('Note for customer')}>
        <Textarea
          maxLength={1000}
          value={customerNote}
          onChange={(event) => setCustomerNote(event.target.value)}
          placeholder={tx('Clarify what is included or any relevant conditions.')}
        />
      </FormField>
      <div className="flex items-center justify-between rounded-lg bg-muted/60 p-4">
        <span className="text-sm font-medium">{tx('Estimated total')}</span>
        <span className="text-xl font-semibold tabular-nums">
          {formatCurrency(total, repairCase.quotation?.currency)}
        </span>
      </div>
      <Button
        type="button"
        onClick={() => {
          const parsed = quoteSchema.safeParse(buildQuotation());
          if (!parsed.success) {
            setFormError(parsed.error.issues[0]?.message ?? 'Review quotation details.');
            return;
          }
          setFormError('');
          setConfirmOpen(true);
        }}
        disabled={isPending || isTechnicianDemoMode}
      >
        {tx('Review and send for approval ')}
        <ArrowRight className="h-4 w-4" />
      </Button>
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={tx('Send quotation to the customer?')}
        description={`This submits versioned quotation details for ${formatCurrency(total, repairCase.quotation?.currency)}. The customer will be asked to approve or decline it.`}
        confirmLabel="Send quotation"
        isPending={isPending}
        disabled={isTechnicianDemoMode}
        onConfirm={() => void submit()}
      />
    </PanelCard>
  );
}

function ExecutionPanel({ repairCase, onAction, isPending, actionError }: SharedPanelProps) {
  const [actionName, setActionName] = useState('');
  const [part, setPart] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setActionName('');
    setPart('');
    setNote('');
    setConfirm(false);
    setError('');
  }, [repairCase.id]);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = repairActionSchema.safeParse({ action: actionName, component: part, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter repair action details.');
      return;
    }
    setError('');
    setConfirm(true);
  };
  const saveAction = async () => {
    const parsed = repairActionSchema.safeParse({ action: actionName, component: part, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter repair action details.');
      setConfirm(false);
      return;
    }
    try {
      const step = (await onAction(`/cases/${repairCase.id}/steps`, {
        title: parsed.data.action,
        description: parsed.data.note || parsed.data.action,
        partsUsed: parsed.data.component ? [{ name: parsed.data.component }] : [],
      })) as { id?: string };
      if (!step.id)
        throw new Error('Repair action saved without a step reference. Reload before retrying.');
      await onAction(`/cases/${repairCase.id}/steps/${step.id}`, { status: 'COMPLETED' });
      setActionName('');
      setPart('');
      setNote('');
      setConfirm(false);
    } catch {
      setConfirm(false);
    }
  };
  return (
    <div className="space-y-4">
      <PanelCard
        title={tx('Repair execution log')}
        eyebrow={repairCase.reference}
        icon={Wrench}
        subtitle="Record the work performed and components used while the case is in repair."
      >
        {isTechnicianDemoMode && <DemoMutationNotice />}
        {error || actionError ? (
          <ActionError message={error || getApiErrorMessage(actionError)} />
        ) : null}
        <div className="mb-5 rounded-lg border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">{tx('Current case state')}</p>
          <p className="mt-1">
            <span
              className={cn(
                'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                statusTone(repairCase.status),
              )}
            >
              {tx(statusLabel(repairCase.status))}
            </span>
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {tx(
              'A state change is confirmed separately. The server checks whether the transition is valid for this case. ',
            )}
          </p>
          <TransitionControl
            repairCase={repairCase}
            onAction={onAction}
            isPending={isPending}
            error={actionError}
          />
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <FormField id="action-performed" label={tx('Action performed')} required>
            <Input
              value={actionName}
              maxLength={160}
              onChange={(event) => setActionName(event.target.value)}
              placeholder={tx('e.g. Removed damaged display assembly')}
            />
          </FormField>
          <FormField id="action-component" label={tx('Component or part reference')}>
            <Input
              value={part}
              maxLength={160}
              onChange={(event) => setPart(event.target.value)}
              placeholder={tx('Part name, SKU, or serial')}
            />
          </FormField>
          <FormField id="action-note" label={tx('Technician note')}>
            <Textarea
              value={note}
              maxLength={1500}
              onChange={(event) => setNote(event.target.value)}
              placeholder={tx('Record relevant repair details.')}
            />
          </FormField>
          <Button type="submit" disabled={isPending || isTechnicianDemoMode}>
            <Save className="h-4 w-4" />
            {tx('Review repair log entry ')}
          </Button>
        </form>
        <ConfirmationDialog
          open={confirm}
          onOpenChange={setConfirm}
          title={tx('Add this action to the repair record?')}
          description={tx(
            'The submitted action and component details become part of the case history.',
          )}
          confirmLabel="Add repair action"
          isPending={isPending}
          disabled={isTechnicianDemoMode}
          onConfirm={() => void saveAction()}
        />
      </PanelCard>
    </div>
  );
}

function TestingPanel({ repairCase, onAction, isPending, actionError }: SharedPanelProps) {
  const checks = [
    'Power on and shutdown',
    'Touch or input response',
    'Display or indicators',
    'Camera and sensors',
    'Charging and connectivity',
  ];
  const [results, setResults] = useState<Record<string, 'pass' | 'fail' | 'not_applicable'>>(() =>
    Object.fromEntries(repairCase.tests.map((test) => [test.name, test.result])),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(repairCase.tests.map((test) => [test.name, test.note ?? ''])),
  );
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setResults(Object.fromEntries(repairCase.tests.map((test) => [test.name, test.result])));
    setNotes(Object.fromEntries(repairCase.tests.map((test) => [test.name, test.note ?? ''])));
  }, [repairCase.id, repairCase.tests]);
  const submit = async () => {
    const body = {
      tests: checks
        .filter((name) => results[name])
        .map((name) => ({ name, result: results[name], note: notes[name] ?? '' })),
    };
    if (!body.tests.length) {
      setMessage('Record at least one test result before submitting.');
      setConfirm(false);
      return;
    }
    setMessage('');
    try {
      for (const result of body.tests) {
        await onAction(`/cases/${repairCase.id}/tests`, {
          name: result.name,
          passed: result.result === 'pass',
          details: { outcome: result.result },
          notes: result.note,
        });
      }
      setConfirm(false);
    } catch {
      setConfirm(false);
    }
  };
  return (
    <PanelCard
      title={tx('Post-repair tests')}
      eyebrow={`${repairCase.reference} · QUALITY CHECK`}
      icon={ClipboardCheck}
      subtitle="Record functional checks and note any limitations. Results are saved to the repair case."
    >
      {isTechnicianDemoMode && <DemoMutationNotice />}
      {message || actionError ? (
        <ActionError message={message || getApiErrorMessage(actionError)} />
      ) : null}
      <div className="overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[minmax(0,1fr)_170px] bg-muted/50 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
          <span>{tx('Test')}</span>
          <span>{tx('Result')}</span>
        </div>
        {checks.map((name) => (
          <div
            key={name}
            className="grid gap-2 border-t p-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_170px] sm:items-center"
          >
            <div>
              <p className="text-sm font-medium">{name}</p>
              <label className="mt-2 block sm:hidden">
                <span className="sr-only">
                  {name} {tx(' result')}
                </span>
                <ResultSelect
                  name={name}
                  value={results[name] ?? ''}
                  onChange={(value) => setResults((current) => ({ ...current, [name]: value }))}
                />
              </label>
              <label className="mt-2 hidden sm:block">
                <span className="sr-only">
                  {name} {tx(' note')}
                </span>
                <Input
                  value={notes[name] ?? ''}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [name]: event.target.value }))
                  }
                  placeholder={tx('Optional result note')}
                  className="h-9 text-xs"
                />
              </label>
            </div>
            <div className="hidden sm:block">
              <label>
                <span className="sr-only">
                  {name} {tx(' result')}
                </span>
                <ResultSelect
                  name={name}
                  value={results[name] ?? ''}
                  onChange={(value) => setResults((current) => ({ ...current, [name]: value }))}
                />
              </label>
            </div>
            <label className="block sm:hidden">
              <span className="sr-only">
                {name} {tx(' note')}
              </span>
              <Input
                value={notes[name] ?? ''}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [name]: event.target.value }))
                }
                placeholder={tx('Optional result note')}
                className="h-9 text-xs"
              />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {tx('Completed checks: ')}
          {Object.values(results).filter((result) => result === 'pass').length} {tx('pass · ')}
          {Object.values(results).filter((result) => result === 'fail').length} {tx(' fail ')}
        </p>
        <Button onClick={() => setConfirm(true)} disabled={isPending || isTechnicianDemoMode}>
          {tx('Review test results ')}
        </Button>
      </div>
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={tx('Submit these test results?')}
        description={tx(
          'The test outcomes will be added to the repair record. Any failed result remains visible to the customer and shop team.',
        )}
        confirmLabel="Submit results"
        isPending={isPending}
        disabled={isTechnicianDemoMode}
        onConfirm={() => void submit()}
      />
    </PanelCard>
  );
}

function WarrantyPanel({ repairCase, onAction, isPending, actionError }: SharedPanelProps) {
  const [durationMonths, setDurationMonths] = useState(
    String(repairCase.warranty?.durationMonths ?? 3),
  );
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [terms, setTerms] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setDurationMonths(String(repairCase.warranty?.durationMonths ?? 3));
    setStartsAt(repairCase.warranty?.startsAt ?? new Date().toISOString().slice(0, 10));
    setTerms(repairCase.warranty?.terms ?? '');
    setConfirm(false);
    setMessage('');
  }, [repairCase.id, repairCase.warranty]);
  const submit = async () => {
    const parsed = warrantySchema.safeParse({
      durationMonths: Number(durationMonths),
      startsAt,
      terms,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? 'Review warranty details.');
      setConfirm(false);
      return;
    }
    setMessage('');
    try {
      await onAction(`/cases/${repairCase.id}/warranty`, {
        durationMonths: parsed.data.durationMonths,
        startsAt: new Date(`${parsed.data.startsAt}T00:00:00.000Z`).toISOString(),
        terms: parsed.data.terms,
      });
      setConfirm(false);
    } catch {
      setConfirm(false);
    }
  };
  return (
    <PanelCard
      title={tx('Warranty documentation')}
      eyebrow={repairCase.reference}
      icon={ShieldCheck}
      subtitle="Document the coverage terms associated with this completed repair."
    >
      {isTechnicianDemoMode && <DemoMutationNotice />}
      {message || actionError ? (
        <ActionError message={message || getApiErrorMessage(actionError)} />
      ) : null}
      {repairCase.warranty && (
        <Alert variant="success" className="mb-4">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{tx('Warranty recorded')}</AlertTitle>
          <AlertDescription>
            {repairCase.warranty.durationMonths} {tx(' months from')}{' '}
            {formatDate(repairCase.warranty.startsAt)}
            {' · '}
            {repairCase.warranty.terms}
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="warranty-duration" label={tx('Coverage duration')}>
          <Select value={durationMonths} onValueChange={setDurationMonths}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{tx('1 month')}</SelectItem>
              <SelectItem value="3">{tx('3 months')}</SelectItem>
              <SelectItem value="6">{tx('6 months')}</SelectItem>
              <SelectItem value="12">{tx('1 year')}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="warranty-start" label={tx('Coverage starts')}>
          <Input
            type="date"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </FormField>
      </div>
      <div className="mt-4">
        <FormField
          id="warranty-terms"
          label={tx('Coverage terms')}
          required
          hint="Describe covered work and relevant exclusions in plain language."
        >
          <Textarea
            maxLength={2000}
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            placeholder={tx('What parts and workmanship are covered? What conditions apply?')}
          />
        </FormField>
      </div>
      {repairCase.status !== 'completed' && (
        <p className="mt-3 text-xs text-muted-foreground">
          {tx('Warranty documentation is available after the repair is marked complete. ')}
        </p>
      )}
      <Button
        className="mt-4"
        onClick={() => setConfirm(true)}
        disabled={isPending || isTechnicianDemoMode || repairCase.status !== 'completed'}
      >
        {tx('Review warranty record ')}
        <ArrowRight className="h-4 w-4" />
      </Button>
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={tx('Save this warranty record?')}
        description={`${durationMonths} months of coverage will be attached to ${repairCase.reference}. Confirm the terms are accurate before submission.`}
        confirmLabel="Save warranty"
        isPending={isPending}
        disabled={isTechnicianDemoMode}
        onConfirm={() => void submit()}
      />
    </PanelCard>
  );
}

function CertificatePanel({ repairCase }: { repairCase: TechnicianCase }) {
  return (
    <PanelCard
      title={tx('Repair certificate')}
      eyebrow={repairCase.reference}
      icon={FileCheck2}
      subtitle="Review the completion record and warranty before sharing the certificate."
    >
      <div className="rounded-xl border bg-muted/30 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {tx('Device repair certificate ')}
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              {repairCase.device.manufacturer} {repairCase.device.model}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{repairCase.issueSummary}</p>
          </div>
          <Badge className={statusTone(repairCase.status)}>
            {tx(statusLabel(repairCase.status))}
          </Badge>
        </div>
        <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
          <DetailField label={tx('Case reference')} value={repairCase.reference} />
          <DetailField label={tx('Customer')} value={repairCase.customerName} />
          <DetailField
            label={tx('Recorded tests')}
            value={`${repairCase.tests.filter((test) => test.result === 'pass').length} passed · ${repairCase.tests.length} total`}
          />
          <DetailField
            label={tx('Warranty')}
            value={
              repairCase.warranty
                ? `${repairCase.warranty.durationMonths} days from ${formatDate(repairCase.warranty.startsAt)}`
                : 'Not documented'
            }
          />
        </div>
      </div>
      {repairCase.status !== 'completed' && (
        <p className="mt-4 text-sm text-muted-foreground">
          {tx(
            'Certificate issuance is available after required case checks and backend validation are complete. ',
          )}
        </p>
      )}
    </PanelCard>
  );
}

function TransitionControl({ repairCase, onAction, isPending, error }: SharedPanelProps) {
  const isOnline = useNetworkStatus();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const target = nextTechnicianTransition(repairCase.status);
  if (!target)
    return (
      <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
        {repairCase.status === 'pending_approval'
          ? 'Waiting for the customer’s approval. The technician cannot move this case forward.'
          : repairCase.status === 'completed'
            ? 'This repair is complete.'
            : 'No technician-initiated transition is available for this state.'}
      </p>
    );
  const confirmTransition = async () => {
    setMessage('');
    try {
      await onAction(`/cases/${repairCase.id}/status`, {
        status: apiStatusFor(target),
      });
      setConfirm(false);
    } catch (reason) {
      setMessage(
        getApiErrorMessage(
          reason,
          'The server rejected this transition. Refresh the case and try again.',
        ),
      );
    }
  };
  return (
    <div className="mt-4">
      {message || error ? <ActionError message={message || getApiErrorMessage(error)} /> : null}
      <Button
        onClick={() => setConfirm(true)}
        disabled={isPending || isTechnicianDemoMode || !isOnline}
      >
        {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {tx('Move to')} {tx(statusLabel(target))} <ArrowRight className="h-4 w-4" />
      </Button>
      {isTechnicianDemoMode && (
        <p className="mt-2 text-xs text-muted-foreground">
          {tx(
            'Transitions are disabled in the fixture preview. The live API validates every transition. ',
          )}
        </p>
      )}
      {!isOnline && (
        <p className="mt-2 text-xs text-muted-foreground">{tx('draft.connectionRequired')}</p>
      )}
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`${tx('Move this case to')} ${tx(statusLabel(target))}?`}
        description={`${tx('This requests the transition from')} ${tx(statusLabel(repairCase.status))} ${tx('to')} ${tx(statusLabel(target))}. ${tx('RepairProof’s backend validates the case’s current state and permissions before applying it.')}`}
        confirmLabel={`${tx('Move to')} ${tx(statusLabel(target))}`}
        isPending={isPending}
        disabled={isTechnicianDemoMode || !isOnline}
        onConfirm={() => void confirmTransition()}
      />
    </div>
  );
}

function EmptyCaseSelection({ view }: { view: TechnicianView }) {
  return (
    <PanelCard
      title={tx('Select a repair case')}
      eyebrow={view.toUpperCase()}
      icon={Wrench}
      subtitle="Choose a case from the work queue to review its details and available workflow actions."
    />
  );
}

function PanelCard({
  title,
  eyebrow,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  eyebrow: string;
  subtitle: string;
  icon: typeof Wrench;
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-start gap-3 border-b p-4 sm:p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="rp-code text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function MiniSummary({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof Wrench;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{title}</p>
        <p className="mt-1 truncate text-xs font-semibold">{value}</p>
      </div>
    </div>
  );
}

function ActionError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{tx('Could not save changes')}</AlertTitle>
      <AlertDescription>
        {message} {tx(' Your unsaved form values are still on screen.')}
      </AlertDescription>
    </Alert>
  );
}

function DemoMutationNotice() {
  return (
    <Alert variant="warning" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{tx('Development mock data')}</AlertTitle>
      <AlertDescription>
        {tx(
          'These are fictional, unverified example repair records. Workflow submissions and evidence uploads are disabled until the API is connected. ',
        )}
      </AlertDescription>
    </Alert>
  );
}

function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isPending,
  disabled,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  isPending: boolean;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tx('Go back ')}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isPending || disabled}>
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultSelect({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: 'pass' | 'fail' | 'not_applicable') => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as 'pass' | 'fail' | 'not_applicable')}
    >
      <SelectTrigger aria-label={`${name} result`}>
        <SelectValue placeholder={tx('Choose result')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pass">{tx('Pass')}</SelectItem>
        <SelectItem value="fail">{tx('Fail')}</SelectItem>
        <SelectItem value="not_applicable">{tx('Not applicable')}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function nextTechnicianTransition(status: CaseStatus): CaseStatus | null {
  const allowed: Partial<Record<CaseStatus, CaseStatus>> = {
    incoming: 'assigned',
    assigned: 'diagnosing',
    approved: 'in_repair',
    in_repair: 'testing',
  };
  return allowed[status] ?? null;
}

function apiStatusFor(status: CaseStatus) {
  const mapped: Partial<Record<CaseStatus, string>> = {
    assigned: 'SUBMITTED',
    diagnosing: 'UNDER_DIAGNOSIS',
    in_repair: 'IN_REPAIR',
    testing: 'AWAITING_VERIFICATION',
  };
  return mapped[status];
}

const newCaseSchema = z.object({
  customerName: z.string().trim().min(1, 'Enter a customer name.'),
  customerPhone: z.string().trim().min(1, 'Enter the customer phone number.'),
  customerEmail: z.union([z.string().trim().email(), z.literal('')]).optional(),
  category: z.enum(['SMARTPHONE', 'LAPTOP']),
  manufacturer: z.string().trim().min(1, 'Enter the device manufacturer.'),
  model: z.string().trim().min(1, 'Enter the device model.'),
  serialLast4: z
    .string()
    .trim()
    .max(4)
    .refine(
      (value) => value.length === 0 || /^[A-Za-z0-9]{4}$/.test(value),
      'Enter all 4 characters or leave the serial blank.',
    )
    .optional(),
  issueSummary: z
    .string()
    .trim()
    .min(8, 'Describe the reported issue in at least 8 characters.')
    .max(1000),
});
const diagnosticSchema = z.object({
  symptoms: z.string().trim().min(3, 'Record the customer’s reported symptoms.'),
  findings: z.string().trim().min(3, 'Record your diagnostic findings.'),
  recommendedWork: z.string().trim().min(3, 'Describe the recommended repair.'),
  safetyNotes: z.string().trim().max(1000),
});
const quoteSchema = z.object({
  diagnosedIssue: z.string().trim().min(1, 'Record the diagnosed issue.'),
  proposedRepair: z.string().trim().min(1, 'Describe the proposed repair.'),
  items: z
    .array(
      z.object({
        type: z.enum(['PART', 'LABOR']),
        description: z.string().trim().min(1, 'Each line item needs a description.'),
        quantity: z.number().int().min(1),
        unitPrice: z.number().nonnegative(),
      }),
    )
    .min(1),
  laborCost: z.number().nonnegative(),
  additionalCharges: z.number().nonnegative(),
  taxRate: z.number().min(0).max(1),
  estimatedCompletionHours: z.number().int().min(1).max(8760),
  warrantyTerms: z.string().trim().min(1, 'Enter warranty terms.'),
  supportingEvidenceIds: z.array(z.string().uuid()).min(1, 'Select supporting evidence.'),
  currency: z.string().length(3),
  validDays: z.number().int().min(1).max(90),
});
const repairActionSchema = z.object({
  action: z.string().trim().min(3, 'Describe the repair action performed.'),
  component: z.string().trim().max(160),
  note: z.string().trim().max(1500),
});
const warrantySchema = z.object({
  durationMonths: z.number().int().positive(),
  startsAt: z.string().date(),
  terms: z
    .string()
    .trim()
    .min(10, 'Describe the warranty terms in at least 10 characters.')
    .max(2000),
});
type SharedPanelProps = {
  repairCase: TechnicianCase;
  onAction: ActionRunner;
  isPending: boolean;
  actionError?: unknown;
  error?: unknown;
};

function formatDate(value: string) {
  return formatLocalizedDate(value);
}
function formatCurrency(value: number, currency?: string) {
  const locale = getActiveLocale();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency ?? (locale === 'bn-BD' ? 'BDT' : 'INR'),
  }).format(value);
}
function formatBytes(value: number) {
  return value < 1_000_000
    ? `${Math.max(1, Math.round(value / 1000))} KB`
    : `${(value / 1_000_000).toFixed(1)} MB`;
}
