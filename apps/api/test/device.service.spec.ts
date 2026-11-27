import { NotFoundException } from '@nestjs/common';
import { DeviceService } from '../src/modules/device/device.service';

describe('DeviceService actor scope', () => {
  let prisma: any;
  let service: DeviceService;

  beforeEach(() => {
    prisma = {
      device: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'device-1', shopId: 'shop-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new DeviceService(prisma);
  });

  it('limits technician lists to registered devices and devices with an assigned case', async () => {
    await service.findAll('shop-1', 'tech-1', 'TECHNICIAN');
    expect(prisma.device.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shopId: 'shop-1',
          deletedAt: null,
          OR: [
            { registeredById: 'tech-1' },
            { repairCases: { some: { technicianId: 'tech-1', deletedAt: null } } },
          ],
        },
      }),
    );
  });

  it('does not return another technician’s device by id', async () => {
    prisma.device.findFirst.mockResolvedValue(null);
    await expect(
      service.findOne('device-foreign', 'shop-1', 'tech-1', 'TECHNICIAN'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.device.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'device-foreign',
          OR: expect.arrayContaining([
            { registeredById: 'tech-1' },
            { repairCases: { some: { technicianId: 'tech-1', deletedAt: null } } },
          ]),
        }),
      }),
    );
  });

  it('applies actor scope to device mutations and denies unowned devices', async () => {
    prisma.device.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update('device-foreign', 'shop-1', 'tech-1', 'TECHNICIAN', { color: 'blue' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.device.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'device-foreign',
          OR: expect.any(Array),
        }),
      }),
    );
  });
});
