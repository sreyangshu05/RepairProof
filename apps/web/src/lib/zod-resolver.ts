import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/** Small Zod adapter kept local so the foundation does not depend on another resolver package. */
export function zodResolver<TInput extends FieldValues, TOutput extends FieldValues>(
  schema: ZodType<TOutput>,
): Resolver<TInput, undefined, TOutput> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data as TOutput, errors: {} };

    const errors = result.error.issues.reduce<FieldErrors<TInput>>((all, issue) => {
      const path = issue.path.map(String).join('.');
      if (path && !path.split('.').some((part) => part === '__proto__' || part === 'constructor')) {
        const parts = path.split('.');
        let node = all as Record<string, unknown>;
        for (const part of parts.slice(0, -1)) {
          node[part] ??= {};
          node = node[part] as Record<string, unknown>;
        }
        const key = parts[parts.length - 1];
        if (key && !node[key]) node[key] = { type: issue.code, message: issue.message };
      }
      return all;
    }, {});
    return { values: {}, errors };
  };
}
