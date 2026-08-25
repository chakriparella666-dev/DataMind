const { appQuery, inMemoryAppDb, isPgConnected, saveInMemoryDbToFile } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'datamind_jwt_secret_key_2026';

class User {
  static generateToken(user) {
    return jwt.sign(
      { id: user.id || user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  static async findByEmail(email) {
    const cleanEmail = email.toLowerCase().trim();
    if (isPgConnected()) {
      try {
        const res = await appQuery(`SELECT * FROM users WHERE email = $1;`, [cleanEmail]);
        if (res.rows.length === 0) return null;
        const user = res.rows[0];
        user._id = user.id.toString();
        return user;
      } catch (err) {
        console.warn('[User findByEmail DB Warning]:', err.message);
      }
    }
    const user = inMemoryAppDb.users.find(u => u.email === cleanEmail);
    return user || null;
  }

  static async findById(id) {
    if (isPgConnected()) {
      try {
        const res = await appQuery(`SELECT id, name, email, google_id, avatar, created_at FROM users WHERE id = $1;`, [id]);
        if (res.rows.length === 0) return null;
        const user = res.rows[0];
        user._id = user.id.toString();
        return user;
      } catch (err) {
        console.warn('[User findById DB Warning]:', err.message);
      }
    }
    const user = inMemoryAppDb.users.find(u => (u.id || u._id).toString() === id.toString());
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  }

  static async create({ name, email, password, googleId = null, avatar = null }) {
    const cleanEmail = email.toLowerCase().trim();
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    if (isPgConnected()) {
      try {
        const res = await appQuery(
          `INSERT INTO users (name, email, password, google_id, avatar)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, name, email, google_id, avatar, created_at;`,
          [name, cleanEmail, hashedPassword, googleId, avatar]
        );
        const user = res.rows[0];
        user._id = user.id.toString();
        return user;
      } catch (err) {
        console.warn('[User create DB Warning]:', err.message);
      }
    }

    const newUser = {
      _id: 'u_' + Date.now(),
      id: 'u_' + Date.now(),
      name,
      email: cleanEmail,
      password: hashedPassword,
      googleId,
      avatar: avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
      createdAt: new Date()
    };
    inMemoryAppDb.users.push(newUser);
    const { password: pw, ...safeUser } = newUser;
    return safeUser;
  }

  static async comparePassword(candidatePassword, hashedPassword) {
    if (!candidatePassword || !hashedPassword) return false;
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }
}

module.exports = User;
