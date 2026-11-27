import { randomUUID } from 'crypto';
import { DeviceCategory, UserRole } from '@repairproof/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { CaseService } from '../src/modules/case/case.service';
import { DiagnosticsService } from '../src/modules/diagnostics/diagnostics.service';
import { QuotationService } from '../src/modules/quotation/quotation.service';
import { AuthorizationService } from '../src/modules/authorization/authorization.service';
import { TrackingService } from '../src/modules/tracking/tracking.service';
import { ComponentsService } from '../src/modules/components/components.service';
import { TestResultsService } from '../src/modules/test-results/test-results.service';
import { VerificationService } from '../src/modules/verification/verification.service';
import { CertificateService } from '../src/modules/certificate/certificate.service';
import { WarrantiesService } from '../src/modules/warranties/warranties.service';
import { EvidenceService } from '../src/modules/evidence/evidence.service';
import { RepairLifecycleService } from '../src/modules/case/repair-lifecycle.service';
import { ObjectStorageService } from '../src/modules/evidence/object-storage.service';
import { ClamAvMalwareScanner } from '../src/modules/evidence/clamav-malware-scanner.service';
import { ConfigService } from '@nestjs/config';

const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
const integrationTest = integrationEnabled ? it : it.skip;

describe('Repair workflow database integration', () => {
  let prisma: PrismaService;
  let shopId: string;
  let profileId: string;
  let verifierProfileId: string;
  let deviceId: string;
  let caseId: string | undefined;
  let componentId: string | undefined;
  let evidenceService: EvidenceService;

  beforeAll(async () => {
    if (!integrationEnabled) return;
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
    prisma = new PrismaService();
    await prisma.$connect();
    const storage = {
      createDownload: async (path: string) =>
        `https://evidence.example.invalid/${encodeURIComponent(path)}`,
    };
    evidenceService = new EvidenceService(
      prisma,
      storage as unknown as ObjectStorageService,
      {} as ClamAvMalwareScanner,
      {} as ConfigService,
    );
    const suffix = randomUUID();
    const shop = await prisma.shop.create({
      data: { name: `Integration ${suffix}`, ownerId: suffix },
    });
    shopId = shop.id;
    const profile = await prisma.profile.create({
      data: {
        userId: suffix,
        email: `${suffix}@integration.invalid`,
        displayName: 'Integration Technician',
        role: UserRole.SHOP_OWNER,
        shopId,
      },
    });
    profileId = profile.id;
    await prisma.organizationMembership.create({
      data: { shopId, profileId, role: UserRole.SHOP_OWNER },
    });
    const verifier = await prisma.profile.create({
      data: {
        userId: `${suffix}-verifier`,
        email: `${suffix}-verifier@integration.invalid`,
        displayName: 'Independent Verifier',
        role: UserRole.TECHNICIAN,
        shopId,
      },
    });
    verifierProfileId = verifier.id;
    await prisma.organizationMembership.create({
      data: { shopId, profileId: verifierProfileId, role: UserRole.TECHNICIAN },
    });
    const device = await prisma.device.create({
      data: {
        shopId,
        registeredById: profileId,
        category: DeviceCategory.SMARTPHONE,
        make: 'Fixture',
        model: 'Test handset',
        intakeCondition: 'Integration fixture',
      },
    });
    deviceId = device.id;
  });

  afterAll(async () => {
    if (!integrationEnabled || !prisma) return;
    if (caseId) {
      await prisma.quotationEvidence.deleteMany({ where: { quotation: { caseId } } });
      await prisma.quotationChangeRequest.deleteMany({ where: { caseId } });
      await prisma.evidenceUploadIntent.deleteMany({ where: { caseId } });
      await prisma.componentReplacement.deleteMany({ where: { caseId } });
      await prisma.testResult.deleteMany({ where: { caseId } });
      await prisma.evidence.deleteMany({ where: { caseId } });
      await prisma.quotationItem.deleteMany({ where: { quotation: { caseId } } });
      await prisma.approval.deleteMany({ where: { quotation: { caseId } } });
      await prisma.quotation.deleteMany({ where: { caseId } });
      await prisma.warranty.deleteMany({ where: { caseId } });
      await prisma.verificationAttempt.deleteMany({ where: { caseId } });
      await prisma.repairCaseTransition.deleteMany({ where: { caseId } });
      await prisma.repairCase.deleteMany({ where: { id: caseId } });
    }
    if (componentId) await prisma.component.deleteMany({ where: { id: componentId } });
    await prisma.auditEvent.deleteMany({ where: { shopId } });
    await prisma.device.deleteMany({ where: { id: deviceId } });
    await prisma.organizationMembership.deleteMany({ where: { shopId } });
    await prisma.profile.deleteMany({ where: { id: verifierProfileId } });
    await prisma.profile.deleteMany({ where: { id: profileId } });
    await prisma.shop.deleteMany({ where: { id: shopId } });
    await prisma.$disconnect();
  });

  integrationTest('persists a complete, tenant-scoped repair lifecycle atomically', async () => {
    const lifecycle = new RepairLifecycleService();
    const cases = new CaseService(prisma, lifecycle, evidenceService);
    const created = await cases.create(
      shopId,
      profileId,
      {
        deviceId,
        customerName: 'Test Customer',
        customerPhone: '+15555550123',
        problemDescription: 'Integration test intake',
        priority: 'NORMAL' as any,
      },
      'SHOP_OWNER',
    );
    caseId = created.id;

    await cases.updateStatus(caseId, shopId, profileId, 'SHOP_OWNER', 'submit-case', {
      status: 'SUBMITTED' as any,
    });
    const diagnostics = new DiagnosticsService(prisma, lifecycle);
    await diagnostics.create(
      caseId,
      shopId,
      profileId,
      { findings: { issue: 'cracked display' }, severity: 'HIGH' },
      'SHOP_OWNER',
    );
    await diagnostics.complete(caseId, shopId, profileId, 'SHOP_OWNER', 'diagnosis-complete');
    const quoteEvidence = await prisma.evidence.create({
      data: {
        caseId,
        capturedById: profileId,
        category: 'DIAGNOSTIC',
        type: 'PHOTO',
        fileUrl: null,
        fileName: 'diagnostic.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
        verifiedMimeType: 'image/jpeg',
        description: 'Cracked display intake evidence',
        purpose: 'PHOTOGRAPH',
        assetRole: 'ORIGINAL',
        legacyUnverified: false,
        malwareStatus: 'CLEAN',
        malwareScannedAt: new Date(),
        storagePath: `integration/${randomUUID()}/diagnostic.jpg`,
        contentSha256: 'b'.repeat(64),
      },
    });
    const quotes = new QuotationService(
      prisma,
      lifecycle,
      { get: (key: string) => key === 'CUSTOMER_AUTHORIZATION_ENABLED' ? 'true' : 'https://repairproof.invalid' } as any,
      evidenceService,
    );
    const quote = await quotes.create(caseId, shopId, profileId, 'SHOP_OWNER', 'quote-create', {
      diagnosedIssue: 'Display is cracked and touch response is intermittent',
      proposedRepair: 'Replace the display and verify touch response',
      items: [
        {
          type: 'PART' as any,
          description: 'Replacement display',
          partName: 'Display',
          partSource: 'OEM' as any,
          quantity: 1,
          unitPrice: 90,
        },
      ],
      laborCost: 35,
      additionalCharges: 5,
      taxRate: 0.1,
      estimatedCompletionHours: 48,
      warrantyTerms: '90 day parts and labor warranty',
      supportingEvidenceIds: [quoteEvidence.id],
      currency: 'USD',
      validDays: 7,
    });
    await quotes.sendToCustomer(caseId, shopId, profileId, 'SHOP_OWNER', quote.id, 'quote-send');
    // The service intentionally no longer returns bearer tokens to application callers.
    // Integration setup reads it directly from the test database to exercise the customer action.
    const { authorizationToken } = await prisma.repairCase.findUniqueOrThrow({
      where: { id: caseId },
      select: { authorizationToken: true },
    });
    await new AuthorizationService(prisma, lifecycle, evidenceService).respondToQuotation(
      authorizationToken,
      'customer-approval',
      { approved: true, customerSignatureName: 'Test Customer' },
    );
    const tracking = new TrackingService(prisma, lifecycle);
    const step = await tracking.addStep(caseId, shopId, profileId, 'SHOP_OWNER', 'repair-step', {
      title: 'Replace display',
      description: 'Install and seat the display panel',
    });
    await tracking.updateStep(caseId, step.id, shopId, profileId, 'SHOP_OWNER', { status: 'COMPLETED' as any });

    const components = new ComponentsService(prisma);
    const component = await components.create(shopId, profileId, {
      name: 'OEM display',
      source: 'OEM' as any,
      quantityOnHand: 2,
      reorderThreshold: 1,
      unitCost: 90,
    });
    componentId = component.id;
    await components.replace(caseId, shopId, profileId, 'SHOP_OWNER', { componentId, quantity: 1 });
    const stock = await prisma.component.findUniqueOrThrow({ where: { id: componentId } });
    expect(stock.quantityOnHand).toBe(1);

    await new TestResultsService(prisma).create(caseId, shopId, profileId, 'SHOP_OWNER', {
      name: 'Display and touch response',
      passed: true,
      details: { display: true, touch: true },
    });
    await prisma.evidence.create({
      data: {
        caseId,
        capturedById: profileId,
        category: 'POST_REPAIR',
        type: 'PHOTO',
        fileUrl: null,
        fileName: 'post-repair.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
        verifiedMimeType: 'image/jpeg',
        purpose: 'REPAIR_COMPLETION',
        assetRole: 'ORIGINAL',
        legacyUnverified: false,
        storagePath: `integration/${randomUUID()}/post-repair.jpg`,
        contentSha256: 'a'.repeat(64),
        malwareStatus: 'CLEAN',
        malwareScannedAt: new Date(),
      },
    });
    await cases.updateStatus(caseId, shopId, profileId, 'SHOP_OWNER', 'request-verification', {
      status: 'AWAITING_VERIFICATION' as any,
    });
    const verificationService = new VerificationService(prisma, lifecycle);
    const verification = await verificationService.submitVerification(
      caseId,
      shopId,
      verifierProfileId,
      'TECHNICIAN',
      'verification-result',
      {
        passed: true,
        checklist: verificationService
          .getDefaultChecklist('SMARTPHONE')
          .map((item) => ({ ...item, passed: true })),
      },
    );
    expect(verification.passed).toBe(true);
    const certificate = await new CertificateService(prisma, {
      get: () => 'https://repairproof.invalid',
    } as any).issueCertificate(caseId, shopId, profileId, { warrantyPeriodMonths: 3 });
    expect(certificate.certificateNumber).toMatch(/^CERT-RP-/);
    const warranties = await new WarrantiesService(prisma).list(shopId);
    expect(warranties).toHaveLength(1);
    expect(warranties[0].caseId).toBe(caseId);

    expect((await prisma.repairCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe(
      'COMPLETED',
    );
    expect(await prisma.auditEvent.count({ where: { shopId } })).toBeGreaterThanOrEqual(6);
  });
});
