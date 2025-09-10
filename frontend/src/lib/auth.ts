import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getAdmin, updateAdminLastLogin } from './db';
import { NextRequest } from 'next/server';

export interface AdminPayload {
  adminId: string;
  username: string;
  type: 'admin';
}

class AuthService {
  private jwtSecret: string;
  private tokenExpiry = '24h';

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  }

  generateToken(payload: AdminPayload): string {
    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: this.tokenExpiry,
      issuer: 'party-dj-system'
    });
  }

  verifyToken(token: string): AdminPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as AdminPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  async authenticateAdmin(username: string, password: string) {
    try {
      const admin = await getAdmin(username);

      if (!admin || !admin.is_active) {
        throw new Error('Invalid credentials');
      }

      const isValidPassword = await this.comparePassword(password, admin.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      await updateAdminLastLogin(admin.username);

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
      throw error;
    }
  }

  extractTokenFromRequest(req: NextRequest): string | null {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  async requireAdminAuth(req: NextRequest): Promise<AdminPayload> {
    const token = this.extractTokenFromRequest(req);
    
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = this.verifyToken(token);

    if (decoded.type !== 'admin') {
      throw new Error('Admin access required');
    }

    return decoded;
  }
}

export const authService = new AuthService();