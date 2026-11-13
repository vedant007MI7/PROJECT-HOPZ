const rideRepo = require('../datadomain/ride.repository');
const eventRepo = require('../datadomain/ride-event.repository');
const ratingRepo = require('../datadomain/rating.repository');
const driverProfileRepo = require('../datadomain/driver-profile.repository');
const db = require('../wrapper/db');
const { expireStaleRequests } = require('./expiry.business');
const config = require('../config');
const AppError = require('../function/app-error');
const { haversineKm } = require('../function/geo');
const { calculateFare } = require('../function/fare');
const { generatePin } = require('../function/pin');
const { RIDE_STATUS, ALLOWED_MOVES, CANCELLABLE_STATUSES } = require('../function/constants');
const { toRide } = require('../models/ride.model');
const { toRating } = require('../models/rating.model');

const UNIQUE_VIOLATION = '23505';
const NOT_FOUND = 'Ride not found';

// `user` is { id, role } from the token. Someone else's ride is a 404, never a 403,
// so ride ids cannot be probed.

const isParticipant = (ride, userId) => ride.rider_id === userId || ride.driver_id === userId;

function assertMove(from, to) {
  if (!ALLOWED_MOVES[from].includes(to)) {
    throw new AppError(`Ride is ${from}; it cannot move to ${to}`, 409);
  }
}

// The one place a ride's status changes (accept uses assertMove too, for its atomic UPDATE).
// Call inside withTransaction with the ride row locked.
async function transition(client, ride, toStatus, actorId, extra) {
  assertMove(ride.status, toStatus);
  await rideRepo.updateStatus(ride.id, toStatus, extra, client);
  await eventRepo.insert({ rideId: ride.id, status: toStatus, actorId }, client);
}

// Re-read after a change so the response carries the driver details and fresh timestamps.
async function viewRide(rideId, user) {
  return toRide(await rideRepo.findById(rideId), user.id);
}

async function createRide(user, input) {
  await expireStaleRequests();
  if (await rideRepo.findActiveByRider(user.id)) {
    throw new AppError('You already have an active ride', 409);
  }

  // The client never sends distance or fare.
  const distanceKm = Math.round(
    haversineKm(input.pickup.lat, input.pickup.lng, input.drop.lat, input.drop.lng) * 100
  ) / 100;
  const fare = calculateFare(input.vehicle_type, distanceKm);

  try {
    const row = await db.withTransaction(async (client) => {
      const ride = await rideRepo.insert(
        { riderId: user.id, pickup: input.pickup, drop: input.drop,
          vehicleType: input.vehicle_type, distanceKm, fare },
        client
      );
      await eventRepo.insert({ rideId: ride.id, status: RIDE_STATUS.REQUESTED, actorId: user.id }, client);
      return ride;
    });
    return toRide(row, user.id);
  } catch (err) {
    // Two taps racing past the check above; the unique index catches the second.
    if (err.code === UNIQUE_VIOLATION) throw new AppError('You already have an active ride', 409);
    throw err;
  }
}

async function getRide(user, rideId) {
  await expireStaleRequests();
  const ride = await rideRepo.findById(rideId);
  if (!ride || !isParticipant(ride, user.id)) throw new AppError(NOT_FOUND, 404);
  return toRide(ride, user.id);
}

async function listRides(user, query) {
  await expireStaleRequests();
  const rows = await rideRepo.listForUser(user.id, user.role, query);
  return rows.map((row) => toRide(row, user.id));
}

async function cancelRide(user, rideId) {
  await db.withTransaction(async (client) => {
    const ride = await rideRepo.findById(rideId, client, true);
    if (!ride || !isParticipant(ride, user.id)) throw new AppError(NOT_FOUND, 404);
    if (!CANCELLABLE_STATUSES.includes(ride.status)) {
      throw new AppError(`A ${ride.status} ride cannot be cancelled`, 409);
    }
    await transition(client, ride, RIDE_STATUS.CANCELLED, user.id, { cancelledBy: user.role });
  });
  return viewRide(rideId, user);
}

async function acceptRide(user, rideId) {
  await expireStaleRequests();
  const profile = await driverProfileRepo.findByUserId(user.id);
  if (!profile || !profile.is_online) throw new AppError('Go online before accepting rides', 409);
  if (await rideRepo.findActiveByDriver(user.id)) {
    throw new AppError('You already have an active ride', 409);
  }

  const ride = await rideRepo.findById(rideId);
  if (!ride) throw new AppError(NOT_FOUND, 404);
  if (ride.vehicle_type !== profile.vehicle_type) {
    throw new AppError('This ride needs a different vehicle type', 409);
  }
  assertMove(ride.status, RIDE_STATUS.ACCEPTED);

  try {
    const won = await db.withTransaction(async (client) => {
      // One atomic UPDATE ... WHERE status = 'requested': the first driver wins.
      const row = await rideRepo.acceptIfRequested(rideId, user.id, generatePin(), client);
      if (!row) return false;
      await eventRepo.insert({ rideId, status: RIDE_STATUS.ACCEPTED, actorId: user.id }, client);
      return true;
    });
    if (!won) throw new AppError('Ride was taken by another driver', 409);
  } catch (err) {
    // Unique index: this driver won another ride between our check and the UPDATE.
    if (err.code === UNIQUE_VIOLATION) throw new AppError('You already have an active ride', 409);
    throw err;
  }
  return viewRide(rideId, user);
}

async function declineRide(user, rideId) {
  const ride = await rideRepo.findById(rideId);
  if (!ride) throw new AppError(NOT_FOUND, 404);
  if (ride.status !== RIDE_STATUS.REQUESTED) throw new AppError('Ride is no longer open', 409);
  await eventRepo.insert({ rideId, status: 'declined', actorId: user.id });
  return { declined: true };
}

// Shared by arrived and complete: lock, check it is this driver's ride, move one step.
async function driverStep(user, rideId, toStatus) {
  await db.withTransaction(async (client) => {
    const ride = await rideRepo.findById(rideId, client, true);
    if (!ride || ride.driver_id !== user.id) throw new AppError(NOT_FOUND, 404);
    await transition(client, ride, toStatus, user.id);
  });
  return viewRide(rideId, user);
}

const markArrived = (user, rideId) => driverStep(user, rideId, RIDE_STATUS.ARRIVED);
const completeRide = (user, rideId) => driverStep(user, rideId, RIDE_STATUS.COMPLETED);

async function startRide(user, rideId, pin) {
  // Decide inside the transaction but throw after it, so a wrong attempt is still saved.
  const outcome = await db.withTransaction(async (client) => {
    const ride = await rideRepo.findById(rideId, client, true);
    if (!ride || ride.driver_id !== user.id) throw new AppError(NOT_FOUND, 404);
    assertMove(ride.status, RIDE_STATUS.STARTED);

    if (ride.pin_attempts >= config.pinMaxAttempts) return { locked: true };
    if (ride.start_pin !== pin) {
      const attempts = await rideRepo.incrementPinAttempts(rideId, client);
      return { attempts };
    }
    await transition(client, ride, RIDE_STATUS.STARTED, user.id);
    return { started: true };
  });

  if (outcome.locked) throw new AppError('Too many wrong PINs; starting this ride is locked', 423);
  if (outcome.attempts !== undefined) {
    const left = config.pinMaxAttempts - outcome.attempts;
    if (left <= 0) throw new AppError('Too many wrong PINs; starting this ride is locked', 423);
    throw new AppError(`Wrong PIN. ${left} attempt${left === 1 ? '' : 's'} left`, 400);
  }
  return viewRide(rideId, user);
}

async function rateRide(user, rideId, input) {
  const ride = await rideRepo.findById(rideId);
  if (!ride || ride.rider_id !== user.id) throw new AppError(NOT_FOUND, 404);
  if (ride.status !== RIDE_STATUS.COMPLETED) throw new AppError('Only completed rides can be rated', 409);

  try {
    const row = await ratingRepo.insert({
      rideId, stars: input.stars, tip: input.tip, comment: input.comment,
    });
    return toRating(row);
  } catch (err) {
    // ride_id is the primary key: the second rating collides.
    if (err.code === UNIQUE_VIOLATION) throw new AppError('This ride is already rated', 409);
    throw err;
  }
}

module.exports = {
  createRide,
  getRide,
  listRides,
  cancelRide,
  acceptRide,
  declineRide,
  markArrived,
  startRide,
  completeRide,
  rateRide,
};
