const { z } = require('zod');
const { ROLES, VEHICLE_TYPES } = require('../../function/constants');

const email = z.string().trim().toLowerCase().email().max(254);

// Driver fields are optional in the type but vehicle_type is required for drivers,
// because a driver without a vehicle cannot match any ride.
const signup = z
  .object({
    name: z.string().trim().min(1).max(100),
    email,
    // bcrypt ignores everything past 72 bytes, so cap it.
    password: z.string().min(8).max(72),
    role: z.enum([ROLES.RIDER, ROLES.DRIVER]),
    phone: z.string().trim().min(5).max(20).optional(),
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

const login = z.object({
  email,
  password: z.string().min(1).max(72),
});

module.exports = { signup, login };
