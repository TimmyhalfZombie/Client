// server/src/lib/expoPush.ts
import { getAuthDb } from '../db/connect';

type PushData = Record<string, any>;
type PushMsg = {
  to: string;            // ExponentPushToken[...]
  title?: string;
  body?: string;
  data?: PushData;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;    // Android channel
  badge?: number;        // iOS
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoToken(t: string) {
  return /^ExponentPushToken\[[A-Za-z0-9\-\_]+\]$/.test(t);
}

async function fetchUserTokens(userId: string): Promise<string[]> {
  const auth = getAuthDb();
  const users = auth.collection('users');
  const doc = await users.findOne(
    { _id: new (require('mongodb').ObjectId)(userId) },
    { projection: { expoPushTokens: 1 } }
  );
  return Array.isArray(doc?.expoPushTokens) ? doc!.expoPushTokens.filter(isExpoToken) : [];
}

export async function sendPushToTokens(
  tokens: string[],
  notification: Omit<PushMsg, 'to'>
) {
  const valid = tokens.filter(isExpoToken);
  if (!valid.length) return { ok: true, sent: 0 };

  // Chunk up to 99 per request
  const chunks: string[][] = [];
  for (let i = 0; i < valid.length; i += 99) chunks.push(valid.slice(i, i + 99));

  const results: any[] = [];
  for (const chunk of chunks) {
    const payload = chunk.map((to) => ({
      to,
      sound: 'default',
      channelId: 'default',
      priority: 'high',
      ...notification,
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json: any = await res.json().catch(() => ({}));
    results.push(json);

    // Immediate error pruning (best-effort)
    const tickets = Array.isArray(json?.data) ? json.data : [];
    const bad: string[] = [];
    tickets.forEach((t: any, idx: number) => {
      if (t?.status === 'error') {
        const detail = t?.details?.error || t?.message;
        if (detail === 'DeviceNotRegistered') {
          bad.push(chunk[idx]);
        }
      }
    });
    if (bad.length) {
      try {
        const auth = getAuthDb();
        await auth
          .collection('users')
          .updateMany(
            { expoPushTokens: { $in: bad } },
            { $pull: { expoPushTokens: { $in: bad } } }
          );
      } catch {}
    }
  }
  return { ok: true, results };
}

export async function sendPushToUserIds(
  userIds: string[],
  opts: { title?: string; body?: string; data?: PushData }
) {
  const allTokens: string[] = [];
  for (const uid of userIds) {
    try {
      const tks = await fetchUserTokens(uid);
      allTokens.push(...tks);
    } catch {}
  }
  if (!allTokens.length) return { ok: true, sent: 0 };

  return sendPushToTokens(allTokens, {
    title: opts.title,
    body: opts.body,
    data: opts.data,
  });
}


