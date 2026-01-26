import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { Types } from 'mongoose';
import { getAuthDb, getCustomerDb } from '../db/connect';
import { sendPushToUserIds } from '../lib/expoPush';
import { requireAuth } from '../middleware/jwt';
import { getIO } from '../socket'; // best-effort: if socket exists we'll emit

const router = Router();

/* --------------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------------*/
function pickClientName(d: any): string {
  return (
    d?.clientName ||
    d?.customerName ||
    d?.location?.contactName ||
    d?.location?.contact?.name ||
    d?.contactName ||
    d?.user?.name ||
    'Customer'
  );
}
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
function toNum(n: any): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
/** Try to get {lat,lng} from several shapes */
function extractCoords(d: any): { lat: number; lng: number } | null {
  if (d?.coords && toNum(d.coords.lat) != null && toNum(d.coords.lng) != null) {
    return { lat: toNum(d.coords.lat)!, lng: toNum(d.coords.lng)! };
  }
  const lc = d?.location?.coords || d?.location?.coordinate;
  if (lc && toNum(lc.lat) != null && toNum(lc.lng) != null) {
    return { lat: toNum(lc.lat)!, lng: toNum(lc.lng)! };
  }
  const ll = d?.location || d;
  if (
    toNum(ll?.lat) != null &&
    (toNum(ll?.lng) != null || toNum(ll?.lon) != null || toNum(ll?.longitude) != null)
  ) {
    const lat = toNum(ll.lat)!;
    const lng = toNum(ll.lng) ?? toNum(ll.lon) ?? toNum(ll.longitude)!;
    return { lat, lng };
  }
  const g1 = d?.location?.geometry?.coordinates;
  if (Array.isArray(g1) && toNum(g1[0]) != null && toNum(g1[1]) != null) {
    return { lat: toNum(g1[1])!, lng: toNum(g1[0])! };
  }
  const g2 = d?.location?.coordinates || d?.coordinates;
  if (Array.isArray(g2) && toNum(g2[0]) != null && toNum(g2[1]) != null) {
    return { lat: toNum(g2[1])!, lng: toNum(g2[0])! };
  }
  return null;
}

/* ---------- optional: Geoapify geocode fallback ---------- */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const KEY = process.env.GEOAPIFY_API_KEY;
  if (!KEY || !address?.trim()) return null;

  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
    address
  )}&limit=1&apiKey=${KEY}`;

  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const f = j?.features?.[0]?.properties;
  const lat = toNum(f?.lat);
  const lng = toNum(f?.lon ?? f?.lng ?? f?.longitude);
  if (lat != null && lng != null) return { lat, lng };
  return null;
}

/* ================================================================================ */
/* CLIENT (current user) */
/* GET /api/assist/mine?limit=100&status=pending|accepted|completed                 */
/* ================================================================================ */
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const user = (req as any).user as { id: string; email?: string };
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    if (!ObjectId.isValid(user.id)) return res.status(400).json({ message: 'Bad user id' });

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const query: any = { userId: new ObjectId(user.id) };
    if (status) query.status = status;

    const docs = await coll
      .find(query, {
        sort: { createdAt: -1 },
        limit,
        projection: {
          _id: 1,
          status: 1,
          vehicle: 1,
          location: 1,
          createdAt: 1,
          updatedAt: 1,
          assignedTo: 1,
          userId: 1,
          rating: 1,
          completedAt: 1,
        },
      })
      .toArray();

    const items = docs.map((d) => ({
      id: String(d._id),
      status: typeof d.status === 'string' ? d.status.toLowerCase() : 'pending',
      vehicle: d.vehicle || null,
      location: d.location || null,
      createdAt: d.createdAt || (d as any).created_at || null,
      updatedAt: d.updatedAt || (d as any).updated_at || null,
      assignedTo: d.assignedTo ? String(d.assignedTo) : null,
      userId: d.userId ? String(d.userId) : null,
      rating: d.rating ?? null,
      completedAt: d.completedAt ?? null,
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* OPERATOR inbox */
/* GET /api/assist/inbox?status=pending|accepted|completed&limit=100               */
/* ================================================================================ */
router.get('/inbox', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const customerDb = getCustomerDb();
    const coll = customerDb.collection('assistrequests');

    const query: any = {};
    if (status) query.status = status;

    const docs = await coll
      .find(query, {
        sort: { createdAt: -1 },
        limit,
        projection: {
          _id: 1,
          status: 1,
          vehicle: 1,
          location: 1,
          createdAt: 1,
          updatedAt: 1,
          assignedTo: 1,
          userId: 1,
          rating: 1,
          completedAt: 1,
          customerName: 1,
          clientName: 1,
          contactName: 1,
          customerPhone: 1,
          acceptedBy: 1,
          completedBy: 1,
        },
      })
      .toArray();

    // Get operator and client information for each request
    const items = await Promise.all(docs.map(async (d) => {
      let operatorInfo = null;
      let clientInfo = null;
      
      // For completed requests, show the operator who completed it
      if (d.status === 'completed' && d.completedBy) {
        const operatorUserId = String(d.completedBy);
        try {
          const operator = await customerDb.collection('operators').findOne({ user_id: String(d.completedBy) });
          if (operator) {
            const lat = operator.last_lat;
            const lng = operator.last_lng;
            const lastSeen = operator.last_seen_at;
            
            operatorInfo = {
              id: operatorUserId,
              name: operator.name || 'Operator',
              location: operator.last_address || operator.initial_address || (lat && lng ? 
                `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Location unknown'),
              initial_address: operator.initial_address || null,
              lastSeen: lastSeen || null,
              avatar: operator.avatar || null,
            };
          }
        } catch (e) {
          console.log('Error fetching operator info:', e);
        }
      }
      // For accepted requests, show the assigned operator
      else if (d.assignedTo || d.acceptedBy) {
        try {
          const operatorId = d.assignedTo || d.acceptedBy;
          const operatorUserId = String(operatorId);
          const operator = await customerDb.collection('operators').findOne({ user_id: operatorUserId });
          if (operator) {
            const lat = operator.last_lat;
            const lng = operator.last_lng;
            const lastSeen = operator.last_seen_at;
            
            operatorInfo = {
              id: operatorUserId,
              name: operator.name || 'Operator',
              location: operator.last_address || operator.initial_address || (lat && lng ? 
                `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Location unknown'),
              initial_address: operator.initial_address || null,
              lastSeen: lastSeen || null,
              acceptedAt: d.updatedAt || d.updated_at || null, // Use updatedAt as acceptance time
              avatar: operator.avatar || null,
            };
          }
        } catch (e) {
          console.log('Error fetching operator info:', e);
        }
      }

      // Get client information
      if (d.userId) {
        try {
          const customerDb = getCustomerDb();
          const client = await customerDb.collection('users').findOne({ _id: new ObjectId(String(d.userId)) });
          if (client) {
            clientInfo = {
              name: client.name || null,
              avatar: client.avatar || null,
              email: client.email || null,
            };
          }
        } catch (e) {
          // Silent error handling for inbox
        }
      }

      return {
        id: String(d._id),
        status: typeof d.status === 'string' ? d.status.toLowerCase() : 'pending',
        vehicle: d.vehicle || null,
        location: d.location || null,
        createdAt: d.createdAt || (d as any).created_at || null,
        updatedAt: d.updatedAt || (d as any).updated_at || null,
        assignedTo: d.assignedTo ? String(d.assignedTo) : null,
        acceptedBy: d.acceptedBy ? String(d.acceptedBy) : null,
        userId: d.userId ? String(d.userId) : null,
        rating: d.rating ?? null,
        completedAt: d.completedAt ?? null,
        customerName: d.customerName || null,
        clientName: d.clientName || null,
        contactName: d.contactName || null,
        customerPhone: d.customerPhone || null,
        operator: operatorInfo,
        user: clientInfo,
      };
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* GET /api/assist/next – newest pending; geocode & persist coords if missing      */
/* ================================================================================ */
router.get('/next', requireAuth, async (_req, res, next) => {
  try {
    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const doc = await coll.findOne({ status: 'pending' }, { sort: { createdAt: -1 } });
    if (!doc) return res.json({ ok: true, data: null });

    let coords = extractCoords(doc);
    if (!coords) {
      const address = pickAddress(doc);
      const gc = await geocodeAddress(address);
      if (gc) {
        coords = gc;
        await coll.updateOne(
          { _id: (doc as any)._id },
          {
            $set: {
              coords: gc,
              'location.coords': gc,
              updatedAt: new Date(),
            },
          }
        );
      }
    }

    return res.json({
      ok: true,
      data: {
        id: String((doc as any)._id),
        clientName: pickClientName(doc),
        placeName: pickPlaceName(doc),
        address: pickAddress(doc),
        coords: coords || null,
        vehicleType: doc?.vehicle?.model ?? null,
        plateNumber: doc?.vehicle?.plate ?? null,
        phone: doc?.customerPhone ?? null,
        otherInfo: doc?.vehicle?.notes ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* Single request (detail) – GET /api/assist/:id                                    */
/* ================================================================================ */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    const doc = await coll.findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const coords = extractCoords(doc);
    
    // Get operator information if available
    let operatorInfo = null;
    if (doc.status === 'completed' && doc.completedBy) {
      const operatorUserId = String(doc.completedBy);
      try {
        const operator = await db.collection('operators').findOne({ user_id: operatorUserId });
        if (operator) {
          const lat = operator.last_lat;
          const lng = operator.last_lng;
          const lastSeen = operator.last_seen_at;
          
          operatorInfo = {
            id: operatorUserId,
            name: operator.name || 'Operator',
            location: operator.last_address || operator.initial_address || (lat && lng ? 
              `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Location unknown'),
            initial_address: operator.initial_address || null,
              lastSeen: lastSeen || null,
              acceptedAt: doc.updatedAt || doc.updated_at || null,
              avatar: operator.avatar || null,
            };
        }
      } catch (e) {
        // Error fetching operator info - silently continue
      }
    } else if (doc.assignedTo || doc.acceptedBy) {
      try {
        const operatorId = doc.assignedTo || doc.acceptedBy;
        const operatorUserId = String(operatorId);
        const operator = await db.collection('operators').findOne({ user_id: operatorUserId });
        if (operator) {
          const lat = operator.last_lat;
          const lng = operator.last_lng;
          const lastSeen = operator.last_seen_at;
          
          operatorInfo = {
            id: operatorUserId,
            name: operator.name || 'Operator',
            location: operator.last_address || operator.initial_address || (lat && lng ? 
              `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Location unknown'),
            initial_address: operator.initial_address || null,
              lastSeen: lastSeen || null,
              acceptedAt: doc.updatedAt || doc.updated_at || null,
              avatar: operator.avatar || null,
            };
        }
      } catch (e) {
        // Error fetching operator info - silently continue
      }
    }
    
    // Get client information including avatar
    let clientInfo = null;
    if (doc.userId) {
      try {
        const customerDb = getCustomerDb();
        const client = await customerDb.collection('users').findOne({ _id: new ObjectId(String(doc.userId)) });
        
        if (client) {
          clientInfo = {
            name: client.name || null,
            avatar: client.avatar || null,
            email: client.email || null,
          };
        }
      } catch (e) {
        // Silent error handling
      }
    }

    const response = {
      id: String(doc._id),
      status: doc.status,
      clientName: pickClientName(doc),
      customerName: doc.customerName || null,
      contactName: doc.contactName || null,
      customerPhone: doc.customerPhone || null,
      placeName: pickPlaceName(doc),
      address: pickAddress(doc),
      coords: coords || null,
      vehicle: doc.vehicle || null,
      location: doc.location || null,
      vehicleType: doc?.vehicle?.model ?? null,
      plateNumber: doc?.vehicle?.plate ?? null,
      phone: doc?.customerPhone ?? null,
      otherInfo: doc?.vehicle?.notes ?? null,
      rating: doc?.rating ?? null,
      completedAt: doc?.completedAt ?? null,
      createdAt: doc?.createdAt ?? null,
      updatedAt: doc?.updatedAt ?? null,
      userId: doc?.userId ? String(doc.userId) : null,
      acceptedBy: doc?.acceptedBy ? String(doc.acceptedBy) : null,
      operator: operatorInfo,
      user: clientInfo,
    };
    
    res.json(response);
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* Universal request resolver – GET /api/assist/resolve/:id                         */
/* ================================================================================ */
router.get('/resolve/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const db = getCustomerDb();
    
    // First try as assistance request
    if (ObjectId.isValid(id)) {
      const assistColl = db.collection('assistrequests');
      const assistDoc = await assistColl.findOne({ _id: new ObjectId(id) });
      
      if (assistDoc) {
        // Return the assistance request data
        const coords = extractCoords(assistDoc);
        
        let operatorInfo = null;
        if (assistDoc.status === 'completed' && assistDoc.completedBy) {
          const operatorUserId = String(assistDoc.completedBy);
          try {
            const operator = await db.collection('operators').findOne({ user_id: operatorUserId });
            if (operator) {
              const lat = operator.last_lat;
              const lng = operator.last_lng;
              const lastSeen = operator.last_seen_at;
              
              operatorInfo = {
                id: operatorUserId,
                name: operator.name || 'Operator',
                location: operator.last_address || (lat && lng ? 
                  `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Location unknown'),
                lastSeen: lastSeen || null,
                acceptedAt: assistDoc.updatedAt || assistDoc.updated_at || null,
                avatar: operator.avatar || null,
              };
            }
          } catch (e) {
            // Error fetching operator info - silently continue
          }
        }
        
        const response = {
          id: String(assistDoc._id),
          status: assistDoc.status,
          clientName: pickClientName(assistDoc),
          customerName: assistDoc.customerName || null,
          contactName: assistDoc.contactName || null,
          customerPhone: assistDoc.customerPhone || null,
          placeName: pickPlaceName(assistDoc),
          address: pickAddress(assistDoc),
          coords: coords || null,
          vehicle: assistDoc.vehicle || null,
          location: assistDoc.location || null,
          vehicleType: assistDoc?.vehicle?.model ?? null,
          plateNumber: assistDoc?.vehicle?.plate ?? null,
          phone: assistDoc?.customerPhone ?? null,
          otherInfo: assistDoc?.vehicle?.notes ?? null,
          rating: assistDoc?.rating ?? null,
          completedAt: assistDoc?.completedAt ?? null,
          createdAt: assistDoc?.createdAt ?? null,
          updatedAt: assistDoc?.updatedAt ?? null,
          acceptedBy: assistDoc?.acceptedBy ? String(assistDoc.acceptedBy) : null,
          operator: operatorInfo,
        };
        
        return res.json(response);
      }
    }
    
    // If not found as assistance request, try as activity
    const activityColl = db.collection('activities');
    const activityDoc = await activityColl.findOne({ _id: new ObjectId(id) });
    
    if (activityDoc) {
      // Get the related assistance request
      const assistId = activityDoc.assistId || activityDoc.requestId || activityDoc.assistanceId;
      if (assistId && ObjectId.isValid(assistId)) {
        const assistColl = db.collection('assistrequests');
        const assistDoc = await assistColl.findOne({ _id: new ObjectId(assistId) });
        
        if (assistDoc) {
          // Return the assistance request data (same as above)
          const coords = extractCoords(assistDoc);
          
          let operatorInfo = null;
          if (assistDoc.status === 'completed' && assistDoc.completedBy) {
            const operatorUserId = String(assistDoc.completedBy);
            try {
              const operator = await db.collection('operators').findOne({ user_id: operatorUserId });
              if (operator) {
                const lat = operator.last_lat;
                const lng = operator.last_lng;
                const lastSeen = operator.last_seen_at;
                
                operatorInfo = {
                  id: operatorUserId,
                  name: operator.name || 'Operator',
                  location: operator.last_address || (lat && lng ? 
                    `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Location unknown'),
                  lastSeen: lastSeen || null,
                  acceptedAt: assistDoc.updatedAt || assistDoc.updated_at || null,
                };
              }
            } catch (e) {
              // Error fetching operator info - silently continue
            }
          }
          
          const response = {
            id: String(assistDoc._id),
            status: assistDoc.status,
            clientName: pickClientName(assistDoc),
            customerName: assistDoc.customerName || null,
            contactName: assistDoc.contactName || null,
            customerPhone: assistDoc.customerPhone || null,
            placeName: pickPlaceName(assistDoc),
            address: pickAddress(assistDoc),
            coords: coords || null,
            vehicle: assistDoc.vehicle || null,
            location: assistDoc.location || null,
            vehicleType: assistDoc?.vehicle?.model ?? null,
            plateNumber: assistDoc?.vehicle?.plate ?? null,
            phone: assistDoc?.customerPhone ?? null,
            otherInfo: assistDoc?.vehicle?.notes ?? null,
            rating: assistDoc?.rating ?? null,
            completedAt: assistDoc?.completedAt ?? null,
            createdAt: assistDoc?.createdAt ?? null,
            updatedAt: assistDoc?.updatedAt ?? null,
            acceptedBy: assistDoc?.acceptedBy ? String(assistDoc.acceptedBy) : null,
            operator: operatorInfo,
          };
          
          return res.json(response);
        }
      }
    }
    
    return res.status(404).json({ message: 'Request not found' });
  } catch (e) {
    console.error('[Server] Error in resolve endpoint:', e);
    next(e);
  }
});

/* ================================================================================ */
/* Accept / Decline                                                                 */
/* ================================================================================ */
router.post('/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    // 1) Mark request as accepted
    const result = await coll.findOneAndUpdate(
      { _id: new ObjectId(id), status: 'pending' },
      {
        $set: {
          status: 'accepted',
          acceptedBy: new ObjectId((req as any).user.id),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result || !result.value) {
      return res.status(404).json({ message: 'Request not found or not pending' });
    }

    // 2) Update operator's location in the users collection
    try {
      const authDb = getAuthDb();
      const usersColl = authDb.collection('users');
      const operatorId = new ObjectId((req as any).user.id);
      
      // Get current location from request body or use initial location
      const { lat, lng, address } = req.body || {};
      
      if (lat && lng) {
        // Update with provided location
        await usersColl.updateOne(
          { _id: operatorId },
          {
            $set: {
              last_lat: Number(lat),
              last_lng: Number(lng),
              last_address: address || null,
              last_seen_at: new Date(),
            }
          }
        );
        console.log(`Updated operator ${operatorId} location: ${lat}, ${lng}`);
      } else {
        // No coords in body: try to copy latest known coords from this user's record
        const existing = await usersColl.findOne(
          { _id: operatorId },
          {
            projection: {
              last_lat: 1, last_lng: 1, last_address: 1,
              initial_lat: 1, initial_lng: 1, initial_long: 1, initial_address: 1,
            }
          }
        );

        const fallbackLat = existing?.last_lat ?? existing?.initial_lat ?? null;
        const fallbackLng = existing?.last_lng ?? existing?.initial_lng ?? existing?.initial_long ?? null;
        const fallbackAddr = existing?.last_address ?? existing?.initial_address ?? null;

        const setDoc: any = { last_seen_at: new Date() };
        if (fallbackLat != null && fallbackLng != null) {
          setDoc.last_lat = Number(fallbackLat);
          setDoc.last_lng = Number(fallbackLng);
          if (fallbackAddr) setDoc.last_address = fallbackAddr;
        }
        await usersColl.updateOne(
          { _id: operatorId },
          { $set: setDoc }
        );
        console.log(`Updated operator ${operatorId} last seen; copied coords=${fallbackLat!=null && fallbackLng!=null}`);
      }
    } catch (locationError) {
      console.error('Error updating operator location:', locationError);
      // Don't fail the request if location update fails
    }

    // 2) Ensure a single shared conversation between operator and client
    const doc = result.value as any;
    const operatorId = new Types.ObjectId((req as any).user.id);
    const clientUserId = doc.userId ? new Types.ObjectId(doc.userId) : null;

    let conversationId: string | undefined;

    if (clientUserId) {
      const conversationsColl = db.collection('conversations');
      const metasColl = db.collection('conversationmetas');

      // canonical hash for pair uniqueness (works even without schema changes)
      const participantsHash = [String(operatorId), String(clientUserId)].sort().join(':');

      // upsert the conversation by participantsHash; also link requestId
      let conv = await conversationsColl.findOne({ participantsHash });

      if (!conv) {
        try {
          conv = (
            await conversationsColl.findOneAndUpdate(
              { participantsHash },
              {
                $setOnInsert: {
                  participants: [operatorId, clientUserId], // store as ObjectIds
                  createdAt: new Date(),
                },
                $set: {
                  requestId: new ObjectId(id),
                  updatedAt: new Date(),
                },
              },
              { upsert: true, returnDocument: 'after' }
            )
          ).value;
        } catch (err: any) {
          if (err?.code === 11000) {
            conv = await conversationsColl.findOne({ participantsHash });
          } else {
            throw err;
          }
        }
      } else if (!conv.requestId && isValidOid(id)) {
        await conversationsColl.updateOne({ _id: conv._id }, { $set: { requestId: new ObjectId(id) } }).catch(() => void 0);
      }

      conversationId = conv ? String(conv._id) : undefined;

      // Ensure ConversationMeta for both sides (unread counters exist)
      const metaOps = [
        {
          updateOne: {
            filter: { conversationId: conv.value!._id, userId: operatorId },
            update: { $setOnInsert: { unread: 0 } },
            upsert: true,
          },
        },
        {
          updateOne: {
            filter: { conversationId: conv.value!._id, userId: clientUserId },
            update: { $setOnInsert: { unread: 0 } },
            upsert: true,
          },
        },
      ];
      try {
        await metasColl.bulkWrite(metaOps as any, { ordered: false });
      } catch {
        // ignore best-effort
      }

      // 3) Notify the client app with the shared conversationId (if socket available)
      try {
        const io = getIO();
        const clientRoom = `user:${String(clientUserId)}`; // requires your socket server to join this room on connect
        io.to(clientRoom).emit('assist:approved', {
          requestId: String(id),
          conversationId,
          operator: {
            id: String(operatorId),
          },
        });
      } catch {
        // socket not initialized or client offline; that's fine
      }

      // Push notify client
      try {
        if (doc?.userId) {
          await sendPushToUserIds([String(doc.userId)], {
            title: 'Request accepted',
            body: 'An operator is en route. Tap to open the chat.',
            data: { type: 'assist', requestId: String(id), conversationId },
          });
        }
      } catch (e) {
        console.warn('[push] assist accepted push failed:', (e as Error).message);
      }
    }

    // 4) Return the conversationId to the operator
    return res.json({ ok: true, conversationId });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/decline', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    // First check if the request exists
    const existingRequest = await coll.findOne({ _id: new ObjectId(id) });
    if (!existingRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if request can be declined
    if (existingRequest.status === 'completed') {
      return res.status(400).json({ message: 'Cannot decline completed request' });
    }

    const result = await coll.findOneAndUpdate(
      { _id: new ObjectId(id), status: { $in: ['pending', 'accepted'] } },
      { $set: { status: 'declined', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result || !result.value) {
      return res.status(400).json({ message: 'Request cannot be declined in current status' });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ================================================================================ */
/* Complete (Repaired) – POST /api/assist/:id/complete { rating?: number }          */
/* ================================================================================ */
router.post('/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const ratingRaw = req.body?.rating;
    const rating =
      ratingRaw === undefined || ratingRaw === null
        ? undefined
        : Math.max(0, Math.min(5, Number(ratingRaw)));

    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const db = getCustomerDb();
    const coll = db.collection('assistrequests');

    // Relaxed filter: complete by id (unless hard-deleted)
    const set: any = {
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      completedBy: new ObjectId((req as any).user.id),
    };
    if (rating !== undefined && Number.isFinite(rating)) set.rating = rating;

    const result = await coll.findOneAndUpdate(
      { _id: new ObjectId(id), status: { $ne: 'deleted' } },
      { $set: set },
      { returnDocument: 'after' }
    );

    if (!result || !result.value) return res.status(404).json({ message: 'Request not found' });

    const doc: any = result.value;

    // Build a rich payload for the Activity detail screen
    const endName = pickPlaceName(doc);
    const endAddr = pickAddress(doc);

    res.json({
      ok: true,
      data: {
        id: String(doc._id),
        status: doc.status,
        completedAt: doc.completedAt ?? new Date(),

        clientName: pickClientName(doc),
        phone: doc?.customerPhone ?? doc?.phone ?? null,

        placeName: endName,
        address: endAddr,

        vehicleType: doc?.vehicle?.model ?? null,
        plateNumber: doc?.vehicle?.plate ?? null,
        otherInfo: doc?.vehicle?.notes ?? null,

        // optional summary fields for the detail screen:
        startName: doc.startName ?? 'Start',
        startAddr: doc.startAddr ?? '',
        endName,
        endAddr,

        acceptedBy: doc.acceptedBy ? String(doc.acceptedBy) : null,
        rating: doc.rating ?? (rating ?? null),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
