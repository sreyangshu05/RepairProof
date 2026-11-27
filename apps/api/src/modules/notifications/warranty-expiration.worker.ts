import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { MetricsService } from '../../common/observability/metrics.service';

@Injectable()
export class WarrantyExpirationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WarrantyExpirationWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processDueReminders(), 6 * 60 * 60 * 1000);
    this.timer.unref();
    void this.processDueReminders();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processDueReminders() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const day = 86_400_000;
      const warranties = await this.prisma.warranty.findMany({
        where: {
          status: 'ACTIVE',
          endsAt: { gt: now, lte: new Date(now.getTime() + 31 * day) },
          repairCase: { deletedAt: null },
        },
        select: { id: true, caseId: true, endsAt: true },
      });
      for (const warranty of warranties) {
        const remaining = warranty.endsAt.getTime() - now.getTime();
        const leadDays = [30, 7, 1].find(
          (days) => remaining <= days * day && remaining > (days - 1) * day,
        );
        if (!leadDays) continue;
        await this.prisma.$transaction((tx) =>
          this.notifications.notifyCaseEvent(tx, {
            caseId: warranty.caseId,
            category: 'WARRANTIES',
            type: 'WARRANTY_EXPIRING',
            title:
              leadDays === 1
                ? 'Warranty expires soon'
                : `Warranty expires in about ${leadDays} days`,
            body: 'A device warranty is nearing its end date. Sign in to review coverage details.',
            deduplicationScope: `warranty:${warranty.id}:expiry:${leadDays}`,
            audience: 'CUSTOMER',
          }),
        );
      }
      this.metrics?.workerRun('warranty_expiration', true);
    } catch (error) {
      this.metrics?.workerRun('warranty_expiration', false);
      this.logger.error(
        `Warranty reminder sweep failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
