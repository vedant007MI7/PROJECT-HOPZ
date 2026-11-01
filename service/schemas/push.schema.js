const { z } = require('zod');

const saveToken = z.object({
  token: z.string().trim().min(1).max(255),
  platform: z.enum(['ios', 'android']),
});

module.exports = { saveToken };
