import { AlertCircle } from 'lucide-react';

export interface FormErrorSummaryProps {
  title?: string;
  errors: Array<{ id: string; message: string }>;
}

export function FormErrorSummary({
  title = 'Check the following fields',
  errors,
}: FormErrorSummaryProps) {
  if (!errors.length) return null;
  return (
    <div
      role="alert"
      aria-labelledby="form-error-title"
      className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm"
    >
      <div className="flex gap-2 font-semibold text-destructive">
        <AlertCircle aria-hidden="true" className="h-4 w-4" />
        <p id="form-error-title">{title}</p>
      </div>
      <ul className="mt-2 list-inside list-disc space-y-1">
        {errors.map((error) => (
          <li key={error.id}>
            <a className="underline underline-offset-2" href={`#${error.id}`}>
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
