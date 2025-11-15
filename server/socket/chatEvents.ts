import { Server as SocketIOServer, Socket } from "socket.io";
import Conversation from "../modals/Conversation";
import ConversationMeta from "../modals/ConversationMeta";
import Message from "../modals/Message";
import User from "../modals/User";
import { getAppdbConnection } from "../config/db";
import { Schema, Types } from "mongoose";

/** ---------------- helpers ---------------- */
function isValidObjectId(id: any): boolean {
  if (!id) return false;
  const idStr = String(id);
  return Types.ObjectId.isValid(idStr) && idStr.length === 24;
}

async function getUserFromEitherDb(userId: string): Promise<any> {
  if (!userId || !isValidObjectId(userId)) return null;

  // customer DB
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

  // appdb (operators)
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

/** Populate participants from customer + appdb */
export async function populateParticipantsFromBothDbs(participantIds: any[]): Promise<any[]> {
  const validIds = (participantIds || [])
    .filter((id) => isValidObjectId(id))
    .map((id) => String(id));

  if (!validIds.length) return [];

  const customerUsers = await User.find({ _id: { $in: validIds } })
    .select("name username avatar email _id")
    .lean();

  const foundIds = new Set(customerUsers.map((u) => String(u._id)));
  const missingIds = validIds.filter((id) => !foundIds.has(id));

  let appdbUsers: any[] = [];
  if (missingIds.length) {
    try {
      const appdbConnection = getAppdbConnection();
      const AppdbUserSchema = new Schema(
        { username: String, name: String, email: String, avatar: String, phone: String },
        { collection: "users", strict: false }
      );
      const AppdbUser =
        appdbConnection.models.User || appdbConnection.model("User", AppdbUserSchema);
      appdbUsers = await AppdbUser.find({ _id: { $in: missingIds } })
        .select("username name avatar email _id")
        .lean();
    } catch (error) {
      console.error("Error fetching from appdb:", error);
    }
  }

  const allUsers = [...customerUsers, ...appdbUsers];
  const isCustomer = (id: string) => customerUsers.some((u) => String(u._id) === id);

  const map = new Map(
    allUsers.map((u: any) => {
      const id = String(u._id);
      const displayName = isCustomer(id)
        ? (u.name || u.username || "Unknown")
        : (u.username || u.name || "Unknown");
      return [
        id,
        {
          _id: u._id,
          name: displayName,
          username: u.username || "",
          avatar: u.avatar || "",
          email: u.email || "",
        },
      ];
    })
  );

  return validIds.map(
    (id) =>
      map.get(id) || {
        _id: id,
        name: "Unknown User",
        avatar: "",
        email: "",
      }
  );
}

/** ---------------- events ---------------- */
export function registerChatEvents(io: SocketIOServer, socket: Socket) {
  /** getConversations */
  socket.on("getConversations", async () => {
    try {
      const userId = socket.data.userId;
      if (!userId)
        return socket.emit("getConversations", { success: false, msg: "Unauthorized" });

      const conversations = await Conversation.find({ participants: userId })
        .sort({ updatedAt: -1 })
        .lean();

      const conversationsWithParticipants = await Promise.all(
        conversations.map(async (conv: any) => {
          const populatedParticipants = await populateParticipantsFromBothDbs(conv.participants || []);

          // lastMessage: try direct reference; if missing, fallback to newest Message
          let lastMessageData: any = null;
          if (conv.lastMessage) {
            try {
              lastMessageData = await Message.findById(conv.lastMessage)
                .select("content senderId attachment createdAt conversationId")
                .lean();
            } catch {
              lastMessageData = null;
            }
          }
          if (!lastMessageData) {
            lastMessageData = await Message.findOne({ conversationId: conv._id })
              .sort({ createdAt: -1 })
              .select("content senderId attachment createdAt conversationId")
              .lean();
          }
          if (lastMessageData?.senderId) {
            const sender = await getUserFromEitherDb(String(lastMessageData.senderId));
            if (sender) lastMessageData.senderId = sender;
          }

          return {
            ...conv,
            participants: populatedParticipants,
            lastMessage: lastMessageData,
          };
        })
      );

      const convIds = conversations.map((c) => c._id);
      const metas = await ConversationMeta.find({
        conversationId: { $in: convIds },
        userId,
      })
        .select("conversationId unreadCount unread")
        .lean();

      const metaMap = new Map<string, number>();
      metas.forEach((m: any) =>
        metaMap.set(String(m.conversationId), Number(m.unreadCount ?? m.unread ?? 0))
      );

      const withUnread = conversationsWithParticipants.map((c) => ({
        ...c,
        unreadCount: metaMap.get(String(c._id)) ?? 0,
      }));

      socket.emit("getConversations", { success: true, data: withUnread });
    } catch (error: any) {
      console.log("getConversations error:", error);
      socket.emit("getConversations", { success: false, msg: "Failed to fetch conversations" });
    }
  });

  /** newConversation — direct 1:1 customer ↔ operator */
  // (line number label in your file was "54", safe to keep content only)
  socket.on("newConversation", async (data) => {
    try {
      const existingConversation = await Conversation.findOne({
        type: "direct",
        participants: { $all: data.participants, $size: 2 },
      }).lean();

      if (existingConversation) {
        const populatedParticipants = await populateParticipantsFromBothDbs(
          existingConversation.participants || []
        );
        socket.emit("newConversation", {
          success: true,
          data: {
            ...existingConversation,
            participants: populatedParticipants,
            isNew: false,
            unreadCount: 0,
          },
        });
        return;
      }

      const conversation = await Conversation.create({
        type: "direct",
        participants: data.participants,
        name: data.name || "",
        avatar: data.avatar || "",
        createdBy: socket.data.userId,
      });

      // Initialize meta (write both unreadCount & legacy unread)
      await Promise.all(
        data.participants.map((uid: string) =>
          ConversationMeta.findOneAndUpdate(
            { conversationId: conversation._id, userId: uid },
            { $setOnInsert: { unreadCount: 0, unread: 0 } },
            { upsert: true, new: true }
          )
        )
      );

      // join room for connected sockets
      const connectedSockets = Array.from(io.sockets.sockets.values()).filter((s) =>
        data.participants.map(String).includes(String(s.data.userId))
      );
      connectedSockets.forEach((s) => s.join(String(conversation._id)));

      const populatedConversation = await Conversation.findById(conversation._id).lean();
      const populatedParticipants = await populateParticipantsFromBothDbs(
        populatedConversation?.participants || []
      );

      const payload = {
        ...populatedConversation,
        participants: populatedParticipants,
        isNew: true,
        unreadCount: 0,
      };

      connectedSockets.forEach((s) =>
        s.emit("newConversation", { success: true, data: payload })
      );
    } catch (error: any) {
      console.log("newConversation error:", error);
      socket.emit("newConversation", { success: false, msg: "failed to created conversation" });
    }
  });

  /** deleteConversation (unchanged from your version) */
  socket.on("deleteConversation", async (conversationId: string) => {
    try {
      const userId = String(socket.data.userId || "");
      if (!userId)
        return socket.emit("deleteConversation", { success: false, msg: "Unauthorized" });

      const convo = await Conversation.findById(conversationId)
        .select("participants")
        .lean();
      if (!convo)
        return socket.emit("deleteConversation", {
          success: false,
          msg: "Conversation not found",
        });

      const isParticipant = convo.participants.map(String).includes(userId);
      if (!isParticipant)
        return socket.emit("deleteConversation", { success: false, msg: "Forbidden" });

      await Message.deleteMany({ conversationId });
      await ConversationMeta.deleteMany({ conversationId });
      await Conversation.findByIdAndDelete(conversationId);

      const participantIds = convo.participants.map(String);
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String(s.data?.userId || "");
        if (participantIds.includes(uid)) {
          s.leave(conversationId);
          io.to(sid).emit("conversationDeleted", { success: true, conversationId });
        }
      }

      socket.emit("deleteConversation", { success: true });
    } catch (e) {
      console.error("deleteConversation error:", e);
      socket.emit("deleteConversation", { success: false, msg: "Failed to delete conversation" });
    }
  });

  /** verifyConversationParticipants (unchanged behavior) */
  socket.on("verifyConversationParticipants", async (conversationId: string) => {
    try {
      const userId = socket.data.userId;
      if (!userId)
        return socket.emit("verifyConversationParticipants", { success: false, msg: "Unauthorized" });

      const conversation = await Conversation.findById(conversationId).lean();
      const populatedParticipants = await populateParticipantsFromBothDbs(
        conversation?.participants || []
      );

      if (!conversation)
        return socket.emit("verifyConversationParticipants", {
          success: false,
          msg: "Conversation not found",
        });

      socket.emit("verifyConversationParticipants", {
        success: true,
        data: {
          conversationId,
          participants: populatedParticipants,
          currentUser: userId,
          isParticipant: populatedParticipants.some((p: any) => String(p._id) === String(userId)),
        },
      });
    } catch (error: any) {
      console.log("verifyConversationParticipants error:", error);
      socket.emit("verifyConversationParticipants", {
        success: false,
        msg: "Failed to verify conversation participants",
      });
    }
  });
}
