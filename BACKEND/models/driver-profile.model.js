const toDriverProfile = (row) => ({
  vehicle_type: row.vehicle_type,
  vehicle_model: row.vehicle_model,
  plate: row.plate,
  is_online: row.is_online,
  lat: row.lat,
  lng: row.lng,
  location_updated_at: row.location_updated_at,
});

module.exports = { toDriverProfile };
