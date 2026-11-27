import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { MetricsService } from '../../common/observability/metrics.service';

@Injectable()
export class EvidenceRetentionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EvidenceRetentionWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly enabled: boolean;

  constructor(
    private readonly evidence: EvidenceService,
    @Optional() private readonly metrics?: MetricsService,
  ) {
    this.enabled =
      process.env.EVIDENCE_RETENTION_WORKER_ENABLED !== 'false' &&
      process.env.EVIDENCE_STORAGE_DISABLED !== 'true';
  }

  onModuleInit() {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.run(), 60 * 60 * 1000);
    this.timer.unref();
    void this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const removed = await this.evidence.purgeExpiredEvidence(100);
      if (removed)
        this.logger.log(`Processed ${removed} expired evidence objects or upload intents`);
      this.metrics?.workerRun('evidence_retention', true);
    } catch (error) {
      this.metrics?.workerRun('evidence_retention', false);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Evidence retention sweep failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
