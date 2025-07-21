import { z } from 'zod'

// Email domain - hard-coded for consistent client-side validation
const ALLOWED_EMAIL_DOMAIN = 'ics.ac'

// Login schema with domain validation
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .refine(
      (email) => email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`),
      `Email must be from @${ALLOWED_EMAIL_DOMAIN} domain`
    ),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password is too long'),
})

// User registration schema (for admin use)
export const userRegistrationSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .refine(
      (email) => email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`),
      `Email must be from @${ALLOWED_EMAIL_DOMAIN} domain`
    ),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name is too long')
    .regex(/^[a-zA-Z\s-']+$/, 'First name contains invalid characters'),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name is too long')
    .regex(/^[a-zA-Z\s-']+$/, 'Last name contains invalid characters'),
  role: z.enum([
    'controller',
    'executive',
    'ops_manager',
    'project_manager',
    'accounting',
    'viewer',
  ]),
  division_id: z.string().uuid().nullable().optional(),
})

// Password reset schema
export const passwordResetSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .refine(
      (email) => email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`),
      `Email must be from @${ALLOWED_EMAIL_DOMAIN} domain`
    ),
})

// New password schema
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password is too long')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

// Type exports
export type LoginInput = z.infer<typeof loginSchema>
export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>
export type NewPasswordInput = z.infer<typeof newPasswordSchema>