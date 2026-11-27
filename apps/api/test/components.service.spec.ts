import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ComponentsService } from '../src/modules/components/components.service';

describe('ComponentsService', () => {
  let service: ComponentsService;
  let tx: any;
  let prisma: any;
  beforeEach(() => {
    tx = {
      repairCase: { findFirst: jest.fn().mockResolvedValue({ id: 'case-1', status: 'IN_REPAIR' }) },
      component: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'part-1', name: 'Display', source: 'OEM', unitCost: 90 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      componentReplacement: { create: jest.fn().mockResolvedValue({ id: 'replacement-1' }) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    service = new ComponentsService(prisma);
  });
  it('decrements tenant stock and records the replacement atomically', async () => {
      await service.replace('case-1', 'shop-1', 'profile-1', 'SHOP_OWNER', { componentId: 'part-1', quantity: 1 });
    expect(tx.component.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ quantityOnHand: { gte: 1 } }) }),
    );
    expect(tx.componentReplacement.create).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });
  it('rejects insufficient stock', async () => {
    tx.component.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.replace('case-1', 'shop-1', 'profile-1', 'SHOP_OWNER', { componentId: 'part-1', quantity: 2 }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.componentReplacement.create).not.toHaveBeenCalled();
  });
  it('rejects components outside the tenant inventory', async () => {
    tx.component.findFirst.mockResolvedValue(null);
    await expect(
      service.replace('case-1', 'shop-1', 'profile-1', 'SHOP_OWNER', {
        componentId: 'foreign-part',
        quantity: 1,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
