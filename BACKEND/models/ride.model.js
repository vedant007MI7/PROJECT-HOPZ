// `viewerId` decides what is shown: only the rider sees start_pin.
// `row` may carry joined driver_* columns (driver_name, driver_phone, vehicle_*, plate).
function toRide(row, viewerId) {
  const ride = {
    id: row.id,
    rider_id: row.rider_id,
    driver_id: row.driver_id,
    pickup: { text: row.pickup_text, lat: row.pickup_lat, lng: row.pickup_lng },
    drop: { text: row.drop_text, lat: row.drop_lat, lng: row.drop_lng },
    vehicle_type: row.vehicle_type,
    distance_km: Number(row.distance_km),
    fare: row.fare,
    status: row.status,
    cancelled_by: row.cancelled_by,
    requested_at: row.requested_at,
    accepted_at: row.accepted_at,
    arrived_at: row.arrived_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    cancelled_at: row.cancelled_at,
    driver: null,
  };

  if (row.driver_id && row.driver_name !== undefined) {
    ride.driver = {
      id: row.driver_id,
      name: row.driver_name,
      phone: row.driver_phone,
      vehicle_type: row.driver_vehicle_type,
      vehicle_model: row.driver_vehicle_model,
      plate: row.driver_plate,
      // Live position, for the rider's map while the driver is on the way or on the trip.
      location:
        viewerId === row.rider_id && ['accepted', 'arrived', 'started'].includes(row.status) && row.driver_lat != null
          ? { lat: row.driver_lat, lng: row.driver_lng }
          : null,
    };
  }

  // The ride's own driver can reach the rider; nobody else gets the rider's phone.
  if (viewerId === row.driver_id && row.rider_name !== undefined) {
    ride.rider = { name: row.rider_name, phone: row.rider_phone };
  }

  if (viewerId === row.rider_id) ride.start_pin = row.start_pin;
  return ride;
}

module.exports = { toRide };
