const { z } = require('zod');
const { ROLES, VEHICLE_TYPES } = require('../../function/constants');
const { normalizePhone } = require('../../function/phone');

const email = z.string().trim().toLowerCase().email().max(254);

// Stored in one format (+91...), so login and uniqueness compare like with like.
const phone = z
  .string()
  .trim()
  .max(25)
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid phone number' });
    return normalized;
  });

// Driver fields are optional in the type but vehicle_type is required for drivers,
// because a driver without a vehicle cannot match any ride.
const signup = z
  .object({
    name: z.string().trim().min(1).max(100),
    email,
    // bcrypt ignores everything past 72 bytes, so cap it.
    password: z.string().min(8).max(72),
    role: z.enum([ROLES.RIDER, ROLES.DRIVER]),
    phone: phone.optional(),
    vehicle_type: z.enum(VEHICLE_TYPES).optional(),
    vehicle_model: z.string().trim().max(100).optional(),
    plate: z.string().trim().max(20).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === ROLES.DRIVER && !v.vehicle_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vehicle_type'],
        message: 'Required for drivers',
      });
    }
  });

// `identifier` is an email or a phone number; `email` still works for older clients.
const login = z
  .object({
    identifier: z.string().trim().min(1).max(254).optional(),
    email: z.string().trim().min(1).max(254).optional(),
    password: z.string().min(1).max(72),
  })
  .refine((v) => v.identifier || v.email, { message: 'Email or phone number is required', path: ['identifier'] })
  .transform((v) => ({ identifier: v.identifier || v.email, password: v.password }));

module.exports = { signup, login };
