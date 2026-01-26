import { Router } from 'express';
import { Types } from 'mongoose';
import { getCustomerDb } from '../db/connect';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/** Normalize/whitelist outgoing user fields. Returns both snake_case and camelCase so the client never misses. */
function toPublicUser(u: any) {
  if (!u) return null;
  const userObj = u as Record<string, any>;

  // prefer explicit initial_* fields; fall back to nested location.*
  const initial_lat =
    userObj.initial_lat ?? userObj.initialLat ?? userObj.location?.initial_lat ?? userObj.location?.initialLat ?? userObj.lat ?? userObj.location?.lat ?? null;

  const initial_long =
    userObj.initial_long ??
    userObj.initialLong ??
    userObj.initial_lng ??
    userObj.initialLng ??
    userObj.location?.initial_long ??
    userObj.location?.initialLong ??
    userObj.location?.initial_lng ??
    userObj.location?.initialLng ??
    userObj.lng ??
    userObj.location?.lng ??
    null;

  const initial_address =
    userObj.initial_address ??
    userObj.initialAddress ??
    userObj.location?.initial_address ??
    userObj.location?.initialAddress ??
    userObj.address ??
    userObj.location?.address ??
    null;

  const composedName = [userObj.firstName, userObj.lastName].filter(Boolean).join(' ').trim() || null;
  const name = userObj.name ?? composedName ?? null;
  const phone =
    userObj.phone ??
    userObj.phoneNumber ??
    userObj.customerPhone ??
    userObj.contactPhone ??
    userObj.mobile ??
    userObj.tel ??
    null;
  const email = userObj.email ?? userObj.contactEmail ?? userObj.username ?? null;
  const username = userObj.username ?? name ?? email ?? null;

  const base = {
    _id: String(userObj._id ?? userObj.id ?? ''),
    name,
    username,
    email,
    phone,
    avatar: userObj.avatar ?? null,

    // canonical (snake_case)
    initial_lat,
    initial_long,
    initial_address,

    // mirrors (camelCase)
    initialLat: initial_lat,
    initialLong: initial_long,
    initialAddress: initial_address,

    // last known current coords if you keep them
    lat: userObj.lat ?? userObj.location?.lat ?? null,
    lng: userObj.lng ?? userObj.location?.lng ?? null,
    address: userObj.address ?? userObj.location?.address ?? null,

    updated_at: userObj.updated_at ?? userObj.updatedAt ?? userObj.location?.updated_at ?? userObj.location?.updatedAt ?? null,
  };

  return base;
}

async function findUserDocById(userId: string) {
  const db = await getCustomerDb();
  const coll = db.collection('users');

  // Support ObjectId or string id
  const filter: Record<string, any> = Types.ObjectId.isValid(userId)
    ? { _id: new Types.ObjectId(userId) }
    : { _id: userId };

  return coll.findOne(filter as any);
}

/** GET /api/users/me – return my profile with initial_* */
router.get('/me', requireAuth, async (req: any, res) => {
  try {
    const meId = String(req.user?.id ?? req.user?._id ?? '');
    if (!meId) return res.status(401).json({ message: 'Unauthorized' });

    const doc = await findUserDocById(meId);
    if (!doc) return res.status(404).json({ message: 'User not found' });

    return res.json(toPublicUser(doc));
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to load profile' });
  }
});

/** GET /api/users/:id – return a user's public profile with initial_* */
router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const doc = await findUserDocById(id);
    if (!doc) return res.status(404).json({ message: 'User not found' });

    return res.json(toPublicUser(doc));
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to load user' });
  }
});

/** GET /api/users/me/location – normalized lat/lng/address (prefers initial_* if present) */
router.get('/me/location', requireAuth, async (req: any, res) => {
  try {
    const meId = String(req.user?.id ?? req.user?._id ?? '');
    if (!meId) return res.status(401).json({ message: 'Unauthorized' });

    const doc = await findUserDocById(meId);
    if (!doc) return res.status(404).json({ message: 'User not found' });

    const u = toPublicUser(doc);
    if (!u) return res.status(404).json({ message: 'User not found' });
    return res.json({
      lat: (u.initial_lat ?? u.lat) ?? null,
      lng: (u.initial_long ?? u.lng) ?? null,
      address: (u.initial_address ?? u.address) ?? null,

      // include both spellings (helps older clients)
      initial_lat: u.initial_lat ?? null,
      initial_long: u.initial_long ?? null,
      initial_address: u.initial_address ?? null,
      updated_at: u.updated_at ?? null,
    });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to load location' });
  }
});

/** POST /api/users/me/location – update my current/initial location */
router.post('/me/location', requireAuth, async (req: any, res) => {
  try {
    const meId = String(req.user?.id ?? req.user?._id ?? '');
    if (!meId) return res.status(401).json({ message: 'Unauthorized' });

    // incoming from device
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const address =
      req.body?.address ??
      req.body?.initial_address ??
      req.body?.initialAddress ??
      null;

    const db = await getCustomerDb();
    const coll = db.collection('users');

    const filter: Record<string, any> = Types.ObjectId.isValid(meId)
      ? { _id: new Types.ObjectId(meId) }
      : { _id: meId };

    // Read current doc to only set initial_* once
    const existing = await coll.findOne(filter as any);

    const $set: any = {
      'location.updated_at': new Date(),
    };
    if (Number.isFinite(lat)) $set['location.lat'] = lat;
    if (Number.isFinite(lng)) $set['location.lng'] = lng;
    if (typeof address === 'string') $set['location.address'] = address;

    // Only set initial_* if missing
    if (!existing) {
      if (Number.isFinite(lat)) $set.initial_lat = lat;
      if (Number.isFinite(lng)) $set.initial_long = lng;
      if (typeof address === 'string' && address.trim()) $set.initial_address = address.trim();
    } else {
      if (existing.initial_lat == null && Number.isFinite(lat)) $set.initial_lat = lat;
      if (existing.initial_long == null && Number.isFinite(lng)) $set.initial_long = lng;
      if (existing.initial_address == null && typeof address === 'string' && address.trim()) {
        $set.initial_address = address.trim();
      }
    }

    await coll.updateOne(filter as any, { $set }, { upsert: true });
    const fresh = await coll.findOne(filter as any);
    return res.json(toPublicUser(fresh));
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to update location' });
  }
});

export default router;
