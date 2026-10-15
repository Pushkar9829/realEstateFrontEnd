// Form schemas mirroring backend/src/modules/auth/validators.js so the user
// sees the same rule before the request is sent.
import { z } from 'zod';

export const password = z.string().min(8, 'At least 8 characters').max(64, 'At most 64 characters')
  .regex(/[A-Za-z]/, 'Must contain a letter').regex(/[0-9]/, 'Must contain a digit');

export const phone = z.string().trim().refine((v) => {
  const s = v.replace(/[\s()-]/g, '');
  return /^(\+?91|0)?[6-9]\d{9}$/.test(s) || /^\+[1-9]\d{7,14}$/.test(s);
}, 'Enter a 10-digit Indian mobile or an international number starting with +');

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or mobile number'),
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z.object({
  role: z.enum(['buyer', 'lister']),
  listerType: z.enum(['owner', 'builder', 'landlord']).optional(),
  name: z.string().trim().min(2, 'Enter your full name').max(80).regex(/^[\p{L} .'-]+$/u, 'Letters, spaces and dots only'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone,
  password,
  confirmPassword: z.string(),
  companyName: z.string().trim().optional(),
  referralCode: z.string().trim().optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms and privacy notice' }) }),
  noBrokerDeclaration: z.boolean().optional(),
  marketingOptIn: z.boolean().default(false),
}).superRefine((d, ctx) => {
  if (d.password !== d.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
  if (d.role === 'lister' && !d.listerType) ctx.addIssue({ code: 'custom', path: ['listerType'], message: 'Choose owner, builder or landlord' });
  if (d.role === 'lister' && d.noBrokerDeclaration !== true) ctx.addIssue({ code: 'custom', path: ['noBrokerDeclaration'], message: 'Brokers and agents cannot register as listers' });
  if (d.listerType === 'builder' && (!d.companyName || d.companyName.length < 2)) ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'Company name is required for builders' });
});

export const forgotSchema = z.object({ identifier: z.string().trim().min(3, 'Enter your email or mobile number') });

export const resetSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  newPassword: password,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: password,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
