import mongoose, { Schema, Types } from 'mongoose';

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  attachment?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'conversations', index: true, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'users', index: true, required: true },
    content: { type: String, trim: true },
    attachment: { type: String, default: null },
  },
  { timestamps: true, collection: 'messages' }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message =
  mongoose.models.messages || mongoose.model<IMessage>('messages', MessageSchema);
