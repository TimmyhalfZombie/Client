import { Request, Response, NextFunction } from 'express';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { config } from '../config';

export interface AuthedUser {
  _id: string;
  username: string;
  email: string;
  phone: string;
}
export interface AuthedRequest extends Request {
  user?: AuthedUser;
}

export function signToken(user: AuthedUser) {
  const payload = {
    _id: user._id,
    username: user.username,
    email: user.email,
    phone: user.phone
  };
  const opts: SignOptions = {
    algorithm: 'HS256'
    // no expiresIn -> token never expires
  };
  return jwt.sign(payload, config.jwtSecret as Secret, opts);
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    const decoded = jwt.verify(token, config.jwtSecret as Secret) as AuthedUser;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
