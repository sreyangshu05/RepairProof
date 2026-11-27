import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CertificateService } from '../src/modules/certificate/certificate.service';

describe('CertificateService', () => {
  it('does not publicly verify a legacy certificate without independent verification', async () => {
    const prisma: any = {
      certificate: {
        findUnique: jest.fn().mockResolvedValue({
          certificateNumber: 'CERT-LEGACY',
          repairCase: {
            status: 'AWAITING_VERIFICATION',
            technicianId: 'tech-1',
            verification: null,
          },
        }),
      },
    };
    const service = new CertificateService(prisma, { get: jest.fn() } as any);
    await expect(service.verifyCertificate('CERT-LEGACY')).rejects.toThrow(NotFoundException);
  });

  it('refuses issuance unless verification and all recorded tests passed', async () => {
    const prisma: any = {
      repairCase: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'case-1',
          status: 'COMPLETED',
          technician: { id: 'tech-1' },
          verification: { passed: true, verifiedById: 'verifier-1' },
          certificate: null,
          testResults: [{ id: 'test-1', name: 'Display', passed: false }],
        }),
      },
      $transaction: jest.fn(),
    };
    const config: any = { get: jest.fn(() => 'https://repairproof.example') };
    const service = new CertificateService(prisma, config);
    await expect(service.issueCertificate('case-1', 'shop-1', 'profile-1', {})).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
