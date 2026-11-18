import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IssueCertificateDto } from './certificate.dto';
import { CaseStatus } from '@repairproof/shared';
import * as QRCode from 'qrcode';

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private generateCertificateNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `CERT-RP-${date}-${rand}`;
  }

  async issueCertificate(caseId: string, issuedById: string, dto: IssueCertificateDto) {
    const repairCase = await this.prisma.repairCase.findUnique({
      where: { id: caseId },
      include: {
        verification: true,
        certificate: true,
      },
    });

    if (!repairCase) {
      throw new NotFoundException(`Repair case with ID ${caseId} not found`);
    }

    if (!repairCase.verification || !repairCase.verification.passed) {
      throw new BadRequestException(
        'Cannot issue digital certificate: Post-repair verification has not been completed and passed.',
      );
    }

    if (repairCase.certificate) {
      return repairCase.certificate;
    }

    const certificateNumber = this.generateCertificateNumber();
    const frontendBaseUrl =
      this.configService.get<string>('VITE_APP_URL') ||
      this.configService.get<string>('CERTIFICATE_BASE_URL') ||
      'http://localhost:5173';

    const verificationUrl = `${frontendBaseUrl}/verify/${certificateNumber}`;
    const qrCodeUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 256,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });

    const [certificate] = await this.prisma.$transaction([
      this.prisma.certificate.create({
        data: {
          caseId,
          certificateNumber,
          verificationUrl,
          qrCodeUrl,
          warrantyPeriodMonths: dto.warrantyPeriodMonths || 3,
          warrantyTerms:
            dto.warrantyTerms ||
            'Standard RepairProof guarantee covers parts replaced and labor against defects for the duration specified.',
          issuedById,
        },
      }),
      this.prisma.repairCase.update({
        where: { id: caseId },
        data: {
          status: CaseStatus.CERTIFIED,
          closedAt: new Date(),
        },
      }),
    ]);

    return certificate;
  }

  async verifyCertificate(certificateNumber: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { certificateNumber },
      include: {
        issuedBy: {
          select: {
            displayName: true,
            role: true,
          },
        },
        repairCase: {
          include: {
            device: true,
            shop: {
              select: {
                name: true,
                address: true,
                phone: true,
                email: true,
                logoUrl: true,
              },
            },
            evidence: {
              where: { deletedAt: null },
              include: { annotations: true },
            },
            steps: {
              where: { deletedAt: null },
              orderBy: { stepNumber: 'asc' },
            },
            quotations: {
              where: { status: 'APPROVED' },
              include: { items: true },
              orderBy: { version: 'desc' },
              take: 1,
            },
            verification: {
              include: {
                verifiedBy: { select: { displayName: true } },
              },
            },
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundException(`Certificate ${certificateNumber} was not found or is invalid`);
    }

    return certificate;
  }
}
