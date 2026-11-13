const { z } = require('zod');

const setStatus = z.object({ is_online: z.boolean() });

const updateLocation = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

module.exports = { setStatus, updateLocation };
