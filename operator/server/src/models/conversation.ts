import mongoose, { Schema, Types } from 'mongoose';

export interface IConversation {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];      // canonical ObjectId participants (when available)
  participantIds: string[];            // all participants as strings (always populated)
  requestId?: Types.ObjectId | null;   // optional link to assist request
  participantsHash: string;            // canonical "memberA:memberB" (sorted)
  title?: string;
  lastMessage?: string | null;
  lastMessageAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function makeParticipantsHash(ids: Array<string | Types.ObjectId> = []): string {
  return ids
    .map((id) => String(id))
    .filter((id) => id.trim().length > 0)
    .sort()
    .join(':');
}

function normalizeParticipantIds(doc: any): string[] {
  const out: string[] = [];
  const pushId = (val: any) => {
    if (val == null) return;
    const str = String(val).trim();
    if (!str) return;
    out.push(str);
  };

  if (Array.isArray(doc?.participantIds) && doc.participantIds.length) {
    doc.participantIds.forEach(pushId);
  } else if (Array.isArray(doc?.participants) && doc.participants.length) {
    doc.participants.forEach(pushId);
  } else if (Array.isArray((doc as any)?.members) && (doc as any).members.length) {
    (doc as any).members.forEach(pushId);
  }

  return Array.from(new Set(out)).sort();
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'users', index: true }],
    participantIds: [{ type: String, index: true }],
    requestId: { type: Schema.Types.ObjectId, ref: 'assistrequests', default: null, index: true },
    participantsHash: { type: String, index: true, unique: true },
    title: String,
    lastMessage: String,
    lastMessageAt: Date,
  },
  { timestamps: true, collection: 'conversations' }
);

ConversationSchema.pre('validate', function (next) {
  const ids = normalizeParticipantIds(this);
  (this as any).participantIds = ids;
  this.participantsHash = makeParticipantsHash(ids);
  next();
});

ConversationSchema.pre('save', function (next) {
  if (this.isModified('participants') || this.isModified('participantIds')) {
    const ids = normalizeParticipantIds(this);
    (this as any).participantIds = ids;
    this.participantsHash = makeParticipantsHash(ids);
  }
  next();
});

ConversationSchema.pre('init', function (doc) {
  const legacyMembers = Array.isArray((doc as any)?.members) ? (doc as any).members : null;
  if (legacyMembers && !Array.isArray(doc?.participants)) {
    doc.participants = legacyMembers;
  }
  if (!Array.isArray(doc?.participantIds) || !doc.participantIds.length) {
    const ids = normalizeParticipantIds(doc);
    doc.participantIds = ids;
  }
});

export const Conversation =
  mongoose.models.conversations || mongoose.model<IConversation>('conversations', ConversationSchema);
