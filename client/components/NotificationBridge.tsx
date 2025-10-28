// client/components/NotificationBridge.tsx
import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import {
  AppState,
  AppStateStatus,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/authContext";
import { getSocket } from "@/socket/socket";
import {
  registerPushToken,
  newMessage,
  markAsRead,
} from "@/socket/socketEvents";

import {
  registerForPushNotificationsAsync,
  showLocalMessageNotification,
  ensureNotificationCategories,
} from "../notifications/notification";

import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";


export default function NotificationBridge() {
  const { user } = useAuth();
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);


  // Track foreground/background
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (s) => (appState.current = s)
    );
    return () => sub.remove();
  }, []);

  // One-time: define notification actions (Reply / Mark as read)
  useEffect(() => {
    ensureNotificationCategories();
  }, []);

  // Register device token and send to server after login
  useEffect(() => {
    (async () => {
      if (!user) return;
      const token = await registerForPushNotificationsAsync();
      const socket = getSocket();
      if (token && socket) registerPushToken({ token });
    })();
  }, [user]);

  // Handle notification taps and quick actions
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      async (resp) => {
        const action = resp.actionIdentifier;
        const data = resp.notification.request.content.data || {};

        const conversationId = data.conversationId as string | undefined;
        const name = (data.name as string | undefined) || "Conversation";
        const avatar = (data.avatar as string | undefined) || "";
        const type = "direct";
        const participants = (
          Array.isArray(data.participants) ? data.participants : []
        ) as Array<{
          _id: string;
          name: string;
          avatar: string;
        }>;

        if (!conversationId) return;

        if (action === "REPLY") {
          const text = (resp as any)?.userText?.trim?.() || "";
          if (text) newMessage({ conversationId, content: text });
        } else if (action === "MARK_AS_READ") {
          markAsRead(conversationId);
        }

        router.push({
          pathname: "/(main)/conversation",
          params: {
            id: conversationId,
            name,
            avatar,
            type,
            participants: JSON.stringify(participants),
          },
        });
      }
    );
    return () => sub.remove();
  }, [router]);

  // Foreground local toast on incoming messages (not sent by me)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (evt: any) => {
      if (!evt?.success || !evt?.data) return;
      const me = user?.id;
      const m = evt.data;

      if (
        appState.current === "active" &&
        String(m.senderId?._id || m.senderId) !== String(me)
      ) {
        const preview = m.attachment
          ? "Sent a photo"
          : m.content || "New message";
        const senderName = m.senderId?.name || "Someone";
        const senderAvatar = m.senderId?.avatar || "";
        showLocalMessageNotification({
          senderName,
          preview,
          conversationId: m.conversationId,
          avatarUrl: senderAvatar,
        });
      }
    };

    socket.on("newMessage", onNewMessage);
    return () => {
      socket.off("newMessage", onNewMessage);
    };
  }, [user]);

  // Local delivered toast for my own message delivery
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onDelivered = (evt: any) => {
      if (!evt?.success) return;
      const names: string[] = Array.isArray(evt.deliveredTo)
        ? evt.deliveredTo
        : [];
      const who = names.length ? names.join(", ") : "recipient";
      showLocalMessageNotification({
        senderName: "Delivered",
        preview: `Your message was delivered to ${who}`,
        conversationId: evt.conversationId,
      });
    };

    socket.on("messageDelivered", onDelivered);
    return () => {
      socket.off("messageDelivered", onDelivered);
    };
  }, []);


  return null;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: "82%",
    backgroundColor: colors.black,
    borderRadius: radius._20,
    padding: spacingX._15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacingY._15,
  },
  btn: {
    flex: 1,
    borderRadius: radius._15,
    paddingVertical: spacingY._10,
    alignItems: "center",
  },
  reject: { marginRight: spacingX._10, backgroundColor: "#E04040" },
  accept: { marginLeft: spacingX._10, backgroundColor: colors.primary },
});
