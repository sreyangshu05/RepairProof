import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaseService } from '../src/modules/case/case.service';
import { CaseStatus } from '@repairproof/shared';

describe('CaseService & Status Machine', () => {
  let service: CaseService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      repairCase: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      device: {
        findFirst: jest.fn(),
      },
    };

    service = new CaseService(mockPrisma);
  });

  it('should reject invalid status transitions (e.g. REGISTERED directly to CERTIFIED)', async () => {
    mockPrisma.repairCase.findFirst.mockResolvedValue({
      id: 'case-123',
      status: CaseStatus.REGISTERED,
    });

    await expect(
      service.updateStatus('case-123', 'shop-1', {
        status: CaseStatus.CERTIFIED,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should permit valid status transitions (e.g. REGISTERED to DIAGNOSING)', async () => {
    mockPrisma.repairCase.findFirst.mockResolvedValue({
      id: 'case-123',
      status: CaseStatus.REGISTERED,
    });

    mockPrisma.repairCase.update.mockResolvedValue({
      id: 'case-123',
      status: CaseStatus.DIAGNOSING,
    });

    const result = await service.updateStatus('case-123', 'shop-1', {
      status: CaseStatus.DIAGNOSING,
    });

    expect(result.status).toBe(CaseStatus.DIAGNOSING);
    expect(mockPrisma.repairCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-123' },
        data: expect.objectContaining({ status: CaseStatus.DIAGNOSING }),
      }),
    );
  });

  it('should throw NotFoundException when case does not exist', async () => {
    mockPrisma.repairCase.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('non-existent-case', 'shop-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
