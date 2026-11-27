import type { CaseStatus } from './types';
import { getCurrentLocale, tx } from '../../i18n/catalog';

export type QueueFilter =
  'all' | 'incoming' | 'assigned' | 'pending_approval' | 'active' | 'completed';

export const filters: Array<{ id: QueueFilter; label: string }> = [
  { id: 'all', label: tx('All cases') },
  { id: 'incoming', label: tx('Incoming') },
  { id: 'assigned', label: tx('Assigned') },
  { id: 'pending_approval', label: tx('Pending approval') },
  { id: 'active', label: tx('Active repairs') },
  { id: 'completed', label: tx('Completed') },
];

export function queueFilterForPath(path: string): QueueFilter {
  if (path.endsWith('/inbox')) return 'incoming';
  if (path.endsWith('/diagnostics')) return 'assigned';
  if (path.endsWith('/quotes')) return 'pending_approval';
  if (path.endsWith('/execution') || path.endsWith('/testing')) return 'active';
  if (path.endsWith('/certificates') || path.endsWith('/warranties')) return 'completed';
  return 'all';
}

export function statusLabel(status: CaseStatus) {
  const labels: Record<CaseStatus, string> = {
    incoming: tx('Incoming'),
    assigned: tx('Assigned'),
    diagnosing: tx('Diagnosing'),
    pending_approval: tx('Pending approval'),
    approved: tx('Approved'),
    in_repair: tx('In repair'),
    testing: tx('Testing'),
    completed: tx('Completed'),
    rejected: tx('Rejected'),
    disputed: tx('Disputed'),
    cancelled: tx('Cancelled'),
  };
  return labels[status];
}

export function statusTone(status: CaseStatus) {
  if (status === 'completed') return 'bg-success/10 text-success';
  if (status === 'pending_approval') return 'bg-warning/10 text-warning';
  if (status === 'in_repair' || status === 'testing' || status === 'diagnosing')
    return 'bg-info/10 text-info';
  return 'bg-secondary text-secondary-foreground';
}

export function matchesFilter(status: CaseStatus, filter: QueueFilter) {
  if (filter === 'all') return true;
  if (filter === 'incoming') return status === 'incoming';
  if (filter === 'assigned') return status === 'assigned' || status === 'diagnosing';
  if (filter === 'pending_approval') return status === 'pending_approval';
  if (filter === 'active')
    return status === 'approved' || status === 'in_repair' || status === 'testing';
  return status === 'completed';
}

export function relative(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
