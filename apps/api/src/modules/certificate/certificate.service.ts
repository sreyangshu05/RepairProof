import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { CaseStatus } from '@repairproof/shared';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { IssueCertificateDto } from './certificate.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}
  private generateCertificateNumber() {
    return `CERT-RP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  async issueCertificate(
    caseId: string,
    shopId: string,
    issuedById: string,
    dto: IssueCertificateDto,
  ) {
    const repairCase = await this.prisma.repairCase.findFirst({
      where: { id: caseId, shopId, deletedAt: null },
      include: {
        verification: true,
        certificate: true,
        testResults: {
          select: { id: true, name: true, passed: true },
          orderBy: { testedAt: 'desc' },
        },
        technician: { select: { id: true } },
      },
    });
    if (!repairCase) throw new NotFoundException('Repair case not found');
    if (repairCase.certificate) return repairCase.certificate;
    if (
      repairCase.status !== CaseStatus.COMPLETED ||
      !repairCase.verification?.passed ||
      repairCase.verification.verifiedById === repairCase.technicianId
    )
      throw new BadRequestException(
        'Certificate requires a passing independent verification and a completed repair',
      );
    const latestTests = new Map<string, (typeof repairCase.testResults)[number]>();
    for (const result of repairCase.testResults)
      if (!latestTests.has(result.name)) latestTests.set(result.name, result);
    if (!latestTests.size || [...latestTests.values()].some((result) => !result.passed))
      throw new BadRequestException(
        'Certificate requires the latest result for every post-repair test to pass',
      );
    const frontendBaseUrl =
      this.configService.get<string>('CERTIFICATE_BASE_URL') ||
      this.configService.get<string>('VITE_APP_URL');
    if (!frontendBaseUrl && process.env.NODE_ENV === 'production')
      throw new ServiceUnavailableException('CERTIFICATE_BASE_URL is required in production');
    const url = `${(frontendBaseUrl || 'http://localhost:5173').replace(/\/$/, '')}/verify/${this.generateCertificateNumber()}`;
    const certificateNumber = new URL(url).pathname.split('/').pop()!;
    const qrCodeUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 256,
      color: { dark: '#1e293b', light: '#ffffff' },
    });
    const period = dto.warrantyPeriodMonths ?? 3;
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setUTCMonth(endsAt.getUTCMonth() + period);
    const terms =
      dto.warrantyTerms?.trim() ||
      'Covers the parts replaced and labor recorded on this certificate for the stated warranty period.';
    return this.prisma.$transaction(async (tx) => {
      const completionEvidence = await tx.evidence.findMany({
        where: {
          caseId,
          purpose: 'REPAIR_COMPLETION',
          assetRole: 'ORIGINAL',
          malwareStatus: 'CLEAN',
          legacyUnverified: false,
          deletedAt: null,
          storagePath: { not: null },
        },
        select: { id: true },
      });
      if (!completionEvidence.length)
        throw new BadRequestException(
          'Certificate requires clean, original repair completion documentation',
        );
      const certificate = await tx.certificate.create({
        data: {
          caseId,
          certificateNumber,
          verificationUrl: url,
          qrCodeUrl,
          warrantyPeriodMonths: period,
          warrantyTerms: terms,
          issuedById,
        },
      });
      await tx.warranty.create({
        data: { caseId, certificateId: certificate.id, startsAt, endsAt, terms },
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId: issuedById,
          action: 'certificate.issued',
          entityType: 'Certificate',
          entityId: certificate.id,
          metadata: {
            caseId,
            certificateNumber,
            evidenceIds: completionEvidence.map((item) => item.id),
            legacyEvidenceCount: await tx.evidence.count({
              where: { caseId, legacyUnverified: true },
            }),
            integrityNotice:
              'Content hashes prove byte integrity only, not evidence authenticity or truth.',
          },
        },
      });
      if (repairCase.technicianId)
        await this.notifications?.enqueue(tx, {
          profileId: repairCase.technicianId,
          category: 'CASE_UPDATES',
          type: 'CERTIFICATE_ISSUED',
          title: 'Repair certificate issued',
          body: 'The verified repair record is ready to share with the customer.',
          deduplicationScope: `certificate:${certificate.id}:issued`,
          payload: { caseId, certificateId: certificate.id },
        });
      return certificate;
    });
  }

  async verifyCertificate(certificateNumber: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { certificateNumber },
      select: {
        certificateNumber: true,
        verificationUrl: true,
        issuedAt: true,
        warrantyPeriodMonths: true,
        warrantyTerms: true,
        warranty: { select: { startsAt: true, endsAt: true, status: true } },
        repairCase: {
          select: {
            caseNumber: true,
            status: true,
            technicianId: true,
            device: { select: { make: true, model: true, category: true } },
            shop: { select: { name: true, address: true, phone: true, logoUrl: true } },
            steps: {
              where: { deletedAt: null },
              select: { title: true, completedAt: true },
              orderBy: { stepNumber: 'asc' },
            },
            testResults: {
              select: { name: true, passed: true, testedAt: true },
              orderBy: { testedAt: 'asc' },
            },
            verification: { select: { passed: true, verifiedAt: true, verifiedById: true, checklist: true } },
            quotations: {
              where: { status: 'APPROVED' },
              select: { currency: true, totalCost: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
            evidence: {
              where: { deletedAt: null },
              select: {
                id: true,
                purpose: true,
                assetRole: true,
                malwareStatus: true,
                contentSha256: true,
                legacyUnverified: true,
                integrityStatement: true,
                truthfulContentAttestedAt: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    if (!certificate) throw new NotFoundException('Certificate was not found or is invalid');
    const repairCase = certificate.repairCase;
    if (
      repairCase.status !== CaseStatus.COMPLETED ||
      !repairCase.verification?.passed ||
      repairCase.verification.verifiedById === repairCase.technicianId
    ) throw new NotFoundException('Certificate was not found or is invalid');
    void this.analytics?.recordAnonymousCertificateAccess(certificateNumber);
    return certificate;
  }
}
