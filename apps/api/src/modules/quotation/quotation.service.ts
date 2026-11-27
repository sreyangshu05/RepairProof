import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, QuotationStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { CaseStatus } from '@repairproof/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuotationDto } from './quotation.dto';
import { RepairLifecycleService } from '../case/repair-lifecycle.service';
import { EvidenceService } from '../evidence/evidence.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: RepairLifecycleService,
    private readonly config: ConfigService,
    private readonly evidenceService: EvidenceService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly analytics?: AnalyticsService,
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {}

  async create(
    caseId: string,
    shopId: string,
    actorId: string,
    actorRole: string,
    idempotencyKey: string,
    dto: CreateQuotationDto,
  ) {
    const requestHash = this.lifecycle.hashRequest(dto);
    return this.prisma.$transaction(async (tx) => {
      const transitionInput = {
        caseId,
        shopId,
        actorId,
        actorRole,
        toState: CaseStatus.QUOTATION_PENDING,
        idempotencyKey,
        requestHash,
      };
      const replay = await this.lifecycle.findReplay(tx, transitionInput);
      if (replay) {
        const recordIds = replay.supportingRecords as string[];
        const existing = await tx.quotation.findFirst({
          where: { id: recordIds[0], caseId },
          include: { items: true },
        });
        if (!existing)
          throw new ConflictException('Idempotency record references a missing quotation');
        return existing;
      }
      const repairCase = await tx.repairCase.findFirst({
        where: { id: caseId, shopId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!repairCase) throw new NotFoundException('Repair case not found');
      if (
        repairCase.status !== CaseStatus.DIAGNOSIS_COMPLETED &&
        repairCase.status !== CaseStatus.REJECTED
      ) {
        throw new BadRequestException(
          'A completed diagnosis or rejected quotation is required before preparing a quotation',
        );
      }
      const diagnostic = await tx.diagnostic.findFirst({
        where: { caseId, status: 'SUBMITTED' },
        select: { id: true },
      });
      if (!diagnostic)
        throw new BadRequestException('Submit a diagnostic before preparing a quotation');

      const issue = dto.diagnosedIssue.trim();
      const proposedRepair = dto.proposedRepair.trim();
      const warrantyTerms = dto.warrantyTerms.trim();
      if (!issue || !proposedRepair || !warrantyTerms)
        throw new BadRequestException(
          'Issue, proposed repair, and warranty terms must contain text',
        );
      const evidenceIds = [...new Set(dto.supportingEvidenceIds)];
      if (evidenceIds.length !== dto.supportingEvidenceIds.length)
        throw new BadRequestException('Supporting evidence cannot contain duplicate files');
      const evidence = await tx.evidence.findMany({
        where: {
          id: { in: evidenceIds },
          caseId,
          deletedAt: null,
          assetRole: 'ORIGINAL',
          malwareStatus: 'CLEAN',
          legacyUnverified: false,
          storagePath: { not: null },
        },
        select: { id: true },
      });
      if (evidence.length !== evidenceIds.length)
        throw new BadRequestException(
          'Quotation attachments must be clean, managed original evidence from this repair case',
        );
      if (
        dto.items.some(
          (item) =>
            !item.description.trim() || (item.partName !== undefined && !item.partName.trim()),
        )
      ) {
        throw new BadRequestException(
          'Quotation item descriptions and provided part names must contain text',
        );
      }

      const statedLaborCost = new Prisma.Decimal(dto.laborCost).toDecimalPlaces(2);
      const taxRate = new Prisma.Decimal(dto.taxRate ?? 0);
      if (taxRate.lessThan(0) || taxRate.greaterThan(1))
        throw new BadRequestException('Tax rate must be between 0 and 1');
      const additionalCharges = new Prisma.Decimal(dto.additionalCharges ?? 0).toDecimalPlaces(2);
      const itemsData = dto.items.map((item) => ({
        type: item.type,
        description: item.description.trim(),
        partName: item.partName?.trim(),
        partSource: item.partSource,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice).toDecimalPlaces(2),
        totalPrice: new Prisma.Decimal(item.unitPrice).mul(item.quantity).toDecimalPlaces(2),
      }));
      const partsCost = itemsData.reduce(
        (sum, item) => (item.type === 'PART' ? sum.add(item.totalPrice) : sum),
        new Prisma.Decimal(0),
      );
      const itemLaborCost = itemsData.reduce(
        (sum, item) => (item.type === 'LABOR' ? sum.add(item.totalPrice) : sum),
        new Prisma.Decimal(0),
      );
      const laborCost = statedLaborCost.add(itemLaborCost).toDecimalPlaces(2);
      const subtotal = partsCost.add(laborCost).add(additionalCharges).toDecimalPlaces(2);
      const taxAmount = subtotal.mul(taxRate).toDecimalPlaces(2);
      const totalCost = subtotal.add(taxAmount).toDecimalPlaces(2);
      const validUntil = new Date(Date.now() + (dto.validDays ?? 7) * 86_400_000);
      if (Number.isNaN(validUntil.getTime()))
        throw new BadRequestException('Quotation validity period is invalid');
      const latest = await tx.quotation.findFirst({
        where: { caseId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const openApproved = await tx.quotation.findFirst({
        where: { caseId, status: QuotationStatus.APPROVED },
        select: { id: true },
      });
      if (openApproved)
        throw new ConflictException(
          'An approved quotation is immutable; record a customer change request before preparing a new version',
        );
      const openDrafts = await tx.quotation.findMany({
        where: { caseId, status: QuotationStatus.DRAFT },
        select: { id: true },
      });
      if (openDrafts.length) {
        await tx.quotation.updateMany({
          where: { id: { in: openDrafts.map((item) => item.id) }, status: QuotationStatus.DRAFT },
          data: { status: QuotationStatus.SUPERSEDED },
        });
        await tx.auditEvent.create({
          data: {
            shopId,
            actorId,
            action: 'quotation.draft_superseded',
            entityType: 'RepairCase',
            entityId: caseId,
            metadata: { quotationIds: openDrafts.map((item) => item.id) },
          },
        });
      }
      const quotation = await tx.quotation.create({
        data: {
          caseId,
          version: (latest?.version ?? 0) + 1,
          status: QuotationStatus.DRAFT,
          diagnosedIssue: issue,
          proposedRepair,
          laborCost,
          partsCost,
          additionalCharges,
          taxRate,
          taxAmount,
          totalCost,
          estimatedCompletionHours: dto.estimatedCompletionHours,
          warrantyTerms,
          currency: (dto.currency ?? 'USD').toUpperCase(),
          validUntil,
          items: { create: itemsData },
          evidence: { create: evidenceIds.map((evidenceId) => ({ evidenceId })) },
        },
        include: { items: true, evidence: { include: { evidence: true } } },
      });
      const changeResolution = await tx.quotationChangeRequest.updateMany({
        where: { caseId, status: 'OPEN' },
        data: { status: 'RESOLVED', replacementQuotationId: quotation.id, resolvedAt: new Date() },
      });
      await this.lifecycle.transition(tx, {
        ...transitionInput,
        supportingRecords: [quotation.id, diagnostic.id, ...evidenceIds],
        reason: 'Quotation version prepared',
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'quotation.created',
          entityType: 'Quotation',
          entityId: quotation.id,
          metadata: {
            caseId,
            version: quotation.version,
            totalCost: totalCost.toString(),
            currency: quotation.currency,
            diagnosedIssue: issue,
            proposedRepair,
            evidenceIds,
            resolvedChangeRequests: changeResolution.count,
          },
        },
      });
      return quotation;
    });
  }

  async sendToCustomer(
    caseId: string,
    shopId: string,
    actorId: string,
    actorRole: string,
    quoteId: string,
    idempotencyKey: string,
  ) {
    if (this.config.get<string>('CUSTOMER_AUTHORIZATION_ENABLED') !== 'true') {
      throw new ServiceUnavailableException(
        'Customer quotation authorization is disabled; quotation was not sent',
      );
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const transitionInput = {
        caseId,
        shopId,
        actorId,
        actorRole,
        toState: CaseStatus.AWAITING_CUSTOMER_APPROVAL,
        idempotencyKey,
        requestHash: this.lifecycle.hashRequest({ quoteId }),
      };
      const replay = await this.lifecycle.findReplay(tx, transitionInput);
      if (replay)
        return {
          sent: true,
          quotationId: quoteId,
          status: CaseStatus.AWAITING_CUSTOMER_APPROVAL,
          replayed: true,
        };
      const repairCase = await tx.repairCase.findFirst({
        where: { id: caseId, shopId, deletedAt: null },
        select: {
          id: true,
          status: true,
          technicianId: true,
          customerEmail: true,
          customerLocale: true,
          authorizationToken: true,
        },
      });
      if (!repairCase) throw new NotFoundException('Repair case not found');
      if (repairCase.status !== CaseStatus.QUOTATION_PENDING)
        throw new ConflictException('Repair case is not awaiting a quotation');
      const quote = await tx.quotation.findFirst({
        where: { id: quoteId, caseId, repairCase: { shopId, deletedAt: null } },
        select: {
          id: true,
          version: true,
          status: true,
          validUntil: true,
          totalCost: true,
          currency: true,
        },
      });
      if (!quote) throw new NotFoundException('Quotation not found');
      if (quote.status !== QuotationStatus.DRAFT)
        throw new ConflictException('Only a draft quotation can be sent');
      if (quote.validUntil <= new Date())
        throw new BadRequestException('Quotation validity date has passed');
      const updated = await tx.quotation.updateMany({
        where: { id: quoteId, status: QuotationStatus.DRAFT },
        data: { status: QuotationStatus.SENT },
      });
      if (updated.count !== 1)
        throw new ConflictException('Quotation changed concurrently; reload and retry');
      const approval = await tx.approval.upsert({
        where: { quotationId: quoteId },
        create: { quotationId: quoteId, status: 'PENDING' },
        update: {
          status: 'PENDING',
          respondedAt: null,
          customerSignatureName: null,
          notes: null,
          decisionIdempotencyKey: null,
          decisionRequestHash: null,
        },
      });
      await this.lifecycle.transition(tx, {
        ...transitionInput,
        supportingRecords: [quoteId, approval.id],
        reason: 'Quotation sent for customer approval',
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId,
          action: 'quotation.sent_for_approval',
          entityType: 'Quotation',
          entityId: quoteId,
          metadata: { caseId },
        },
      });
      if (repairCase.technicianId)
        await this.notifications?.enqueue(tx, {
          profileId: repairCase.technicianId,
          category: 'QUOTATIONS',
          type: 'CUSTOMER_APPROVAL_REQUESTED',
          title: 'Quotation sent for approval',
          body: 'The customer has been asked to review a repair quotation.',
          deduplicationScope: `quotation:${quoteId}:sent`,
          payload: { caseId, quotationId: quoteId },
        });
      if (repairCase.customerEmail) {
        const appUrl = (
          this.config.get<string>('PUBLIC_APP_URL') ||
          this.config.get<string>('VITE_APP_URL') ||
          'http://localhost:5173'
        ).replace(/\/$/, '');
        const reviewLink = `${appUrl}/authorize/${repairCase.authorizationToken}`;
        const previous = await tx.quotation.findFirst({
          where: { caseId, version: { lt: quote.version } },
          orderBy: { version: 'desc' },
          select: { totalCost: true },
        });
        await this.notifications?.enqueue(tx, {
          recipientEmail: repairCase.customerEmail,
          category: 'QUOTATIONS',
          type: 'NEW_QUOTATION',
          locale: repairCase.customerLocale as 'en-IN' | 'bn-BD' | 'hi-IN',
          title: 'Repair quotation ready for review',
          body: 'A repair quotation is ready for review. Open your secure review link to see details.',
          emailText: `A repair quotation is ready for review. Review, approve, decline, or request changes using this secure link: ${reviewLink}`,
          deduplicationScope: `quotation:${quoteId}:ready`,
          payload: { caseId, quotationId: quoteId, version: quote.version },
        });
        if (previous && !previous.totalCost.equals(quote.totalCost))
          await this.notifications?.enqueue(tx, {
            recipientEmail: repairCase.customerEmail,
            category: 'QUOTATIONS',
            type: 'PRICE_CHANGED',
            locale: repairCase.customerLocale as 'en-IN' | 'bn-BD' | 'hi-IN',
            title: 'Repair quotation updated',
            body: 'The repair quotation price has changed. Review the updated quotation before deciding.',
            emailText: `The repair quotation price has changed. Review the updated quotation before deciding: ${reviewLink}`,
            deduplicationScope: `quotation:${quoteId}:price-change`,
            payload: { caseId, quotationId: quoteId, version: quote.version },
          });
      }
      return { sent: true, quotationId: quoteId, status: CaseStatus.AWAITING_CUSTOMER_APPROVAL };
    });
    if (!result.replayed)
      void this.analytics?.record({
        name: 'quotation.delivered', sourceId: quoteId, actorProfileId: actorId, shopId,
        role: actorRole, journeyId: caseId, properties: { channel: 'secure_review' },
      });
    if (!result.replayed)
      void this.featureFlags?.recordConfiguredMetric(actorId, caseId, 'quotation_delivered');
    return result;
  }

  async findByCase(caseId: string, shopId: string, actorId: string, actorRole: string) {
    const repairCase = await this.prisma.repairCase.findFirst({
      where: {
        id: caseId,
        shopId,
        deletedAt: null,
        ...(actorRole === 'TECHNICIAN' ? { technicianId: actorId } : {}),
      },
      select: { id: true },
    });
    if (!repairCase) throw new NotFoundException('Repair case not found');
    const quotations = await this.prisma.quotation.findMany({
      where: { caseId, deletedAt: null },
      include: {
        items: true,
        approval: true,
        evidence: { include: { evidence: true } },
        changeRequests: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { version: 'desc' },
    });
    return this.evidenceService.decorateForRead(quotations, shopId, actorId);
  }
}
