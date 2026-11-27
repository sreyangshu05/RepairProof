import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Camera,
  Plus,
  Send,
  CheckCircle2,
  Trash2,
  FileBadge2,
  Check,
  Pin,
  ExternalLink,
} from 'lucide-react';
import { api, apiGet, apiPost } from '../../lib/api';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { formatDate, formatCurrency } from '../../lib/utils';
import { getSupabaseStorageClient } from '../../lib/supabase-storage';
import {
  EvidenceCategory,
  EvidencePurpose,
  PartSource,
  QuotationItemType,
  RepairStepStatus,
} from '@repairproof/shared';

type CaseEvidence = {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'DOCUMENT';
  category: string;
  fileUrl?: string | null;
  fileName: string;
  description?: string | null;
  purpose: string;
  assetRole: string;
  malwareStatus: string;
  legacyUnverified: boolean;
  deletedAt?: string | null;
  capturedAt: string | Date;
  contentSha256?: string | null;
  annotations: Array<{ id: string; x: number; y: number; note: string }>;
};
type QuoteEvidence = { evidenceId: string; evidence: CaseEvidence };
type CaseQuotation = {
  id: string;
  version: number;
  status: string;
  validUntil: string | Date;
  items: Array<{
    id: string;
    description: string;
    partSource?: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  partsCost: number;
  laborCost: number;
  taxRate: number;
  taxAmount: number;
  additionalCharges: number;
  totalCost: number;
  diagnosedIssue?: string | null;
  proposedRepair?: string | null;
  customerResponseNote?: string | null;
  changeRequests?: Array<{ id: string; requestText: string; status: string }>;
  evidence?: QuoteEvidence[];
};
type ChecklistItem = {
  id: string;
  label: string;
  category: string;
  passed: boolean;
  notes?: string;
};
type CaseDetail = {
  id: string;
  caseNumber: string;
  status: string;
  priority: string;
  customerName: string;
  customerPhone: string;
  problemDescription: string;
  createdAt: string | Date;
  device?: {
    category?: string;
    make?: string;
    model?: string;
    serialNumber?: string | null;
    imei?: string | null;
  };
  evidence: CaseEvidence[];
  quotations: CaseQuotation[];
  steps: Array<{
    id: string;
    stepNumber: number;
    title: string;
    description: string;
    status: string;
    photos: string[];
  }>;
  verification?: { passed: boolean; notes?: string | null } | null;
  certificate?: {
    certificateNumber: string;
    warrantyPeriodMonths: number;
    warrantyTerms?: string | null;
    issuedAt: string | Date;
    qrCodeUrl: string;
  } | null;
};
type VerificationData = {
  hasVerification: boolean;
  verification?: { checklist: ChecklistItem[] };
  defaultChecklist?: ChecklistItem[];
};
type CreateQuotationInput = Record<string, unknown>;
type RepairStepInput = { title: string; description: string; photos: string[] };
type EvidenceAnnotationInput = { x: number; y: number; note: string };
type CertificateInput = { warrantyPeriodMonths: number; warrantyTerms: string };

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('evidence');

  // Evidence state
  const [evidenceCategory, setEvidenceCategory] = useState<EvidenceCategory>(
    EvidenceCategory.DIAGNOSTIC,
  );
  const [evidencePurpose, setEvidencePurpose] = useState<EvidencePurpose>(
    EvidencePurpose.PHOTOGRAPH,
  );
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [selectedEvidenceForAnnotation, setSelectedEvidenceForAnnotation] =
    useState<CaseEvidence | null>(null);
  const [annotationNote, setAnnotationNote] = useState('');
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);

  // Quote builder state
  const [quoteItems, setQuoteItems] = useState<
    Array<{
      type: QuotationItemType;
      description: string;
      partName: string;
      partSource: PartSource;
      quantity: number;
      unitPrice: number;
    }>
  >([
    {
      type: QuotationItemType.PART,
      description: 'OLED Display Replacement Assembly',
      partName: 'OEM Display Panel',
      partSource: PartSource.OEM,
      quantity: 1,
      unitPrice: 180,
    },
  ]);
  const [laborCost, setLaborCost] = useState(65);
  const [diagnosedIssue, setDiagnosedIssue] = useState('');
  const [proposedRepair, setProposedRepair] = useState('');
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [estimatedCompletionHours, setEstimatedCompletionHours] = useState(24);
  const [warrantyTerms, setWarrantyTerms] = useState('90 day parts and labor warranty');
  const [selectedQuoteEvidenceIds, setSelectedQuoteEvidenceIds] = useState<string[]>([]);

  // Repair step state
  const [stepTitle, setStepTitle] = useState('');
  const [stepDescription, setStepDescription] = useState('');
  const [stepPhotos, setStepPhotos] = useState<string[]>([]);

  // Verification state
  const [verificationItems, setVerificationItems] = useState<ChecklistItem[]>([]);

  // Fetch full case data
  const { data: repairCase, isLoading } = useQuery<CaseDetail>({
    queryKey: ['case', id],
    queryFn: () => apiGet<CaseDetail>(`/cases/${id}`),
    enabled: !!id,
  });

  React.useEffect(() => {
    const eligible = (repairCase?.evidence || []).filter(
      (item) =>
        ['INTAKE', 'DIAGNOSTIC'].includes(item.category) &&
        item.assetRole === 'ORIGINAL' &&
        item.malwareStatus === 'CLEAN' &&
        item.legacyUnverified === false &&
        !item.deletedAt,
    );
    setSelectedQuoteEvidenceIds((current) =>
      current.length
        ? current.filter((id) => eligible.some((item) => item.id === id))
        : eligible.map((item) => item.id),
    );
  }, [repairCase?.id, repairCase?.evidence]);

  // Fetch verification details
  const { data: verificationData } = useQuery<VerificationData>({
    queryKey: ['verification', id],
    queryFn: () => apiGet<VerificationData>(`/cases/${id}/verification`),
    enabled: !!id,
  });

  // Sync verification items when loaded
  React.useEffect(() => {
    if (verificationData) {
      if (verificationData.hasVerification) {
        setVerificationItems(verificationData.verification?.checklist ?? []);
      } else if (verificationData.defaultChecklist) {
        setVerificationItems(verificationData.defaultChecklist);
      }
    }
  }, [verificationData]);

  // Upload Evidence Mutation
  const uploadEvidenceMutation = useMutation({
    mutationFn: async ({
      file,
      category,
      purpose,
      description,
    }: {
      file: File;
      category: EvidenceCategory;
      purpose: EvidencePurpose;
      description?: string;
    }) => {
      const intent = await apiPost<
        {
          uploadId: string;
          evidenceId?: string;
          bucket?: string;
          objectPath?: string;
          uploadToken?: string;
          alreadyCompleted?: boolean;
        },
        Record<string, unknown>
      >(`/cases/${id}/evidence/upload-intents`, {
        category,
        purpose,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        description,
      });
      if (intent.alreadyCompleted) return { evidenceId: intent.evidenceId };
      if (!intent.bucket || !intent.objectPath || !intent.uploadToken)
        throw new Error('Upload intent is no longer available. Start a new upload.');
      const { error } = await getSupabaseStorageClient()
        .storage.from(intent.bucket)
        .uploadToSignedUrl(intent.objectPath, intent.uploadToken, file, {
          contentType: file.type,
          upsert: false,
        });
      if (error) throw new Error('The evidence file could not be uploaded. Try again.');
      return apiPost(`/cases/${id}/evidence/upload-intents/${intent.uploadId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
      setEvidenceDescription('');
    },
  });

  // Add Pin Annotation Mutation
  const addAnnotationMutation = useMutation({
    mutationFn: ({ evidenceId, data }: { evidenceId: string; data: EvidenceAnnotationInput }) =>
      api.post(`/cases/${id}/evidence/${evidenceId}/annotate`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
      setPendingPin(null);
      setAnnotationNote('');
    },
  });

  // Create Quotation Mutation
  const createQuotationMutation = useMutation({
    mutationFn: (quoteData: CreateQuotationInput) => api.post(`/cases/${id}/quotations`, quoteData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
    },
  });

  // Send Quotation to Customer Mutation
  const sendQuotationMutation = useMutation({
    mutationFn: (quoteId: string) => api.post(`/cases/${id}/quotations/${quoteId}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
    },
  });

  // Add Repair Step Mutation
  const addStepMutation = useMutation({
    mutationFn: (stepData: RepairStepInput) => api.post(`/cases/${id}/steps`, stepData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
      setStepTitle('');
      setStepDescription('');
      setStepPhotos([]);
    },
  });

  // Complete Step Mutation
  const completeStepMutation = useMutation({
    mutationFn: (stepId: string) =>
      api.patch(`/cases/${id}/steps/${stepId}`, { status: RepairStepStatus.COMPLETED }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
    },
  });

  // Submit Verification Mutation
  const submitVerificationMutation = useMutation({
    mutationFn: (data: { passed: boolean; checklist: ChecklistItem[]; notes?: string }) =>
      api.post(`/cases/${id}/verification`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
      queryClient.invalidateQueries({ queryKey: ['verification', id] });
    },
  });

  // Issue Certificate Mutation
  const issueCertificateMutation = useMutation({
    mutationFn: (data: CertificateInput) => api.post(`/cases/${id}/certificate`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', id] });
    },
  });

  // Preserve original bytes; the API issues a signed private-storage upload intent.
  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadEvidenceMutation.mutate({
      file,
      category: evidenceCategory,
      purpose: evidencePurpose,
      description: evidenceDescription || undefined,
    });
  };

  if (isLoading || !repairCase) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        Loading repair case workbench...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workbench Header */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <span className="font-mono text-lg font-bold text-primary">
                {repairCase.caseNumber}
              </span>
              <Badge variant="outline" className="text-xs uppercase font-mono">
                {repairCase.status.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {repairCase.priority} PRIORITY
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {repairCase.device?.make} {repairCase.device?.model}
            </h1>
            <p className="text-xs text-muted-foreground">
              Customer:{' '}
              <span className="font-semibold text-foreground">{repairCase.customerName}</span> (
              {repairCase.customerPhone}) • Created {formatDate(repairCase.createdAt)}
            </p>
          </div>

          <p className="max-w-xs text-xs text-muted-foreground" role="status">
            Customer authorization links are currently disabled. Quotations cannot be sent for approval until the authorization workflow is enabled.
          </p>
        </div>

        {/* Reported Problem Notice */}
        <div className="p-3 rounded-lg bg-muted/60 border text-xs">
          <span className="font-semibold text-foreground">Reported Symptoms: </span>
          <span className="text-muted-foreground">{repairCase.problemDescription}</span>
        </div>
      </div>

      {/* Proof Chain Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList
          aria-label="Repair case record sections"
          className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1.5 gap-1"
        >
          <TabsTrigger value="evidence" className="text-xs py-2">
            1. Diagnostic Evidence ({repairCase.evidence?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="quotation" className="text-xs py-2">
            2. Quotation ({repairCase.quotations?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="tracking" className="text-xs py-2">
            3. Repair Steps ({repairCase.steps?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="verification" className="text-xs py-2">
            4. Quality Verification
          </TabsTrigger>
          <TabsTrigger value="certificate" className="text-xs py-2">
            5. Digital Certificate
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DIAGNOSTIC EVIDENCE ENGINE */}
        <TabsContent value="evidence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Evidence Engine</CardTitle>
              <CardDescription>
                Capture photographic fault evidence and annotate defective traces, chips, or
                fractures.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload bar */}
              <div className="p-4 rounded-xl border bg-secondary/30 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Record New Evidence
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <Label htmlFor="evidence-category" className="text-xs mb-1 block">
                      Category
                    </Label>
                    <select
                      id="evidence-category"
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                      value={evidenceCategory}
                      onChange={(e) => setEvidenceCategory(e.target.value as EvidenceCategory)}
                    >
                      <option value={EvidenceCategory.DIAGNOSTIC}>
                        DIAGNOSTIC (Fault Discovery)
                      </option>
                      <option value={EvidenceCategory.INTAKE}>
                        INTAKE (Pre-existing Condition)
                      </option>
                      <option value={EvidenceCategory.DURING_REPAIR}>
                        DURING REPAIR (Board level / Soldering)
                      </option>
                      <option value={EvidenceCategory.POST_REPAIR}>
                        POST REPAIR (Clean Reassembly)
                      </option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="evidence-purpose" className="text-xs mb-1 block">
                      Evidence purpose
                    </Label>
                    <select
                      id="evidence-purpose"
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                      value={evidencePurpose}
                      onChange={(e) => setEvidencePurpose(e.target.value as EvidencePurpose)}
                    >
                      <option value={EvidencePurpose.PHOTOGRAPH}>Photograph</option>
                      <option value={EvidencePurpose.INVOICE}>Invoice</option>
                      <option value={EvidencePurpose.DIAGNOSTIC_REPORT}>Diagnostic report</option>
                      <option value={EvidencePurpose.COMPONENT_DOCUMENTATION}>
                        Component documentation
                      </option>
                      <option value={EvidencePurpose.TEST_RESULT}>Test result</option>
                      <option value={EvidencePurpose.REPAIR_COMPLETION}>Repair completion</option>
                      <option value={EvidencePurpose.OTHER}>Other</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2">
                    <Label htmlFor="evidence-description" className="text-xs mb-1 block">
                      Observation Notes
                    </Label>
                    <Input
                      id="evidence-description"
                      placeholder="e.g. Blown backlight capacitor C401, liquid corrosion on power rail..."
                      value={evidenceDescription}
                      onChange={(e) => setEvidenceDescription(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <label htmlFor="case-evidence-upload" className="cursor-pointer">
                    <Button type="button" size="sm" asChild>
                      <span>
                        <Camera className="h-4 w-4 mr-1.5" /> Select & Upload Evidence
                      </span>
                    </Button>
                    <input
                      id="case-evidence-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,application/pdf"
                      className="hidden"
                      onChange={handleEvidenceUpload}
                    />
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Original bytes are retained in private storage. Uploads are limited to 25 MB and
                    gated by MIME and malware checks.
                  </span>
                </div>
              </div>

              {/* Evidence Gallery */}
              {repairCase.evidence?.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                  No diagnostic evidence captured yet. Add photo proof above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {repairCase.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-xl border overflow-hidden bg-card hover:border-primary/50 transition-all shadow-sm"
                    >
                      <div
                        className={`relative aspect-video bg-muted overflow-hidden group ${ev.fileUrl && ev.type === 'PHOTO' ? 'cursor-crosshair' : ''}`}
                        onClick={(e) => {
                          if (!ev.fileUrl || ev.type !== 'PHOTO') return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          setSelectedEvidenceForAnnotation(ev);
                          setPendingPin({ x: Math.round(x), y: Math.round(y) });
                        }}
                      >
                        {ev.fileUrl && ev.type === 'PHOTO' && (
                          <img
                            src={ev.fileUrl}
                            alt={ev.fileName}
                            className="w-full h-full object-contain"
                          />
                        )}
                        {ev.fileUrl && ev.type === 'VIDEO' && (
                          <video
                            src={ev.fileUrl}
                            controls
                            preload="metadata"
                            className="h-full w-full object-contain"
                          >
                            Video playback is not supported.
                          </video>
                        )}
                        {ev.fileUrl && ev.type === 'DOCUMENT' && (
                          <div className="grid h-full place-items-center">
                            <a
                              href={ev.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-primary underline"
                            >
                              Open {ev.fileName}
                            </a>
                          </div>
                        )}
                        {!ev.fileUrl && (
                          <div className="grid h-full place-items-center px-5 text-center text-xs text-muted-foreground">
                            File is private or awaiting a successful malware scan.
                          </div>
                        )}

                        {/* Existing Pins */}
                        {ev.annotations?.map((ann) => (
                          <div
                            key={ann.id}
                            style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group/pin"
                          >
                            <div className="h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs shadow-lg animate-pulse ring-2 ring-white">
                              <Pin className="h-3 w-3" />
                            </div>
                            <div className="absolute left-7 top-0 bg-black/90 text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap hidden group-hover/pin:block z-20">
                              {ann.note}
                            </div>
                          </div>
                        ))}

                        {ev.fileUrl && ev.type === 'PHOTO' && (
                          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                            Click photo to place pinpoint note
                          </div>
                        )}
                      </div>

                      <div className="p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">
                            {ev.category}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatDate(ev.capturedAt)}
                          </span>
                        </div>
                        <p className="font-medium text-foreground">
                          {ev.description || 'Diagnostic inspection record'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {ev.purpose} · {ev.assetRole} · scan: {ev.malwareStatus}
                        </p>
                        {ev.contentSha256 && (
                          <p className="break-all font-mono text-[9px] text-muted-foreground">
                            SHA-256 {ev.contentSha256}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          A matching hash supports byte integrity only; it does not prove the
                          content is authentic or truthful.
                        </p>

                        {ev.annotations?.length > 0 && (
                          <div className="mt-2 pt-2 border-t space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                              Defect Pinpoints ({ev.annotations.length})
                            </p>
                            {ev.annotations.map((ann) => (
                              <p
                                key={ann.id}
                                className="text-[11px] text-foreground flex items-center"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5" />
                                {ann.note}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pin Annotation Modal Dialog */}
              {pendingPin && selectedEvidenceForAnnotation && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
                    <h3 className="font-bold text-base">Add Defect Pinpoint Note</h3>
                    <p className="text-xs text-muted-foreground">
                      Coordinates: ({pendingPin.x}%, {pendingPin.y}%) on evidence photo.
                    </p>
                    <Input
                      placeholder="e.g. Solder bridge on IC U201, burnt diode, hairline glass crack..."
                      value={annotationNote}
                      onChange={(e) => setAnnotationNote(e.target.value)}
                      autoFocus
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPendingPin(null);
                          setAnnotationNote('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!annotationNote.trim()}
                        onClick={() =>
                          addAnnotationMutation.mutate({
                            evidenceId: selectedEvidenceForAnnotation.id,
                            data: {
                              x: pendingPin.x,
                              y: pendingPin.y,
                              note: annotationNote.trim(),
                            },
                          })
                        }
                      >
                        Pin Note to Evidence
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: QUOTATION SYSTEM */}
        <TabsContent value="quotation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Repair Quotation System</CardTitle>
              <CardDescription>
                Build an itemized, transparent parts and labor quotation. Customer receives a
                verifiable sign-off link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Quotes */}
              {repairCase.quotations?.length > 0 && (
                <div className="space-y-3 pb-6 border-b">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Quotation History
                  </h4>
                  {repairCase.quotations.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm">Version {q.version}</span>
                          <Badge
                            variant={
                              q.status === 'APPROVED'
                                ? 'success'
                                : q.status === 'REJECTED'
                                  ? 'destructive'
                                  : q.status === 'SENT'
                                    ? 'warning'
                                    : 'secondary'
                            }
                          >
                            {q.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            Valid until {formatDate(q.validUntil)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {q.items?.length} items • Parts: {formatCurrency(Number(q.partsCost))} •
                          Labor: {formatCurrency(Number(q.laborCost))}
                        </p>
                        {q.diagnosedIssue && (
                          <p className="max-w-2xl text-xs">
                            <span className="font-medium">Diagnosed:</span> {q.diagnosedIssue}{' '}
                            <span className="font-medium">Proposed:</span> {q.proposedRepair}
                          </p>
                        )}
                        {q.changeRequests?.map((request) => (
                          <p key={request.id} className="text-xs text-primary">
                            Customer requested: {request.requestText} ·{' '}
                            {request.status.toLowerCase()}
                          </p>
                        ))}
                        {q.customerResponseNote && (
                          <p className="text-xs italic text-foreground pt-1">
                            Customer note: "{q.customerResponseNote}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Total Quote</p>
                          <p className="text-lg font-bold text-foreground">
                            {formatCurrency(Number(q.totalCost))}
                          </p>
                        </div>
                        {q.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            onClick={() => sendQuotationMutation.mutate(q.id)}
                            disabled={sendQuotationMutation.isPending}
                          >
                            <Send className="h-3.5 w-3.5 mr-1.5" /> Send to Customer
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Build New Quote */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Build New Quotation Version
                </h4>

                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor="quote-diagnosed-issue" className="text-xs">
                        Diagnosed issue
                      </Label>
                      <textarea
                        id="quote-diagnosed-issue"
                        value={diagnosedIssue}
                        onChange={(event) => setDiagnosedIssue(event.target.value)}
                        maxLength={3000}
                        className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
                        placeholder="Record the confirmed fault"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quote-proposed-repair" className="text-xs">
                        Proposed repair
                      </Label>
                      <textarea
                        id="quote-proposed-repair"
                        value={proposedRepair}
                        onChange={(event) => setProposedRepair(event.target.value)}
                        maxLength={3000}
                        className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
                        placeholder="Describe the work covered by this version"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label htmlFor="quote-additional" className="text-xs">
                        Additional charges
                      </Label>
                      <Input
                        id="quote-additional"
                        type="number"
                        min="0"
                        step="0.01"
                        value={additionalCharges}
                        onChange={(event) => setAdditionalCharges(Number(event.target.value))}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quote-tax-percent" className="text-xs">
                        Tax rate (%)
                      </Label>
                      <Input
                        id="quote-tax-percent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={taxPercent}
                        onChange={(event) => setTaxPercent(Number(event.target.value))}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quote-completion-hours" className="text-xs">
                        Estimated completion (hours)
                      </Label>
                      <Input
                        id="quote-completion-hours"
                        type="number"
                        min="1"
                        max="8760"
                        value={estimatedCompletionHours}
                        onChange={(event) =>
                          setEstimatedCompletionHours(Number(event.target.value))
                        }
                        className="mt-1 h-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="quote-warranty" className="text-xs">
                      Warranty terms
                    </Label>
                    <textarea
                      id="quote-warranty"
                      value={warrantyTerms}
                      onChange={(event) => setWarrantyTerms(event.target.value)}
                      maxLength={2000}
                      className="mt-1 min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm"
                    />
                  </div>
                  <fieldset className="rounded-lg border p-3">
                    <legend className="px-1 text-xs font-semibold">
                      Supporting evidence (select at least one)
                    </legend>
                    {(repairCase.evidence || []).filter(
                      (item) => ['INTAKE', 'DIAGNOSTIC'].includes(item.category) && !item.deletedAt,
                    ).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Upload intake or diagnostic evidence before creating this quotation.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(repairCase.evidence || [])
                          .filter(
                            (item) =>
                              ['INTAKE', 'DIAGNOSTIC'].includes(item.category) && !item.deletedAt,
                          )
                          .map((item) => (
                            <label
                              key={item.id}
                              className="flex min-h-11 items-center gap-2 rounded-md border p-2 text-xs"
                            >
                              <input
                                type="checkbox"
                                aria-label={`Attach ${item.fileName || item.description || 'evidence'} to quotation`}
                                checked={selectedQuoteEvidenceIds.includes(item.id)}
                                onChange={(event) =>
                                  setSelectedQuoteEvidenceIds((current) =>
                                    event.target.checked
                                      ? [...current, item.id]
                                      : current.filter((id) => id !== item.id),
                                  )
                                }
                              />
                              <span className="truncate">
                                {item.fileName || item.description || item.id}
                              </span>
                              <span className="ml-auto text-muted-foreground">{item.category}</span>
                            </label>
                          ))}
                      </div>
                    )}
                  </fieldset>
                  {quoteItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border bg-muted/40 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs"
                    >
                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Item description (e.g. Display Assembly)"
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...quoteItems];
                            updated[idx]!.description = e.target.value;
                            setQuoteItems(updated);
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <select
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={item.partSource}
                          onChange={(e) => {
                            const updated = [...quoteItems];
                            updated[idx]!.partSource = e.target.value as PartSource;
                            setQuoteItems(updated);
                          }}
                        >
                          <option value={PartSource.OEM}>OEM Original</option>
                          <option value={PartSource.AFTERMARKET}>Premium Aftermarket</option>
                          <option value={PartSource.REFURBISHED}>Refurbished</option>
                          <option value={PartSource.CUSTOMER_PROVIDED}>Customer Provided</option>
                        </select>
                      </div>
                      <div>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...quoteItems];
                            updated[idx]!.quantity = Number(e.target.value);
                            setQuoteItems(updated);
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Unit Price $"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const updated = [...quoteItems];
                            updated[idx]!.unitPrice = Number(e.target.value);
                            setQuoteItems(updated);
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          ${(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                        {quoteItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== idx))}
                            className="text-destructive hover:opacity-80"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuoteItems([
                        ...quoteItems,
                        {
                          type: QuotationItemType.PART,
                          description: '',
                          partName: '',
                          partSource: PartSource.OEM,
                          quantity: 1,
                          unitPrice: 0,
                        },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Component Line
                  </Button>
                </div>

                {/* Labor and Subtotal */}
                <div className="p-4 rounded-xl border bg-secondary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <Label htmlFor="labor" className="text-xs">
                      Labor Fee ($):
                    </Label>
                    <Input
                      id="labor"
                      type="number"
                      min="0"
                      value={laborCost}
                      onChange={(e) => setLaborCost(Number(e.target.value))}
                      className="w-28 h-9 text-xs"
                    />
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-muted-foreground mr-3">Calculated Total:</span>
                    <span className="text-xl font-bold text-foreground">
                      $
                      {(
                        (quoteItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0) +
                          laborCost +
                          additionalCharges) *
                        (1 + taxPercent / 100)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <Button
                    disabled={
                      createQuotationMutation.isPending ||
                      !diagnosedIssue.trim() ||
                      !proposedRepair.trim() ||
                      !warrantyTerms.trim() ||
                      estimatedCompletionHours < 1 ||
                      selectedQuoteEvidenceIds.length === 0
                    }
                    onClick={() =>
                      createQuotationMutation.mutate({
                        diagnosedIssue,
                        proposedRepair,
                        items: quoteItems,
                        laborCost,
                        additionalCharges,
                        taxRate: taxPercent / 100,
                        estimatedCompletionHours,
                        warrantyTerms,
                        supportingEvidenceIds: selectedQuoteEvidenceIds,
                        validDays: 7,
                      })
                    }
                  >
                    Save & Generate Quotation Draft
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: REPAIR EXECUTION TRACKING */}
        <TabsContent value="tracking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step-by-Step Repair Execution Tracking</CardTitle>
              <CardDescription>
                Maintain a progressive audit trail of assembly steps, heat curves, microscopic
                soldering, and parts fitted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Steps Timeline */}
              {repairCase.steps?.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                  No repair execution steps logged yet. Start recording your work below.
                </div>
              ) : (
                <div className="space-y-4">
                  {repairCase.steps.map((st) => (
                    <div
                      key={st.id}
                      className="p-4 rounded-xl border bg-card flex flex-col md:flex-row md:items-start justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                            {st.stepNumber}
                          </span>
                          <h4 className="font-semibold text-sm">{st.title}</h4>
                          <Badge
                            variant={st.status === 'COMPLETED' ? 'success' : 'secondary'}
                            className="text-[10px]"
                          >
                            {st.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{st.description}</p>

                        {st.photos && st.photos.length > 0 && (
                          <div className="flex items-center space-x-2 pt-2">
                            {st.photos.map((ph: string, i: number) => (
                              <img
                                key={i}
                                src={ph}
                                alt="Step proof"
                                className="h-14 w-14 rounded-lg object-cover border"
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {st.status !== 'COMPLETED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => completeStepMutation.mutate(st.id)}
                          className="shrink-0"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Mark Step
                          Complete
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Step Form */}
              <div className="p-4 rounded-xl border bg-secondary/30 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Log Next Repair Step
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="step-title" className="text-xs mb-1 block">
                      Step Title *
                    </Label>
                    <Input
                      id="step-title"
                      placeholder="e.g. Micro-soldering charging port FPC connector"
                      value={stepTitle}
                      onChange={(e) => setStepTitle(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div>
                    <Label htmlFor="step-description" className="text-xs mb-1 block">
                      Technical Description *
                    </Label>
                    <textarea
                      id="step-description"
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                      placeholder="Describe technical procedure (e.g., applied lead-free solder paste at 350°C, verified continuity under microscope)..."
                      value={stepDescription}
                      onChange={(e) => setStepDescription(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={
                        !stepTitle.trim() || !stepDescription.trim() || addStepMutation.isPending
                      }
                      onClick={() =>
                        addStepMutation.mutate({
                          title: stepTitle.trim(),
                          description: stepDescription.trim(),
                          photos: stepPhotos,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Log Repair Step
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: QUALITY VERIFICATION */}
        <TabsContent value="verification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Post-Repair Verification Checklist</CardTitle>
              <CardDescription>
                Systematic functional checks tailored for {repairCase.device?.category}. All
                consequential hardware subsystems must be certified.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {verificationItems.map((item, idx) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setVerificationItems((current) =>
                        current.map((check, index) =>
                          index === idx ? { ...check, passed: !check.passed } : check,
                        ),
                      );
                    }}
                    aria-pressed={item.passed}
                    className={`w-full min-h-11 p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      item.passed
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-border bg-card hover:bg-muted/30'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">
                        {item.category}
                      </span>
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    </div>

                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center ${
                        item.passed
                          ? 'bg-emerald-600 text-white'
                          : 'border-2 border-muted-foreground/30 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold">Verification Score: </span>
                  <span className="text-sm font-bold text-foreground">
                    {verificationItems.filter((i) => i.passed).length} / {verificationItems.length}{' '}
                    Subsystems Passed
                  </span>
                </div>

                <Button
                  disabled={submitVerificationMutation.isPending}
                  onClick={() =>
                    submitVerificationMutation.mutate({
                      passed: verificationItems.every((i) => i.passed),
                      checklist: verificationItems,
                      notes: 'Comprehensive diagnostic sweep completed in workshop.',
                    })
                  }
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Save Quality Verification Sweep
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: DIGITAL REPAIR CERTIFICATE */}
        <TabsContent value="certificate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Digital Repair Certificate & Passport</CardTitle>
              <CardDescription>
                Cryptographic, immutable certificate verifiable globally via QR code or public
                registry.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {repairCase.certificate ? (
                <div className="rounded-2xl border-2 border-primary/30 bg-card p-6 md:p-8 space-y-6 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ShieldCheck className="h-64 w-64" />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="h-6 w-6 text-emerald-600" />
                        <span className="text-base font-bold uppercase tracking-wider text-foreground">
                          Official Certificate of Verified Repair
                        </span>
                      </div>
                      <p className="font-mono text-sm text-primary font-bold">
                        {repairCase.certificate.certificateNumber}
                      </p>
                    </div>

                    <Badge variant="success" className="text-xs px-3 py-1 font-mono uppercase">
                      Guaranteed • {repairCase.certificate.warrantyPeriodMonths} Months Warranty
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="space-y-3 text-xs md:col-span-2">
                      <div>
                        <span className="text-muted-foreground">Certified Device: </span>
                        <span className="font-bold text-foreground">
                          {repairCase.device?.make} {repairCase.device?.model}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Device Identifiers: </span>
                        <span className="font-mono text-foreground">
                          {repairCase.device?.serialNumber
                            ? `S/N: ${repairCase.device.serialNumber}`
                            : ''}{' '}
                          {repairCase.device?.imei ? `IMEI: ${repairCase.device.imei}` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Warranty Terms: </span>
                        <span className="text-foreground">
                          {repairCase.certificate.warrantyTerms}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Issued: </span>
                        <span className="font-mono text-foreground">
                          {formatDate(repairCase.certificate.issuedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border shadow-sm">
                      <img
                        src={repairCase.certificate.qrCodeUrl}
                        alt="Verification QR"
                        className="h-36 w-36"
                      />
                      <span className="text-[10px] text-slate-500 font-mono mt-2">
                        Scan to verify authenticity
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/verify/${repairCase.certificate.certificateNumber}`}
                        target="_blank"
                      >
                        <ExternalLink className="h-4 w-4 mr-1.5" /> Open Public Verification Page
                      </Link>
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                      Tamper-evident record sealed in RepairProof ledger.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-dashed text-center space-y-4">
                  <FileBadge2 className="h-12 w-12 text-muted-foreground/50 mx-auto" />
                  <div>
                    <h4 className="font-semibold text-base">Certificate Not Issued Yet</h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                      Complete all quality verification checklist items above before sealing and
                      issuing the official customer certificate.
                    </p>
                  </div>

                  <Button
                    disabled={
                      !repairCase.verification?.passed || issueCertificateMutation.isPending
                    }
                    onClick={() =>
                      issueCertificateMutation.mutate({
                        warrantyPeriodMonths: 3,
                        warrantyTerms:
                          'Full replacement guarantee on fitted parts and repair labor for 90 days against mechanical or electrical defects.',
                      })
                    }
                  >
                    <ShieldCheck className="h-4 w-4 mr-1.5" /> Seal & Issue Digital Certificate
                  </Button>

                  {!repairCase.verification?.passed && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      ⚠️ Requires passing post-repair verification in Tab 4.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
