import { Injectable } from '@nestjs/common';

type Sample = { count: number; sum: number; buckets: number[] };

/** Process-local Prometheus metrics. Scrape each API replica; never label by IDs or raw URLs. */
@Injectable()
export class MetricsService {
  private readonly bounds = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  private readonly requests = new Map<string, Sample>();
  private inFlight = 0;
  private dbUp = 0;
  private redisUp = 0;
  private storageUp = 0;
  private emailQueued = 0;
  private emailOldestSeconds = 0;
  private readonly workerSuccess = new Map<string, number>();
  private readonly workerFailure = new Map<string, number>();
  private readonly startedAt = Date.now();

  beginRequest() {
    this.inFlight += 1;
  }
  endRequest(method: string, route: string, status: number, seconds: number) {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const safeMethod = /^[A-Z]{1,10}$/.test(method) ? method : 'OTHER';
    const safeRoute = route.startsWith('/') && route.length < 150 ? route : 'unmatched';
    const key = `${safeMethod}|${safeRoute}|${Math.floor(status / 100)}xx`;
    const sample = this.requests.get(key) ?? {
      count: 0,
      sum: 0,
      buckets: this.bounds.map(() => 0),
    };
    sample.count += 1;
    sample.sum += seconds;
    this.bounds.forEach((bound, index) => {
      if (seconds <= bound) sample.buckets[index] += 1;
    });
    this.requests.set(key, sample);
  }
  setDependency(name: 'db' | 'redis' | 'storage', healthy: boolean) {
    if (name === 'db') this.dbUp = healthy ? 1 : 0;
    else if (name === 'redis') this.redisUp = healthy ? 1 : 0;
    else this.storageUp = healthy ? 1 : 0;
  }
  workerRun(name: string, succeeded: boolean) {
    const workers = ['notification_email', 'warranty_expiration', 'evidence_retention'];
    if (!workers.includes(name)) return;
    (succeeded ? this.workerSuccess : this.workerFailure).set(name, Date.now());
  }
  setEmailQueue(count: number, oldestSeconds: number) {
    this.emailQueued = Math.max(0, count);
    this.emailOldestSeconds = Math.max(0, oldestSeconds);
  }

  renderPrometheus(): string {
    const lines = [
      '# HELP repairproof_process_uptime_seconds Process uptime.',
      '# TYPE repairproof_process_uptime_seconds gauge',
      `repairproof_process_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`,
      '# HELP repairproof_http_requests_in_flight Requests currently being handled.',
      '# TYPE repairproof_http_requests_in_flight gauge',
      `repairproof_http_requests_in_flight ${this.inFlight}`,
      '# HELP repairproof_dependency_up Dependency health (1=healthy, 0=unhealthy).',
      '# TYPE repairproof_dependency_up gauge',
      `repairproof_dependency_up{dependency="postgres"} ${this.dbUp}`,
      `repairproof_dependency_up{dependency="redis"} ${this.redisUp}`,
      `repairproof_dependency_up{dependency="evidence_storage"} ${this.storageUp}`,
      '# HELP repairproof_notification_email_queued Number of queued or expired-lock email notifications.',
      '# TYPE repairproof_notification_email_queued gauge',
      `repairproof_notification_email_queued ${this.emailQueued}`,
      '# HELP repairproof_notification_email_oldest_seconds Age of oldest queued email notification.',
      '# TYPE repairproof_notification_email_oldest_seconds gauge',
      `repairproof_notification_email_oldest_seconds ${this.emailOldestSeconds}`,
      '# HELP repairproof_worker_last_success_timestamp_seconds Unix timestamp of most recent successful worker pass.',
      '# TYPE repairproof_worker_last_success_timestamp_seconds gauge',
      ...[...this.workerSuccess].map(
        ([worker, at]) =>
          `repairproof_worker_last_success_timestamp_seconds{worker="${worker}"} ${Math.floor(at / 1000)}`,
      ),
      '# HELP repairproof_worker_last_failure_timestamp_seconds Unix timestamp of most recent failed worker pass.',
      '# TYPE repairproof_worker_last_failure_timestamp_seconds gauge',
      ...[...this.workerFailure].map(
        ([worker, at]) =>
          `repairproof_worker_last_failure_timestamp_seconds{worker="${worker}"} ${Math.floor(at / 1000)}`,
      ),
      '# HELP repairproof_http_request_duration_seconds HTTP request duration.',
      '# TYPE repairproof_http_request_duration_seconds histogram',
    ];
    for (const [key, sample] of this.requests) {
      const [method, route, statusClass] = key.split('|');
      const labels = `method="${method}",route="${route.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}",status_class="${statusClass}"`;
      this.bounds.forEach((bound, index) =>
        lines.push(
          `repairproof_http_request_duration_seconds_bucket{${labels},le="${bound}"} ${sample.buckets[index]}`,
        ),
      );
      lines.push(
        `repairproof_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${sample.count}`,
      );
      lines.push(`repairproof_http_request_duration_seconds_sum{${labels}} ${sample.sum}`);
      lines.push(`repairproof_http_request_duration_seconds_count{${labels}} ${sample.count}`);
    }
    return `${lines.join('\n')}\n`;
  }
}
