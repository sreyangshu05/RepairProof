import { tx } from '../../i18n/catalog';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileClock,
  FileSearch,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { AnalyticsConsentSettings } from '../../features/settings/AnalyticsConsentSettings';
import type { MessageKey } from '../../i18n/catalog';

const ConsumerDashboard = React.lazy(() =>
  import('../../features/consumer-dashboard/ConsumerDashboard').then((module) => ({
    default: module.ConsumerDashboard,
  })),
);
const TechnicianWorkspace = React.lazy(() =>
  import('../../features/technician-workspace/TechnicianWorkspace').then((module) => ({
    default: module.TechnicianWorkspace,
  })),
);
const FeatureFlagConsole = React.lazy(() =>
  import('../../features/platform-admin/FeatureFlagConsole').then((module) => ({
    default: module.FeatureFlagConsole,
  })),
);

type Role = 'consumer' | 'technician' | 'shop' | 'admin';
type NavItem = { label: string; path: string; icon: React.ElementType };
const navTranslation: Record<string, MessageKey> = {
  Overview: 'nav.overview',
  'My devices': 'nav.devices',
  'Repair history': 'nav.history',
  Warranties: 'nav.warranties',
  Disputes: 'nav.disputes',
  'Account settings': 'nav.settings',
  Workbench: 'nav.workbench',
  'Repair inbox': 'nav.inbox',
  'New repair': 'nav.newRepair',
  Diagnostics: 'nav.diagnostics',
  'Quote builder': 'nav.quotes',
  'Repair tracker': 'nav.tracker',
  'Quality tests': 'nav.tests',
  Certificates: 'nav.certificates',
  'Business overview': 'nav.businessOverview',
  Staff: 'nav.staff',
  Analytics: 'nav.analytics',
  Customers: 'nav.customers',
  Services: 'nav.services',
  Inventory: 'nav.inventory',
  'Business settings': 'nav.businessSettings',
  'Platform overview': 'nav.platformOverview',
  Users: 'nav.users',
  Organizations: 'nav.organizations',
  'Dispute review': 'nav.disputeReview',
  'Audit logs': 'nav.auditLogs',
  'System health': 'nav.systemHealth',
  Configuration: 'nav.configuration',
};

const nav: Record<Role, NavItem[]> = {
  consumer: [
    { label: 'Overview', path: '/consumer/dashboard', icon: LayoutDashboard },
    { label: 'My devices', path: '/consumer/devices', icon: Smartphone },
    { label: 'Repair history', path: '/consumer/history', icon: ClipboardList },
    { label: 'Warranties', path: '/consumer/warranties', icon: ShieldCheck },
    { label: 'Disputes', path: '/consumer/disputes', icon: FileSearch },
    { label: 'Account settings', path: '/consumer/settings', icon: Settings2 },
  ],
  technician: [
    { label: 'Workbench', path: '/technician/dashboard', icon: LayoutDashboard },
    { label: 'Repair inbox', path: '/technician/inbox', icon: ClipboardList },
    { label: 'New repair', path: '/technician/new-case', icon: Plus },
    { label: 'Diagnostics', path: '/technician/diagnostics', icon: FileSearch },
    { label: 'Quote builder', path: '/technician/quotes', icon: FileText },
    { label: 'Repair tracker', path: '/technician/execution', icon: Wrench },
    { label: 'Quality tests', path: '/technician/testing', icon: ClipboardCheck },
    { label: 'Certificates', path: '/technician/certificates', icon: BadgeCheck },
    { label: 'Warranties', path: '/technician/warranties', icon: ShieldCheck },
  ],
  shop: [
    { label: 'Business overview', path: '/shop/dashboard', icon: LayoutDashboard },
    { label: 'Staff', path: '/shop/staff', icon: Users },
    { label: 'Analytics', path: '/shop/analytics', icon: Activity },
    { label: 'Customers', path: '/shop/customers', icon: Users },
    { label: 'Services', path: '/shop/services', icon: Wrench },
    { label: 'Inventory', path: '/shop/inventory', icon: Package },
    { label: 'Business settings', path: '/shop/settings', icon: Settings2 },
  ],
  admin: [
    { label: 'Platform overview', path: '/admin/overview', icon: LayoutDashboard },
    { label: 'Users', path: '/admin/users', icon: Users },
    { label: 'Organizations', path: '/admin/organizations', icon: Building2 },
    { label: 'Dispute review', path: '/admin/disputes', icon: FileSearch },
    { label: 'Audit logs', path: '/admin/audit', icon: FileClock },
    { label: 'System health', path: '/admin/health', icon: Activity },
    { label: 'Configuration', path: '/admin/config', icon: Settings2 },
  ],
};

const roleLabel: Record<Role, string> = {
  consumer: 'My RepairProof',
  technician: 'Technician workspace',
  shop: 'Business workspace',
  admin: 'Operations console',
};

const pageMeta: Record<
  string,
  { title: string; eyebrow: string; subtitle: string; action?: string }
> = {
  '/consumer/dashboard': {
    title: 'Good morning, Jordan',
    eyebrow: 'YOUR REPAIR RECORDS',
    subtitle: 'A clear view of your devices, repairs, and coverage.',
    action: 'Register a device',
  },
  '/consumer/devices': {
    title: 'Your devices',
    eyebrow: 'DEVICE LIBRARY',
    subtitle: 'Keep your repair records connected to the devices you own.',
    action: 'Register a device',
  },
  '/consumer/register-device': {
    title: 'Register a device',
    eyebrow: 'DEVICE LIBRARY · NEW DEVICE',
    subtitle: 'Add a device so repair records can stay connected to it.',
  },
  '/consumer/device-details': {
    title: 'iPhone 14 Pro',
    eyebrow: 'DEVICE DETAILS',
    subtitle: 'Your device record and verified repair history.',
    action: 'View repair history',
  },
  '/consumer/history': {
    title: 'Repair history',
    eyebrow: 'YOUR RECORDS',
    subtitle: 'Every documented repair, organized in one place.',
    action: 'Add a repair',
  },
  '/consumer/case': {
    title: 'Screen and battery repair',
    eyebrow: 'REPAIR RP-2026-01842',
    subtitle: 'A complete record from intake through final testing.',
  },
  '/consumer/compare': {
    title: 'Review estimate',
    eyebrow: 'QUOTE COMPARISON · RP-2026-01842',
    subtitle: 'Compare the current estimate with the previous version.',
  },
  '/consumer/approval': {
    title: 'Your decision',
    eyebrow: 'ESTIMATE V2 · VALID THROUGH MAY 28',
    subtitle: 'Review the work and total before authorizing the repair.',
  },
  '/consumer/certificate': {
    title: 'Repair certificate',
    eyebrow: 'VERIFIED REPAIR RECORD',
    subtitle: 'A shareable record of work completed and checks performed.',
  },
  '/consumer/passport': {
    title: 'Device passport',
    eyebrow: 'DEVICE HISTORY',
    subtitle: 'A portable repair record for your device.',
  },
  '/consumer/warranties': {
    title: 'Warranty coverage',
    eyebrow: 'YOUR COVERAGE',
    subtitle: 'See what is covered and when coverage ends.',
  },
  '/consumer/disputes': {
    title: 'Help with a repair',
    eyebrow: 'SUPPORT & DISPUTES',
    subtitle: 'Ask a question or submit a concern with the relevant record attached.',
    action: 'Start a request',
  },
  '/consumer/settings': {
    title: 'Account settings',
    eyebrow: 'YOUR ACCOUNT',
    subtitle: 'Manage your contact information, privacy, and preferences.',
  },
  '/technician/dashboard': {
    title: 'Workbench',
    eyebrow: 'REPAIR QUEUE',
    subtitle: 'Your repair queue, organized around the next action.',
    action: 'Start a repair',
  },
  '/technician/inbox': {
    title: 'Repair inbox',
    eyebrow: 'MY WORK',
    subtitle: 'Cases assigned to you and repairs that need attention.',
    action: 'New repair case',
  },
  '/technician/new-case': {
    title: 'Start a repair',
    eyebrow: 'NEW CASE · STEP 1 OF 3',
    subtitle: 'Find a device or capture intake details to open a repair record.',
  },
  '/technician/diagnostics': {
    title: 'Diagnostic workspace',
    eyebrow: 'RP-2026-01842 · DIAGNOSIS',
    subtitle: 'Record what you observed and connect each finding to evidence.',
  },
  '/technician/evidence': {
    title: 'Evidence capture',
    eyebrow: 'CASE EVIDENCE',
    subtitle: 'Upload clear, relevant images. Original evidence is preserved in the case record.',
  },
  '/technician/quotes': {
    title: 'Quotation builder',
    eyebrow: 'REPAIR CASE · QUOTATION',
    subtitle: 'Build a transparent estimate with clear parts and labor.',
  },
  '/technician/execution': {
    title: 'Repair execution',
    eyebrow: 'REPAIR LOG',
    subtitle: 'Record the work as it happens, including parts and supporting evidence.',
  },
  '/technician/testing': {
    title: 'Post-repair testing',
    eyebrow: 'QUALITY CHECKS',
    subtitle: 'Record each functional check before issuing the certificate.',
  },
  '/technician/certificates': {
    title: 'Certificate preview',
    eyebrow: 'REPAIR CERTIFICATE',
    subtitle: 'Review exactly what the customer and public verification page will see.',
  },
  '/technician/warranties': {
    title: 'Warranty management',
    eyebrow: 'SHOP COVERAGE',
    subtitle: 'Track active coverage, upcoming expirations, and customer questions.',
  },
  '/shop/dashboard': {
    title: 'Business overview',
    eyebrow: 'BUSINESS WORKSPACE',
    subtitle: 'Keep the repair pipeline moving and focus on the exceptions.',
    action: 'Create repair',
  },
  '/shop/staff': {
    title: 'Staff & access',
    eyebrow: 'YOUR TEAM',
    subtitle: 'Manage shop roles and keep work access up to date.',
    action: 'Invite a technician',
  },
  '/shop/analytics': {
    title: 'Repair analytics',
    eyebrow: 'SHOP PERFORMANCE',
    subtitle: 'Understand throughput, quote response, and quality trends.',
  },
  '/shop/customers': {
    title: 'Customers',
    eyebrow: 'CUSTOMER RECORDS',
    subtitle: 'Find customers and see their shop repair history.',
    action: 'Add customer',
  },
  '/shop/services': {
    title: 'Service catalogue',
    eyebrow: 'ESTIMATE DEFAULTS',
    subtitle: 'Create reusable service line items for faster, consistent quotes.',
    action: 'Add service',
  },
  '/shop/inventory': {
    title: 'Inventory connections',
    eyebrow: 'CONNECTED SYSTEMS',
    subtitle:
      'Connect your parts catalogue when you are ready. Quotes work without an integration.',
  },
  '/shop/settings': {
    title: 'Business settings',
    eyebrow: 'BUSINESS SETTINGS',
    subtitle: 'Control the details customers see in quotes and certificates.',
  },
  '/admin/overview': {
    title: 'Platform overview',
    eyebrow: 'OPERATIONS',
    subtitle: 'Service health and support work that needs attention.',
  },
  '/admin/users': {
    title: 'User management',
    eyebrow: 'PLATFORM ACCESS',
    subtitle: 'Review accounts and access status across the platform.',
  },
  '/admin/organizations': {
    title: 'Organization verification',
    eyebrow: 'SHOP ONBOARDING',
    subtitle: 'Review business details and make verification decisions.',
  },
  '/admin/disputes': {
    title: 'Dispute review',
    eyebrow: 'CUSTOMER SUPPORT',
    subtitle: 'Review a structured record before taking action.',
  },
  '/admin/audit': {
    title: 'Audit log',
    eyebrow: 'SECURITY & ACCOUNTABILITY',
    subtitle: 'Search privileged and sensitive actions by actor, resource, or time.',
  },
  '/admin/health': {
    title: 'System health',
    eyebrow: 'PLATFORM STATUS',
    subtitle: 'Monitor core dependencies and background processing.',
  },
  '/admin/config': {
    title: 'Configuration',
    eyebrow: 'PLATFORM SETTINGS',
    subtitle: 'Review controlled platform-level settings and feature availability.',
  },
};

const routeFor = (path: string) => path.replace(/\/$/, '') || '/';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="rp-container flex h-20 items-center justify-between">
        <Brand />
        <nav
          className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"
          aria-label={tx('Main navigation')}
        >
          <a href="#how-it-works" className="hover:text-foreground">
            {tx('How it works ')}
          </a>
          <a href="#for-shops" className="hover:text-foreground">
            {tx('For repair shops ')}
          </a>
          <a href="/verify" className="hover:text-foreground">
            {tx('Verify a repair ')}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">{tx('Sign in')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">
              {tx('Create your workspace ')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="rp-container grid min-h-[650px] items-center gap-12 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success" />
              {tx('Independent repair records, made clear ')}
            </div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              {tx('Good repair work deserves ')}
              <span className="text-primary">{tx('a clear record.')}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              {tx(
                'Document the condition, diagnosis, parts, and tests. Give customers a straightforward way to review and verify every repair. ',
              )}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/signup">
                  {tx('Create a shop workspace ')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/verify">
                  {tx('Verify a certificate ')}
                  <ShieldCheck className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                {tx('No customer account required ')}
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                {tx('Clear parts and labor ')}
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                {tx('Shareable repair record ')}
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -inset-8 rounded-[2rem] bg-secondary/70" />
            <div className="relative rounded-2xl border bg-card p-5 shadow-xl sm:p-7">
              <div className="mb-4 rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                {tx('Illustrative preview · fictional example, not a real or verified repair ')}
              </div>
              <div className="flex items-start justify-between border-b pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">
                    {tx('Example repair record ')}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">{tx('iPhone 14 Pro')}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tx('Screen replacement · EXAMPLE-01842 ')}
                  </p>
                </div>
                <Badge variant="secondary">{tx('Example')}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 py-5 text-center">
                <MiniMetric label={tx('Evidence')} value="06" />
                <MiniMetric label={tx('Repair steps')} value="04" />
                <MiniMetric label={tx('Tests passed')} value="08 / 08" />
              </div>
              <div className="space-y-4 rounded-xl bg-muted/70 p-4">
                <ProgressLine
                  active
                  label={tx('Device condition recorded')}
                  detail="May 12 · Morgan Chen"
                />
                <ProgressLine
                  active
                  label={tx('Estimate approved')}
                  detail="May 12 · Customer authorization"
                />
                <ProgressLine
                  active
                  label={tx('Repair and tests complete')}
                  detail="May 13 · 8 functional checks"
                  last
                />
              </div>
              <div className="mt-5 flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{tx('Certificate RP-C-260513-0382')}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx('Public details · No customer contact ')}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="absolute -bottom-5 -left-6 hidden rounded-xl border bg-card p-3 shadow-lg sm:flex sm:items-center sm:gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-success/10 text-success">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold">{tx('Evidence stays connected')}</p>
                <p className="text-[11px] text-muted-foreground">
                  {tx('From intake to final check')}
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="border-y bg-card">
          <div className="rp-container grid gap-8 py-12 sm:grid-cols-3">
            {[
              ['01', 'Record the condition', 'Create a useful baseline with photos and notes.'],
              [
                '02',
                'Explain the work',
                'Share findings, parts, labor, and get customer approval.',
              ],
              [
                '03',
                'Close with proof',
                'Log the repair, record tests, and issue a verifiable certificate.',
              ],
            ].map(([n, t, d]) => (
              <div key={n} className="flex gap-4">
                <span className="rp-code text-sm font-semibold text-primary">{n}</span>
                <div>
                  <h3 className="font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          id="for-shops"
          className="rp-container grid gap-8 py-16 md:grid-cols-[1fr_auto] md:items-center"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
              {tx('For independent repair teams ')}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              {tx('A better record of the work you already do. ')}
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {tx(
                'RepairProof supports clear customer communication and accountable repair workflows without replacing your technical judgment. ',
              )}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/technician/dashboard">
              {tx('Explore the workspace ')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>
      <footer className="border-t">
        <div className="rp-container flex flex-col gap-3 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <span>{tx('Repair records that travel with the device.')}</span>
          <a href="/verify" className="hover:text-foreground">
            {tx('Verify a certificate ')}
          </a>
        </div>
      </footer>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex min-h-11 items-center gap-2.5 text-foreground">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary text-primary-foreground">
        <ShieldCheck className="h-5 w-5" />
      </span>
      <span className="text-base font-semibold tracking-tight">{tx('RepairProof')}</span>
    </Link>
  );
}
function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-2 py-3">
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
function ProgressLine({
  label,
  detail,
  active,
  last,
}: {
  label: string;
  detail: string;
  active?: boolean;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span className="relative mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        {active ? (
          <Check className="h-3 w-3" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
        {!last && <span className="absolute left-1/2 top-5 h-6 w-px -translate-x-1/2 bg-border" />}
      </span>
      <div className="pb-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function ExperienceShell({ role }: { role: Role }) {
  const { t, formatNumber } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const menuRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const accountMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const workspaceHeadingRef = useRef<HTMLHeadingElement>(null);
  const lastPathRef = useRef(location.pathname);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      setIsDesktop(media.matches);
      if (media.matches) setMenuOpen(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (menuRef.current) menuRef.current.inert = !isDesktop && !menuOpen;
  }, [isDesktop, menuOpen]);
  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname;
      workspaceHeadingRef.current?.focus();
    }
  }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen || isDesktop) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menuRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false);
        menuTriggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !menuRef.current) return;
      const controls = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (first && last && event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (first && last && !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDesktop, menuOpen]);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
        accountMenuTriggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [accountMenuOpen]);
  const path = routeFor(location.pathname);
  const activePath = useMemo(
    () => nav[role].find((item) => path === item.path || path.startsWith(`${item.path}/`))?.path,
    [path, role],
  );
  const fallbackPath = nav[role][0]?.path;
  const meta = pageMeta[path] ??
    (fallbackPath ? pageMeta[fallbackPath] : undefined) ?? {
      title: 'Workspace',
      eyebrow: roleLabel[role],
      subtitle: 'Your RepairProof workspace.',
    };
  const title = user?.displayName ?? roleLabel[role];
  const initials = title
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('');
  const screen = role === 'admin' && path === '/admin/config' ? (
    <FeatureFlagConsole />
  ) : role === 'consumer' && path === '/consumer/dashboard' ? (
      <ConsumerDashboard />
    ) : role === 'technician' ? (
      <TechnicianWorkspace />
    ) : (
      <RolePage role={role} path={path} />
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#workspace-main"
        className="sr-only z-[100] min-h-11 items-center rounded-md bg-card p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('common.skipToMain')}
      </a>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            className="grid h-11 w-11 place-items-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            ref={menuTriggerRef}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? t('common.closeNavigation') : t('common.openNavigation')}
            aria-controls="workspace-navigation"
            aria-expanded={menuOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Brand />
          <span className="hidden h-6 w-px bg-border sm:block" />
          <span className="hidden truncate text-xs font-medium text-muted-foreground sm:block">
            {t(
              role === 'consumer'
                ? 'workspace.consumer'
                : role === 'technician'
                  ? 'workspace.technician'
                  : role === 'shop'
                    ? 'workspace.shop'
                    : 'workspace.admin',
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher compact />
          {role === 'technician' && (
            <button
              aria-label={t('action.focusCaseSearch')}
              onClick={() =>
                document
                  .querySelector<HTMLInputElement>(
                    'input[placeholder="Search case, device, customer"]',
                  )
                  ?.focus()
              }
              className="hidden h-11 items-center gap-2 rounded-md border bg-background px-3 text-xs text-muted-foreground md:flex"
            >
              <Search className="h-4 w-4" />
              {t('action.findRepairCase')}
            </button>
          )}
          <div className="relative">
            <button
              ref={accountMenuTriggerRef}
              aria-haspopup="true"
              aria-expanded={accountMenuOpen}
              aria-controls="account-menu"
              onClick={() => setAccountMenuOpen((open) => !open)}
              className="flex min-h-11 items-center gap-2 rounded-md p-1.5 hover:bg-muted"
              aria-label={`Account menu for ${title}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                {initials}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-semibold">{title}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {role === 'admin'
                    ? t('role.admin')
                    : role === 'shop'
                      ? t('role.shop')
                      : role === 'consumer'
                        ? t('role.consumer')
                        : t('role.technician')}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="hidden h-4 w-4 text-muted-foreground sm:block"
              />
            </button>
            {accountMenuOpen && (
              <div
                id="account-menu"
                className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border bg-card p-2 shadow-lg"
              >
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {t('common.signedInAs')}{' '}
                  <span className="font-medium text-foreground">{user?.email}</span>
                </p>
                {role !== 'admin' && <AnalyticsConsentSettings />}
                <button
                  className="min-h-11 w-full rounded-md px-3 text-left text-sm text-destructive hover:bg-muted"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    logout();
                    navigate('/login', { replace: true });
                  }}
                >
                  {t('common.signOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside
          id="workspace-navigation"
          ref={menuRef}
          aria-label={`${roleLabel[role]} navigation`}
          aria-hidden={!isDesktop && !menuOpen}
          aria-modal={!isDesktop && menuOpen ? true : undefined}
          role={!isDesktop && menuOpen ? 'dialog' : undefined}
          className={cn(
            'fixed inset-y-16 left-0 z-30 w-[min(84vw,17rem)] border-r bg-card px-3 py-5 transition-transform motion-reduce:transition-none lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-60 lg:translate-x-0',
            menuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="px-3 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
              {t(
                role === 'consumer'
                  ? 'workspace.consumer'
                  : role === 'technician'
                    ? 'workspace.technician'
                    : role === 'shop'
                      ? 'workspace.shop'
                      : 'workspace.admin',
              )}
            </p>
            <p className="mt-1 truncate text-sm font-semibold">
              {role === 'consumer'
                ? 'Personal workspace'
                : role === 'admin'
                  ? 'RepairProof'
                  : 'Apex Device Lab'}
            </p>
          </div>
          <nav aria-label={`${roleLabel[role]} navigation`} className="space-y-1">
            {nav[role].map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (!isDesktop)
                    window.requestAnimationFrame(() =>
                      document.querySelector<HTMLElement>('main h1')?.focus(),
                    );
                  setMenuOpen(false);
                }}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                    isActive || activePath === item.path
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <item.icon aria-hidden="true" className="h-[18px] w-[18px]" />
                <span>{t(navTranslation[item.label] ?? 'common.na')}</span>
                {item.label === 'Repair inbox' && (
                  <span className="ml-auto rounded-full bg-background/20 px-2 py-0.5 text-[10px]">
                    {formatNumber(8)}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="mt-7 border-t pt-5">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
              {t('workspace.quickAccess')}
            </p>
            <NavLink
              to={
                role === 'consumer'
                  ? '/consumer/passport'
                  : role === 'technician'
                    ? '/technician/evidence'
                    : role === 'shop'
                      ? '/shop/inventory'
                      : '/admin/health'
              }
              className="mt-2 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <CircleHelp className="h-[18px] w-[18px]" />
              {role === 'consumer'
                ? t('nav.passport')
                : role === 'technician'
                  ? t('nav.evidence')
                  : role === 'shop'
                    ? t('nav.integrations')
                    : t('nav.systemHealth')}
            </NavLink>
          </div>
          <div className="absolute inset-x-3 bottom-4 hidden rounded-lg border bg-muted/50 p-3 lg:block">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {t('workspace.proofChain')}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t('workspace.proofDescription')}
            </p>
          </div>
        </aside>
        {menuOpen && (
          <button
            aria-label={t('action.closeNavigationOverlay')}
            className="fixed inset-16 z-20 bg-black/30 lg:hidden"
            onClick={() => {
              setMenuOpen(false);
              menuTriggerRef.current?.focus();
            }}
          />
        )}
        <main
          id="workspace-main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 focus:outline-none"
        >
          <div className="mx-auto max-w-[1280px] space-y-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">
                  {tx(meta.eyebrow)}
                </p>
                <h1
                  ref={workspaceHeadingRef}
                  tabIndex={-1}
                  className="mt-2 rounded-sm text-2xl font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-[30px]"
                >
                  {tx(meta.title)}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  {tx(meta.subtitle)}
                </p>
              </div>
              {meta.action && role === 'technician' && (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => handlePrimary(role, path, navigate)}
                >
                  <Plus className="h-4 w-4" />
                  {tx(meta.action)}
                </Button>
              )}
            </div>
            <React.Suspense
              fallback={
                <div
                  className="min-h-64 animate-pulse rounded-xl border bg-card"
                  aria-label={t('state.loadingWorkspace')}
                />
              }
            >
              {screen}
            </React.Suspense>
            <footer className="border-t pt-4 text-xs text-muted-foreground">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{t('workspace.footer')}</span>
                <span className="rp-code">{t('workspace.secure')}</span>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function handlePrimary(role: Role, path: string, navigate: ReturnType<typeof useNavigate>) {
  if (role === 'technician')
    navigate(
      path === '/technician/dashboard' || path === '/technician/inbox'
        ? '/technician/new-case'
        : '/technician/quotes',
    );
  else if (role === 'consumer') navigate('/consumer/register-device');
  else if (role === 'shop') navigate('/technician/new-case');
  else navigate('/admin/organizations');
}

function RolePage({ role, path }: { role: Role; path: string }) {
  const meta = pageMeta[path] ?? {
    title: 'Workspace',
    eyebrow: roleLabel[role],
    subtitle: 'Your RepairProof workspace.',
  };
  return (
    <section aria-labelledby="unavailable-title" className="rounded-xl border bg-card p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">
        {tx(meta.eyebrow)}
      </p>
      <h2 id="unavailable-title" className="mt-2 text-lg font-semibold">
        {tx('This area is not connected to live data yet ')}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {tx('RepairProof does not currently provide this')}{' '}
        {role === 'admin' ? 'platform administration' : 'business management'}{' '}
        {tx(
          ' view. No sample users, case counts, organization decisions, analytics, or system health are shown as real records. ',
        )}
      </p>
      {role === 'shop' && (
        <Button asChild className="mt-5">
          <Link to="/technician/dashboard">
            {tx('Open repair workbench ')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </section>
  );
}
