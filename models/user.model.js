// Whitelist fields instead of deleting password_hash, so new columns stay private by default.
const toUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  role: row.role,
  created_at: row.created_at,
});

module.exports = { toUser };
