import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getCustomerDb } from '../db/connect';
import { requireAuth } from '../middleware/jwt';

const router = Router();

function extractScore(doc: any): number | null {
  const candidates = [doc?.rating, doc?.score, doc?.value, doc?.stars, doc?.points];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) {
      return c;
    }
  }
  return null;
}

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const idRaw = String(req.params.id ?? '').trim();
    if (!idRaw) {
      return res.status(400).json({ message: 'Missing rating id' });
    }

    const db = getCustomerDb();
    const coll = db.collection('ratings');

    const filters: any[] = [];
    const pushFilters = (key: string, value: any) => {
      filters.push({ [key]: value });
    };

    pushFilters('customerId', idRaw);
    pushFilters('userId', idRaw);
    pushFilters('clientId', idRaw);
    pushFilters('targetId', idRaw);

    if (ObjectId.isValid(idRaw)) {
      const objId = new ObjectId(idRaw);
      pushFilters('customerId', objId);
      pushFilters('userId', objId);
      pushFilters('clientId', objId);
      pushFilters('targetId', objId);
    }

    if (filters.length === 0) {
      return res.json({ average: null, count: 0 });
    }

    const docs = await coll.find({ $or: filters }).toArray();

    if (!docs.length) {
      return res.json({ average: null, count: 0 });
    }

    let sum = 0;
    let count = 0;
    for (const doc of docs) {
      const v = extractScore(doc);
      if (v != null) {
        sum += v;
        count += 1;
      }
    }

    if (!count) {
      return res.json({ average: null, count: 0 });
    }

    const avg = sum / count;

    return res.json({ average: avg, count });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? 'Failed to load rating' });
  }
});

export default router;

