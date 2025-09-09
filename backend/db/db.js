const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'party_dj.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

/**
 * Initialize the database connection and create tables
 */
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // Ensure the directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        return reject(err);
      }
      console.log('Connected to SQLite database at:', DB_PATH);
    });

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Read and execute schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema, async (err) => {
      if (err) {
        console.error('Error creating database schema:', err);
        return reject(err);
      }
      
      console.log('Database schema created successfully');
      
      // Set up default admin password if provided
      if (process.env.ADMIN_PASSWORD) {
        await setupDefaultAdmin();
      }
      
      resolve();
    });
  });
}

/**
 * Set up default admin user with hashed password
 */
async function setupDefaultAdmin() {
  return new Promise((resolve, reject) => {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) {
      return resolve();
    }

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error('Error hashing admin password:', err);
        return reject(err);
      }

      // Update admin password hash
      db.run(
        'UPDATE admins SET password_hash = ? WHERE username = ?',
        [hash, 'admin'],
        (err) => {
          if (err) {
            console.error('Error updating admin password:', err);
            return reject(err);
          }
          console.log('Default admin password set successfully');
          resolve();
        }
      );

      // Also update settings table for backward compatibility
      db.run(
        'UPDATE settings SET value = ? WHERE key = ?',
        [hash, 'admin_password_hash'],
        (err) => {
          if (err) {
            console.error('Error updating settings password hash:', err);
          }
        }
      );
    });
  });
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      return resolve();
    }
    
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        return reject(err);
      }
      console.log('Database connection closed');
      resolve();
    });
  });
}

/**
 * Helper function to run database queries with promises
 */
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        return reject(err);
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Helper function to get single row with promises
 */
function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row);
    });
  });
}

/**
 * Helper function to get all rows with promises
 */
function getAllRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
}

/**
 * Hash IP address for privacy
 */
function hashIP(ip) {
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'default-salt')).digest('hex');
}

/**
 * Generate UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  runQuery,
  getRow,
  getAllRows,
  hashIP,
  generateUUID
};