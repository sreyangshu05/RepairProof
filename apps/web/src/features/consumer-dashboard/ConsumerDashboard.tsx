import { tx } from '../../i18n/catalog';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileSearch,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PageEmptyState } from '../../components/ui/page-empty-state';
import { Skeleton } from '../../components/ui/skeleton';
import { getApiErrorMessage } from '../../lib/api';
import { cn, formatLocalizedDate } from '../../lib/utils';
import { getActiveLocale, useI18n } from '../../i18n/I18nProvider';
import { useConsumerDashboard } from './use-consumer-dashboard';
import type { ConsumerDevice, RepairStage } from './types';

type DeviceFilter = 'all' | 'active' | 'expiring' | 'no-warranty';

const activeStages: RepairStage[] = ['Awaiting approval', 'In repair', 'Ready for testing'];
const today = new Date();
const soon = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

function isWarrantyExpiring(device: ConsumerDevice) {
  if (!device.warranty) return false;
  const end = new Date(`${device.warranty.endsAt}T23:59:59`);
  return end >= today && end <= soon;
}

function formatDate(value: string) {
  return formatLocalizedDate(value);
}

function formatRelative(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(getActiveLocale(), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function ConsumerDashboard() {
  useI18n();
  const { data, isLoading, isError, error, refetch, isFetching } = useConsumerDashboard();
  const fixtureMode = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FIXTURES === 'true';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const [announcement, setAnnouncement] = useState('');
  const devices = useMemo(() => data?.devices ?? [], [data?.devices]);

  const activeCases = useMemo(
    () =>
      devices.flatMap((device) =>
        device.latestRepair && activeStages.includes(device.latestRepair.stage)
          ? [{ ...device.latestRepair, deviceName: `${device.manufacturer} ${device.model}` }]
          : [],
      ),
    [devices],
  );
  const completedRepairs = useMemo(
    () =>
      devices.flatMap((device) =>
        device.history
          .filter((repair) => repair.stage === 'Completed')
          .map((repair) => ({ ...repair, deviceName: `${device.manufacturer} ${device.model}` })),
      ),
    [devices],
  );
  const expiringWarranties = useMemo(() => devices.filter(isWarrantyExpiring), [devices]);
  const matchingDevices = useMemo(
    () =>
      devices.filter((device) => {
        const term = search.trim().toLocaleLowerCase();
        const matchesSearch =
          !term || `${device.manufacturer} ${device.model}`.toLocaleLowerCase().includes(term);
        const matchesFilter =
          filter === 'all' ||
          (filter === 'active' &&
            !!device.latestRepair &&
            activeStages.includes(device.latestRepair.stage)) ||
          (filter === 'expiring' && isWarrantyExpiring(device)) ||
          (filter === 'no-warranty' && !device.warranty);
        return matchesSearch && matchesFilter;
      }),
    [devices, filter, search],
  );

  if (!fixtureMode) {
    return (
      <PageEmptyState
        title="Consumer accounts are not available yet"
        description="For this release, customers can review quotations through an authorization link and verify published repair certificates."
        action={<Link className="text-primary underline" to="/verify">Verify a repair certificate</Link>}
      />
    );
  }

  if (isLoading) return <ConsumerDashboardLoading />;
  if (isError)
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5" role="alert">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="flex-1">
              <h2 className="font-semibold">{tx('Your dashboard could not load')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {getApiErrorMessage(error, 'Check your connection and try again.')}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                {tx('Try again ')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-6 sm:space-y-7">
      {fixtureMode && (
        <div
          role="note"
          className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs leading-5 text-warning"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{tx('Development mock data.')}</strong>{' '}
            {tx(
              ' These fictional sample records are not verified real-world repairs, devices, warranties, or notifications. ',
            )}
          </span>
        </div>
      )}

      <section aria-label={tx('Repair overview')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <OverviewCard
          title={tx('Registered devices')}
          count={devices.length}
          detail="In your library"
          icon={Smartphone}
          href="/consumer/devices"
        />
        <OverviewCard
          title={tx('Active repairs')}
          count={activeCases.length}
          detail="Need a next step"
          icon={Wrench}
          href="/consumer/history"
        />
        <OverviewCard
          title={tx('Completed repairs')}
          count={completedRepairs.length}
          detail="In your device history"
          icon={FileCheck2}
          href="/consumer/history"
        />
        <OverviewCard
          title={tx('Warranty expirations')}
          count={expiringWarranties.length}
          detail="Within the next 90 days"
          icon={CalendarClock}
          href="/consumer/warranties"
        />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section
            aria-labelledby="devices-heading"
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            <div className="flex flex-col gap-4 border-b p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
                  {tx('Your library ')}
                </p>
                <h2 id="devices-heading" className="mt-1 text-base font-semibold">
                  {tx('Devices & repair history ')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tx('Search your devices and review their latest recorded repair. ')}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_190px] lg:w-[430px]">
                <label className="relative block">
                  <span className="sr-only">{tx('Search devices')}</span>
                  <Search
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={tx('Search manufacturer or model')}
                    className="pl-9"
                  />
                </label>
                <label className="relative block">
                  <span className="sr-only">{tx('Filter devices')}</span>
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value as DeviceFilter)}
                    className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">{tx('All devices')}</option>
                    <option value="active">{tx('Active repair')}</option>
                    <option value="expiring">{tx('Warranty ending soon')}</option>
                    <option value="no-warranty">{tx('No active warranty')}</option>
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                </label>
              </div>
            </div>
            {devices.length === 0 ? (
              <div className="p-5">
                <PageEmptyState
                  title={tx('No devices registered yet')}
                  description={tx(
                    'Add a device to connect its repair cases, certificates, and warranty information.',
                  )}
                  action={
                    <Button asChild>
                      <Link to="/consumer/register-device">
                        <Plus className="h-4 w-4" />
                        {tx('Register a device ')}
                      </Link>
                    </Button>
                  }
                />
              </div>
            ) : matchingDevices.length === 0 ? (
              <div className="p-5">
                <PageEmptyState
                  title={tx('No devices match those filters')}
                  description={tx(
                    'Try another search or clear the current filters to see your full device library.',
                  )}
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch('');
                        setFilter('all');
                      }}
                    >
                      {tx('Clear filters ')}
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-5 py-3">
                          {tx('Device ')}
                        </th>
                        <th scope="col" className="px-4 py-3">
                          {tx('Registered ')}
                        </th>
                        <th scope="col" className="px-4 py-3">
                          {tx('Repairs ')}
                        </th>
                        <th scope="col" className="px-4 py-3">
                          {tx('Warranty ')}
                        </th>
                        <th scope="col" className="px-4 py-3">
                          {tx('Latest repair ')}
                        </th>
                        <th scope="col" className="px-4 py-3">
                          <span className="sr-only">{tx('View device')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {matchingDevices.map((device) => (
                        <DeviceTableRow key={device.id} device={device} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y md:hidden">
                  {matchingDevices.map((device) => (
                    <DeviceCard key={device.id} device={device} />
                  ))}
                </div>
              </>
            )}
            <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {tx('Showing ')}
                {matchingDevices.length} {tx(' of ')}
                {devices.length} {tx(' devices ')}
              </span>
              <Link
                className="inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:underline"
                to="/consumer/devices"
              >
                {tx('View all devices ')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section
              aria-labelledby="active-repairs-heading"
              className="overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              <SectionHeading
                id="active-repairs-heading"
                title={tx('Active repair cases')}
                detail={`${activeCases.length} ${activeCases.length === 1 ? 'case' : 'cases'} in progress`}
                icon={Wrench}
              />
              <div className="divide-y">
                {activeCases.length ? (
                  activeCases.map((repair) => (
                    <Link
                      key={repair.reference}
                      to="/consumer/case"
                      className="flex min-h-[74px] items-center gap-3 p-4 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
                        <Wrench className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {repair.deviceName}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {repair.reference}
                          {' · '}
                          {repair.title}
                        </span>
                      </span>
                      <StageBadge stage={repair.stage} />
                    </Link>
                  ))
                ) : (
                  <InlineEmpty
                    text="No active repair cases right now."
                    href="/consumer/history"
                    linkLabel="Review repair history"
                  />
                )}
              </div>
            </section>
            <section
              aria-labelledby="completed-heading"
              className="overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              <SectionHeading
                id="completed-heading"
                title={tx('Completed repairs')}
                detail="Recorded on your devices"
                icon={ClipboardCheck}
              />
              <div className="divide-y">
                {completedRepairs.length ? (
                  completedRepairs.slice(0, 4).map((repair) => (
                    <Link
                      key={repair.reference}
                      to="/consumer/certificate"
                      className="flex min-h-[74px] items-center gap-3 p-4 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {repair.deviceName}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {repair.title}
                          {' · '}
                          {formatDate(repair.date)}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))
                ) : (
                  <InlineEmpty
                    text="Completed repairs will appear here."
                    href="/consumer/devices"
                    linkLabel="View devices"
                  />
                )}
              </div>
            </section>
          </div>
        </div>

        <aside className="space-y-5">
          <section
            id="consumer-notifications"
            aria-labelledby="notifications-heading"
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            <SectionHeading
              id="notifications-heading"
              title={tx('Notifications')}
              detail={`${data?.notifications.filter((item) => item.unread).length ?? 0} unread`}
              icon={Bell}
              action={
                <button
                  type="button"
                  aria-label={tx('Refresh notifications and dashboard')}
                  onClick={() => void refetch()}
                  className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                </button>
              }
            />
            <div className="divide-y">
              {data?.notifications.length ? (
                data.notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    to={notification.href}
                    onClick={() => setAnnouncement(`Opened notification: ${notification.title}`)}
                    className="flex gap-3 p-4 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-1 h-2 w-2 shrink-0 rounded-full',
                        notification.unread ? 'bg-primary' : 'bg-border',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{notification.title}</span>
                        <time className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelative(notification.createdAt)}
                        </time>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {notification.detail}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <InlineEmpty
                  text="You're all caught up. New updates will appear here."
                  href="/consumer/history"
                  linkLabel="View your records"
                />
              )}
            </div>
            <div role="status" aria-live="polite" className="sr-only">
              {announcement}
            </div>
          </section>

          <section
            aria-labelledby="warranty-heading"
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            <SectionHeading
              id="warranty-heading"
              title={tx('Warranty expirations')}
              detail="The next 90 days"
              icon={ShieldCheck}
              action={
                <Link
                  to="/consumer/warranties"
                  aria-label={tx('View all warranties')}
                  className="grid h-10 w-10 place-items-center rounded-md text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            <div className="divide-y">
              {expiringWarranties.length ? (
                expiringWarranties.map((device) => (
                  <Link
                    key={device.id}
                    to="/consumer/warranties"
                    className="block p-4 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{device.model}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {device.warranty?.coverage}
                        </p>
                      </div>
                      <span className="rounded-full bg-warning/10 px-2.5 py-1 text-[10px] font-medium text-warning">
                        {device.warranty && formatDate(device.warranty.endsAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {tx('Coverage by ')}
                      {device.warranty?.provider}
                    </p>
                  </Link>
                ))
              ) : (
                <InlineEmpty
                  text="No coverage is due to end in the next 90 days."
                  href="/consumer/warranties"
                  linkLabel="View coverage"
                />
              )}
            </div>
          </section>

          <section
            aria-labelledby="activity-heading"
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            <SectionHeading
              id="activity-heading"
              title={tx('Recent activity')}
              detail="Latest record updates"
              icon={Activity}
            />
            <ol className="divide-y">
              {data?.activity.length ? (
                data.activity.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      className="flex gap-3 p-4 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="relative mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                        <Clock3 className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                        <time className="mt-2 block text-[10px] text-muted-foreground">
                          {formatRelative(item.createdAt)}
                        </time>
                      </span>
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  <InlineEmpty
                    text="Device and repair activity will appear here."
                    href="/consumer/devices"
                    linkLabel="Register a device"
                  />
                </li>
              )}
            </ol>
          </section>
        </aside>
      </div>

      <section
        aria-labelledby="quick-actions-heading"
        className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
              {tx('Move things forward ')}
            </p>
            <h2 id="quick-actions-heading" className="mt-1 text-sm font-semibold">
              {tx('Quick actions ')}
            </h2>
          </div>
          <Link
            to="/consumer/settings"
            className="hidden min-h-11 items-center text-xs text-muted-foreground hover:text-foreground sm:flex"
          >
            {tx('Account settings ')}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            icon={Plus}
            label={tx('Register a device')}
            description={tx('Add to your library')}
            href="/consumer/register-device"
          />
          <QuickAction
            icon={FileSearch}
            label={tx('Review an estimate')}
            description={tx('See pending approvals')}
            href="/consumer/approval"
          />
          <QuickAction
            icon={ShieldCheck}
            label={tx('Check warranty')}
            description={tx('Review active coverage')}
            href="/consumer/warranties"
          />
          <QuickAction
            icon={CircleAlert}
            label={tx('Get help with a repair')}
            description={tx('Open the dispute center')}
            href="/consumer/disputes"
          />
        </div>
        <Link
          to="/consumer/settings"
          className="mt-3 inline-flex min-h-11 items-center text-xs text-muted-foreground hover:text-foreground sm:hidden"
        >
          {tx('Account settings ')}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}

function OverviewCard({
  title,
  count,
  detail,
  icon: Icon,
  href,
}: {
  title: string;
  count: number;
  detail: string;
  icon: typeof Smartphone;
  href: string;
}) {
  const { formatNumber } = useI18n();
  return (
    <Link
      to={href}
      className="group rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-5 text-muted-foreground">{title}</span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
        {formatNumber(count)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </Link>
  );
}

function SectionHeading({
  id,
  title,
  detail,
  icon: Icon,
  action,
}: {
  id: string;
  title: string;
  detail: string;
  icon: typeof Smartphone;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      {action}
    </div>
  );
}

function StageBadge({ stage }: { stage: RepairStage }) {
  const styles: Record<RepairStage, string> = {
    'Awaiting approval': 'bg-warning/10 text-warning',
    'In repair': 'bg-info/10 text-info',
    'Ready for testing': 'bg-secondary text-secondary-foreground',
    Completed: 'bg-success/10 text-success',
  };
  return <Badge className={cn('shrink-0 border-0 text-[10px]', styles[stage])}>{tx(stage)}</Badge>;
}

function DeviceTableRow({ device }: { device: ConsumerDevice }) {
  return (
    <tr className="align-top hover:bg-muted/20">
      <th scope="row" className="px-5 py-4 font-medium">
        <Link to="/consumer/device-details" className="hover:text-primary hover:underline">
          {device.manufacturer}
          <span className="block pt-0.5 text-xs font-normal text-muted-foreground">
            {device.model}
          </span>
        </Link>
      </th>
      <td className="px-4 py-4 text-xs text-muted-foreground">
        {formatDate(device.registrationDate)}
      </td>
      <td className="px-4 py-4 text-xs">
        {device.repairCount} {device.repairCount === 1 ? 'repair' : 'repairs'}
      </td>
      <td className="px-4 py-4">
        {device.warranty ? (
          <span>
            <span className="block text-xs font-medium">{tx('Active')}</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              {tx('to ')}
              {formatDate(device.warranty.endsAt)}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{tx('No active warranty')}</span>
        )}
      </td>
      <td className="px-4 py-4">
        {device.latestRepair ? (
          <span>
            <StageBadge stage={device.latestRepair.stage} />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              {device.latestRepair.title}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{tx('No repair recorded')}</span>
        )}
      </td>
      <td className="px-4 py-4">
        <Link
          to="/consumer/device-details"
          aria-label={`View ${device.manufacturer} ${device.model} details`}
          className="grid h-11 w-11 place-items-center rounded-md text-primary hover:bg-muted"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function DeviceCard({ device }: { device: ConsumerDevice }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{device.manufacturer}</p>
          <h3 className="mt-0.5 font-semibold">{device.model}</h3>
        </div>
        <Link
          to="/consumer/device-details"
          aria-label={`View ${device.manufacturer} ${device.model} details`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md border text-primary"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
        <div>
          <dt className="text-muted-foreground">{tx('Registered')}</dt>
          <dd className="mt-1 font-medium">{formatDate(device.registrationDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{tx('Repair count')}</dt>
          <dd className="mt-1 font-medium">{device.repairCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{tx('Warranty')}</dt>
          <dd className="mt-1 font-medium">
            {device.warranty
              ? `Active Â· to ${formatDate(device.warranty.endsAt)}`
              : 'No active warranty'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{tx('Latest repair')}</dt>
          <dd className="mt-1">
            {device.latestRepair ? (
              <StageBadge stage={device.latestRepair.stage} />
            ) : (
              <span className="text-muted-foreground">{tx('None')}</span>
            )}
          </dd>
        </div>
      </dl>
      <details className="mt-4 border-t pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-medium">
          {tx('Device repair history ')}
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        </summary>
        <ol className="space-y-3 pb-2">
          {device.history.map((repair) => (
            <li className="flex items-start justify-between gap-3" key={repair.reference}>
              <div>
                <Link
                  to={repair.stage === 'Completed' ? '/consumer/certificate' : '/consumer/case'}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {repair.title}
                </Link>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {repair.reference}
                  {' · '}
                  {formatDate(repair.date)}
                </p>
              </div>
              <StageBadge stage={repair.stage} />
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}

function InlineEmpty({ text, href, linkLabel }: { text: string; href: string; linkLabel: string }) {
  return (
    <div className="p-4">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link
        to={href}
        className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  href,
}: {
  icon: typeof Smartphone;
  label: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="flex min-h-[68px] items-center gap-3 rounded-lg border px-3 py-3 hover:border-primary/40 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{label}</span>
        <span className="mt-1 block truncate text-[10px] text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function ConsumerDashboardLoading() {
  return (
    <div aria-busy="true" aria-label={tx('Loading consumer dashboard')} className="space-y-6">
      <span className="sr-only">{tx('Loading your devices and repair activity')}</span>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Skeleton className="h-[420px] rounded-xl" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
