// server/modals/Rating.ts
import { Schema, model, Document } from "mongoose";
import { getIO } from "../socket/socket";
import { getCustomerConnection } from "../config/db";

export interface IRating extends Document {
  assistRequestId: Schema.Types.ObjectId;
  customerId: Schema.Types.ObjectId;
  operatorId: Schema.Types.ObjectId;
  rating: number; // 1-5 stars
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RatingSchema = new Schema<IRating>(
  {
    assistRequestId: { 
      type: Schema.Types.ObjectId, 
      ref: "AssistRequest", 
      required: true
    },
    customerId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    operatorId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    rating: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 5 
    },
    comment: { 
      type: String, 
      maxlength: 500 
    },
  },
  { timestamps: true }
);

// Ensure only one rating per assist request
RatingSchema.index({ assistRequestId: 1 }, { unique: true });

// Emit rating update to operator
function emitRatingUpdate(doc: IRating) {
  try {
    const io = getIO();
    io.to(String(doc.operatorId)).emit("rating:received", {
      success: true,
      data: {
        assistRequestId: doc.assistRequestId,
        rating: doc.rating,
        comment: doc.comment,
        customerId: doc.customerId,
        createdAt: doc.createdAt
      }
    });
  } catch (error) {
    console.error("Error emitting rating update:", error);
  }
}

RatingSchema.post("save", emitRatingUpdate);

// Use customer connection for Rating model
const customer = getCustomerConnection();
export default customer.model<IRating>("Rating", RatingSchema);
