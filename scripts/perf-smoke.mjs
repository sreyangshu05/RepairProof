#!/usr/bin/env node
// Safe read-only API latency smoke. Point only at a RepairProof environment you are authorized to test.
const target = new URL(process.env.REPAIRPROOF_PERF_URL ?? 'http://127.0.0.1:3001/health/live');
const loopback = ['127.0.0.1', 'localhost', '::1'].includes(target.hostname);
if (!['http:', 'https:'].includes(target.protocol) || (!loopback && process.env.REPAIRPROOF_PERF_ALLOW_REMOTE !== 'true')) {
  throw new Error('Performance target must be loopback unless REPAIRPROOF_PERF_ALLOW_REMOTE=true is explicitly set');
}
const concurrency = Math.min(16, Math.max(1, Number(process.env.REPAIRPROOF_PERF_CONCURRENCY ?? 4)));
const durationSeconds = Math.min(30, Math.max(1, Number(process.env.REPAIRPROOF_PERF_DURATION_SECONDS ?? 5)));
const budgetMs = Number(process.env.REPAIRPROOF_PERF_P95_BUDGET_MS ?? 750);
if (!Number.isInteger(concurrency) || !Number.isFinite(budgetMs) || budgetMs <= 0) throw new Error('Invalid performance test settings');
const samples = [];
let failures = 0;
let stopping = false;
const deadline = Date.now() + durationSeconds * 1000;
const token = process.env.REPAIRPROOF_PERF_BEARER_TOKEN;

async function worker() {
  while (!stopping && Date.now() < deadline) {
    const started = performance.now();
    try {
      const response = await fetch(target, {
        method: 'GET',
        headers: { 'X-API-Version': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch {
      failures += 1;
    } finally {
      samples.push(performance.now() - started);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
stopping = true;
const sorted = samples.toSorted((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
const p95 = percentile(0.95);
const throughput = samples.length / durationSeconds;
console.log(JSON.stringify({ target: `${target.origin}${target.pathname}`, concurrency, durationSeconds, requests: samples.length, failures, requestsPerSecond: Number(throughput.toFixed(2)), p50Ms: Number(percentile(0.5).toFixed(1)), p95Ms: Number(p95.toFixed(1)), p99Ms: Number(percentile(0.99).toFixed(1)), p95BudgetMs: budgetMs }));
if (!samples.length || failures || p95 > budgetMs) process.exitCode = 1;
