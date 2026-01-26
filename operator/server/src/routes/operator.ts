import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getAuthDb } from '../db/connect';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/** Normalize outgoing user fields (returns both snake_case and camelCase) */
function toPublicUser(u: any) {
  if (!u) return null;
  const userObj = u as Record<string, any>;

  const initial_lat =
    userObj.initial_lat ??
    userObj.initialLat ??
    userObj.location?.initial_lat ??
    userObj.location?.initialLat ??
    userObj.lat ??
    userObj.location?.lat ??
    null;

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

  return {
    _id: String(userObj._id ?? userObj.id ?? ''),
    name,
    username,
    email,
    phone,
    avatar: userObj.avatar ?? null,

    // canonical snake_case
    initial_lat,
    initial_long,
    initial_address,

    // mirrors (camelCase)
    initialLat: initial_lat,
    initialLong: initial_long,
    initialAddress: initial_address,

    // latest (if you store them)
    lat: userObj.lat ?? userObj.location?.lat ?? userObj.last_lat ?? null,
    lng: userObj.lng ?? userObj.location?.lng ?? userObj.last_lng ?? userObj.last_long ?? null,
    address: userObj.address ?? userObj.location?.address ?? userObj.last_address ?? null,

    updated_at:
      userObj.updated_at ??
      userObj.updatedAt ??
      userObj.location?.updated_at ??
      userObj.location?.updatedAt ??
      userObj.last_seen_at ??
      userObj.initial_loc_at ??
      null,
  };
}

async function usersColl() {
  const db = await getAuthDb(); // <-- appdb
  return db.collection('users');
}

function idFilter(id: string): Record<string, any> {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
}

/* -------------------------------------------------------------------------- */
/*  GET /me – return my profile (incl. initial_* fields)                      */
/*  Mount under /api/users and/or /api/operator                               */
/* -------------------------------------------------------------------------- */
router.get('/me', requireAuth, async (req: any, res) => {
  try {
    const uid = String(req.user?.id ?? req.user?._id ?? '');
    if (!uid) return res.status(401).json({ message: 'unauthorized' });

    const coll = await usersColl();
    const doc = await coll.findOne(idFilter(uid) as any);
    if (!doc) return res.status(404).json({ message: 'User not found' });

    return res.json(toPublicUser(doc));
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to load profile' });
  }
});

/* -------------------------------------------------------------------------- */
/*  GET /:id – public profile (incl. initial_* fields)                        */
/* -------------------------------------------------------------------------- */
router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const coll = await usersColl();
    const doc = await coll.findOne(idFilter(id) as any);
    if (!doc) return res.status(404).json({ message: 'User not found' });

    return res.json(toPublicUser(doc));
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to load user' });
  }
});

/* -------------------------------------------------------------------------- */
/*  GET /me/location – normalized lat/lng/address                             */
/*  Prefers last_* then falls back to initial_*                                */
/*  Returns 200 with nulls if missing (friendlier to client)                  */
/* -------------------------------------------------------------------------- */
router.get('/me/location', requireAuth, async (req: any, res) => {
  try {
    const uid = String(req.user?.id ?? req.user?._id ?? '');
    if (!uid) return res.status(401).json({ message: 'unauthorized' });

    const coll = await usersColl();
    const user = await coll.findOne(
      idFilter(uid) as any,
      {
        projection: {
          last_lat: 1,
          last_lng: 1,
          last_long: 1,
          last_address: 1,
          last_seen_at: 1,
          initial_lat: 1,
          initial_lng: 1,
          initial_long: 1,
          inital_lat: 1,    // tolerate misspelling
          inital_long: 1,   // tolerate misspelling
          initial_address: 1,
          initial_loc_at: 1,
          location: 1,
          address: 1,
          lat: 1,
          lng: 1,
        },
      }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    const lat =
      user.last_lat ??
      user.lat ??
      user.location?.lat ??
      user.initial_lat ??
      user.inital_lat ??
      null;

    const lng =
      user.last_lng ??
      user.last_long ??
      user.lng ??
      user.location?.lng ??
      user.initial_lng ??
      user.initial_long ??
      user.inital_long ??
      null;

    const address =
      user.last_address ??
      user.address ??
      user.location?.address ??
      user.initial_address ??
      null;

    const updated_at =
      user.last_seen_at ??
      user.location?.updated_at ??
      user.initial_loc_at ??
      null;

    return res.json({
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      address: typeof address === 'string' ? address : null,
      updated_at,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('GET /me/location failed', err);
    return res.status(500).json({ message: 'failed to read location' });
  }
});

/* -------------------------------------------------------------------------- */
/*  POST /me/location – upsert last_* and set initial_* if missing            */
/*  Body: { lat: number, lng: number, address?: string }                      */
/* -------------------------------------------------------------------------- */
router.post('/me/location', requireAuth, async (req: any, res) => {
  try {
    const uid = String(req.user?.id ?? req.user?._id ?? '');
    if (!uid) return res.status(401).json({ message: 'unauthorized' });

    const { lat, lng, address } = req.body || {};
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ message: 'lat and lng are required numbers' });
    }

    const coll = await usersColl();
    const filter = idFilter(uid);
    const existing = await coll.findOne(filter);

    const set: any = {
      last_lat: latNum,
      last_lng: lngNum,
      last_address: typeof address === 'string' ? address : (existing?.last_address ?? existing?.initial_address ?? null),
      last_seen_at: new Date(),
    };

    // Set initial_* once if missing
    if (!existing || existing.initial_lat == null) set.initial_lat = latNum;
    if (!existing || (existing.initial_lng == null && existing.initial_long == null)) {
      set.initial_lng = lngNum; // prefer *_lng
      set.initial_long = existing?.initial_long ?? lngNum; // also keep *_long if your schema used it
    }
    if (!existing || existing.initial_address == null) {
      if (typeof address === 'string' && address.trim()) set.initial_address = address.trim();
    }
    if (!existing || existing.initial_loc_at == null) set.initial_loc_at = new Date();

    await coll.updateOne(filter, { $set: set }, { upsert: true });
    const fresh = await coll.findOne(filter);
    return res.json(toPublicUser(fresh));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('POST /me/location failed', err);
    return res.status(500).json({ message: 'failed to update location' });
  }
});

/* -------------------------------------------------------------------------- */
/*  POST /update-initial-from-last – maintenance helper                       */
/* -------------------------------------------------------------------------- */
router.post('/update-initial-from-last', requireAuth, async (_req: any, res) => {
  try {
    const coll = await usersColl();
    const cur = coll.find({
      last_lat: { $exists: true },
      $or: [{ initial_lat: { $exists: false } }, { initial_lng: { $exists: false } }, { initial_long: { $exists: false } }],
    });

    let updated = 0;
    for await (const u of cur) {
      await coll.updateOne(
        { _id: u._id },
        {
          $set: {
            initial_lat: u.initial_lat ?? u.last_lat ?? null,
            initial_lng: u.initial_lng ?? u.last_lng ?? u.last_long ?? null,
            initial_long: u.initial_long ?? u.last_long ?? u.last_lng ?? null,
            initial_address: u.initial_address ?? u.last_address ?? null,
            initial_loc_at: u.initial_loc_at ?? u.last_seen_at ?? new Date(),
          },
        }
      );
      updated++;
    }

    return res.json({ success: true, updated });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('POST /update-initial-from-last failed', err);
    return res.status(500).json({ message: 'failed to update initial fields' });
  }
});

export default router;
