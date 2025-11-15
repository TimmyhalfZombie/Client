// server/modals/AssistRequest.ts
import { Schema, model, Types, Document } from "mongoose";
import { getIO } from "../socket/socket";
import { AssistStatus, IAssistRequest } from "../types";
import { getCustomerConnection } from "../config/db";

const AssistRequestSchema = new Schema<IAssistRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: String,
    placeName: String,
    status: {
      type: String,
      enum: ["pending", "accepted", "completed"],
      default: "pending",
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
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
    // 📍 Real-time location tracking
    customerCurrentLocation: {
      lat: Number,
      lng: Number,
      address: String,
      timestamp: Date,
    },
    operatorCurrentLocation: {
      lat: Number,
      lng: Number,
      address: String,
      timestamp: Date,
    },
    lastLocationUpdate: Date,
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

// Use customer connection for AssistRequest model
const customer = getCustomerConnection();
export default customer.model<IAssistRequest>("AssistRequest", AssistRequestSchema);
