import { translateStatus, tx } from '../../i18n/catalog';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Smartphone,
  Laptop,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { ApiError, apiGet, apiPost, getApiErrorMessage } from '../../lib/api';
import { useNetworkStatus } from '../../pwa/use-network-status';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { formatDate, formatCurrency } from '../../lib/utils';

type AuthorizationEvidence = {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'DOCUMENT';
  fileName: string;
  description?: string | null;
  purpose: string;
  assetRole: string;
  malwareStatus: string;
  capturedAt: string | Date;
  fileUrl?: string | null;
  category: string;
};
type AuthorizationQuote = {
  id: string;
  version: number;
  status: string;
  validUntil: string | Date;
  diagnosedIssue?: string | null;
  proposedRepair?: string | null;
  estimatedCompletionHours: number;
  warrantyTerms: string;
  currency: string;
  laborCost: number;
  additionalCharges?: number;
  taxAmount?: number;
  taxRate?: number;
  totalCost: number;
  changeRequests?: Array<{ id: string; requestText: string; status: string }>;
  evidence?: Array<{ evidenceId: string; evidence: AuthorizationEvidence }>;
  items?: Array<{
    id: string;
    description: string;
    partSource?: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};
type AuthorizationRecord = {
  caseNumber: string;
  status: string;
  problemDescription: string;
  shop?: { name?: string };
  device?: {
    category?: string;
    make?: string;
    model?: string;
    serialNumber?: string | null;
    imei?: string | null;
  };
  evidence?: AuthorizationEvidence[];
  quotations?: AuthorizationQuote[];
};
type AuthorizationResult = {
  decision?: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  approved?: boolean;
};

export const CustomerAuthorizationPage: React.FC = () => {
  const { formatNumber } = useI18n();
  const isOnline = useNetworkStatus();
  const { token } = useParams<{ token: string }>();
  const [signatureName, setSignatureName] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [decisionMade, setDecisionMade] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | null>(
    null,
  );

  const {
    data: repairCase,
    isLoading,
    error,
  } = useQuery<AuthorizationRecord>({
    queryKey: ['authorize', token],
    queryFn: () => apiGet<AuthorizationRecord>(`/authorize/${token}`),
    enabled: !!token,
  });
  const evidenceUrlMutation = useMutation({
    mutationFn: (evidenceId: string) =>
      apiGet<{ signedUrl: string }>(`/authorize/${token}/evidence/${evidenceId}`),
  });

  const respondMutation = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES') => {
      if (!navigator.onLine) throw new Error(tx('draft.connectionRequired'));
      return apiPost<
        AuthorizationResult,
        { decision: string; customerSignatureName: string; notes?: string }
      >(`/authorize/${token}/respond`, {
        decision,
        customerSignatureName: signatureName.trim(),
        notes: customerNotes.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      setDecisionMade(res.decision || (res.approved ? 'APPROVE' : 'REJECT'));
    },
  });

  const persistCustomerLocale = (locale: 'en-IN' | 'bn-BD' | 'hi-IN') => {
    if (token) void apiPost(`/authorize/${token}/locale`, { locale }).catch(() => undefined);
  };

  if (isLoading) {
    return (
      <main
        role="main"
        className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4"
      >
        <div className="absolute right-4 top-4">
          <LanguageSwitcher compact onChange={persistCustomerLocale} />
        </div>
        <div className="text-center space-y-2">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground font-medium">
            {tx('Verifying customer repair authorization link... ')}
          </p>
        </div>
      </main>
    );
  }

  if (error || !repairCase) {
    const isDisabled = error instanceof ApiError && error.status === 503;
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card role="alert" className="max-w-md w-full text-center p-6 space-y-3">
          <div className="flex justify-end">
            <LanguageSwitcher onChange={persistCustomerLocale} />
          </div>
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <CardTitle>
            {isDisabled
              ? tx('Authorization Temporarily Unavailable')
              : tx('Invalid or Expired Link')}
          </CardTitle>
          <CardDescription>
            {isDisabled
              ? tx(
                  'Customer authorization links are currently disabled. Contact the repair workshop through its existing support channel.',
                )
              : tx(
                  'This customer authorization link has expired or is invalid. Please contact the repair workshop directly.',
                )}
          </CardDescription>
        </Card>
      </div>
    );
  }

  const activeQuote = repairCase.quotations?.[0];

  return (
    <main role="main" className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-end">
          <LanguageSwitcher onChange={persistCustomerLocale} />
        </div>
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>{tx('RepairProof Customer Authorization')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {tx('Repair Estimate & Authorization ')}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {tx('Issued by ')}
            <span className="font-semibold text-foreground">{repairCase.shop?.name}</span>{' '}
            {' · Case #'}
            {repairCase.caseNumber}
          </p>
        </div>

        {/* Device & Symptoms Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {repairCase.device?.category === 'SMARTPHONE' ? (
                    <Smartphone className="h-5 w-5" />
                  ) : (
                    <Laptop className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base font-bold">
                    {repairCase.device?.make} {repairCase.device?.model}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {repairCase.device?.serialNumber
                      ? `S/N: ${repairCase.device.serialNumber}`
                      : ''}{' '}
                    {repairCase.device?.imei ? `IMEI: ${repairCase.device.imei}` : ''}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs uppercase">
                {translateStatus(repairCase.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-semibold text-foreground mb-1">{tx('Customer Reported Fault:')}</p>
              <p className="text-muted-foreground">{repairCase.problemDescription}</p>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostic Evidence Preview */}
        {(repairCase.evidence?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {tx('Evidence attached to the repair case')}
              </CardTitle>
              <CardDescription className="text-xs">
                {tx(
                  'Review the files and their recorded purpose. File hashes support byte integrity only and do not prove that an image or document is authentic or truthful. ',
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {repairCase.evidence?.map((ev) => (
                  <div key={ev.id} className="rounded-lg border overflow-hidden bg-card">
                    {ev.type === 'PHOTO' && (
                      <div className="grid aspect-video place-items-center bg-muted">
                        <button
                          type="button"
                          onClick={() => evidenceUrlMutation.mutate(ev.id)}
                          className="min-h-11 px-4 text-sm font-medium text-primary underline"
                          disabled={evidenceUrlMutation.isPending}
                        >
                          {tx('Open private photograph ')}
                        </button>
                      </div>
                    )}
                    {ev.type === 'VIDEO' && (
                      <div className="grid aspect-video place-items-center bg-muted">
                        <button
                          type="button"
                          onClick={() => evidenceUrlMutation.mutate(ev.id)}
                          className="min-h-11 px-4 text-sm font-medium text-primary underline"
                          disabled={evidenceUrlMutation.isPending}
                        >
                          {tx('Open private video ')}
                        </button>
                      </div>
                    )}
                    {ev.type === 'DOCUMENT' && (
                      <div className="grid aspect-video place-items-center bg-muted">
                        <button
                          type="button"
                          onClick={() => evidenceUrlMutation.mutate(ev.id)}
                          className="min-h-11 px-4 text-sm font-medium text-primary underline"
                          disabled={evidenceUrlMutation.isPending}
                        >
                          {tx('Open ')}
                          {ev.fileName}
                        </button>
                      </div>
                    )}
                    <div className="p-2.5 text-xs space-y-1">
                      <p className="font-semibold text-foreground">
                        {ev.description || ev.fileName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {ev.purpose}
                        {' · '}
                        {ev.assetRole}
                        {' · '}
                        {tx('Malware scan')} {translateStatus(ev.malwareStatus)}
                      </p>
                      {ev.malwareStatus !== 'CLEAN' && (
                        <p className="text-[10px] text-muted-foreground">
                          {tx('This file is unavailable until it passes the malware scan. ')}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {formatDate(ev.capturedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {evidenceUrlMutation.data?.signedUrl && (
                <a
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
                  href={evidenceUrlMutation.data.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {tx('Open selected evidence (private link expires in one minute) ')}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Itemized Quotation */}
        {activeQuote ? (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{tx('Itemized Repair Quotation')}</CardTitle>
                  <CardDescription className="text-xs">
                    {tx('Version')} {formatNumber(activeQuote.version)}
                    {' · '}
                    {tx('Quote valid until')} {formatDate(activeQuote.validUntil)}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    activeQuote.status === 'APPROVED'
                      ? 'success'
                      : activeQuote.status === 'REJECTED'
                        ? 'destructive'
                        : 'warning'
                  }
                >
                  {translateStatus(activeQuote.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    {tx('Diagnosed issue')}
                  </p>
                  <p className="mt-1 text-sm">{activeQuote.diagnosedIssue}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    {tx('Proposed repair')}
                  </p>
                  <p className="mt-1 text-sm">{activeQuote.proposedRepair}</p>
                </div>
              </div>
              <dl className="grid gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{tx('Estimated completion')}</dt>
                  <dd className="mt-1 font-medium">
                    {tx('Within')} {formatNumber(activeQuote.estimatedCompletionHours)}{' '}
                    {tx('hours after approval')}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tx('Warranty terms')}</dt>
                  <dd className="mt-1 font-medium">{activeQuote.warrantyTerms}</dd>
                </div>
              </dl>
              {activeQuote.evidence && activeQuote.evidence.length > 0 && (
                <section aria-label={tx('Quotation supporting evidence')}>
                  <h3 className="mb-2 text-xs font-semibold">
                    {tx('Evidence attached to this quotation')}
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {activeQuote.evidence.map((record) => (
                      <li key={record.evidenceId} className="rounded-lg border p-2 text-xs">
                        {record.evidence.fileUrl ? (
                          <a
                            className="font-medium text-primary underline"
                            href={record.evidence.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {record.evidence.fileName}
                          </a>
                        ) : (
                          <span className="font-medium">{record.evidence.fileName}</span>
                        )}
                        <p className="mt-1 text-muted-foreground">
                          {record.evidence.description || record.evidence.category}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div
                role="region"
                aria-label={tx('Quotation line items and totals')}
                tabIndex={0}
                className="overflow-x-auto rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase bg-muted/60 text-muted-foreground border-b">
                    <tr>
                      <th scope="col" className="px-3 py-2">
                        {tx('Component / Service ')}
                      </th>
                      <th scope="col" className="px-3 py-2">
                        {tx('Part Grade ')}
                      </th>
                      <th scope="col" className="px-3 py-2 text-center">
                        {tx('Qty ')}
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        {tx('Unit Price ')}
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        {tx('Total ')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeQuote.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          {item.description}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[9px]">
                            {item.partSource || 'SERVICE'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">{formatNumber(item.quantity)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {formatCurrency(Number(item.unitPrice), activeQuote.currency)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold">
                          {formatCurrency(Number(item.totalPrice), activeQuote.currency)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-2 text-right font-medium text-muted-foreground"
                      >
                        {tx('Labour and diagnostics: ')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {formatCurrency(Number(activeQuote.laborCost), activeQuote.currency)}
                      </td>
                    </tr>
                    {Number(activeQuote.additionalCharges) > 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-2 text-right font-medium text-muted-foreground"
                        >
                          {tx('Additional charges: ')}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(
                            Number(activeQuote.additionalCharges),
                            activeQuote.currency,
                          )}
                        </td>
                      </tr>
                    )}
                    {Number(activeQuote.taxAmount) > 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-2 text-right font-medium text-muted-foreground"
                        >
                          {tx('Tax')} (
                          {formatNumber(Number(activeQuote.taxRate) * 100, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          %):
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(Number(activeQuote.taxAmount), activeQuote.currency)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2 bg-muted/20">
                      <td
                        colSpan={4}
                        className="px-3 py-3 text-right font-bold text-foreground text-sm"
                      >
                        {tx('Total Amount Due Upon Completion: ')}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-extrabold text-base text-primary">
                        {formatCurrency(Number(activeQuote.totalCost), activeQuote.currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action Decision Form */}
              {decisionMade !== null ||
              activeQuote.status === 'APPROVED' ||
              activeQuote.status === 'REJECTED' ? (
                <div
                  className={`p-6 rounded-xl border text-center space-y-2 ${
                    decisionMade === 'APPROVE' || activeQuote.status === 'APPROVED'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-500'
                  }`}
                >
                  {decisionMade === 'APPROVE' || activeQuote.status === 'APPROVED' ? (
                    <>
                      <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                      <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-100">
                        {tx('Repair Authorized Successfully ')}
                      </h3>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        {tx(
                          'Thank you. Your decision was recorded with a timestamp and audit event. The workshop team has been notified to review the authorization. ',
                        )}
                      </p>
                    </>
                  ) : decisionMade === 'REQUEST_CHANGES' || activeQuote.changeRequests?.length ? (
                    <>
                      <FileText className="h-10 w-10 text-primary mx-auto" />
                      <h3 className="font-bold text-base">{tx('Change request sent')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {tx(
                          'The workshop received your requested changes. A revised quotation will be issued for your explicit approval. ',
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-10 w-10 text-destructive mx-auto" />
                      <h3 className="font-bold text-base text-destructive">
                        {tx('Repair Estimate Declined ')}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {tx(
                          'You have declined this quotation. The technician will contact you regarding device collection. ',
                        )}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border bg-secondary/30 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {tx('Customer Authorization Sign-Off ')}
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="sig" className="text-xs mb-1 block">
                        {tx('Your Full Name (Electronic Signature) * ')}
                      </Label>
                      <Input
                        id="sig"
                        placeholder={tx('Type your full legal name...')}
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="notes" className="text-xs mb-1 block">
                        {tx('Notes or requested changes ')}
                      </Label>
                      <Input
                        id="notes"
                        placeholder={tx(
                          'Add instructions, or describe the scope or price change you are requesting...',
                        )}
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      {!isOnline && (
                        <p
                          className="w-full text-sm text-muted-foreground"
                          role="status"
                          aria-live="polite"
                        >
                          {tx('draft.connectionRequired')}
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        className="flex-1"
                        disabled={!signatureName.trim() || respondMutation.isPending || !isOnline}
                        onClick={() => respondMutation.mutate('REJECT')}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" /> {tx(' Decline Repair ')}
                      </Button>

                      <Button
                        type="button"
                        variant="success"
                        className="flex-1"
                        disabled={!signatureName.trim() || respondMutation.isPending || !isOnline}
                        onClick={() => respondMutation.mutate('APPROVE')}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> {tx('Authorize & Begin Repair')}{' '}
                        ({formatCurrency(Number(activeQuote.totalCost), activeQuote.currency)})
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        disabled={
                          !signatureName.trim() ||
                          !customerNotes.trim() ||
                          respondMutation.isPending ||
                          !isOnline
                        }
                        onClick={() => respondMutation.mutate('REQUEST_CHANGES')}
                      >
                        <FileText className="mr-1.5 h-4 w-4" /> {tx(' Request changes ')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {respondMutation.error && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {getApiErrorMessage(respondMutation.error)}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {tx(
                  'The technician is currently running initial diagnostics. Quotation will appear here shortly. ',
                )}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};
