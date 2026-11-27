import { tx } from '../../i18n/catalog';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileSearch,
  Fingerprint,
  LockKeyhole,
  Menu,
  MessageSquareText,
  PackageCheck,
  ScanLine,
  Shield,
  ShieldCheck,
  Smartphone,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { useI18n } from '../../i18n/I18nProvider';

type PreviewTab = 'passport' | 'evidence';

const lifecycle = [
  {
    number: '01',
    title: 'Intake',
    detail: 'Record device condition and customer concerns.',
    icon: Smartphone,
  },
  {
    number: '02',
    title: 'Diagnose',
    detail: 'Document findings and attach relevant evidence.',
    icon: FileSearch,
  },
  {
    number: '03',
    title: 'Approve',
    detail: 'Share a clear quotation before work begins.',
    icon: ClipboardCheck,
  },
  {
    number: '04',
    title: 'Repair',
    detail: 'Log actions and replacement components.',
    icon: Wrench,
  },
  {
    number: '05',
    title: 'Verify',
    detail: 'Record post-repair checks and issue a certificate.',
    icon: BadgeCheck,
  },
];

const faqItems = [
  {
    q: 'What is RepairProof?',
    a: 'RepairProof is a record and verification platform for device repairs. It helps repair teams document each stage and gives customers a clearer way to review the work.',
  },
  {
    q: 'Does RepairProof perform or certify repairs?',
    a: 'No. RepairProof records information submitted by repair teams and presents the evidence, approvals, actions, and tests associated with a repair. A verification record does not replace a technician’s professional judgment.',
  },
  {
    q: 'Do customers need an account to review a repair?',
    a: 'Customer authorization links are disabled in the current demonstration. In a configured release, a shop may share a link with access limited to the relevant repair record and quotation.',
  },
  {
    q: 'What information appears on a public certificate?',
    a: 'A certificate can show a repair reference, device description, work summary, and recorded test outcomes. Personal contact details should not be included in public certificate data.',
  },
  {
    q: 'Can any repair business use RepairProof?',
    a: 'The workspace is designed for independent repair teams and organizations. Create a workspace to explore the current product experience and its setup flow.',
  },
  {
    q: 'How does RepairProof handle privacy?',
    a: 'The privacy notice and customer terms are still drafts for review. This demonstration uses no customer data; please do not enter real customer contact details, device identifiers, or evidence. Approved policies must be published before production data collection.',
  },
];

export function LandingPage() {
  useI18n();
  const [previewTab, setPreviewTab] = useState<PreviewTab>('passport');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [notice, setNotice] = useState('');

  const scrollToPreview = () => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById('passport-preview')
      ?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(
      () => document.getElementById('passport-preview')?.focus(),
      reducedMotion ? 0 : 350,
    );
    setNotice('Repair passport preview selected.');
  };

  return (
    <div className="overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-md bg-card p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tx('Skip to content ')}
      </a>
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6">
        <div className="rp-container flex min-h-16 items-center justify-between rounded-xl border border-border/80 bg-card/95 px-4 shadow-md backdrop-blur-sm sm:px-6">
          <Link
            to="/"
            aria-label={tx('RepairProof home')}
            className="flex items-center gap-2.5 font-semibold tracking-tight"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>{tx('RepairProof')}</span>
          </Link>
          <nav
            aria-label={tx('Main navigation')}
            className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex"
          >
            <a className="hover:text-foreground" href="#how-it-works">
              {tx('How it works ')}
            </a>
            <a className="hover:text-foreground" href="#for-people">
              {tx('Who it’s for ')}
            </a>
            <a className="hover:text-foreground" href="#trust">
              {tx('Trust & privacy ')}
            </a>
            <a className="hover:text-foreground" href="#faq">
              {tx('FAQs ')}
            </a>
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <LanguageSwitcher compact />
            <Button asChild size="sm" variant="ghost">
              <Link to="/login">{tx('Sign in')}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">
                {tx('Create a workspace ')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="grid h-11 w-11 place-items-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
          >
            {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <nav
            aria-label={tx('Mobile navigation')}
            className="rp-container mt-2 grid gap-1 rounded-xl border bg-card p-3 shadow-lg sm:hidden"
          >
            <a
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-3 text-sm hover:bg-muted"
              href="#how-it-works"
            >
              {tx('How it works ')}
            </a>
            <a
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-3 text-sm hover:bg-muted"
              href="#for-people"
            >
              {tx('Who it’s for ')}
            </a>
            <a
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-3 text-sm hover:bg-muted"
              href="#trust"
            >
              {tx('Trust & privacy ')}
            </a>
            <a
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-3 py-3 text-sm hover:bg-muted"
              href="#faq"
            >
              {tx('FAQs ')}
            </a>
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
              <div className="col-span-2">
                <LanguageSwitcher />
              </div>
              <Button asChild variant="outline">
                <Link to="/login">{tx('Sign in')}</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">{tx('Get started')}</Link>
              </Button>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section className="relative isolate">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 top-20 -z-10 h-72 w-72 rounded-full bg-secondary/70 blur-3xl sm:right-10 sm:h-96 sm:w-96"
          />
          <div className="rp-container grid min-h-[620px] items-center gap-14 py-16 sm:py-20 lg:grid-cols-[.92fr_1.08fr] lg:py-24">
            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-primary">
                  <ScanLine className="h-3 w-3" />
                </span>
                {tx('Independent repair verification & intelligence ')}
              </div>
              <h1 className="text-[2.65rem] font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-[4.35rem]">
                {tx('Every repair has a story. ')}
                <span className="text-primary">{tx('Make it clear.')}</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {tx(
                  'RepairProof connects diagnostics, customer approvals, repair actions, evidence, and testing in one understandable record. ',
                )}
              </p>
              <div className="mt-8 flex flex-col gap-3 min-[440px]:flex-row">
                <Button asChild size="lg">
                  <Link to="/signup">
                    {tx('Create a workspace ')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" onClick={scrollToPreview}>
                  {tx('Take a look inside ')}
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                {tx('For repair teams and the people who depend on their work. ')}
              </p>
            </div>
            <PassportPreview
              activeTab={previewTab}
              onTabChange={setPreviewTab}
              onNotice={setNotice}
            />
          </div>
        </section>

        <section aria-labelledby="problem-title" className="border-y bg-card">
          <div className="rp-container grid gap-10 py-16 md:grid-cols-[.8fr_1.2fr] md:items-center md:py-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                {tx('The gap ')}
              </p>
              <h2
                id="problem-title"
                className="mt-3 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
              >
                {tx('Good work can be hard to see after the device leaves the bench. ')}
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  title: 'Scattered details',
                  text: 'Photos, notes, parts, and messages live in different places.',
                },
                {
                  title: 'Unclear decisions',
                  text: 'Customers need an understandable estimate before work begins.',
                },
                {
                  title: 'No connected record',
                  text: 'The final result can lose its connection to what was diagnosed and done.',
                },
              ].map((item) => (
                <article key={item.title} className="border-l-2 border-primary/30 pl-4">
                  <h3 className="font-semibold">{tx(item.title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{tx(item.text)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="rp-container scroll-mt-28 py-20 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
              {tx('One connected record ')}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {tx('A repair, documented from intake to final check. ')}
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              {tx(
                'Each stage adds useful context to the same repair record, so the customer and technician can see what happened and what comes next. ',
              )}
            </p>
          </div>
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {lifecycle.map(({ number, title, detail, icon: Icon }, index) => (
              <li key={title} className="relative rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="rp-code text-xs font-semibold text-primary">{number}</span>
                  <Icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mt-7 font-semibold">{tx(title)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{tx(detail)}</p>
                {index < lifecycle.length - 1 && (
                  <ChevronRight
                    aria-hidden="true"
                    className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 rounded-full bg-background text-muted-foreground xl:block"
                  />
                )}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2">
              <Clock3 className="h-3.5 w-3.5" />
              {tx('Decisions stay in sequence ')}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2">
              <FileCheck2 className="h-3.5 w-3.5" />
              {tx('Evidence stays with the case ')}
            </span>
          </div>
        </section>

        <section className="bg-[#17323a] text-white">
          <div className="rp-container grid gap-12 py-16 sm:py-20 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b8d8d2]">
                {tx('The repair lifecycle ')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {tx('From “what’s wrong?” to “here’s what was done.” ')}
              </h2>
              <p className="mt-4 leading-7 text-white/70">
                {tx(
                  'A shared timeline makes the handoffs visible without asking anyone to interpret a pile of disconnected updates. ',
                )}
              </p>
              <Button asChild className="mt-7" variant="secondary">
                <Link to="/technician/dashboard">
                  {tx('Explore the repair workspace ')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[.06] p-5 sm:p-7">
              <div className="flex items-center justify-between border-b border-white/15 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/60">
                    {tx('Repair timeline')}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">
                    {tx('RP-2026-01842 · iPhone 14 Pro')}
                  </h3>
                </div>
                <span className="rounded-full border border-[#b8d8d2]/40 px-3 py-1 text-xs text-[#d5eeea]">
                  {tx('In progress ')}
                </span>
              </div>
              <div className="mt-6 grid gap-0 sm:grid-cols-5">
                {lifecycle.map(({ title, detail, icon: Icon }, index) => (
                  <div className="relative flex gap-3 pb-6 sm:block sm:pb-0 sm:pr-3" key={title}>
                    <span
                      className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ${index < 3 ? 'bg-[#b8d8d2] text-[#17323a]' : 'border border-white/30 bg-[#17323a] text-white/60'}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {index < lifecycle.length - 1 && (
                      <span className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-px bg-white/20 sm:left-9 sm:top-[17px] sm:h-px sm:w-[calc(100%-1.5rem)]" />
                    )}
                    <p className="pt-1 text-sm font-medium sm:mt-4">{tx(title)}</p>
                    <p className="mt-1 hidden text-xs leading-5 text-white/70 sm:block">
                      {tx(detail)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-lg border border-white/10 bg-black/10 p-4">
                <div className="flex items-start gap-3">
                  <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-[#b8d8d2]" />
                  <p className="text-sm leading-6 text-white/75">
                    {tx(
                      '“The display was checked before opening. The estimate includes the replacement part and labor.” ',
                    )}
                    <span className="mt-2 block text-xs text-white/70">
                      {tx('Diagnostic note · Technician workspace ')}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="for-people" className="rp-container scroll-mt-28 py-20 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
              {tx('Useful on both sides of the repair ')}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {tx('Clearer records. Better conversations. ')}
            </h2>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <BenefitPanel
              icon={Smartphone}
              label={tx('For consumers')}
              title={tx('Know what was found, approved, and completed.')}
              points={[
                'Review the diagnosis and estimate before deciding.',
                'Follow repair progress in one timeline.',
                'Keep certificates and warranty information with the device record.',
              ]}
              cta="See the consumer experience"
              href="/consumer/dashboard"
            />
            <BenefitPanel
              icon={Wrench}
              label={tx('For technicians')}
              title={tx('Show the care and process behind the repair.')}
              points={[
                'Capture intake condition, findings, and evidence together.',
                'Present parts, labor, and customer approval clearly.',
                'Close the case with actions performed and recorded tests.',
              ]}
              cta="Explore the technician workspace"
              href="/technician/dashboard"
            />
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="rp-container grid gap-12 py-16 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                {tx('Evidence & verification ')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {tx('Know what a record shows—and what it doesn’t. ')}
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                {tx(
                  'RepairProof organizes submitted information so a reader can review its source and context. A verification result confirms that a certificate matches a recorded repair; it is not an independent inspection of the device. ',
                )}
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/verify">
                  {tx('Look up a certificate ')}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  level: '01',
                  title: 'Documented',
                  text: 'The shop recorded a note, image, or action in the repair case.',
                },
                {
                  level: '02',
                  title: 'Customer approved',
                  text: 'A decision was recorded against the quotation presented.',
                },
                {
                  level: '03',
                  title: 'Certificate issued',
                  text: 'The completed repair record can be checked by its reference.',
                },
              ].map((item) => (
                <article key={item.level} className="rounded-xl border bg-background p-5">
                  <span className="rp-code text-xs font-semibold text-primary">
                    {tx('LEVEL ')}
                    {item.level}
                  </span>
                  <h3 className="mt-5 font-semibold">{tx(item.title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{tx(item.text)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rp-container py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                {tx('A record that can travel ')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {tx('A digital repair passport, built from the work record. ')}
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                {tx(
                  'The device passport brings repair certificates and coverage details into a readable device history. It’s designed to make the documented work easier to carry forward. ',
                )}
              </p>
              <Button asChild className="mt-7">
                <Link to="/consumer/passport">
                  {tx('View a sample passport ')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-5 shadow-lg sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b pb-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-secondary text-primary">
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {tx('Device passport ')}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold">{tx('iPhone 14 Pro')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {tx('Registered device · ending 4821')}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                  {tx('3 records ')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 py-5">
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">{tx('Device added')}</p>
                  <p className="mt-1 text-sm font-semibold">{tx('May 2024')}</p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">{tx('Repair records')}</p>
                  <p className="mt-1 text-sm font-semibold">{tx('2 certificates · 1 estimate')}</p>
                </div>
              </div>
              <div className="space-y-3">
                <PassportRow
                  date="May 2026"
                  title={tx('Display replacement')}
                  detail="Certificate RP-C-260513-0382"
                  status="Certificate issued"
                />
                <PassportRow
                  date="Oct 2025"
                  title={tx('Battery service')}
                  detail="Estimate and customer approval recorded"
                  status="Repair documented"
                />
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {tx('Sample product preview · fictional device and repair records ')}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#e7eeeb]">
          <div className="rp-container grid gap-10 py-16 sm:py-20 md:grid-cols-[1fr_1fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                {tx('For repair businesses ')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {tx('A repeatable way to show the work behind your service. ')}
              </h2>
              <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
                {tx(
                  'Give customers a consistent view of estimates, approvals, repair actions, and test results. Keep case information organized for your team as work moves through the shop. ',
                )}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/signup">
                    {tx('Set up a workspace ')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/shop/dashboard">{tx('Explore business tools')}</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-white bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="text-xs text-muted-foreground">{tx('Team workspace')}</p>
                  <h3 className="mt-1 font-semibold">{tx('Repair queue')}</h3>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                  <PackageCheck className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-2">
                {[
                  {
                    id: 'RP-01842',
                    device: 'iPhone 14 Pro',
                    stage: 'Awaiting approval',
                    tone: 'bg-warning/10 text-warning',
                  },
                  {
                    id: 'RP-01841',
                    device: 'MacBook Air',
                    stage: 'In repair',
                    tone: 'bg-info/10 text-info',
                  },
                  {
                    id: 'RP-01839',
                    device: 'Galaxy S23',
                    stage: 'Ready to verify',
                    tone: 'bg-success/10 text-success',
                  },
                ].map((row) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 border-b py-4 last:border-0"
                    key={row.id}
                  >
                    <div>
                      <p className="text-sm font-semibold">{row.device}</p>
                      <p className="rp-code mt-1 text-[11px] text-muted-foreground">{row.id}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.tone}`}>
                      {row.stage}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
                to="/shop/analytics"
              >
                {tx('See business workspace ')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section id="trust" className="rp-container scroll-mt-28 py-20 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                {tx('Trust through clarity ')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {tx('The record should be understandable—and appropriately private. ')}
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                {tx(
                  'RepairProof is designed to make repair information easier to inspect while keeping customer and business details scoped to their intended use. ',
                )}
              </p>
              <a
                href="#faq"
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                {tx('Privacy questions in the FAQ ')}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Fingerprint,
                  title: 'Traceable decisions',
                  text: 'Approvals, actions, and updates are attached to a repair record with their context.',
                },
                {
                  icon: LockKeyhole,
                  title: 'Access with purpose',
                  text: 'Customer links and staff workspaces serve different access needs.',
                },
                {
                  icon: FileCheck2,
                  title: 'Evidence in context',
                  text: 'Photos and notes appear alongside the stage and action they support.',
                },
                {
                  icon: Shield,
                  title: 'Clear limits',
                  text: 'A platform record reports submitted details; it does not claim to independently inspect a repair.',
                },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-xl border bg-card p-5">
                  <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
                  <h3 className="mt-4 font-semibold">{tx(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{tx(text)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 border-y bg-card">
          <div className="rp-container grid gap-10 py-16 sm:py-20 lg:grid-cols-[.65fr_1.35fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
                {tx('Questions, answered ')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                {tx('Frequently asked questions ')}
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {tx(
                  'Want to explore the product? Start with a workspace or look up a certificate. ',
                )}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/signup">{tx('Create workspace')}</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/verify">{tx('Verify a repair')}</Link>
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {faqItems.map((item, index) => (
                <article className="py-1" key={item.q}>
                  <h3>
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left font-medium focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={openFaq === index}
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    >
                      <span>{tx(item.q)}</span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </h3>
                  {openFaq === index && (
                    <p className="max-w-3xl pb-5 pr-8 text-sm leading-6 text-muted-foreground">
                      {tx(item.a)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rp-container py-16 sm:py-20">
          <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-primary-foreground sm:px-12 sm:py-16">
            <div
              aria-hidden="true"
              className="absolute -right-10 -top-20 h-56 w-56 rotate-12 rounded-[2rem] border border-white/15 sm:right-14 sm:top-[-7rem] sm:h-80 sm:w-80"
            />
            <div className="relative max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[.16em]">
                {tx('Make the record part of the repair ')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {tx('Give every repair a clearer finish. ')}
              </h2>
              <p className="mt-4 max-w-xl leading-7 text-primary-foreground/90">
                {tx(
                  'Create a RepairProof workspace to organize cases, communicate estimates, and issue repair records customers can review. ',
                )}
              </p>
              <div className="mt-7 flex flex-col gap-3 min-[440px]:flex-row">
                <Button asChild size="lg" variant="secondary">
                  <Link to="/signup">
                    {tx('Create a workspace ')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="min-h-11 border-white/50 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link to="/verify">{tx('Verify a certificate')}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="rp-container grid gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </span>
              {tx('RepairProof ')}
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              {tx(
                'Independent repair verification and intelligence. A clear record of the work, evidence, and decisions. ',
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm">
            <a className="hover:text-primary" href="#how-it-works">
              {tx('How it works ')}
            </a>
            <a className="hover:text-primary" href="#for-people">
              {tx('For repair teams ')}
            </a>
            <a className="hover:text-primary" href="#trust">
              {tx('Trust & privacy ')}
            </a>
            <a className="hover:text-primary" href="#faq">
              {tx('FAQs ')}
            </a>
            <Link className="hover:text-primary" to="/verify">
              {tx('Verify a certificate ')}
            </Link>
            <Link className="hover:text-primary" to="/login">
              {tx('Sign in ')}
            </Link>
          </div>
          <div className="flex flex-col gap-2 border-t pt-5 text-xs text-muted-foreground sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{tx('© 2026 RepairProof. Repair records that travel with the device.')}</span>
            <a href="#trust" className="hover:text-foreground">
              {tx('Privacy approach ')}
            </a>
          </div>
        </div>
      </footer>
      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>
    </div>
  );
}

function PassportPreview({
  activeTab,
  onTabChange,
  onNotice,
}: {
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  onNotice: (message: string) => void;
}) {
  return (
    <div
      id="passport-preview"
      tabIndex={-1}
      aria-label={tx('Interactive repair record preview')}
      className="relative mx-auto w-full max-w-[620px] scroll-mt-28 rounded-2xl border bg-card p-4 shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
    >
      <div className="absolute -right-2 -top-2 hidden h-12 w-12 rotate-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md sm:flex">
        <span className="text-lg">{tx('✳')}</span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
            {tx('Repair passport · Sample record ')}
          </p>
          <h2 className="mt-1 text-lg font-semibold sm:text-xl">{tx('iPhone 14 Pro')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {tx('Screen replacement · RP-2026-01842')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
          <BadgeCheck className="h-4 w-4" />
          {tx('Record complete ')}
        </span>
      </div>
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          onTabChange(value as PreviewTab);
          onNotice(
            value === 'passport' ? 'Passport tab selected.' : 'Evidence and checks tab selected.',
          );
        }}
        className="mt-4"
      >
        <TabsList aria-label={tx('Repair preview sections')} className="h-auto w-full">
          <TabsTrigger value="passport" className="min-h-11 flex-1">
            {tx('Passport ')}
          </TabsTrigger>
          <TabsTrigger value="evidence" className="min-h-11 flex-1">
            {tx('Evidence & checks ')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="passport" className="pt-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <PreviewStat label={tx('Evidence items')} value="06" />
            <PreviewStat label={tx('Repair actions')} value="04" />
            <PreviewStat label={tx('Checks recorded')} value="08 / 08" />
          </div>
          <div className="mt-4 space-y-3 rounded-xl bg-muted/60 p-4">
            <PreviewEvent title={tx('Device condition recorded')} detail="May 12 · Intake" />
            <PreviewEvent
              title={tx('Estimate reviewed and approved')}
              detail="May 12 · Customer authorization"
            />
            <PreviewEvent
              title={tx('Repair and functional checks')}
              detail="May 13 · Certificate issued"
              last
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onTabChange('evidence');
              onNotice('Evidence details opened.');
            }}
            className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileCheck2 className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  {tx('Certificate RP-C-260513-0382')}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {tx('View documented evidence and checks ')}
                </span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </TabsContent>
        <TabsContent value="evidence" className="space-y-3 pt-4">
          <div className="rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary">
                <FileSearch className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{tx('Intake condition · 3 photos')}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {tx('Front glass condition and device frame recorded before repair. ')}
                </p>
              </div>
              <Check className="ml-auto h-4 w-4 text-success" />
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary">
                <Wrench className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{tx('Repair action · Display assembly')}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {tx('Replacement component and labor recorded to the case. ')}
                </p>
              </div>
              <Check className="ml-auto h-4 w-4 text-success" />
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary">
                <ClipboardCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{tx('Functional checks · 8 recorded')}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {tx('Touch response, brightness, proximity, and other checks. ')}
                </p>
              </div>
              <Check className="ml-auto h-4 w-4 text-success" />
            </div>
          </div>
          <p className="rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
            {tx(
              'Sample data for product illustration. A certificate reflects information entered into the repair record. ',
            )}
          </p>
        </TabsContent>
      </Tabs>
      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          {tx('Sample preview · fictional record ')}
        </span>
        <Link
          to="/verify/RP-C-260513-0382"
          className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline"
        >
          {tx('Certificate details ')}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-2 py-3 text-center">
      <p className="text-sm font-semibold tabular-nums sm:text-base">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-xs">{tx(label)}</p>
    </div>
  );
}

function PreviewEvent({
  title,
  detail,
  last = false,
}: {
  title: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span className="relative mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        <Check className="h-3 w-3" />
        {!last && <span className="absolute left-1/2 top-5 h-5 w-px -translate-x-1/2 bg-border" />}
      </span>
      <div>
        <p className="text-xs font-medium sm:text-sm">{tx(title)}</p>
        <p className="text-[11px] text-muted-foreground">{tx(detail)}</p>
      </div>
    </div>
  );
}

function PassportRow({
  date,
  title,
  detail,
  status,
}: {
  date: string;
  title: string;
  detail: string;
  status: string;
}) {
  return (
    <article className="flex gap-3 rounded-lg border p-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/10 text-success">
        <Check className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <h4 className="text-sm font-semibold">{tx(title)}</h4>
          <span className="text-[11px] text-muted-foreground">{date}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{tx(detail)}</p>
        <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-[10px] font-medium">
          {status}
        </span>
      </div>
    </article>
  );
}

function BenefitPanel({
  icon: Icon,
  label,
  title,
  points,
  cta,
  href,
}: {
  icon: typeof Smartphone;
  label: string;
  title: string;
  points: string[];
  cta: string;
  href: string;
}) {
  return (
    <article className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[.14em] text-primary">
        {tx(label)}
      </p>
      <h3 className="mt-2 max-w-md text-2xl font-semibold leading-tight tracking-tight">
        {tx(title)}
      </h3>
      <ul className="mt-5 space-y-3">
        {points.map((point) => (
          <li className="flex gap-3 text-sm leading-6 text-muted-foreground" key={point}>
            <Check className="mt-1 h-4 w-4 shrink-0 text-success" />
            {tx(point)}
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" className="mt-7">
        <Link to={href}>
          {tx(cta)}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </article>
  );
}
