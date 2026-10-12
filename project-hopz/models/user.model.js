// User entity shape. Models hold data only - no logic, no imports from other layers.
class User {
  constructor({ id, name, email, createdAt }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.createdAt = createdAt;
  }
}

module.exports = { User };
