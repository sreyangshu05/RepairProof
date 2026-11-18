import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitVerificationDto } from './verification.dto';
import { CaseStatus } from '@repairproof/shared';

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  getDefaultChecklist(category: string) {
    if (category === 'SMARTPHONE') {
      return [
        { id: 'screen_display', label: 'Display Panel & TrueTone/Brightness', category: 'Display', passed: false },
        { id: 'screen_touch', label: 'Multi-touch Responsiveness & Digitizer', category: 'Display', passed: false },
        { id: 'audio_speaker', label: 'Loudspeaker & Earpiece Clarity', category: 'Audio', passed: false },
        { id: 'audio_mic', label: 'Primary & Secondary Microphones', category: 'Audio', passed: false },
        { id: 'camera_front', label: 'Front Facing Camera & Face ID/Sensors', category: 'Cameras', passed: false },
        { id: 'camera_rear', label: 'Rear Main Camera & Optical Zoom', category: 'Cameras', passed: false },
        { id: 'power_charging', label: 'Fast Charging & Wireless Charging Port', category: 'Power', passed: false },
        { id: 'battery_health', label: 'Battery Cycle & Current Discharge Rate', category: 'Power', passed: false },
        { id: 'conn_cellular', label: 'Cellular Signal & 5G/LTE Data', category: 'Connectivity', passed: false },
        { id: 'conn_wifi_bt', label: 'Wi-Fi 6 & Bluetooth Pairing', category: 'Connectivity', passed: false },
        { id: 'biometrics', label: 'Fingerprint / Biometric Sensor', category: 'Security', passed: false },
      ];
    }

    // Default LAPTOP checklist
    return [
      { id: 'display_panel', label: 'Screen Output, Backlight & Dead Pixels', category: 'Display', passed: false },
      { id: 'keyboard_keys', label: 'All Keyboard Keys & Backlight', category: 'Input', passed: false },
      { id: 'trackpad', label: 'Trackpad Gestures & Physical Click', category: 'Input', passed: false },
      { id: 'battery_charge', label: 'DC/USB-C Power In & Battery Charge State', category: 'Power', passed: false },
      { id: 'thermal_fan', label: 'Cooling Fans & Thermal Dissipation', category: 'Thermals', passed: false },
      { id: 'ports_io', label: 'USB, HDMI, Audio Jack & Thunderbolt Ports', category: 'I/O', passed: false },
      { id: 'audio_speakers', label: 'Internal Speakers & Headphone Jack', category: 'Audio', passed: false },
      { id: 'webcam_mic', label: 'Webcam & Microphone Array', category: 'Media', passed: false },
      { id: 'storage_smart', label: 'SSD Health S.M.A.R.T. Readout', category: 'Storage', passed: false },
      { id: 'wireless_conn', label: 'Wi-Fi & Bluetooth Radios', category: 'Connectivity', passed: false },
    ];
  }

  async submitVerification(caseId: string, verifiedById: string, dto: SubmitVerificationDto) {
    const repairCase = await this.prisma.repairCase.findUnique({
      where: { id: caseId },
      include: { device: true },
    });

    if (!repairCase) {
      throw new NotFoundException(`Repair case with ID ${caseId} not found`);
    }

    // Upsert verification record
    const verification = await this.prisma.verification.upsert({
      where: { caseId },
      create: {
        caseId,
        verifiedById,
        passed: dto.passed,
        notes: dto.notes,
        checklist: dto.checklist as any,
        verifiedAt: new Date(),
      },
      update: {
        verifiedById,
        passed: dto.passed,
        notes: dto.notes,
        checklist: dto.checklist as any,
        verifiedAt: new Date(),
      },
      include: {
        verifiedBy: { select: { displayName: true } },
      },
    });

    // Update case status: if passed and currently IN_REPAIR, advance to VERIFYING
    if (repairCase.status === CaseStatus.IN_REPAIR) {
      await this.prisma.repairCase.update({
        where: { id: caseId },
        data: { status: CaseStatus.VERIFYING },
      });
    }

    return verification;
  }

  async getVerification(caseId: string) {
    const repairCase = await this.prisma.repairCase.findUnique({
      where: { id: caseId },
      include: { device: true },
    });

    if (!repairCase) {
      throw new NotFoundException(`Repair case with ID ${caseId} not found`);
    }

    const verification = await this.prisma.verification.findUnique({
      where: { caseId },
      include: {
        verifiedBy: { select: { displayName: true } },
      },
    });

    if (!verification) {
      return {
        hasVerification: false,
        defaultChecklist: this.getDefaultChecklist(repairCase.device.category),
      };
    }

    return {
      hasVerification: true,
      verification,
    };
  }
}
