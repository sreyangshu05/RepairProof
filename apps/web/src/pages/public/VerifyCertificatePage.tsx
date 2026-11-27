import { translateStatus, tx } from '../../i18n/catalog';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Search, CheckCircle2, Smartphone, Laptop, AlertCircle } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { Card, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { formatDate } from '../../lib/utils';

type PublicEvidence = {
  id: string;
  purpose: string;
  assetRole: string;
  malwareStatus: string;
  legacyUnverified: boolean;
  truthfulContentAttestedAt?: string | Date | null;
  contentSha256?: string | null;
};
type PublicCertificate = {
  certificateNumber: string;
  warrantyPeriodMonths: number;
  warrantyTerms?: string | null;
  issuedAt: string | Date;
  qrCodeUrl: string;
  repairCase?: {
    device?: {
      category?: string;
      make?: string;
      model?: string;
      serialNumber?: string | null;
      imei?: string | null;
    };
    shop?: { name?: string };
    quotations?: Array<{
      items?: Array<{
        id: string;
        description: string;
        partSource?: string | null;
        quantity: number;
      }>;
    }>;
    evidence?: PublicEvidence[];
  };
};

export const VerifyCertificatePage: React.FC = () => {
  const { formatNumber } = useI18n();
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState(certificateNumber || '');

  const {
    data: certificate,
    isLoading,
    error,
  } = useQuery<PublicCertificate>({
    queryKey: ['certificate', certificateNumber],
    queryFn: () => apiGet<PublicCertificate>(`/certificates/${certificateNumber}`),
    enabled: !!certificateNumber,
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/verify/${searchInput.trim()}`);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        {/* Verification Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" />
            <span>{tx('Public Verification Registry')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {tx('RepairProof Digital Passport ')}
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            {tx(
              'Verify the authenticity of electronics repair transactions, replacement component provenance, and warranty coverage. ',
            )}
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-md mx-auto flex gap-2 pt-2">
            <Input
              id="certificate-number"
              aria-label={tx('Certificate number')}
              placeholder={tx('Enter Certificate Number (e.g. CERT-RP-...)')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 text-xs font-mono"
            />
            <Button type="submit">
              <Search className="h-4 w-4 mr-1.5" /> {tx(' Verify ')}
            </Button>
          </form>
        </div>

        {/* Certificate Display */}
        {isLoading && certificateNumber ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <ShieldCheck className="h-10 w-10 text-primary mx-auto animate-pulse mb-2" />
            {tx('Verifying cryptographic proof on RepairProof ledger... ')}
          </div>
        ) : error ? (
          <Card className="max-w-md mx-auto text-center p-8">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <CardTitle>{tx('Certificate Not Found')}</CardTitle>
            <CardDescription className="mt-1">
              {tx('No verified repair record found for')} “{certificateNumber}”.{' '}
              {tx('Please verify the certificate code on your receipt or QR tag.')}
            </CardDescription>
          </Card>
        ) : certificate ? (
          <div className="space-y-6">
            {/* Certificate Header Banner */}
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-card p-6 md:p-8 shadow-lg relative overflow-hidden space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    <span className="text-sm sm:text-base font-bold tracking-wider uppercase text-foreground">
                      {tx('Verified Genuine Repair Certificate ')}
                    </span>
                  </div>
                  <p className="font-mono text-base font-bold text-primary">
                    {certificate.certificateNumber}
                  </p>
                </div>

                <Badge
                  variant="success"
                  className="text-xs px-3 py-1 font-mono uppercase self-start sm:self-auto"
                >
                  {formatNumber(certificate.warrantyPeriodMonths)} {tx('Months Active Warranty')}
                </Badge>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Device Info */}
                <div className="space-y-4 md:col-span-2 text-xs">
                  <div className="p-4 rounded-xl bg-muted/40 border space-y-2">
                    <h3 className="font-bold text-sm text-foreground flex items-center">
                      {certificate.repairCase?.device?.category === 'SMARTPHONE' ? (
                        <Smartphone className="h-4 w-4 mr-1.5 text-primary" />
                      ) : (
                        <Laptop className="h-4 w-4 mr-1.5 text-primary" />
                      )}
                      {certificate.repairCase?.device?.make} {certificate.repairCase?.device?.model}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground font-mono">
                      <span>
                        {tx('S/N: ')}
                        {certificate.repairCase?.device?.serialNumber || 'N/A'}
                      </span>
                      <span>IMEI: {certificate.repairCase?.device?.imei || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Certified Replacement Components */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      {tx('Certified Parts Fitted & Labor Performed ')}
                    </h4>
                    <div className="rounded-xl border divide-y overflow-hidden text-xs">
                      {certificate.repairCase?.quotations?.[0]?.items?.map((it) => (
                        <div key={it.id} className="p-3 flex items-center justify-between bg-card">
                          <div>
                            <p className="font-semibold text-foreground">{it.description}</p>
                            <span className="text-[10px] text-muted-foreground">
                              {tx('Grade:')}{' '}
                              <strong className="text-primary">{it.partSource || 'OEM'}</strong>
                              {' · '}
                              {tx('Qty:')} {formatNumber(it.quantity)}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {tx('Authenticated ')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                    <p className="font-semibold">{tx('Evidence integrity and authenticity')}</p>
                    <p className="mt-1 text-muted-foreground">
                      {tx(
                        'Evidence fingerprints, when present, show whether stored bytes match their recorded upload. They do not establish who made an image or document, when its scene occurred, or whether its content is truthful. Derived assets and legacy uploads are identified separately from scanned original files. ',
                      )}
                    </p>
                    {certificate.repairCase?.evidence?.map((item) => (
                      <p className="mt-2 text-[10px] text-muted-foreground" key={item.id}>
                        {item.purpose}
                        {' · '}
                        {item.assetRole}
                        {' · '}
                        {tx('Malware scan')} {translateStatus(item.malwareStatus)}
                        {' · '}
                        {item.legacyUnverified
                          ? tx('Legacy, unverified upload')
                          : item.truthfulContentAttestedAt
                            ? tx('Content attested by uploader')
                            : tx('No truthfulness attestation recorded')}
                        {item.contentSha256 ? ` · SHA-256 ${item.contentSha256}` : ''}
                      </p>
                    ))}
                  </div>

                  {/* Warranty Terms */}
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 text-xs">
                    <span className="font-bold text-emerald-900 dark:text-emerald-100">
                      {tx('Warranty Coverage:')}{' '}
                    </span>
                    <span className="text-emerald-800 dark:text-emerald-200">
                      {certificate.warrantyTerms}
                    </span>
                  </div>
                </div>

                {/* QR Code & Authority Sign-off */}
                <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-xl border text-center space-y-3">
                  <img
                    src={certificate.qrCodeUrl}
                    alt={tx('Certificate QR')}
                    className="h-40 w-40 rounded shadow-sm border p-1"
                  />
                  <div className="text-[11px] space-y-1">
                    <p className="font-semibold text-foreground">
                      {certificate.repairCase?.shop?.name || 'Certified Repair Center'}
                    </p>
                    <p className="text-muted-foreground font-mono">
                      {tx('Issued ')}
                      {formatDate(certificate.issuedAt)}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      <span aria-hidden="true">✓ </span>
                      {tx('Tamper-Resistant Seal')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {tx(
              'Enter a certificate number above or scan a RepairProof QR code on an electronic device to inspect its repair ledger. ',
            )}
          </div>
        )}
      </div>
    </main>
  );
};
