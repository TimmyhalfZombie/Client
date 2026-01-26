import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { connectDB, getCustomerDb } from '../db/connect';
import { requireAuth, requireRefresh, signAccess, signRefresh } from '../middleware/jwt';

const router = Router();

/* ---------- helpers ---------- */
function normalizePhone(raw?: string) {
  if (typeof raw !== 'string') return undefined;
  const digits = raw.replace(/\D+/g, '');
  return digits.length ? digits : undefined;
}
function normalizeIdentifier(raw: string) {
  const id = String(raw || '').trim();
  const looksLikeEmail = id.includes('@');
  const email = looksLikeEmail ? id.toLowerCase() : undefined;
  const username = looksLikeEmail ? undefined : id;
  const phone = normalizePhone(id);
  return { email, username, phone };
}

/* ------------------- REGISTER ------------------- */
router.post('/register', async (req, res, next) => {
  try {
    let { username, email, phone, password, lat, lng, address } = req.body || {};

    username = String(username || '').trim();
    email = String(email || '').trim().toLowerCase();
    const phoneNorm = normalizePhone(phone);
    password = String(password || '');

    if (!username || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const db = await connectDB();
    const users = db.collection('users');

    const conflict = await users.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNorm ? [{ phone: phoneNorm }] : []),
      ],
    });
    if (conflict) {
      return res.status(409).json({ message: 'Email or phone already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    const createdAt = new Date();

    const latNum = Number(lat);
    const lngNum = Number(lng);
    const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);
    
    // Geocode coordinates to get real address if not provided
    let realAddress = address;
    if (hasCoords && !address) {
      try {
        const { reverseGeocode } = await import('./geo');
        const geocodedAddress = await reverseGeocode(latNum, lngNum);
        if (geocodedAddress) {
          realAddress = geocodedAddress;
        }
      } catch (e) {
        console.log('Reverse geocoding failed:', e);
      }
      if (!realAddress) {
        realAddress = `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`;
      }
    }

    const doc = await users.insertOne({
      username,
      ...(email ? { email } : {}),
      ...(phoneNorm ? { phone: phoneNorm } : {}),
      ...(hasCoords ? { 
        initial_lat: latNum, 
        initial_lng: lngNum, 
        initial_address: realAddress || null,
        initial_loc_at: createdAt 
      } : {}),
      password_hash: hash,
      created_at: createdAt,
    });

    // mirror into customer DB for operator location bootstrap
    if (hasCoords) {
      const customerDb = getCustomerDb();
      await customerDb.collection('operators').updateOne(
        { user_id: String(doc.insertedId) },
        {
          $set: {
            user_id: String(doc.insertedId),
            last_lat: latNum,
            last_lng: lngNum,
            last_address: realAddress || null,
            last_seen_at: createdAt,
            accuracy_m: 50,
            source: 'device',
          },
        },
        { upsert: true }
      );
    }

    const payload = { id: String(doc.insertedId), email };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    return res.json({
      user: { id: payload.id, email, username, phone: phoneNorm },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    console.error('REGISTER failed:', e);
    next(e);
  }
});

/* -------------------- LOGIN --------------------- */
router.post('/login', async (req, res, next) => {
  try {
    let { identifier, password } = req.body || {};
    identifier = String(identifier || '').trim();
    password = String(password || '');

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    const { email, username, phone } = normalizeIdentifier(identifier);

    const db = await connectDB();
    const users = db.collection('users');

    const user = await users.findOne(
      {
        $or: [
          ...(email ? [{ email }] : []),
          ...(username ? [{ username }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      {
        projection: {
          _id: 1,
          email: 1,
          username: 1,
          phone: 1,
          password_hash: 1,
          password: 1,
        },
      }
    );

    if (!user) {
      return res
        .status(401)
        .json({ message: 'Account not found. Please create an account first.' });
    }

    const hash: string | undefined = user.password_hash || user.password;
    if (typeof hash !== 'string' || !hash.length) {
      return res
        .status(500)
        .json({ message: 'User record has no password hash. Please reset your password.' });
    }

    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = { id: String(user._id), email: user.email };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    return res.json({
      user: {
        id: payload.id,
        email: user.email,
        username: user.username,
        phone: user.phone,
      },
      accessToken,
      refreshToken,
    });
  } catch (e) {
    next(e);
  }
});

/* --------------------- REFRESH ------------------ */
router.post('/refresh', requireRefresh, async (req, res) => {
  const user = (req as any).user as { id: string };
  // Optionally rotate refresh (recommended)
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  return res.json({ accessToken, refreshToken });
});

/* ----------------------- ME -------------------- */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { id } = (req as any).user as { id: string; email?: string };
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid user id' });

    const db = await connectDB();
    const users = db.collection('users');

    const doc = await users.findOne(
      { _id: new ObjectId(id) },
      { projection: { username: 1, phone: 1, email: 1, initial_lat: 1, initial_lng: 1 } }
    );
    if (!doc) return res.status(404).json({ message: 'User not found' });

    return res.json({
      username: doc.username ?? '',
      phone: doc.phone ?? '',
      email: doc.email ?? '',
      initial_lat: doc.initial_lat ?? null,
      initial_lng: doc.initial_lng ?? null,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
