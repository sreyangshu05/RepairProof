import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitVerificationDto } from './verification.dto';
import { CaseStatus } from '@repairproof/shared';
import { RepairLifecycleService } from '../case/repair-lifecycle.service';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: RepairLifecycleService,
  ) {}

  getDefaultChecklist(category: string) {
    if (category === 'SMARTPHONE') {
      return [
        {
          id: 'screen_display',
          label: 'Display Panel & TrueTone/Brightness',
          category: 'Display',
          passed: false,
        },
        {
          id: 'screen_touch',
          label: 'Multi-touch Responsiveness & Digitizer',
          category: 'Display',
          passed: false,
        },
        {
          id: 'audio_speaker',
          label: 'Loudspeaker & Earpiece Clarity',
          category: 'Audio',
          passed: false,
        },
        {
          id: 'audio_mic',
          label: 'Primary & Secondary Microphones',
          category: 'Audio',
          passed: false,
        },
        {
          id: 'camera_front',
          label: 'Front Facing Camera & Face ID/Sensors',
          category: 'Cameras',
          passed: false,
        },
        {
          id: 'camera_rear',
          label: 'Rear Main Camera & Optical Zoom',
          category: 'Cameras',
          passed: false,
        },
        {
          id: 'power_charging',
          label: 'Fast Charging & Wireless Charging Port',
          category: 'Power',
          passed: false,
        },
        {
          id: 'battery_health',
          label: 'Battery Cycle & Current Discharge Rate',
          category: 'Power',
          passed: false,
        },
        {
          id: 'conn_cellular',
          label: 'Cellular Signal & 5G/LTE Data',
          category: 'Connectivity',
          passed: false,
        },
        {
          id: 'conn_wifi_bt',
          label: 'Wi-Fi 6 & Bluetooth Pairing',
          category: 'Connectivity',
          passed: false,
        },
        {
          id: 'biometrics',
          label: 'Fingerprint / Biometric Sensor',
          category: 'Security',
          passed: false,
        },
      ];
    }

    // Default LAPTOP checklist
    return [
      {
        id: 'display_panel',
        label: 'Screen Output, Backlight & Dead Pixels',
        category: 'Display',
        passed: false,
      },
      {
        id: 'keyboard_keys',
        label: 'All Keyboard Keys & Backlight',
        category: 'Input',
        passed: false,
      },
      {
        id: 'trackpad',
        label: 'Trackpad Gestures & Physical Click',
        category: 'Input',
        passed: false,
      },
      {
        id: 'battery_charge',
        label: 'DC/USB-C Power In & Battery Charge State',
        category: 'Power',
        passed: false,
      },
      {
        id: 'thermal_fan',
        label: 'Cooling Fans & Thermal Dissipation',
        category: 'Thermals',
        passed: false,
      },
      {
        id: 'ports_io',
        label: 'USB, HDMI, Audio Jack & Thunderbolt Ports',
        category: 'I/O',
        passed: false,
      },
      {
        id: 'audio_speakers',
        label: 'Internal Speakers & Headphone Jack',
        category: 'Audio',
        passed: false,
      },
      { id: 'webcam_mic', label: 'Webcam & Microphone Array', category: 'Media', passed: false },
      {
        id: 'storage_smart',
        label: 'SSD Health S.M.A.R.T. Readout',
        category: 'Storage',
        passed: false,
      },
      {
        id: 'wireless_conn',
        label: 'Wi-Fi & Bluetooth Radios',
        category: 'Connectivity',
        passed: false,
      },
    ];
  }

  async submitVerification(
    caseId: string,
    shopId: string,
    verifiedById: string,
    actorRole: string,
    idempotencyKey: string,
    dto: SubmitVerificationDto,
  ) {
    if (dto.passed && dto.checklist.some((item) => !item.passed))
      throw new BadRequestException('A verification cannot pass while a checklist item has failed');
    return this.prisma.$transaction(async (tx) => {
      if (!idempotencyKey || idempotencyKey.length > 128)
        throw new BadRequestException('A valid Idempotency-Key (1-128 characters) is required');
      const effectiveKey = this.lifecycle.hashRequest({ caseId, idempotencyKey });
      const requestHash = this.lifecycle.hashRequest(dto);
      const priorAttempt = await tx.verificationAttempt.findUnique({
        where: { idempotencyKey: effectiveKey },
      });
      if (priorAttempt) {
        if (priorAttempt.requestHash !== requestHash || priorAttempt.verifiedById !== verifiedById)
          throw new BadRequestException(
            'Idempotency key was already used for a different verification',
          );
        return priorAttempt;
      }
      const repairCase = await tx.repairCase.findFirst({
        where: { id: caseId, shopId, deletedAt: null },
        select: {
          id: true,
          status: true,
          technicianId: true,
          device: { select: { category: true } },
        },
      });
      if (!repairCase) throw new NotFoundException(`Repair case with ID ${caseId} not found`);
      if (repairCase.status !== CaseStatus.AWAITING_VERIFICATION)
        throw new BadRequestException(
          'Independent verification is only available after the technician requests verification',
        );
      if (
        !['TECHNICIAN', 'SHOP_OWNER'].includes(actorRole) ||
        verifiedById === repairCase.technicianId
      )
        throw new BadRequestException(
          'The assigned technician cannot independently verify this repair',
        );
      const requiredChecks = this.getDefaultChecklist(repairCase.device.category)
        .map((item) => item.id)
        .sort();
      const submittedChecks = dto.checklist.map((item) => item.id).sort();
      if (
        new Set(submittedChecks).size !== submittedChecks.length ||
        JSON.stringify(requiredChecks) !== JSON.stringify(submittedChecks)
      ) {
        throw new BadRequestException(
          'Verification must include each required device test exactly once',
        );
      }
      const attempt = await tx.verificationAttempt.create({
        data: {
          caseId,
          verifiedById,
          passed: dto.passed,
          notes: dto.notes?.trim(),
          checklist: dto.checklist as unknown as Prisma.InputJsonArray,
          idempotencyKey: effectiveKey,
          requestHash,
        },
      });
      const verification = await tx.verification.upsert({
        where: { caseId },
        create: {
          caseId,
          verifiedById,
          passed: dto.passed,
          notes: dto.notes?.trim(),
          checklist: dto.checklist as unknown as Prisma.InputJsonArray,
          verifiedAt: new Date(),
        },
        update: {
          verifiedById,
          passed: dto.passed,
          notes: dto.notes?.trim(),
          checklist: dto.checklist as unknown as Prisma.InputJsonArray,
          verifiedAt: new Date(),
        },
        include: { verifiedBy: { select: { displayName: true } } },
      });
      const nextStatus = dto.passed ? CaseStatus.COMPLETED : CaseStatus.IN_REPAIR;
      await this.lifecycle.transition(tx, {
        caseId,
        shopId,
        actorId: verifiedById,
        actorRole,
        toState: nextStatus,
        idempotencyKey: effectiveKey,
        requestHash,
        reason:
          dto.notes ||
          (dto.passed ? 'Independent verification passed' : 'Independent verification failed'),
        supportingRecords: [attempt.id, verification.id],
      });
      await tx.auditEvent.create({
        data: {
          shopId,
          actorId: verifiedById,
          action: dto.passed ? 'verification.passed' : 'verification.failed',
          entityType: 'VerificationAttempt',
          entityId: attempt.id,
          metadata: { caseId, summaryId: verification.id },
        },
      });
      return attempt;
    });
  }

  async getVerification(caseId: string, shopId: string) {
    const repairCase = await this.prisma.repairCase.findFirst({
      where: { id: caseId, shopId, deletedAt: null },
      include: { device: true },
    });

    if (!repairCase) {
      throw new NotFoundException(`Repair case with ID ${caseId} not found`);
    }

    const [verification, attempts] = await Promise.all([
      this.prisma.verification.findUnique({
        where: { caseId },
        include: {
          verifiedBy: { select: { displayName: true } },
        },
      }),
      this.prisma.verificationAttempt.findMany({
        where: { caseId },
        include: { verifiedBy: { select: { displayName: true } } },
        orderBy: { verifiedAt: 'desc' },
      }),
    ]);

    if (!verification) {
      return {
        hasVerification: false,
        defaultChecklist: this.getDefaultChecklist(repairCase.device.category),
        attempts,
      };
    }

    return {
      hasVerification: true,
      verification,
      attempts,
    };
  }
}
