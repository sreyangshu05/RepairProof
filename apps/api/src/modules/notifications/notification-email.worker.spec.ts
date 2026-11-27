import { NotificationEmailWorker } from './notification-email.worker';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ResendEmailProvider } from './email-delivery.provider';

describe('NotificationEmailWorker', () => {
  const notification = {
    id: 'notice-1',
    profileId: 'profile-1',
    recipientEmail: null,
    title: 'Repair update',
    body: 'Ready',
    emailAttempts: 1,
  };
  let prisma: {
    $queryRaw: jest.Mock;
    profile: { findUnique: jest.Mock };
    notification: { update: jest.Mock };
  };
  let worker: NotificationEmailWorker;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([notification]),
      profile: { findUnique: jest.fn().mockResolvedValue({ email: 'user@example.test' }) },
      notification: { update: jest.fn().mockResolvedValue({}) },
    };
    const config = {
      get: (key: string) =>
        ({ RESEND_API_KEY: 'test-key', EMAIL_FROM: 'RepairProof <notices@example.test>' })[key],
    } as unknown as ConfigService;
    worker = new NotificationEmailWorker(
      prisma as unknown as PrismaService,
      new ResendEmailProvider(config),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('claims and sends due notifications, then marks them sent', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 202 }));
    await worker.processDueNotifications();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': 'repairproof-notification-notice-1',
        }),
        body: expect.stringContaining('user@example.test'),
      }),
    );
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notice-1' },
        data: expect.objectContaining({ emailStatus: 'SENT', emailSentAt: expect.any(Date) }),
      }),
    );
  });

  it('retries transient provider errors and permanently fails after the fifth attempt', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    await worker.processDueNotifications();
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailStatus: 'QUEUED',
          emailNextAttemptAt: expect.any(Date),
        }),
      }),
    );

    prisma.$queryRaw.mockResolvedValue([{ ...notification, emailAttempts: 5 }]);
    prisma.notification.update.mockClear();
    await worker.processDueNotifications();
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailStatus: 'FAILED', emailNextAttemptAt: null }),
      }),
    );
  });

  it('does not retry permanent provider rejections', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 422 }));
    await worker.processDueNotifications();
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailStatus: 'FAILED', emailNextAttemptAt: null }),
      }),
    );
  });

  it('honors the provider Retry-After header within the bounded retry window', async () => {
    const before = Date.now();
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    await worker.processDueNotifications();
    const update = prisma.notification.update.mock.calls[0][0];
    expect(update.data.emailStatus).toBe('QUEUED');
    expect(update.data.emailNextAttemptAt.getTime()).toBeGreaterThanOrEqual(before + 120_000);
  });

  it('delivers a queued notification directly to a repair customer email', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 202 }));
    prisma.$queryRaw.mockResolvedValue([
      { ...notification, profileId: null, recipientEmail: 'customer@example.test' },
    ]);
    await worker.processDueNotifications();
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ body: expect.stringContaining('customer@example.test') }),
    );
  });
});
