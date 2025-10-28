// server\modals\Message.ts

import mongoose from "mongoose";
import { getCustomerConnection } from "../config/db";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: String,
    attachment: String,
    type: {
      type: String,
      enum: ["text", "image", "file", "system"],
      default: "text",
    },
    isSystemMessage: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Use customer connection for Message model
const customer = getCustomerConnection();
export default customer.model("Message", messageSchema);
