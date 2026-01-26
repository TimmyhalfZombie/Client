import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/** Public shape we attach to req.user */
export type JwtUser = { id: string; email?: string };

/** Use separate secrets and TTLs; fall back to legacy config if envs are missing */
const ACCESS_SECRET  = process.env.JWT_SECRET || config.jwtSecret;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || config.jwtSecret;

const ACCESS_EXPIRES  = process.env.JWT_ACCESS_TTL  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_TTL || '30d';

/** Helpers to sign tokens */
export function signAccess(user: JwtUser) {
  // Standardize on sub for user id
  return jwt.sign({ sub: user.id, email: user.email }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}
export function signRefresh(user: JwtUser, jti?: string) {
  return jwt.sign({ sub: user.id, jti }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

/** Extract Bearer token from Authorization header */
function readBearer(req: Request): string | null {
  const h = req.header('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Require a valid **access** token */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as any;
    (req as any).user = { id: String(payload.sub ?? payload.id), email: payload.email } as JwtUser;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/** Require a valid **refresh** token (reads from body.refreshToken or header X-Refresh-Token) */
export function requireRefresh(req: Request, res: Response, next: NextFunction) {
  const token =
    (req.body && (req.body.refreshToken as string)) ||
    (req.header('X-Refresh-Token') as string) ||
    null;

  if (!token) return res.status(400).json({ message: 'Missing refresh token' });

  try {
    const payload = jwt.verify(token, REFRESH_SECRET) as any;
    (req as any).user = { id: String(payload.sub) } as JwtUser;
    (req as any).refresh = { jti: payload.jti };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
}
