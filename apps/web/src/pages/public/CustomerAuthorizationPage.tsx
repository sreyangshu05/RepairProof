import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ShieldCheck, CheckCircle2, XCircle, Smartphone, Laptop, AlertCircle, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { formatDate, formatCurrency } from '../../lib/utils';

export const CustomerAuthorizationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [signatureName, setSignatureName] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [decisionMade, setDecisionMade] = useState<boolean | null>(null);

  const { data: repairCase, isLoading, error } = useQuery<any>({
    queryKey: ['authorize', token],
    queryFn: () => api.get(`/authorize/${token}`),
    enabled: !!token,
  });

  const respondMutation = useMutation({
    mutationFn: (approved: boolean) =>
      api.post(`/authorize/${token}/respond`, {
        approved,
        customerSignatureName: signatureName.trim(),
        notes: customerNotes.trim() || undefined,
      }),
    onSuccess: (res: any) => {
      setDecisionMade(res.approved);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground font-medium">Verifying customer repair authorization link...</p>
        </div>
      </div>
    );
  }

  if (error || !repairCase) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-3">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <CardTitle>Invalid or Expired Link</CardTitle>
          <CardDescription>
            This customer authorization link has expired or is invalid. Please contact the repair workshop directly.
          </CardDescription>
        </Card>
      </div>
    );
  }

  const activeQuote = repairCase.quotations?.[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">
            <ShieldCheck className="h-4 w-4" />
            <span>RepairProof Verified Authorization Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Repair Estimate & Authorization
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Issued by <span className="font-semibold text-foreground">{repairCase.shop?.name}</span> • Case #{repairCase.caseNumber}
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
                    {repairCase.device?.serialNumber ? `S/N: ${repairCase.device.serialNumber}` : ''}{' '}
                    {repairCase.device?.imei ? `IMEI: ${repairCase.device.imei}` : ''}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs uppercase">
                {repairCase.status.replace(/_/g, ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-semibold text-foreground mb-1">Customer Reported Fault:</p>
              <p className="text-muted-foreground">{repairCase.problemDescription}</p>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostic Evidence Preview */}
        {repairCase.evidence?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Diagnostic Evidence Captured by Technician</CardTitle>
              <CardDescription className="text-xs">
                Inspect physical photographic proof of damaged internal components.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {repairCase.evidence.map((ev: any) => (
                  <div key={ev.id} className="rounded-lg border overflow-hidden bg-card">
                    <img src={ev.fileUrl} alt="Diagnostic" className="aspect-video w-full object-cover" />
                    <div className="p-2.5 text-xs space-y-1">
                      <p className="font-semibold text-foreground">{ev.description || 'Hardware Inspection'}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{formatDate(ev.capturedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Itemized Quotation */}
        {activeQuote ? (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Itemized Repair Quotation</CardTitle>
                  <CardDescription className="text-xs">
                    Version {activeQuote.version} • Quote valid until {formatDate(activeQuote.validUntil)}
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
                  {activeQuote.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase bg-muted/60 text-muted-foreground border-b">
                    <tr>
                      <th className="px-3 py-2">Component / Service</th>
                      <th className="px-3 py-2">Part Grade</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeQuote.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2.5 font-medium text-foreground">{item.description}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[9px]">
                            {item.partSource || 'SERVICE'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right font-mono">${Number(item.unitPrice).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold">
                          ${Number(item.totalPrice).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Certified Labor & Diagnostics:
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        ${Number(activeQuote.laborCost).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="border-t-2 bg-muted/20">
                      <td colSpan={4} className="px-3 py-3 text-right font-bold text-foreground text-sm">
                        Total Amount Due Upon Completion:
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-extrabold text-base text-primary">
                        ${Number(activeQuote.totalCost).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action Decision Form */}
              {decisionMade !== null || activeQuote.status === 'APPROVED' || activeQuote.status === 'REJECTED' ? (
                <div
                  className={`p-6 rounded-xl border text-center space-y-2 ${
                    decisionMade === true || activeQuote.status === 'APPROVED'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-500'
                  }`}
                >
                  {decisionMade === true || activeQuote.status === 'APPROVED' ? (
                    <>
                      <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                      <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-100">
                        Repair Authorized Successfully
                      </h3>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Thank you! Your authorization was cryptographically stamped. The workshop technician has been notified to proceed.
                      </p>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-10 w-10 text-destructive mx-auto" />
                      <h3 className="font-bold text-base text-destructive">Repair Estimate Declined</h3>
                      <p className="text-xs text-muted-foreground">
                        You have declined this quotation. The technician will contact you regarding device collection.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border bg-secondary/30 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Customer Authorization Sign-Off
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="sig" className="text-xs mb-1 block">
                        Your Full Name (Electronic Signature) *
                      </Label>
                      <Input
                        id="sig"
                        placeholder="Type your full legal name..."
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="notes" className="text-xs mb-1 block">
                        Optional Notes or Instructions for Technician
                      </Label>
                      <Input
                        id="notes"
                        placeholder="e.g. Please preserve device photos and internal data..."
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button
                        type="button"
                        variant="destructive"
                        className="flex-1"
                        disabled={!signatureName.trim() || respondMutation.isPending}
                        onClick={() => respondMutation.mutate(false)}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" /> Decline Repair
                      </Button>

                      <Button
                        type="button"
                        variant="success"
                        className="flex-1"
                        disabled={!signatureName.trim() || respondMutation.isPending}
                        onClick={() => respondMutation.mutate(true)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> Authorize & Begin Repair ($
                        {Number(activeQuote.totalCost).toFixed(2)})
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The technician is currently running initial diagnostics. Quotation will appear here shortly.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
