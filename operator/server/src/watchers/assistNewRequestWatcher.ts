import { getCustomerDb } from '../db/connect';
import { sendPushToUserIds } from '../lib/expoPush';

let started = false;

function pickPlaceName(d: any): string {
  return d?.placeName || d?.location?.name || d?.vehicle?.model || 'Location';
}
function pickAddress(d: any): string {
  return (
    d?.address ||
    d?.location?.address ||
    d?.location?.formattedAddress ||
    d?.location?.displayName ||
    ''
  );
}

export async function initAssistRequestWatcher() {
  if (started) return;
  started = true;

  try {
    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const stream = coll.watch(
      [
        {
          $match: {
            operationType: { $in: ['insert', 'update', 'replace'] },
          },
        },
      ],
      { fullDocument: 'updateLookup' }
    );

    stream.on('change', async (change: any) => {
      try {
        const op = change.operationType as string;
        const full = change.fullDocument || {};

        // Identify new or newly-pending requests
        let becamePending = false;
        if (op === 'insert' || op === 'replace') {
          becamePending = String(full?.status || 'pending') === 'pending';
        } else if (op === 'update') {
          const setFields = change?.updateDescription?.updatedFields || {};
          if (
            Object.prototype.hasOwnProperty.call(setFields, 'status') &&
            String(setFields.status) === 'pending'
          ) {
            becamePending = true;
          }
        }
        if (!becamePending) return;

        const id = String(full?._id || change.documentKey?._id || '');
        if (!id) return;

        // Find all operator user IDs
        const ops = await db
          .collection('operators')
          .find({}, { projection: { user_id: 1 } })
          .toArray();
        const userIds = ops
          .map((o: any) => (o?.user_id ? String(o.user_id) : ''))
          .filter(Boolean);
        if (!userIds.length) return;

        const place = pickPlaceName(full);
        const addr = pickAddress(full);
        const body = addr ? `${place} — ${addr}` : place;

        await sendPushToUserIds(userIds, {
          title: 'New request',
          body,
          data: { type: 'assist', requestId: id },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[watcher] assist new request push failed:', (e as Error).message);
      }
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[watcher] failed to start assist request watcher:', (e as Error).message);
  }
}


