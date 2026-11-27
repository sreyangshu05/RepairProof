import { tx } from '../../i18n/catalog';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { AccountAccessForm } from '../../features/auth/AccountAccessForm';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { apiPost, getApiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { UserRole } from '@repairproof/shared';
import type { LoginFormValues, RegistrationFormValues } from '../../lib/validation';
import { LanguageSwitcher } from '../../i18n/LanguageSwitcher';
import { useI18n } from '../../i18n/I18nProvider';

export function AccountAccessPage() {
  useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const acceptSession = useAuthStore((state) => state.acceptSession);
  const register = location.pathname === '/signup' || location.pathname.endsWith('/register');
  const consumer = location.pathname.startsWith('/consumer');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);

  const resendConfirmation = async (email: string) => {
    if (resendingConfirmation) return;
    setResendingConfirmation(true);
    setError(null);
    try {
      await apiPost('/auth/signup/resend', { email });
      setNotice('If the account still needs confirmation, a fresh email has been requested.');
    } catch (submissionError) {
      setError(
        getApiErrorMessage(submissionError, 'We could not request another email. Please try again.'),
      );
    } finally {
      setResendingConfirmation(false);
    }
  };

  const onSubmit = async (values: LoginFormValues | RegistrationFormValues) => {
    setError(null);
    setNotice(null);
    try {
      if (register && 'shopName' in values) {
        const result = await apiPost<
          {
            user: {
              id: string;
              email: string;
              displayName: string;
              role: UserRole;
              shop?: { id: string; name: string } | null;
            };
            token: string | null;
          },
          { email: string; password: string; displayName: string; shopName: string; analyticsConsent: boolean }
        >('/auth/signup', {
          email: values.email,
          password: values.password,
          displayName: values.displayName,
          shopName: values.shopName,
          analyticsConsent: values.analyticsConsent === true,
        });
        if (!result.token) {
          setNotice(
            'Your workshop account was created. Follow the email confirmation instructions, then sign in.',
          );
          return;
        }
        acceptSession(result);
        navigate('/shop/dashboard', { replace: true });
      } else if (!register && 'email' in values) {
        await login(values.email, values.password);
        const role = useAuthStore.getState().user?.role;
        navigate(
          role === UserRole.PLATFORM_ADMIN
            ? '/admin/overview'
            : role === UserRole.SHOP_OWNER
              ? '/shop/dashboard'
              : '/technician/dashboard',
          { replace: true },
        );
      }
    } catch (submissionError) {
      setError(
        getApiErrorMessage(
          submissionError,
          'We could not complete this request. Please try again.',
        ),
      );
    }
  };

  if (consumer)
    return (
      <main className="mx-auto grid min-h-screen max-w-xl content-center gap-4 p-6">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <Brand />
        <h1 className="text-3xl font-semibold">{tx('Access your repair record')}</h1>
        <p className="text-muted-foreground">
          {tx(
            'Open the secure repair approval link sent by your repair shop to review an estimate. Consumer accounts are not available in this release. ',
          )}
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/verify">{tx('Verify a certificate')}</Link>
        </Button>
      </main>
    );

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_.9fr]">
      <section className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <LanguageSwitcher compact />
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">
            {tx('REPAIR TEAM WORKSPACE ')}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {register ? 'Create your workshop account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {register
              ? 'Set up your repair business workspace.'
              : 'Sign in to continue to your RepairProof workspace.'}
          </p>
          {notice && (
            <p
              role="status"
              className="mt-4 rounded-md border border-success/30 bg-success/5 p-3 text-sm"
            >
              {notice}
            </p>
          )}
          <AccountAccessForm
            register={register}
            onSubmit={onSubmit}
            onResendConfirmation={register ? resendConfirmation : undefined}
            resendingConfirmation={resendingConfirmation}
            error={error}
          />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {register ? 'Already have an account?' : 'New to RepairProof?'}{' '}
            <Link
              className="inline-flex min-h-11 items-center px-2 font-medium text-primary hover:underline"
              to={register ? '/login' : '/signup'}
            >
              {register ? 'Sign in' : 'Create a workshop account'}
            </Link>
          </p>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {tx('By continuing, you agree to our terms and privacy notice. ')}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {tx('© 2026 RepairProof · Secure repair records')}
        </p>
      </section>
      <aside className="hidden flex-col justify-between bg-[#172B3A] p-10 text-white lg:flex">
        <div className="max-w-lg pt-20">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-8 text-4xl font-semibold leading-tight tracking-tight">
            {tx('Good repair work deserves a clear record. ')}
          </h2>
          <p className="mt-4 text-base leading-7 text-white/70">
            {tx(
              'Follow repair progress, review clear estimates, and keep the proof connected to your device. ',
            )}
          </p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/65">
            {tx('Illustrative example · fictional data ')}
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60">
                {tx('Example repair record ')}
              </p>
              <p className="mt-1 font-semibold">{tx('MacBook Air · Battery replacement')}</p>
            </div>
            <Badge variant="secondary">{tx('Example')}</Badge>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ['Evidence', '04'],
              ['Tests', '07 / 07'],
              ['Warranty', '90 days'],
            ].map(([label, value]) => (
              <div className="rounded-lg bg-white/5 p-3" key={label}>
                <p className="text-[10px] text-white/60">{label}</p>
                <p className="mt-1 text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </main>
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
