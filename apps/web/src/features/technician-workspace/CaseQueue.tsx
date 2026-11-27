import { tx } from '../../i18n/catalog';
import { useMemo, useState } from 'react';
import { Clock3, Search, UserRound } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import { filters, matchesFilter, relative, type QueueFilter } from './case-queue-utils';
import { statusLabel } from './case-queue-utils';
import type { TechnicianCase } from './types';

export function CaseQueue({
  cases,
  selectedId,
  onSelect,
  initialFilter = 'all',
}: {
  cases: TechnicianCase[];
  selectedId: string;
  onSelect: (id: string) => void;
  initialFilter?: QueueFilter;
}) {
  const [filter, setFilter] = useState<QueueFilter>(initialFilter);
  const [search, setSearch] = useState('');

  const filteredCases = useMemo(
    () =>
      cases.filter((repairCase) => {
        const text =
          `${repairCase.reference} ${repairCase.customerName} ${repairCase.device.manufacturer} ${repairCase.device.model} ${repairCase.issueSummary}`.toLocaleLowerCase();
        const normalizedSearch = search.trim().toLocaleLowerCase();
        return (
          (!normalizedSearch || text.includes(normalizedSearch)) &&
          matchesFilter(repairCase.status, filter)
        );
      }),
    [cases, filter, search],
  );

  return (
    <section
      aria-labelledby="case-queue-title"
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
              {tx('Work queue ')}
            </p>
            <h2 id="case-queue-title" className="mt-1 text-sm font-semibold">
              {tx('Repair cases ')}
            </h2>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums">
            {filteredCases.length}
          </span>
        </div>
        <label className="relative mt-4 block">
          <span className="sr-only">{tx('Search repair cases')}</span>
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tx('Search case, device, customer')}
            className="pl-9"
          />
        </label>
        <div
          className="mt-3 flex gap-1.5 overflow-x-auto pb-1"
          role="group"
          aria-label={tx('Filter repair cases')}
        >
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={cn(
                'min-h-11 shrink-0 rounded-full border px-3 text-xs font-medium',
                filter === item.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {tx(item.label)}
            </button>
          ))}
        </div>
      </div>
      {filteredCases.length ? (
        <div className="max-h-[min(58vh,740px)] divide-y overflow-y-auto">
          {filteredCases.map((repairCase) => (
            <CaseQueueItem
              key={repairCase.id}
              repairCase={repairCase}
              active={repairCase.id === selectedId}
              onClick={() => onSelect(repairCase.id)}
            />
          ))}
        </div>
      ) : (
        <div className="p-5">
          <p className="text-sm font-medium">{tx('No cases in this view')}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {tx('Try another queue filter or search term. ')}
          </p>
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setSearch('');
            }}
            className="mt-3 min-h-11 text-xs font-medium text-primary underline underline-offset-4"
          >
            {tx('Show all cases ')}
          </button>
        </div>
      )}
    </section>
  );
}

function CaseQueueItem({
  repairCase,
  active,
  onClick,
}: {
  repairCase: TechnicianCase;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'w-full border-l-2 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        active ? 'border-l-primary bg-primary/5' : 'border-l-transparent',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="rp-code text-[11px] font-semibold text-primary">
          {repairCase.reference}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-1 text-[10px] font-medium',
            repairCase.priority === 'time-sensitive'
              ? 'bg-warning/10 text-warning'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {repairCase.priority === 'time-sensitive'
            ? 'Time-sensitive'
            : tx(statusLabel(repairCase.status))}
        </span>
      </span>
      <span className="mt-2 block text-sm font-semibold">
        {repairCase.device.manufacturer} {repairCase.device.model}
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {repairCase.issueSummary}
      </span>
      <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="h-3 w-3" />
          {repairCase.customerName}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          {tx('Updated ')}
          {relative(repairCase.updatedAt)}
        </span>
      </span>
    </button>
  );
}
