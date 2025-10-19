// server/modals/AssistRequest.ts
import { Schema, model, Types, Document } from "mongoose";
import { getIO } from "../socket/socket";

export type AssistStatus = "pending" | "accepted" | "done" | "canceled";

export interface IAssistRequest extends Document {
  userId: Types.ObjectId;
  title?: string;
  placeName?: string;
  status: AssistStatus;
  assignedTo?: Types.ObjectId | null;
  acceptedAt?: Date;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  vehicle?: any;
  location?: {
    type: string;
    coordinates: number[];
    address?: string;
    accuracy?: number;
  };
}

const AssistRequestSchema = new Schema<IAssistRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: String,
    placeName: String,
    status: {
      type: String,
      enum: ["pending", "accepted", "done", "canceled"],
      default: "pending",
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    acceptedAt: { type: Date, default: null },
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    vehicle: Schema.Types.Mixed,
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: [Number],
      address: String,
      accuracy: Number,
    },
  },
  { timestamps: true }
);

// 🔔 emit deletion to the owner's room
function emitDeleted(doc?: IAssistRequest | null) {
  if (!doc) return;
  try {
    const io = getIO();
    io.to(String(doc.userId)).emit("assist:deleted", { id: String(doc._id) });
  } catch {}
}

// doc-based deletes
// 'remove' middleware is deprecated/unsupported in current mongoose typings; use document deleteOne instead
AssistRequestSchema.post("deleteOne", { document: true, query: false }, emitDeleted);
// query-based deletes
AssistRequestSchema.post("findOneAndDelete", emitDeleted);

const AssistRequest = model<IAssistRequest>("AssistRequest", AssistRequestSchema);
export default AssistRequest;
