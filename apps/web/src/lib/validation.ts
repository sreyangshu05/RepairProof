import { z } from 'zod';

export const emailSchema = z.string().trim().email('Enter a valid email address.').max(320);
export const passwordSchema = z.string().min(8, 'Use at least 8 characters.').max(128);
export const nameSchema = z.string().trim().min(1, 'Enter a name.').max(160);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});
export const registrationSchema = z
  .object({
    displayName: nameSchema,
    shopName: z
      .string()
      .trim()
      .min(1, 'Enter your workshop name.')
      .max(120, 'Workshop name must be 120 characters or fewer.'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    analyticsConsent: z.boolean().default(false),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegistrationFormValues = z.infer<typeof registrationSchema>;
