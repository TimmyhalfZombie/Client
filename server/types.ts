import { Document, Types } from "mongoose";

export interface UserProps extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  name?: string;
  username?: string;
  avatar?: string;
  created?: Date;
  phone?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  expoPushToken?: string;
  initial_lat?: number;
  initial_lng?: number;
  initial_address?: string;
}

export interface ConversationProps extends Document {
  _id: Types.ObjectId;
  type: "direct"; // Only direct 1-on-1 messaging (customer ↔ operator)
  name?: string;
  participants: Types.ObjectId[]; // Always 2 participants [customer, operator]
  lastMessage?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMetaProps extends Document {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  unreadCount: number;
  lastReadAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistRequestProps extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;

  /** Snapshot of sender profile at request time (for operator UI & history) */
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  vehicle: { model?: string; plate?: string; notes?: string };
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
    address?: string;
    accuracy?: number;
  };
  status: "pending" | "accepted" | "completed";
  assignedTo?: Types.ObjectId | null;
  acceptedAt?: Date;
  acceptedBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

// Assist Request Types (moved from AssistRequest.ts)
export type AssistStatus = "pending" | "accepted" | "completed";

export interface IAssistRequest extends Document {
  userId: Types.ObjectId;
  title?: string;
  placeName?: string;
  status: AssistStatus;
  assignedTo?: Types.ObjectId | null;
  acceptedAt?: Date;
  acceptedBy?: Types.ObjectId | null;
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
  // 📍 Real-time location tracking
  customerCurrentLocation?: {
    lat: number;
    lng: number;
    address?: string;
    timestamp: Date;
  };
  operatorCurrentLocation?: {
    lat: number;
    lng: number;
    address?: string;
    timestamp: Date;
  };
  lastLocationUpdate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
