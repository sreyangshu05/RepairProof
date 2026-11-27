export interface PriceSample {
  amount: number;
  shopId: string;
  transactionAt: Date;
}
export { normalizePriceLabel } from '../../common/text-normalization';

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length < 2) return sorted[0] ?? 0;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function removePriceOutliers(samples: PriceSample[]): {
  samples: PriceSample[];
  outliersRemoved: number;
} {
  if (samples.length < 8) return { samples, outliersRemoved: 0 };
  const values = samples.map((sample) => sample.amount);
  const center = median(values);
  const deviations = values.map((value) => Math.abs(value - center));
  const mad = median(deviations);
  let lower: number;
  let upper: number;
  if (mad > 0) {
    const radius = 3.5 * 1.4826 * mad;
    lower = center - radius;
    upper = center + radius;
  } else {
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);
    const iqr = q3 - q1;
    const tolerance = iqr > 0 ? 3 * iqr : Math.max(Math.abs(center) * 0.05, 0.01);
    lower = q1 - tolerance;
    upper = q3 + tolerance;
  }
  const retained = samples.filter((sample) => sample.amount >= lower && sample.amount <= upper);
  return { samples: retained, outliersRemoved: samples.length - retained.length };
}

export function pricePercentileRange(samples: PriceSample[]): { low: number; high: number } {
  const values = samples.map((sample) => sample.amount);
  return { low: quantile(values, 0.2), high: quantile(values, 0.8) };
}
