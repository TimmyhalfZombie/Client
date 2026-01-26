import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export type JwtUser = { id: string; email: string };

const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';

export function signAccess(payload: JwtUser) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ACCESS_EXPIRES });
}

export function signRefresh(payload: JwtUser) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: REFRESH_EXPIRES });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.header('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtUser;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
