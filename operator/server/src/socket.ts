import type { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { getAuthDb, getCustomerDb } from './db/connect';
import { sendPushToUserIds } from './lib/expoPush'; // optional; used for chat push
import { Conversation } from './models/conversation';
import { ConversationMeta } from './models/conversationMeta';
import { Message } from './models/message';

type JwtUser = { id: string };

let ioRef: Server | null = null;
export function getIO(): Server {
  if (!ioRef) throw new Error('Socket.IO not initialized');
  return ioRef;
}

const userRoom = (userId: string) => `user:${userId}`;
const convRoom = (id: string) => `conv:${id}`;
const operatorsRoom = 'operators';

// ---------- helpers for new-request payload prettification ----------
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

let assistWatchStarted = false;
async function startAssistWatcher(io: Server) {
  if (assistWatchStarted) return;
  try {
    const db = await getCustomerDb();
    const coll = db.collection('assistrequests');

    // Watch for new pending requests; requires MongoDB replica set/Atlas
    const changeStream = coll.watch(
      [
        { $match: { operationType: { $in: ['insert'] } } },
      ],
      { fullDocument: 'default' }
    );

    changeStream.on('change', (chg: any) => {
      try {
        const doc = chg.fullDocument;
        if (!doc) return;
        if (doc.status && doc.status !== 'pending') return;

        const payload = {
          id: String(doc._id),
          status: doc.status || 'pending',
          clientName: pickClientName(doc),
          placeName: pickPlaceName(doc),
          address: pickAddress(doc),
          location: doc.location || null,
          vehicle: doc.vehicle || null,
          createdAt: doc.createdAt || doc.created_at || new Date(),
          userId: doc.userId ? String(doc.userId) : null,
        };

        // Broadcast instantly to all operators
        io.to(operatorsRoom).emit('assist:created', payload);
      } catch (e) {
        console.warn('[assist:created] emit failed:', (e as Error).message);
      }
    });

    changeStream.on('error', (err: any) => {
      console.warn('[assist watcher] change stream error:', err?.message || err);
    });

    assistWatchStarted = true;
    console.log('[assist watcher] started');
  } catch (e) {
    console.warn('[assist watcher] disabled:', (e as Error).message);
  }
}

async function usersInRoom(io: Server, room: string): Promise<Set<string>> {
  const sockets = await io.in(room).fetchSockets();
  const ids = new Set<string>();
  sockets.forEach((s) => {
    const uid = (s as any).user?.id;
    if (uid) ids.add(String(uid));
  });
  return ids;
}

function toObjectId(id?: string | Types.ObjectId | null): Types.ObjectId | null {
  if (!id) return null;
  if (id instanceof Types.ObjectId) return id;
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

function pickUserName(user: any): string {
  return (
    user?.name ||
    user?.username ||
    user?.displayName ||
    user?.email ||
    'User'
  );
}

function pickUserAvatar(user: any): string | null {
  return (
    user?.avatar ||
    user?.avatarUrl ||
    user?.photoURL ||
    user?.profilePicture ||
    null
  );
}

async function fetchUserSummaries(ids: string[]): Promise<Map<string, any>> {
  const unique = Array.from(new Set(ids.filter(Boolean).map(String)));
  const objectIds = unique
    .map((id: string) => toObjectId(id))
    .filter((oid): oid is Types.ObjectId => !!oid);

  if (!objectIds.length) return new Map<string, any>();

  try {
    const authDb = getAuthDb();
    const docs = await authDb
      .collection('users')
      .find({ _id: { $in: objectIds } })
      .project({ name: 1, username: 1, email: 1, avatar: 1, avatarUrl: 1, photoURL: 1 })
      .toArray();

    const map = new Map<string, any>();
    docs.forEach((doc: any) => {
      map.set(String(doc._id), doc);
    });
    return map;
  } catch (err) {
    console.warn('[socket] fetchUserSummaries failed:', (err as Error).message);
    return new Map<string, any>();
  }
}

function buildMessagePayload(doc: any, usersMap?: Map<string, any>) {
  const obj = doc?.toObject ? doc.toObject() : doc;
  const senderId = String(obj?.senderId ?? obj?.sender?._id ?? '');
  const user = usersMap?.get(senderId);

  return {
    _id: String(obj?._id ?? ''),
    conversationId: String(obj?.conversationId ?? ''),
    content: obj?.content ?? '',
    attachment: obj?.attachment ?? null,
    createdAt: new Date(obj?.createdAt ?? Date.now()).toISOString(),
    senderId: {
      _id: senderId,
      name: pickUserName(user),
      avatar: pickUserAvatar(user),
      email: user?.email || undefined,
    },
  };
}

async function buildConversationPayload(convDoc: any, currentUserId: string, options: { lastMessage?: any } = {}) {
  const conv = convDoc?.toObject ? convDoc.toObject() : convDoc;
  const convId = String(conv?._id ?? '');

  const participantIdsFromDoc: string[] = Array.isArray(conv?.participantIds)
    ? conv.participantIds.map((id: any) => String(id))
    : [];
  const participantIdsFromParticipants: string[] = Array.isArray(conv?.participants)
    ? conv.participants.map((m: any) => String(m))
    : [];

  const allParticipantIds = Array.from(
    new Set(
      [...participantIdsFromDoc, ...participantIdsFromParticipants, String(currentUserId)].filter((id) => id && id !== 'undefined')
    )
  );

  const usersMap = await fetchUserSummaries(allParticipantIds);

  const participants: Array<{ _id: string; name: string; avatar: string | null; email?: string }> = allParticipantIds.map((id: string) => {
    const user = usersMap.get(id);
    return {
      _id: id,
      name: pickUserName(user),
      avatar: pickUserAvatar(user),
      email: user?.email || undefined,
    };
  });

  const friend = participants.find((p) => p._id !== String(currentUserId));
  const lastMessageSource = options.lastMessage || (await Message.findOne({ conversationId: conv._id }).sort({ createdAt: -1 }).lean().catch(() => null));
  const lastMessage = lastMessageSource
    ? buildMessagePayload(lastMessageSource, usersMap)
    : conv?.lastMessage
    ? {
        _id: `legacy_${convId}`,
        conversationId: convId,
        content: conv.lastMessage,
        attachment: null,
        createdAt: new Date(conv.lastMessageAt ?? conv.updatedAt ?? conv.createdAt ?? Date.now()).toISOString(),
        senderId: {
          _id: friend?._id ?? String(currentUserId),
          name: friend?.name ?? pickUserName(usersMap.get(String(currentUserId))),
          avatar: friend?.avatar ?? pickUserAvatar(usersMap.get(String(currentUserId))),
          email: friend?.email,
        },
      }
    : null;

  const userIdObj = toObjectId(currentUserId);
  const metaFilter: any = { conversationId: conv._id };
  if (userIdObj) metaFilter.userId = userIdObj;
  else metaFilter.userId = currentUserId;

  const meta = (await ConversationMeta.findOne(metaFilter).lean().catch(() => null)) as any;

  return {
    _id: convId,
    type: 'direct',
    name: conv?.title || friend?.name || 'Conversation',
    avatar: conv?.avatar || friend?.avatar || null,
    participants,
    lastMessage,
    createdAt: new Date(conv?.createdAt ?? Date.now()).toISOString(),
    updatedAt: new Date(conv?.updatedAt ?? conv?.createdAt ?? Date.now()).toISOString(),
    unreadCount: typeof meta?.unread === 'number' ? meta.unread : 0,
  };
}

function extractParticipantIds(conv: any): string[] {
  if (!conv) return [];
  const ids = new Set<string>();
  if (Array.isArray(conv?.participantIds)) {
    conv.participantIds.forEach((id: any) => {
      if (id != null) ids.add(String(id));
    });
  }
  if (Array.isArray(conv?.participants)) {
    conv.participants.forEach((id: any) => {
      if (id != null) ids.add(String(id));
    });
  }
  if (Array.isArray((conv as any)?.members)) {
    (conv as any).members.forEach((id: any) => {
      if (id != null) ids.add(String(id));
    });
  }
  return Array.from(ids);
}

function sanitizeMessageText(raw: any): string {
  const collapsed = String(raw ?? '').replace(/[\s\u00A0]+/g, ' ').trim();
  if (!collapsed) return '';
  const tokens = collapsed.split(' ');
  if (tokens.length > 1 && tokens.every((tok) => tok.length === 1)) {
    return tokens.join('');
  }
  return collapsed;
}

function emitToUser(io: Server, userId: string, event: string, payload: any) {
  io.sockets.sockets.forEach((client) => {
    const clientUser = (client as any).user as JwtUser | undefined;
    if (clientUser?.id === userId) {
      client.emit(event, payload);
    }
  });
}

async function broadcastConversationUpdate(io: Server, convId: Types.ObjectId | string, options: { lastMessage?: any } = {}) {
  const conv = (await Conversation.findById(convId).lean()) as any;
  if (!conv) return;
  const participantIds = extractParticipantIds(conv);

  await Promise.all(
    participantIds.map(async (uid: string) => {
      const data = await buildConversationPayload(conv, uid, options);
      emitToUser(io, uid, 'conversationUpdated', { success: true, data });
    })
  );
}

export function initSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: process.env.CLIENT_ORIGIN || '*', credentials: true },
  });
  ioRef = io;

  // Start zero-delay assist watcher (if DB supports change streams)
  startAssistWatcher(io).catch(() => {});

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string) ||
      (socket.handshake.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');
    if (!token) return next(new Error('no auth token'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret') as any;
      (socket as any).user = { id: String(payload.id || payload.sub) } as JwtUser;
      next();
    } catch {
      next(new Error('invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const me = (socket as any).user as JwtUser;

    // Join personal user room + operators broadcast room (this app is Operator)
    socket.join(userRoom(me.id));
    socket.join(operatorsRoom);

    // Auto-join all my conversation rooms
    try {
      let convIds: string[] = [];
      const joinQuery: any = {
        $or: [],
      };
      if (Types.ObjectId.isValid(me.id)) {
        joinQuery.$or.push({ participants: new Types.ObjectId(me.id) });
      }
      joinQuery.$or.push({ participantIds: me.id }, { members: me.id });
      const mine = await Conversation.find(joinQuery, { _id: 1 }).lean();
      convIds = mine.map((c: any) => String(c._id));
      convIds.forEach((id) => socket.join(convRoom(id)));
      if (process.env.NODE_ENV !== 'production') console.log('[socket] joined rooms:', convIds);
    } catch (e) {
      console.warn('[socket] auto-join failed:', (e as Error).message);
    }

    const joinAny = (id?: string) => id && socket.join(convRoom(String(id)));
    const leaveAny = (id?: string) => id && socket.leave(convRoom(String(id)));

    socket.on('conversation:join', (p: any) => joinAny(p?.conversationId || p?.id));
    socket.on('join:conv', (id: string) => joinAny(id));
    socket.on('join', (p: any) => joinAny(p?.room || p?.conversationId || p?.id));

    socket.on('conversation:leave', (p: any) => leaveAny(p?.conversationId || p?.id));
    socket.on('leave:conv', (id: string) => leaveAny(id));
    socket.on('leave', (p: any) => leaveAny(p?.room || p?.conversationId || p?.id));

    socket.on('typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      if (!conversationId) return;
      socket.to(convRoom(conversationId)).emit('typing', { userId: me.id, isTyping: !!isTyping });
    });

    socket.on('getConversations', async (payloadOrAck?: any, maybeAck?: (res: any) => void) => {
      const ack = typeof payloadOrAck === 'function'
        ? (payloadOrAck as (res: any) => void)
        : typeof maybeAck === 'function'
          ? maybeAck
          : undefined;
      try {
        const orConditions: any[] = [];
        if (Types.ObjectId.isValid(me.id)) {
          orConditions.push({ participants: new Types.ObjectId(me.id) });
        }
        orConditions.push({ participantIds: me.id }, { members: me.id }, { participants: me.id });
        const query = orConditions.length === 1 ? orConditions[0] : { $or: orConditions };

        const convs = await Conversation.find(query).sort({ updatedAt: -1 }).lean();
        const data = await Promise.all(convs.map((conv) => buildConversationPayload(conv, me.id)));

        const response = { success: true, data };
        ack ? ack(response) : socket.emit('getConversations', response);
      } catch (err: any) {
        console.error('[socket] getConversations failed:', err?.message || err);
        const response = { success: false, msg: 'Failed to fetch conversations' };
        ack ? ack(response) : socket.emit('getConversations', response);
      }
    });

    // ---- conversation creation (aligned with client app) ----
    socket.on('newConversation', async (payload: any, ack?: (res: any) => void) => {
      try {
        const type = (payload?.type || 'direct').toString();
        let participants: string[] = Array.isArray(payload?.participants) ? payload.participants.map(String) : [];
        participants = Array.from(new Set(participants.filter(Boolean)));

        if (!participants.includes(me.id)) participants.push(me.id);
        if (participants.length < 2) {
          socket.emit('newConversation', { success: false, msg: 'Not enough participants' });
          return;
        }

        const participantIds = participants.slice().sort();
        const participantsHash = participantIds.join(':');
        const memberOids = participantIds
          .map((id) => toObjectId(id))
          .filter((oid): oid is Types.ObjectId => !!oid);

        let conv = await Conversation.findOne({ participantsHash });
        if (!conv) {
          conv = await Conversation.findOne({ participantIds: { $all: participantIds } });
        }
        const existing = !!conv;

          if (!conv) {
          try {
            conv = await Conversation.create({
              participants: memberOids,
              participantIds,
              title: payload?.name || undefined,
              lastMessageAt: new Date(),
            });
          } catch (createErr: any) {
            if ((createErr as any)?.code === 11000) {
              conv = await Conversation.findOne({ participantsHash }) ?? await Conversation.findOne({ participantIds: { $all: participantIds } });
            }
            if (!conv) throw createErr;
          }
        } else {
          const needsUpdate =
            !Array.isArray((conv as any).participantIds) ||
            participantIds.length !== (conv as any).participantIds.length ||
            participantIds.some((id) => !(conv as any).participantIds.map(String).includes(id));
          if (needsUpdate) {
            await Conversation.updateOne(
              { _id: conv._id },
              { $set: { participantIds, participantsHash } }
            ).catch(() => undefined);
          }
        }

        // ensure meta rows exist (unread = 0)
        await Promise.all(
          memberOids.map((oid) =>
            ConversationMeta.updateOne(
              { conversationId: conv!._id, userId: oid },
              { $setOnInsert: { unread: 0 }, $set: { unread: 0 } },
              { upsert: true }
            ).catch(() => undefined)
          )
        );

        socket.join(convRoom(String(conv!._id)));

        const freshConv = await Conversation.findById(conv!._id).lean();
        if (!freshConv) {
          const response = { success: false, msg: 'Failed to load conversation' };
          ack ? ack(response) : socket.emit('newConversation', response);
          return;
        }

        const mine = await buildConversationPayload(freshConv, me.id);
        const selfPayload = { success: true, data: { ...mine, isNew: !existing } };
        ack ? ack(selfPayload) : socket.emit('newConversation', selfPayload);

        const otherIds = participants.filter((id) => id !== me.id);
        await Promise.all(
          otherIds.map(async (uid) => {
            const data = await buildConversationPayload(freshConv, uid);
            emitToUser(io, uid, 'newConversation', { success: true, data: { ...data, isNew: !existing } });
          })
        );

        await broadcastConversationUpdate(io, conv!._id);
      } catch (err: any) {
        console.error('[socket] newConversation failed:', err?.message || err);
        const response = { success: false, msg: 'Failed to create conversation' };
        ack ? ack(response) : socket.emit('newConversation', response);
      }
    });

    socket.on('deleteConversation', async (conversationId: string) => {
      try {
        if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
          socket.emit('deleteConversation', { success: false, msg: 'Invalid conversation id' });
          return;
        }

        const conv = await Conversation.findById(conversationId);
        if (!conv) {
          socket.emit('deleteConversation', { success: false, msg: 'Conversation not found' });
          return;
        }

        const participantIds = extractParticipantIds(conv);
        if (!participantIds.includes(me.id)) {
          socket.emit('deleteConversation', { success: false, msg: 'Forbidden' });
          return;
        }

        await Message.deleteMany({ conversationId: conv._id });
        await ConversationMeta.deleteMany({ conversationId: conv._id });
        await Conversation.deleteOne({ _id: conv._id });

        const payload = { success: true, conversationId: String(conv._id) };
        participantIds.forEach((uid: string) => emitToUser(io, uid, 'conversationDeleted', payload));
        socket.emit('deleteConversation', { success: true });
      } catch (err: any) {
        console.error('[socket] deleteConversation failed:', err?.message || err);
        socket.emit('deleteConversation', { success: false, msg: 'Failed to delete conversation' });
      }
    });

    socket.on('markAsRead', async (conversationId: string) => {
      try {
        if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
          socket.emit('markAsRead', { success: false, msg: 'Invalid conversation id' });
          return;
        }

        const conv = (await Conversation.findById(conversationId).lean()) as any;
        if (!conv) {
          socket.emit('markAsRead', { success: false, msg: 'Conversation not found' });
          return;
        }

        const participantIds = extractParticipantIds(conv);
        if (!participantIds.includes(me.id)) {
          socket.emit('markAsRead', { success: false, msg: 'Forbidden' });
          return;
        }

        const userIdObj = toObjectId(me.id);
        const filter: any = { conversationId: conv._id };
        if (userIdObj) filter.userId = userIdObj;
        else filter.userId = me.id;

        await ConversationMeta.updateOne(filter, { $set: { unread: 0, lastReadAt: new Date() } }, { upsert: true });
        socket.emit('markAsRead', { success: true });

        const refreshed = (await Conversation.findById(conversationId).lean()) as any;
        if (refreshed) {
          const data = await buildConversationPayload(refreshed, me.id);
          data.unreadCount = 0;
          socket.emit('conversationUpdated', { success: true, data });
        }
      } catch (err: any) {
        console.error('[socket] markAsRead failed:', err?.message || err);
        socket.emit('markAsRead', { success: false, msg: 'Failed to mark as read' });
      }
    });

    // ---- message history (unchanged) ----
    socket.on('getMessages', async (conversationId: string, ack?: (res: any) => void) => {
      try {
        if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
          const payload = { success: false, msg: 'Invalid conversation id' };
          ack ? ack(payload) : socket.emit('getMessages', payload);
          return;
        }
        const conv = await Conversation.findById(conversationId);
        if (!conv) {
          const payload = { success: false, msg: 'Conversation not found' };
          ack ? ack(payload) : socket.emit('getMessages', payload);
          return;
        }
        const participantIds = extractParticipantIds(conv);
        if (!participantIds.includes(me.id)) {
          const payload = { success: false, msg: 'Forbidden' };
          ack ? ack(payload) : socket.emit('getMessages', payload);
          return;
        }

        const docs = await Message.find({ conversationId: conv._id }).sort({ createdAt: -1 }).limit(200).lean();
        const senderIds = docs.map((m: any) => String(m.senderId));
        const userMap = await fetchUserSummaries(senderIds);

        const mapped = docs.map((m: any) => buildMessagePayload(m, userMap));

        const payload = { success: true, data: mapped };
        ack ? ack(payload) : socket.emit('getMessages', payload);
      } catch (err: any) {
        console.error('[socket] getMessages failed:', err?.message || err);
        const payload = { success: false, msg: 'Failed to fetch messages' };
        ack ? ack(payload) : socket.emit('getMessages', payload);
      }
    });

    // ---- send message (unchanged; also triggers remote push if you kept expoPush.ts) ----
    async function createAndBroadcastMessage(p: {
      conversationId?: string;
      text?: string;
      content?: string;
      attachment?: string | null;
      tempId?: string;
    }) {
      const conversationId = String(p?.conversationId || '');
      const rawContent = p?.text ?? p?.content;
      const text = typeof rawContent === 'string' ? sanitizeMessageText(rawContent) : '';
      const attachment = p?.attachment ? String(p.attachment) : null;
      const tempId = p?.tempId;

      if (!conversationId || (!text && !attachment)) {
        if (process.env.NODE_ENV !== 'production') console.warn('[socket] missing conversationId/content', p);
        return null;
      }

      let conv: any = null;
      try {
        conv = await Conversation.findById(conversationId);
      } catch (e) {
        console.error('[socket] invalid conversationId:', conversationId, (e as Error).message);
        throw e;
      }
      if (!conv) throw new Error('conversation_not_found');
      const participantIds = extractParticipantIds(conv);
      const isMember = participantIds.includes(me.id);
      if (!isMember) throw new Error('forbidden');

      const stamp = new Date();

      let msgDoc: any = null;
      try {
        const sender = Types.ObjectId.isValid(me.id) ? new Types.ObjectId(me.id) : me.id;
        msgDoc = await Message.create({
          conversationId: conv._id,
          senderId: sender,
          content: text,
          attachment,
          createdAt: stamp,
        });
      } catch (e) {
        console.error('[socket] mongoose insert failed, falling back to native:', (e as Error).message);
        const db = await getCustomerDb();
        const ins = await db.collection('messages').insertOne({
          conversationId: conv._id,
          senderId: Types.ObjectId.isValid(me.id) ? new Types.ObjectId(me.id) : me.id,
          content: text,
          attachment,
          createdAt: stamp,
        });
        msgDoc = { _id: ins.insertedId, conversationId: conv._id, senderId: me.id, content: text, attachment, createdAt: stamp };
      }

      await Conversation.findByIdAndUpdate(conv._id, {
        lastMessage: attachment && !text ? '[attachment]' : text,
        lastMessageAt: stamp,
      }).catch((e) => console.warn('[socket] update conversation preview failed:', (e as Error).message));

      const others = participantIds.filter((memberId: string) => memberId !== me.id);

      await Promise.all(
        others.map(async (uid: string) => {
          try {
            const oid = toObjectId(uid);
            if (oid) {
            await ConversationMeta.updateOne(
                { conversationId: conv._id, userId: oid },
              { $inc: { unread: 1 } },
              { upsert: true }
            );
            }
          } catch {}
        })
      );

      const userMap = await fetchUserSummaries([me.id, ...others]);
      const messagePayload = buildMessagePayload({ ...(msgDoc?.toObject ? msgDoc.toObject() : msgDoc), conversationId: conv._id }, userMap);

      io.to(convRoom(messagePayload.conversationId)).emit('newMessage', { success: true, data: messagePayload });
      io.to(convRoom(messagePayload.conversationId)).emit('message:new', {
        id: messagePayload._id,
        conversationId: messagePayload.conversationId,
        from: messagePayload.senderId._id,
        text: messagePayload.content,
        attachment: messagePayload.attachment,
        createdAt: messagePayload.createdAt,
      });

      if (tempId) socket.emit('message:delivered', { tempId, id: messagePayload._id, createdAt: messagePayload.createdAt });

      emitToUser(io, me.id, 'messageDelivered', {
        success: true,
        conversationId: messagePayload.conversationId,
        deliveredTo: others.map((uid: string) => pickUserName(userMap.get(uid))).filter(Boolean),
      });

      // Optional: remote push for recipients not in room
      try {
        const inRoom = await usersInRoom(io, convRoom(messagePayload.conversationId));
        const targets = others.filter((uid: string) => !inRoom.has(uid));
        if (targets.length) {
          await sendPushToUserIds(targets, {
            title: 'New message',
            body:
              attachment && !text
                ? 'Sent a photo'
                : text.length > 120
                  ? text.slice(0, 117) + '…'
                  : text || 'New message',
            data: { type: 'chat', conversationId: messagePayload.conversationId },
          });
        }
      } catch (e) {
        console.warn('[push] chat push failed:', (e as Error).message);
      }

      await broadcastConversationUpdate(io, conv._id, { lastMessage: msgDoc });

      return messagePayload;
    }

    socket.on('message:send', async (p: any, ack?: (res: any) => void) => {
      try {
        const m = await createAndBroadcastMessage({
          conversationId: p?.conversationId,
          text: p?.text ?? p?.content,
          attachment: p?.attachment,
          tempId: p?.tempId,
        });
        ack && ack({ ok: true, success: true, data: m, id: m?._id, createdAt: m?.createdAt });
      } catch (e: any) {
        ack && ack({ ok: false, error: e?.message || 'send_failed' });
      }
    });

    socket.on('newMessage', async (p: any, ack?: (res: any) => void) => {
      try {
        const m = await createAndBroadcastMessage({
          conversationId: p?.conversationId,
          text: p?.text ?? p?.content,
          attachment: p?.attachment,
          tempId: p?.tempId,
        });
        ack && ack({ ok: true, success: true, data: m, id: m?._id, createdAt: m?.createdAt });
      } catch (e: any) {
        ack && ack({ ok: false, error: e?.message || 'send_failed' });
      }
    });

    socket.on('conversation:broadcastDeleted', (id: string) => {
      if (!id) return;
      io.to(convRoom(id)).emit('conversation:deleted', { id, conversationId: id });
    });
  });

  return io;
}

export const rooms = { userRoom, convRoom };
