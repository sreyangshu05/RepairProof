import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, QuotationStatus } from '@prisma/client';
import { CaseStatus } from '@repairproof/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDisputeDto, CustomerAuthorizationResponseDto } from './authorization.dto';
import { RepairLifecycleService } from '../case/repair-lifecycle.service';
import { EvidenceService } from '../evidence/evidence.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: RepairLifecycleService,
    private readonly evidenceService: EvidenceService,
    private readonly notifications?: NotificationsService,
  ) {}

  private async findCaseByToken(token: string, allowExpired = false) {
    const repairCase = await this.prisma.repairCase.findUnique({
      where: { authorizationToken: token },
      include: {
        shop: { select: { name: true, phone: true, email: true, logoUrl: true, address: true } },
        device: true,
        evidence: {
          where: { deletedAt: null },
          include: { annotations: true },
          orderBy: { capturedAt: 'desc' },
        },
        quotations: {
          where: {
            status: {
              in: [QuotationStatus.SENT, QuotationStatus.APPROVED, QuotationStatus.REJECTED],
            },
          },
          include: {
            items: true,
            approval: true,
            evidence: { include: { evidence: true } },
            changeRequests: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!repairCase || repairCase.deletedAt)
      throw new NotFoundException('Invalid or expired authorization link');
    if (!allowExpired && repairCase.authorizationExpiresAt <= new Date())
      throw new BadRequestException('This authorization link has expired');
    return repairCase;
  }

  async getCaseByToken(token: string) {
    const repairCase = await this.findCaseByToken(token);
    const quotation = repairCase.quotations[0];
    // Explicit public allowlist. Never serialize the ORM aggregate: it contains the
    // bearer token, customer contact data, full device identifiers and internal notes.
    return {
      caseNumber: repairCase.caseNumber,
      status: repairCase.status,
      problemDescription: repairCase.problemDescription,
      createdAt: repairCase.createdAt,
      estimatedCompletionAt: repairCase.estimatedCompletionAt,
      shop: {
        name: repairCase.shop.name,
        phone: repairCase.shop.phone,
        email: repairCase.shop.email,
        logoUrl: repairCase.shop.logoUrl,
      },
      device: {
        category: repairCase.device.category,
        make: repairCase.device.make,
        model: repairCase.device.model,
        // Device serial/IMEI are never part of the public link response.
      },
      evidence: repairCase.evidence.map((item) => ({
        id: item.id,
        type: item.type,
        fileName: item.fileName,
        description: item.description,
        category: item.category,
        purpose: item.purpose,
        assetRole: item.assetRole,
        malwareStatus: item.malwareStatus,
        capturedAt: item.capturedAt,
        // Download is issued by the separately authorized, audited endpoint.
        fileUrl: null,
      })),
      quotations: quotation
        ? [
            {
              id: quotation.id,
              version: quotation.version,
              status: quotation.status,
              validUntil: quotation.validUntil,
              diagnosedIssue: quotation.diagnosedIssue,
              proposedRepair: quotation.proposedRepair,
              estimatedCompletionHours: quotation.estimatedCompletionHours,
              currency: quotation.currency,
              laborCost: quotation.laborCost,
              additionalCharges: quotation.additionalCharges,
              taxRate: quotation.taxRate,
              taxAmount: quotation.taxAmount,
              totalCost: quotation.totalCost,
              warrantyTerms: quotation.warrantyTerms,
              items: quotation.items.map((item) => ({
                id: item.id,
                type: item.type,
                description: item.description,
                partSource: item.partSource,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              })),
              evidence: quotation.evidence.map(({ evidence }) => ({
                evidenceId: evidence.id,
                evidence: {
                  id: evidence.id,
                  fileName: evidence.fileName,
                  description: evidence.description,
                  category: evidence.category,
                  fileUrl: null,
                },
              })),
              approval: quotation.approval ? { status: quotation.approval.status } : null,
              changeRequests: quotation.changeRequests.map((request) => ({
                id: request.id,
                status: request.status,
                requestText: request.requestText,
                createdAt: request.createdAt,
              })),
            },
          ]
        : null,
    };
  }

  async updateCustomerLocale(token: string, locale: string) {
    const repairCase = await this.findCaseByToken(token);
    await this.prisma.repairCase.update({
      where: { id: repairCase.id },
      data: { customerLocale: locale },
      select: { id: true },
    });
    return { updated: true };
  }

  async getEvidenceDownload(token: string, evidenceId: string) {
    return this.evidenceService.createCustomerDownloadUrl(token, evidenceId);
  }

  async respondToQuotation(
    token: string,
    idempotencyKey: string,
    dto: CustomerAuthorizationResponseDto,
  ) {
    if (!dto.customerSignatureName?.trim())
      throw new BadRequestException('A customer signature name is required');
    const repairCase = await this.findCaseByToken(token, true);
    const quote = repairCase.quotations[0];
    const decision =
      dto.decision ??
      (dto.approved === true ? 'APPROVE' : dto.approved === false ? 'REJECT' : undefined);
    if (!decision) throw new BadRequestException('Choose approve, reject, or request changes');
    if (decision === 'REQUEST_CHANGES' && !dto.notes?.trim())
      throw new BadRequestException('Describe the requested scope or price changes');
    const approved = decision === 'APPROVE';
    const caseStatus = approved ? CaseStatus.APPROVED : CaseStatus.REJECTED;
    return this.prisma.$transaction(async (tx) => {
      const requestHash = this.lifecycle.hashRequest({
        decision,
        customerSignatureName: dto.customerSignatureName.trim(),
        notes: dto.notes?.trim(),
      });
      const transitionInput = {
        caseId: repairCase.id,
        shopId: repairCase.shopId,
        actorId: null,
        actorRole: 'CUSTOMER',
        toState: caseStatus,
        idempotencyKey,
        requestHash,
      };
      const replay = await this.lifecycle.findReplay(tx, transitionInput);
      if (replay)
        return {
          approved,
          decision,
          status: caseStatus,
          quotation: { id: quote.id, version: quote.version, status: quote.status },
          replayed: true,
        };
      if (repairCase.authorizationExpiresAt <= new Date())
        throw new BadRequestException('This authorization link has expired');
      if (
        !quote ||
        quote.status !== QuotationStatus.SENT ||
        quote.validUntil <= new Date() ||
        repairCase.status !== CaseStatus.AWAITING_CUSTOMER_APPROVAL
      ) {
        throw new BadRequestException('No current quotation is available for approval');
      }
      const quoteStatus = approved ? QuotationStatus.APPROVED : QuotationStatus.REJECTED;
      const quoteUpdated = await tx.quotation.updateMany({
        where: { id: quote.id, caseId: repairCase.id, status: QuotationStatus.SENT },
        data: {
          status: quoteStatus,
          customerResponseNote: `${decision}: ${dto.notes?.trim() || 'No additional note'} (Signed: ${dto.customerSignatureName.trim()})`,
          respondedAt: new Date(),
        },
      });
      if (quoteUpdated.count !== 1)
        throw new ConflictException('Quotation has already been answered');
      const approval = await tx.approval.findFirst({
        where: { quotationId: quote.id, status: ApprovalStatus.PENDING },
        select: { id: true },
      });
      if (!approval) throw new ConflictException('Approval has already been recorded');
      const approvalUpdated = await tx.approval.updateMany({
        where: { id: approval.id, status: ApprovalStatus.PENDING },
        data: {
          status: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
          customerSignatureName: dto.customerSignatureName.trim(),
          notes: dto.notes?.trim(),
          respondedAt: new Date(),
          decisionIdempotencyKey: this.lifecycle.hashRequest({
            caseId: repairCase.id,
            idempotencyKey,
          }),
          decisionRequestHash: requestHash,
        },
      });
      if (approvalUpdated.count !== 1)
        throw new ConflictException('Approval has already been recorded');
      let changeRequest: { id: string } | undefined;
      if (decision === 'REQUEST_CHANGES') {
        changeRequest = await tx.quotationChangeRequest.create({
          data: {
            caseId: repairCase.id,
            quotationId: quote.id,
            customerSignatureName: dto.customerSignatureName.trim(),
            requestText: dto.notes!.trim(),
            idempotencyKey,
            requestHash,
          },
          select: { id: true },
        });
      }
      await this.lifecycle.transition(tx, {
        ...transitionInput,
        supportingRecords: [quote.id, approval.id, ...(changeRequest ? [changeRequest.id] : [])],
        reason:
          decision === 'REQUEST_CHANGES'
            ? `Customer requested quotation changes: ${dto.notes!.trim()}`
            : `Customer ${decision === 'APPROVE' ? 'approved' : 'rejected'} quotation`,
      });
      const updatedQuote = await tx.quotation.findUnique({
        where: { id: quote.id },
        include: { items: true, approval: true },
      });
      await tx.auditEvent.create({
        data: {
          shopId: repairCase.shopId,
          actorId: null,
          action:
            decision === 'REQUEST_CHANGES'
              ? 'quotation.change_requested'
              : `quotation.customer_${decision.toLowerCase()}`,
          entityType: decision === 'REQUEST_CHANGES' ? 'QuotationChangeRequest' : 'Quotation',
          entityId: changeRequest?.id ?? quote.id,
          metadata: {
            caseId: repairCase.id,
            quotationId: quote.id,
            version: quote.version,
            decision,
            customerSignatureName: dto.customerSignatureName.trim(),
            notes: dto.notes?.trim(),
            requestHash,
          },
        },
      });
      await this.notifications?.notifyCaseEvent(tx, {
        caseId: repairCase.id,
        category: 'QUOTATIONS',
        type:
          decision === 'REQUEST_CHANGES'
            ? 'CUSTOMER_REQUESTED_QUOTATION_CHANGES'
            : `CUSTOMER_${decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'}_QUOTATION`,
        title:
          decision === 'REQUEST_CHANGES'
            ? 'Customer requested quotation changes'
            : `Customer ${decision === 'APPROVE' ? 'approved' : 'declined'} the quotation`,
        body:
          decision === 'REQUEST_CHANGES'
            ? 'The customer asked to review changes to the repair quotation.'
            : 'The customer responded to the repair quotation. Sign in to review the decision.',
        deduplicationScope: `quotation:${quote.id}:customer-decision:${decision.toLowerCase()}`,
        audience: 'TECHNICIAN',
      });
      return { approved, decision, status: caseStatus, quotation: updatedQuote, changeRequest };
    });
  }

  async openDispute(token: string, idempotencyKey: string, dto: CreateCustomerDisputeDto) {
    const repairCase = await this.findCaseByToken(token);
    if (repairCase.status !== CaseStatus.COMPLETED)
      throw new BadRequestException('A dispute can only be opened for a completed repair');
    if (!idempotencyKey || idempotencyKey.length > 128)
      throw new BadRequestException('A valid Idempotency-Key (1-128 characters) is required');
    return this.prisma.$transaction(async (tx) => {
      const requestHash = this.lifecycle.hashRequest({
        reason: dto.reason.trim(),
        description: dto.description.trim(),
      });
      const prior = await tx.dispute.findFirst({
        where: { caseId: repairCase.id, idempotencyKey },
      });
      if (prior) {
        if (prior.requestHash !== requestHash || prior.openedById !== null)
          throw new ConflictException('Idempotency key was already used for a different dispute');
        return prior;
      }
      const dispute = await tx.dispute.create({
        data: {
          caseId: repairCase.id,
          openedById: null,
          reason: dto.reason.trim(),
          description: dto.description.trim(),
          idempotencyKey,
          requestHash,
        },
      });
      await this.lifecycle.transition(tx, {
        caseId: repairCase.id,
        shopId: repairCase.shopId,
        actorId: null,
        actorRole: 'CUSTOMER',
        toState: CaseStatus.DISPUTED,
        idempotencyKey: `customer-dispute:${this.lifecycle.hashRequest(idempotencyKey).slice(0, 32)}`,
        requestHash,
        supportingRecords: [dispute.id],
        reason: dto.reason.trim(),
      });
      await tx.auditEvent.create({
        data: {
          shopId: repairCase.shopId,
          actorId: null,
          action: 'dispute.opened',
          entityType: 'Dispute',
          entityId: dispute.id,
          metadata: { caseId: repairCase.id, actorRole: 'CUSTOMER' },
        },
      });
      return dispute;
    });
  }
}
