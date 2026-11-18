import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvidenceDto, AddAnnotationDto } from './evidence.dto';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(caseId: string, authorProfileId: string, dto: CreateEvidenceDto) {
    const repairCase = await this.prisma.repairCase.findUnique({
      where: { id: caseId },
    });

    if (!repairCase) {
      throw new NotFoundException(`Repair case with ID ${caseId} not found`);
    }

    return this.prisma.evidence.create({
      data: {
        caseId,
        capturedById: authorProfileId,
        category: dto.category,
        type: dto.type || 'PHOTO',
        fileUrl: dto.fileUrl,
        thumbnailUrl: dto.thumbnailUrl,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        description: dto.description,
      },
      include: {
        annotations: true,
        capturedBy: {
          select: { displayName: true },
        },
      },
    });
  }

  async findByCase(caseId: string) {
    return this.prisma.evidence.findMany({
      where: {
        caseId,
        deletedAt: null,
      },
      include: {
        annotations: true,
        capturedBy: {
          select: { displayName: true },
        },
      },
      orderBy: { capturedAt: 'desc' },
    });
  }

  async addAnnotation(evidenceId: string, authorName: string, dto: AddAnnotationDto) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${evidenceId} not found`);
    }

    return this.prisma.evidenceAnnotation.create({
      data: {
        evidenceId,
        x: dto.x,
        y: dto.y,
        note: dto.note,
        authorName: dto.authorName || authorName,
      },
    });
  }
}
