import mongoose, { Schema, Types } from 'mongoose';

export interface IConversationMeta {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  unread: number;
  lastReadAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const MetaSchema = new Schema<IConversationMeta>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'conversations', index: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'users', index: true, required: true },
    unread: { type: Number, default: 0 },
    lastReadAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'conversationmetas' }
);

MetaSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

export const ConversationMeta =
  mongoose.models.conversationmetas || mongoose.model<IConversationMeta>('conversationmetas', MetaSchema);
