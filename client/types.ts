// client/types.ts
import { Router } from "expo-router";
import { ReactNode } from "react";
import {
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  TouchableOpacityProps,
  ViewStyle,
} from "react-native";

export type TypoProps = {
  size?: number;
  color?: string;
  fontWeight?: TextStyle["fontWeight"];
  children: any | null;
  style?: TextStyle;
  textProps?: TextProps;
};

export interface UserProps {
  id: string;
  email: string;
  name: string;
  phone: string | null; // Explicit null allowed
  avatar: string | null; // Explicit null allowed
}

export interface UserDataProps {
  name: string;
  email: string;
  phone?: string;
  avatar?: any;
}

export interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  inputRef?: React.RefObject<TextInput>;
}

export interface DecodedTokenProps {
  user: UserProps;
  exp: number;
  iat: number;
}

export type AuthContextProps = {
  token: string | null;
  user: UserProps | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    name: string,
    avatar?: string,
    phone?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateToken: (token: string) => Promise<void>;
};

export type ScreenWrapperProps = {
  style?: ViewStyle;
  children: React.ReactNode;
  isModal?: boolean;
  showPattern?: boolean;
  bgOpacity?: number;
};

export type ResponseProps = {
  success: boolean;
  data?: any;
  msg?: string;
};

export interface ButtonProps extends TouchableOpacityProps {
  style?: ViewStyle;
  onPress?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}

export type BackButtonProps = {
  style?: ViewStyle;
  color?: string;
  iconSize?: number;
};

export type AvatarProps = {
  size?: number;
  uri: string | null;
  style?: ViewStyle;
};

export type HeaderProps = {
  title?: string;
  style?: ViewStyle;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export type ConversationListItemProps = {
  item: ConversationProps;
  showDivider: boolean;
  router: Router;
};

export type ConversationProps = {
  _id: string;
  type: "direct"; // Only direct 1-on-1 messaging (customer ↔ operator)
  avatar: string | null;
  participants: {
    _id: string;
    name: string;
    username?: string;
    avatar: string;
    email: string;
  }[]; // Always 2 participants [customer, operator]
  name?: string;
  lastMessage?: {
    _id: string;
    content: string;
    senderId: string;
    type: "text" | "image" | "file";
    attachment?: string;
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
};

export type MessageProps = {
  id: string;
  sender: {
    id: string;
    name: string;
    username?: string;
    avatar: string | null;
  };
  content: string;
  attachment?: string | null;
  isMe?: boolean;
  createdAt: string;
};

// Assist Request Types (moved from assistService.ts)
export interface AssistRequest {
  _id: string;
  userId: string;
  title?: string;
  placeName?: string;
  status: "pending" | "accepted" | "completed";
  assignedTo?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  name: string;
  avatar?: string;
  email: string;
}

export interface AssistRequestWithUser extends Omit<AssistRequest, "userId"> {
  userId: User;
}

// Activity Store Types (moved from activityStore.ts)
export type ActivityItem = {
  id: string; // may be a local temp id OR the server _id
  title: string;
  placeName?: string;
  createdAt: string;
  status: "pending" | "accepted" | "completed";
  meta?: { assistId?: string | null; operator?: any; [k: string]: any };
  location?: {
    street?: string;
    barangay?: string;
    city?: string;
  };
};

// Operator Request Manager Types (moved from OperatorRequestManager.tsx)
export interface AssistRequestData {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  vehicle: {
    model: string;
    plate: string;
    notes?: string;
  };
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  createdAt: string;
}

export interface OperatorRequestManagerProps {
  onRequestAccepted?: (requestId: string) => void;
  onRequestRemoved?: (requestId: string, takenBy: string) => void;
}

// Route Hook Types (moved from useRoute.ts)
export type Step = {
  instruction: string;
  distance: number;
  duration: number;
};

// EnRoute Manager Types (moved from EnRouteManager.tsx)
export type OperatorStatusKind =
  | "en_route"
  | "arrived"
  | "working"
  | "completed"
  | "idle";

export type OperatorInfo = {
  id?: string;
  name?: string;
  username?: string | null;
  fullName?: string | null;
  avatar?: string | null;
  phone?: string;
  email?: string | null;
  location?: {
    lat: number;
    lng: number;
    address?: string | null;
  } | null;
};

export type OperatorStatusState = {
  visible: boolean;
  assistId?: string | null;
  status: OperatorStatusKind;
  eta?: string;
  operator?: OperatorInfo;
};

// Assist Chat Service Types (moved from assistChatService.ts)
export interface AssistChatInfo {
  assistRequestId: string;
  customerId: string;
  operatorId: string;
  customerName: string;
  operatorName: string;
  vehicleInfo?: string;
  locationInfo?: string;
}
