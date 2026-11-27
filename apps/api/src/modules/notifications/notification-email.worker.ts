import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { NotificationCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailDeliveryProvider, EmailProviderError } from './email-delivery.provider';
import { MetricsService } from '../../common/observability/metrics.service';

interface ClaimedNotification {
  id: string;
  profileId: string | null;
  recipientEmail: string | null;
  title: string;
  body: string;
  emailText: string | null;
  category: string;
  emailAttempts: number;
}

@Injectable()
export class NotificationEmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEmailWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProvider: EmailDeliveryProvider,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  onModuleInit() {
    if (!this.emailProvider.isConfigured) {
      this.logger.warn('Email delivery is disabled; notification email jobs remain durably queued');
      return;
    }
    this.timer = setInterval(() => void this.processDueNotifications(), 5_000);
    this.timer.unref();
    void this.processDueNotifications();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processDueNotifications() {
    if (this.running || !this.emailProvider.isConfigured) return;
    this.running = true;
    try {
      const batch = await this.prisma.$queryRaw<ClaimedNotification[]>(Prisma.sql`
        WITH due AS (
          SELECT "id" FROM "Notification"
          WHERE ("emailStatus" = 'QUEUED' AND ("emailNextAttemptAt" IS NULL OR "emailNextAttemptAt" <= NOW()))
             OR ("emailStatus" = 'SENDING' AND "emailLockedUntil" <= NOW())
          ORDER BY "createdAt" ASC
          LIMIT 20 FOR UPDATE SKIP LOCKED
        )
        UPDATE "Notification" AS n
        SET "emailStatus" = 'SENDING', "emailLockedUntil" = NOW() + INTERVAL '5 minutes',
            "emailAttempts" = n."emailAttempts" + 1
        FROM due WHERE n."id" = due."id"
        RETURNING n."id", n."profileId", n."recipientEmail", n."title", n."body", n."emailText", n."category", n."emailAttempts"
      `);
      for (const notification of batch) await this.deliver(notification);
      this.metrics?.workerRun('notification_email', true);
    } catch (error) {
      this.metrics?.workerRun('notification_email', false);
      this.logger.error(`Email queue poll failed: ${this.errorMessage(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async deliver(notification: ClaimedNotification) {
    try {
      const preference =
        notification.profileId && this.prisma.notificationPreference
          ? await this.prisma.notificationPreference.findUnique({
              where: {
                profileId_category: {
                  profileId: notification.profileId,
                  category: notification.category as NotificationCategory,
                },
              },
              select: { emailEnabled: true },
            })
          : null;
      if (preference?.emailEnabled === false) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { emailStatus: 'NOT_QUEUED', emailLockedUntil: null, emailNextAttemptAt: null },
        });
        return;
      }
      const profile = notification.profileId
        ? await this.prisma.profile.findUnique({
            where: { id: notification.profileId },
            select: { email: true },
          })
        : null;
      const recipientEmail = notification.recipientEmail || profile?.email;
      if (!recipientEmail) throw new PermanentEmailError('Recipient email address is unavailable');
      await this.emailProvider.send({
        idempotencyKey: `repairproof-notification-${notification.id}`,
        from: '',
        to: recipientEmail,
        subject: notification.title,
        text: notification.emailText || notification.body,
      });
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          emailStatus: 'SENT',
          emailSentAt: new Date(),
          emailLockedUntil: null,
          emailNextAttemptAt: null,
          emailLastError: null,
        },
      });
    } catch (error) {
      const message = this.errorMessage(error).slice(0, 1000);
      const retryable =
        !(error instanceof PermanentEmailError) &&
        (!(error instanceof EmailProviderError) || error.retryable);
      const permanent = !retryable || notification.emailAttempts >= 5;
      const exponentialDelayMs = Math.min(
        30_000 * 2 ** Math.max(0, notification.emailAttempts - 1),
        3_600_000,
      );
      const retryAfterMs = error instanceof EmailProviderError ? error.retryAfterMs : undefined;
      const delayMs = Math.max(exponentialDelayMs, retryAfterMs ?? 0);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          emailStatus: permanent ? 'FAILED' : 'QUEUED',
          emailLockedUntil: null,
          emailNextAttemptAt: permanent ? null : new Date(Date.now() + delayMs),
          emailLastError: message,
        },
      });
      this.logger.warn(
        `Notification email ${notification.id} ${permanent ? 'failed permanently' : 'scheduled for retry'}: ${message}`,
      );
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown email delivery error';
  }
}

class PermanentEmailError extends Error {}
