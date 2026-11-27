import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from './utils';

describe('Frontend Utils', () => {
  it('formats currency correctly', () => {
    expect(formatCurrency(180)).toContain('180.00');
    expect(formatCurrency(0)).toContain('0.00');
  });

  it('formats dates cleanly', () => {
    const date = new Date('2026-11-18T10:00:00Z');
    const formatted = formatDate(date);
    expect(formatted).not.toBe('N/A');
    expect(formatted).toContain('2026');
  });

  it('handles null date gracefully', () => {
    expect(formatDate(null)).toBe('Not available');
    expect(formatDate(undefined)).toBe('Not available');
  });
});
