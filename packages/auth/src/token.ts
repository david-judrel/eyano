import jwt from 'jsonwebtoken';
import { TokenPayload } from './types';

const SECRET = process.env.AUTH_SECRET || 'eyano-dev-secret-change-in-production';
const EXPIRES_IN = '7d';

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
