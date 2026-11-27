import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormErrorSummary } from '../../components/ui/form-error-summary';
import { FormField } from '../../components/ui/form-field';
import { Input } from '../../components/ui/input';
import {
  loginSchema,
  registrationSchema,
  type LoginFormValues,
  type RegistrationFormValues,
} from '../../lib/validation';
import { zodResolver } from '../../lib/zod-resolver';

type Props = {
  register: boolean;
  onSubmit: (values: LoginFormValues | RegistrationFormValues) => Promise<void> | void;
  onResendConfirmation?: (email: string) => Promise<void> | void;
  resendingConfirmation?: boolean;
  error?: string | null;
};

export function AccountAccessForm({
  register,
  onSubmit,
  onResendConfirmation,
  resendingConfirmation = false,
  error,
}: Props) {
  const [passwordHelp, setPasswordHelp] = useState(false);
  const schema = useMemo(() => (register ? registrationSchema : loginSchema), [register]);
  const form = useForm<LoginFormValues | RegistrationFormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: register
      ? { displayName: '', shopName: '', email: '', password: '', confirmPassword: '', analyticsConsent: false }
      : { email: '', password: '' },
  });
  const emailValue = form.watch('email');
  const errors = form.formState.errors as FieldErrors<LoginFormValues & RegistrationFormValues>;
  const summary = Object.entries(errors).flatMap(([id, error]) =>
    error?.message ? [{ id, message: String(error.message) }] : [],
  );

  return (
    <form className="mt-8 space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      <FormErrorSummary errors={summary} />
      {register && (
        <FormField id="displayName" label="Full name" required error={errors.displayName?.message}>
          <Input
            autoComplete="name"
            placeholder="Your name"
            {...form.register('displayName' as never)}
          />
        </FormField>
      )}
      {register && (
        <FormField id="shopName" label="Workshop name" required error={errors.shopName?.message}>
          <Input
            autoComplete="organization"
            placeholder="Your repair business"
            {...form.register('shopName' as never)}
          />
        </FormField>
      )}
      <FormField id="email" label="Email address" required error={errors.email?.message}>
        <Input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          {...form.register('email')}
        />
      </FormField>
      <FormField
        id="password"
        label="Password"
        required
        hint={register ? 'Use at least 8 characters.' : undefined}
        error={errors.password?.message}
      >
        <Input
          type="password"
          autoComplete={register ? 'new-password' : 'current-password'}
          placeholder={register ? 'At least 8 characters' : 'Your password'}
          {...form.register('password')}
        />
      </FormField>
      {register && (
        <FormField
          id="confirmPassword"
          label="Confirm password"
          required
          error={errors.confirmPassword?.message}
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            {...form.register('confirmPassword' as never)}
          />
        </FormField>
      )}
      {register && (
        <label className="flex min-h-11 items-start gap-3 rounded-md border p-3 text-sm leading-5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
            {...form.register('analyticsConsent' as never)}
          />
          <span>
            Optional: share pseudonymous workshop product-use and controlled experiment measurements to help improve RepairProof.
            This excludes customer details, device identifiers, repair notes, prices, and evidence.
            You can change this later in account settings.
          </span>
        </label>
      )}
      {!register && (
        <div className="flex min-h-11 items-center justify-between gap-2 text-xs">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" />
            Remember me
          </label>
          <button
            className="inline-flex min-h-11 items-center px-2 text-primary hover:underline"
            type="button"
            aria-expanded={passwordHelp}
            aria-controls={passwordHelp ? 'password-help' : undefined}
            onClick={() => setPasswordHelp((shown) => !shown)}
          >
            Forgot password?
          </button>
        </div>
      )}
      {!register && passwordHelp && (
        <p id="password-help" role="status" className="text-sm text-muted-foreground">
          Password reset is not available yet. Contact your workshop administrator for help.
        </p>
      )}
      <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
        {register ? 'Create account' : 'Sign in'}{' '}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Button>
      {register && onResendConfirmation && (
        <Button
          className="w-full"
          type="button"
          variant="outline"
          disabled={!emailValue || resendingConfirmation}
          onClick={() => void onResendConfirmation(emailValue)}
        >
          {resendingConfirmation ? 'Requesting email…' : 'Resend confirmation email'}
        </Button>
      )}
    </form>
  );
}
