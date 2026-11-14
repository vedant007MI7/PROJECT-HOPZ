const ROLES = { RIDER: 'rider', DRIVER: 'driver' };

const VEHICLE_TYPES = ['auto', 'mini', 'sedan'];

const RIDE_STATUS = {
  REQUESTED: 'requested',
  ACCEPTED: 'accepted',
  ARRIVED: 'arrived',
  STARTED: 'started',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Single source of truth for status changes; the status-change function reads only this.
const ALLOWED_MOVES = {
  requested: ['accepted', 'cancelled'],
  accepted: ['arrived', 'cancelled'],
  arrived: ['started', 'cancelled'],
  started: ['completed'],
  completed: [],
  cancelled: [],
};

// A driver can hold only one of these at a time (mirrors the partial unique index).
const DRIVER_ACTIVE_STATUSES = ['accepted', 'arrived', 'started'];
// A rider can have only one of these at a time.
const RIDER_ACTIVE_STATUSES = ['requested', 'accepted', 'arrived', 'started'];
// Cancel is refused once the trip has started.
const CANCELLABLE_STATUSES = ['requested', 'accepted', 'arrived'];

const PIN = { LENGTH: 4 };

const PAYMENT_METHODS = ['cash', 'online'];

// "Today" and "this week" (Monday start) in driver earnings are counted in this timezone.
const EARNINGS_TIMEZONE = 'Asia/Kolkata';

module.exports = {
  ROLES,
  VEHICLE_TYPES,
  RIDE_STATUS,
  ALLOWED_MOVES,
  DRIVER_ACTIVE_STATUSES,
  RIDER_ACTIVE_STATUSES,
  CANCELLABLE_STATUSES,
  PIN,
  PAYMENT_METHODS,
  EARNINGS_TIMEZONE,
};
