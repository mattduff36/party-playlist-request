const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getRow, runQuery } = require('../db/db');

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    this.tokenExpiry = '24h'; // Token expires in 24 hours
  }

  /**
   * Generate JWT token
   */
  generateToken(payload) {
    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: this.tokenExpiry,
      issuer: 'party-dj-system'
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Authenticate admin user
   */
  async authenticateAdmin(username, password) {
    try {
      // Get admin user from database
      const admin = await getRow(
        'SELECT * FROM admins WHERE username = ? AND is_active = TRUE',
        [username]
      );

      if (!admin) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await this.comparePassword(password, admin.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      await runQuery(
        'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [admin.id]
      );

      // Generate JWT token
      const token = this.generateToken({
        adminId: admin.id,
        username: admin.username,
        type: 'admin'
      });

      return {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          lastLogin: admin.last_login
        }
      };
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Middleware to verify admin authentication
   */
  requireAdminAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const decoded = this.verifyToken(token);

      if (decoded.type !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      req.admin = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  /**
   * Create new admin user
   */
  async createAdmin(username, password) {
    try {
      // Check if username already exists
      const existingAdmin = await getRow(
        'SELECT id FROM admins WHERE username = ?',
        [username]
      );

      if (existingAdmin) {
        throw new Error('Username already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Generate unique ID
      const adminId = `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Insert new admin
      await runQuery(`
        INSERT INTO admins (id, username, password_hash, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [adminId, username, passwordHash]);

      return {
        id: adminId,
        username: username,
        created: true
      };
    } catch (error) {
      console.error('Error creating admin:', error);
      throw error;
    }
  }

  /**
   * Update admin password
   */
  async updateAdminPassword(adminId, newPassword) {
    try {
      const passwordHash = await this.hashPassword(newPassword);
      
      const result = await runQuery(
        'UPDATE admins SET password_hash = ? WHERE id = ?',
        [passwordHash, adminId]
      );

      if (result.changes === 0) {
        throw new Error('Admin not found');
      }

      return true;
    } catch (error) {
      console.error('Error updating admin password:', error);
      throw error;
    }
  }

  /**
   * Get admin by ID
   */
  async getAdminById(adminId) {
    try {
      const admin = await getRow(
        'SELECT id, username, created_at, last_login, is_active FROM admins WHERE id = ?',
        [adminId]
      );

      return admin;
    } catch (error) {
      console.error('Error getting admin:', error);
      throw error;
    }
  }

  /**
   * List all admins
   */
  async listAdmins() {
    try {
      const admins = await getAllRows(
        'SELECT id, username, created_at, last_login, is_active FROM admins ORDER BY created_at DESC'
      );

      return admins;
    } catch (error) {
      console.error('Error listing admins:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();