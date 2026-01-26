import { Router } from 'express';
import { Types } from 'mongoose';
import { getCustomerDb } from '../db/connect';
import { requireAuth } from '../middleware/jwt';

const r = Router();

function toId(v: any): string | null {
  try { return v ? String(v) : null; } catch { return null; }
}

/**
 * DEBUG/Verification: fetch messages directly from the customer DB
 * GET /api/messages/all?limit=200&conversationId=...&senderId=...
 */
r.get('/all', requireAuth as any, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 2000);
  const conversationId = typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined;
  const senderId = typeof req.query.senderId === 'string' ? req.query.senderId : undefined;

  const db = getCustomerDb();
  const coll = db.collection('messages');

  const q: any = {};
  if (conversationId && Types.ObjectId.isValid(conversationId)) q.conversationId = new Types.ObjectId(conversationId);
  if (senderId && Types.ObjectId.isValid(senderId)) q.senderId = new Types.ObjectId(senderId);

  const docs = await coll
    .find(q, { sort: { createdAt: -1 }, limit })
    .toArray();

  const items = docs.map((m: any) => ({
    id: toId(m._id),
    conversationId: toId(m.conversationId),
    senderId: toId(m.senderId),
    content: m.content,
    attachment: m.attachment ?? null,
    createdAt: (m.createdAt ?? new Date()).toISOString(),
    updatedAt: (m.updatedAt ?? m.createdAt ?? new Date()).toISOString(),
  }));

  res.json({ count: items.length, items });
});

// Placeholder (legacy/in-memory). Not used by your chat flow; safe to keep.
r.get('/:requestId', requireAuth as any, async (_req, res) => {
  res.json({ items: [] });
});

export default r;
