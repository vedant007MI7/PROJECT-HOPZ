const { z } = require('zod');
const { VEHICLE_TYPES, RIDE_STATUS, PIN, PAYMENT_METHODS } = require('../../function/constants');

const place = z.object({
  text: z.string().trim().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const createRide = z.object({
  pickup: place,
  drop: place,
  vehicle_type: z.enum(VEHICLE_TYPES),
  payment_method: z.enum(PAYMENT_METHODS).default('cash'),
});

const rideIdParam = z.object({ id: z.string().uuid() });

const listRides = z.object({
  status: z.enum(Object.values(RIDE_STATUS)).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const startRide = z.object({
  pin: z.string().regex(new RegExp(`^\\d{${PIN.LENGTH}}$`), `Must be ${PIN.LENGTH} digits`),
});

const rateRide = z.object({
  stars: z.number().int().min(1).max(5),
  tip: z.number().int().min(0).default(0),
  comment: z.string().trim().max(500).optional(),
});

// What Razorpay's checkout hands back after a successful payment.
const verifyPayment = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(200),
});

module.exports = { createRide, rideIdParam, listRides, startRide, rateRide, verifyPayment };
