import { Server as SocketIOServer, Socket } from "socket.io";
import Message from "../modals/Message";
import Conversation from "../modals/Conversation";
import ConversationMeta from "../modals/ConversationMeta";
import User from "../modals/User";
import Expo, { ExpoPushMessage } from "expo-server-sdk";
import { getAppdbConnection } from "../config/db";
import { Schema } from "mongoose";
import { populateParticipantsFromBothDbs } from "./chatEvents";

const expo = new Expo();

function trimBody(s?: string) {
  if (!s) return "";
  return s.length > 160 ? s.slice(0, 157) + "..." : s;
}

async function getUserFromEitherDb(userId: string): Promise<any> {
  if (!userId) return null;

  const user = await User.findById(userId)
    .select("name username avatar email _id")
    .lean();
  if (user) {
    const username = (user as any).username || "";
    return {
      _id: user._id,
      name: user.name || username || "Unknown",
      username,
      avatar: user.avatar || "",
      email: user.email || "",
    };
  }

  try {
    const appdbConnection = getAppdbConnection();
    const AppdbUserSchema = new Schema(
      { username: String, name: String, email: String, avatar: String, phone: String },
      { collection: "users", strict: false }
    );
    const AppdbUser =
      appdbConnection.models.User || appdbConnection.model("User", AppdbUserSchema);

    const appdbUser: any = await AppdbUser.findById(userId)
      .select("username name avatar email _id")
      .lean();

    if (appdbUser) {
      return {
        _id: appdbUser._id,
        name: appdbUser.username || appdbUser.name || "Unknown",
        username: appdbUser.username || "",
        avatar: appdbUser.avatar || "",
        email: appdbUser.email || "",
      };
    }
  } catch (error) {
    console.error("Error fetching from appdb:", error);
  }
  return null;
}

/**
 * Get push tokens for users from both customer and appdb databases
 * Returns array of push tokens for users who have them registered
 */
async function getPushTokensFromBothDbs(userIds: string[]): Promise<string[]> {
  if (!userIds || userIds.length === 0) return [];

  const tokens: string[] = [];

  try {
    // Get tokens from customer database
    const customerUsers = await User.find({
      _id: { $in: userIds },
      expoPushToken: { $exists: true, $ne: "" },
    })
      .select("expoPushToken _id")
      .lean();

    const foundIds = new Set(customerUsers.map((u) => String(u._id)));
    const customerTokens = customerUsers
      .map((r) => r.expoPushToken)
      .filter((token): token is string => Boolean(token));
    tokens.push(...customerTokens);

    // Get tokens from appdb for remaining users
    const missingIds = userIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      try {
        const appdbConnection = getAppdbConnection();
        const AppdbUserSchema = new Schema(
          { username: String, name: String, email: String, avatar: String, phone: String, expoPushToken: String },
          { collection: "users", strict: false }
        );
        const AppdbUser =
          appdbConnection.models.User || appdbConnection.model("User", AppdbUserSchema);

        const appdbUsers = await AppdbUser.find({
          _id: { $in: missingIds },
          expoPushToken: { $exists: true, $ne: "" },
        })
          .select("expoPushToken")
          .lean();

        const appdbTokens = appdbUsers
          .map((r) => r.expoPushToken)
          .filter((token): token is string => Boolean(token));
        tokens.push(...appdbTokens);
      } catch (error) {
        console.error("Error fetching push tokens from appdb:", error);
      }
    }
  } catch (error) {
    console.error("Error fetching push tokens from customer db:", error);
  }

  return tokens;
}

type PushPayloadWithoutTo = Omit<ExpoPushMessage, "to">;

async function sendPushToExpo(tokens: string[], message: PushPayloadWithoutTo) {
  const valid = tokens.filter((t) => Expo.isExpoPushToken(t));
  if (!valid.length) return;

  const chunks = expo.chunkPushNotifications(
    valid.map<ExpoPushMessage>((token) => ({ to: token, ...message }))
  );

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (e) {
      console.error("Expo push chunk error:", e);
    }
  }
}

export function registerMessageEvents(io: SocketIOServer, socket: Socket) {
  /** getMessages */
  socket.on("getMessages", async (conversationId: string) => {
    try {
      if (!socket.data.userId)
        return socket.emit("getMessages", { success: false, msg: "Unauthorized" });

      const messages = await Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const messagesWithSenders = await Promise.all(
        messages.map(async (msg: any) => {
          const sender = await getUserFromEitherDb(String(msg.senderId));
          return {
            ...msg,
            senderId:
              sender || {
                _id: msg.senderId,
                name: "Unknown",
                username: "",
                avatar: "",
                email: "",
              },
          };
        })
      );

      socket.emit("getMessages", { success: true, data: messagesWithSenders });
    } catch (error) {
      console.error("getMessages error:", error);
      socket.emit("getMessages", { success: false, msg: "Failed to fetch messages" });
    }
  });

  /** newMessage */
  socket.on(
    "newMessage",
    async (data: { conversationId: string; content?: string; attachment?: string }) => {
      try {
        const { conversationId, content, attachment } = data;
        const senderId = socket.data.userId;

        if (!senderId || !conversationId)
          return socket.emit("newMessage", { success: false, msg: "Invalid payload" });

        // create message
        const message = await Message.create({ conversationId, senderId, content, attachment });

        // update conversation lastMessage + updatedAt
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        // participants (1:1)
        const conversationDoc = await Conversation.findById(conversationId)
          .select("participants")
          .lean();

        let otherParticipantIds: string[] = [];
        if (conversationDoc) {
          otherParticipantIds = conversationDoc.participants
            .map((p) => String(p))
            .filter((pid) => pid !== String(senderId));

          // increment unread for others — keep legacy `unread` in sync
          await Promise.all(
            otherParticipantIds.map((participantId) =>
              ConversationMeta.findOneAndUpdate(
                { conversationId, userId: participantId },
                { $inc: { unreadCount: 1, unread: 1 }, $set: { isDeleted: false } },
                { upsert: true, new: true }
              )
            )
          );
        }

        // populate sender for emit
        const sender = await getUserFromEitherDb(String(senderId));
        const populated = {
          ...(await Message.findById(message._id).lean()),
          senderId:
            sender || {
              _id: senderId,
              name: "Unknown",
              username: "",
              avatar: "",
              email: "",
            },
        };

        // broadcast newMessage
        io.to(conversationId).emit("newMessage", {
          success: true,
          data: { ...populated, conversationId },
        });

        // personalized conversationUpdated for every participant
        const conversationForUpdate = await Conversation.findById(conversationId).lean();
        const populatedParticipants = conversationForUpdate
          ? await populateParticipantsFromBothDbs(conversationForUpdate.participants || [])
          : [];

        let lastMessageData: any = null;
        if (conversationForUpdate?.lastMessage) {
          lastMessageData = await Message.findById(conversationForUpdate.lastMessage)
            .select("content senderId attachment createdAt conversationId")
            .lean();
          if (lastMessageData?.senderId) {
            const s = await getUserFromEitherDb(String(lastMessageData.senderId));
            if (s) lastMessageData.senderId = s;
          }
        }

        const populatedConversation = conversationForUpdate
          ? {
              ...conversationForUpdate,
              participants: populatedParticipants,
              lastMessage: lastMessageData,
            }
          : null;

        if (populatedConversation) {
          for (const [socketId, s] of io.sockets.sockets) {
            const uid = String(s.data?.userId || "");
            if (!uid) continue;

            const isParticipant = populatedConversation.participants
              .map((p: any) => String(p._id))
              .includes(uid);
            if (!isParticipant) continue;

            const meta = await ConversationMeta.findOne({ conversationId, userId: uid })
              .select("unreadCount")
              .lean();

            const unread = Number(meta?.unreadCount ?? 0);

            io.to(socketId).emit("conversationUpdated", {
              success: true,
              data: { ...populatedConversation, unreadCount: unread },
            });
          }
        }

        // 🔔 Push notifications - Send to all recipients with push tokens (from both databases)
        if (otherParticipantIds.length && populated) {
          // Get push tokens from both customer and appdb databases
          const tokens = await getPushTokensFromBothDbs(otherParticipantIds);

          if (tokens.length > 0) {
            const senderName = (populated?.senderId as any)?.name || "Someone";
            const body = attachment ? "Sent a photo" : trimBody(content) || "New message";

            const participantsMin = (populatedConversation?.participants || []).map((p: any) => ({
              _id: String(p._id),
              name: p.name,
              avatar: p.avatar || "",
            }));

            // Send push notification to all recipients
            await sendPushToExpo(tokens, {
              title: senderName,
              body,
              sound: "default",
              categoryId: "MESSAGE",
              data: {
                conversationId,
                name: senderName,
                avatar: (populated?.senderId as any)?.avatar || "",
                type: "direct",
                participants: participantsMin,
              },
            });
          }
        }
      } catch (error) {
        console.error("newMessage error:", error);
        socket.emit("newMessage", { success: false, msg: "Failed to send message" });
      }
    }
  );

  /** markAsRead */
  socket.on("markAsRead", async (conversationId: string) => {
    try {
      const userId = socket.data.userId;
      if (!userId)
        return socket.emit("markAsRead", { success: false, msg: "Unauthorized" });

      // reset both fields (unreadCount + legacy unread)
      await ConversationMeta.findOneAndUpdate(
        { conversationId, userId },
        { $set: { unreadCount: 0, unread: 0, lastReadAt: new Date(), isDeleted: false } },
        { upsert: true }
      );

      const convo = await Conversation.findById(conversationId).lean();
      const populatedParticipants = convo
        ? await populateParticipantsFromBothDbs(convo.participants || [])
        : [];

      let lastMessageData: any = null;
      if (convo?.lastMessage) {
        lastMessageData = await Message.findById(convo.lastMessage)
          .select("content senderId attachment createdAt conversationId")
          .lean();
        if (lastMessageData?.senderId) {
          const s = await getUserFromEitherDb(String(lastMessageData.senderId));
          if (s) lastMessageData.senderId = s;
        }
      }

      socket.emit("conversationUpdated", {
        success: true,
        data: { ...convo, participants: populatedParticipants, lastMessage: lastMessageData, unreadCount: 0 },
      });
      socket.emit("markAsRead", { success: true });
    } catch (error) {
      console.error("markAsRead error:", error);
      socket.emit("markAsRead", { success: false, msg: "Failed to mark as read" });
    }
  });
}
