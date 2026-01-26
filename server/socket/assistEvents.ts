import { Server as SocketIOServer, Socket } from "socket.io";
import AssistRequest from "../modals/AssistRequest";
import Conversation from "../modals/Conversation";
import ConversationMeta from "../modals/ConversationMeta";
import User from "../modals/User";
import Message from "../modals/Message";
import Rating from "../modals/Rating";
import { populateParticipantsFromBothDbs } from "./chatEvents";
import { getAppdbConnection } from "../config/db";
import { Schema } from "mongoose";
import Expo, { ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

type PushPayloadWithoutTo = Omit<ExpoPushMessage, "to">;

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
          {
            username: String,
            name: String,
            email: String,
            avatar: String,
            phone: String,
            expoPushToken: String,
          },
          { collection: "users", strict: false },
        );
        const AppdbUser =
          appdbConnection.models.User ||
          appdbConnection.model("User", AppdbUserSchema);

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

async function sendPushToExpo(tokens: string[], message: PushPayloadWithoutTo) {
  const valid = tokens.filter((t) => Expo.isExpoPushToken(t));
  if (!valid.length) return;

  const chunks = expo.chunkPushNotifications(
    valid.map<ExpoPushMessage>((token) => ({ to: token, ...message })),
  );

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (e) {
      console.error("Expo push chunk error:", e);
    }
  }
}

/** Helpers */
async function ensureDirectConversation(
  io: SocketIOServer,
  a: string,
  b: string,
) {
  let convo = await Conversation.findOne({
    type: "direct",
    participants: { $all: [a, b], $size: 2 },
  })
    .populate({
      path: "lastMessage",
      select: "content senderId attachment createdAt conversationId",
    })
    .lean();

  if (!convo) {
    const created = await Conversation.create({
      type: "direct",
      participants: [a, b],
      createdBy: a,
    });

    await Promise.all(
      [a, b].map((uid) =>
        ConversationMeta.findOneAndUpdate(
          { conversationId: created._id, userId: uid },
          { $setOnInsert: { unreadCount: 0 } },
          { upsert: true, new: true },
        ),
      ),
    );

    // join sockets to room
    for (const [sid, s] of io.sockets.sockets) {
      const uid = String((s.data as any)?.userId || "");
      if (uid === String(a) || uid === String(b))
        s.join(created._id.toString());
    }

    convo = await Conversation.findById(created._id)
      .populate({
        path: "lastMessage",
        select: "content senderId attachment createdAt conversationId",
      })
      .lean();
  }

  // Manually populate participants from both databases
  if (convo) {
    const populatedParticipants = await populateParticipantsFromBothDbs(
      convo.participants || [],
    );
    convo = {
      ...convo,
      participants: populatedParticipants,
    };
  }

  // Check if conversation was just created (to emit newConversation event)
  let isNewConversation = false;
  if (convo) {
    const existingBefore = await Conversation.findOne({
      type: "direct",
      participants: { $all: [a, b], $size: 2 },
      _id: { $ne: convo._id },
    }).lean();
    isNewConversation = !existingBefore;
  }

  // If this is a new conversation, emit it to both participants
  if (convo && isNewConversation) {
    const payload = { ...convo, isNew: true, unreadCount: 0 };
    for (const [sid, s] of io.sockets.sockets) {
      const uid = String((s.data as any)?.userId || "");
      if (uid === String(a) || uid === String(b)) {
        io.to(sid).emit("newConversation", { success: true, data: payload });
      }
    }
  }

  return convo!;
}

export function registerAssistEvents(io: SocketIOServer, socket: Socket) {
  // Temp: everyone can watch the operators room
  socket.on("joinOperators", () => {
    socket.join("operators");
  });

  /**
   * Create request + ack + broadcast.
   * IMPORTANT: we snapshot the current user profile into the doc.
   */
  socket.on("assistRequest", async (data: any, ack?: (res: any) => void) => {
    try {
      const requester = String((socket.data as any)?.userId || "");
      if (!requester) throw new Error("Unauthorized");

      const { vehicle = {}, location = {} } = data || {};
      const lat = Number(location.lat);
      const lng = Number(location.lng);

      // Read authoritative user profile and snapshot it
      const user = await User.findById(requester)
        .select("name email phone avatar")
        .lean();

      console.log("🔍 User data for assist request:", {
        requesterId: requester,
        userData: user,
        email: user?.email,
        name: user?.name,
        phone: user?.phone,
      });

      const doc = await AssistRequest.create({
        userId: requester,
        customerName: (user?.name || "").trim(),
        customerEmail: (user?.email || "").trim(),
        customerPhone: (user?.phone || "").trim(),
        vehicle,
        location: {
          type: "Point",
          coordinates: [isFinite(lng) ? lng : 0, isFinite(lat) ? lat : 0],
          address: location.address || "",
          accuracy: location.accuracy || undefined,
        },
        status: "pending",
      });

      console.log("💾 Created assist request:", {
        id: doc._id,
        customerName: doc.customerName,
        customerEmail: doc.customerEmail,
        customerPhone: doc.customerPhone,
        status: doc.status,
      });

      // Acknowledge back to the requester
      const response = {
        success: true,
        data: { id: String(doc._id) },
      };

      if (typeof ack === "function") {
        console.log("✅ Sending callback acknowledgement to customer");
        ack(response);
      } else {
        console.log("📢 Emitting assistRequest event back to customer");
        socket.emit("assistRequest", response);
      }

      // Broadcast to operators (use snapshot for name)
      io.to("operators").emit("assist:created", {
        success: true,
        data: {
          id: String(doc._id),
          user: {
            id: requester,
            name: doc.customerName || user?.name || "",
            avatar: user?.avatar || "",
          },
          vehicle: doc.vehicle,
          location: { lat, lng, address: doc.location?.address || "" },
          createdAt: (doc as any).createdAt,
        },
      });
    } catch (e) {
      console.error("assistRequest error:", e);
      const errorMsg = {
        success: false,
        msg: "Failed to dispatch request",
      };
      if (typeof ack === "function") ack(errorMsg);
      else socket.emit("assistRequest", errorMsg);
    }
  });

  // Alias kept for future-proofing
  socket.on("assist:create", async (data: any) => {
    socket.emit("assistRequest", { success: true, msg: "accepted (compat)" });
    socket.emit("assist:create", { success: true });
    socket.emit("assistRequest", data);
  });

  // Operator accepts - WITH RACE CONDITION PROTECTION
  socket.on("assist:accept", async (data: { id: string }) => {
    try {
      const operatorId = String((socket.data as any)?.userId || "");
      const id = String(data?.id || "");
      if (!operatorId || !id)
        return socket.emit("assist:accept", {
          success: false,
          msg: "Invalid payload",
        });

      // CRITICAL: Use atomic update to prevent race conditions
      const req = await AssistRequest.findOneAndUpdate(
        {
          _id: id,
          status: "pending", // Only update if still pending
        },
        {
          status: "accepted",
          assignedTo: operatorId,
          acceptedAt: new Date(),
        },
        { new: true }, // Return updated document
      );

      if (!req) {
        console.log(
          `❌ Failed to accept request ${id} - already taken or not found`,
        );
        return socket.emit("assist:accept", {
          success: false,
          msg: "Request already taken by another operator or not found",
        });
      }

      // Get operator details including location and full name/username
      const operator = await User.findById(operatorId)
        .select(
          "name avatar email phone username initial_lat initial_lng initial_address",
        )
        .lean();

      console.log(`✅ ASSISTANCE REQUEST ACCEPTED`);
      console.log(`   Request ID: ${id}`);
      console.log(`   Customer: ${req.customerName} (${String(req.userId)})`);
      console.log(
        `   Operator: ${operator?.name || "Unknown"} (${operatorId})`,
      );
      console.log(
        `   Vehicle: ${req.vehicle?.model || "N/A"} - ${req.vehicle?.plate || "N/A"}`,
      );
      console.log(`   Location: ${req.location?.address || "N/A"}`);
      console.log(`   Status changed: pending → accepted`);

      // Ensure DM with assist request context FIRST (before notifications)
      console.log(
        `🔗 Creating conversation between customer ${req.userId} and operator ${operatorId}`,
      );
      const conversation = await ensureDirectConversation(
        io,
        String(req.userId),
        operatorId,
      );

      console.log(`📡 Emitting assist:approved event to customer...`);

      // Notify requester (customer) with operator details
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (uid === String(req.userId)) {
          console.log(
            `📢 Notifying customer ${req.userId} about approved request`,
          );
          io.to(sid).emit("assist:approved", {
            success: true,
            data: {
              id,
              operatorName: operator?.name || "Operator",
              operatorId: operatorId,
              operatorAvatar: operator?.avatar || null,
              operator: {
                id: operatorId,
                name: operator?.name || operator?.username || "Operator",
                username: operator?.username || operator?.name || null,
                fullName: operator?.name || operator?.username || null,
                avatar: operator?.avatar || null,
                phone: operator?.phone || null,
                email: operator?.email || null,
                // Include operator location if available
                location:
                  operator?.initial_lat && operator?.initial_lng
                    ? {
                        lat: Number(operator.initial_lat),
                        lng: Number(operator.initial_lng),
                        address: operator.initial_address || null,
                      }
                    : null,
              },
              conversationId: conversation?._id?.toString() || null, // Include conversationId
              estimatedTimeWindow: "10:15 - 10:25 AM", // Default ETA
            },
          });
          console.log(
            `✅ assist:approved event sent to customer ${req.userId}`,
          );
        }
      }

      // CRITICAL: Notify ALL operators that this request was taken
      console.log(`📢 Broadcasting request removal to all operators`);
      io.to("operators").emit("assist:removed", {
        success: true,
        data: {
          id,
          takenBy: operatorId,
          customerId: req.userId,
          customerName: req.customerName,
          vehicle: req.vehicle,
          location: req.location,
        },
      });

      // Notify the accepting operator specifically
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (uid === String(operatorId)) {
          console.log(
            `📢 Notifying operator ${operatorId} about accepted request`,
          );
          io.to(sid).emit("assist:accepted", {
            success: true,
            data: { id, customerId: req.userId },
          });
        }
      }

      // Update conversation name to include assist request details
      if (conversation) {
        console.log(`✅ Conversation created: ${conversation._id}`);
        await Conversation.findByIdAndUpdate(conversation._id, {
          name: `Assistance Request - ${req.vehicle?.model || "Vehicle Repair"}`,
        });
        console.log(`📝 Conversation name updated for ${conversation._id}`);

        // Auto-send formatted request data to operator conversation
        await sendRequestDataToConversation(
          io,
          conversation._id,
          req,
          operatorId,
        );

        // Ensure both users are in the socket room for this conversation
        const conversationId = conversation._id.toString();
        for (const [sid, s] of io.sockets.sockets) {
          const uid = String((s.data as any)?.userId || "");
          if (uid === String(req.userId) || uid === String(operatorId)) {
            s.join(conversationId);
            console.log(
              `🔗 User ${uid} joined conversation room ${conversationId}`,
            );
          }
        }

        // Notify both users about the new conversation with the same conversation ID
        const conversationDoc = await Conversation.findById(
          conversation._id,
        ).lean();

        // Manually populate participants from both databases
        const populatedParticipants = conversationDoc
          ? await populateParticipantsFromBothDbs(
              conversationDoc.participants || [],
            )
          : [];
        const populatedConversation = conversationDoc
          ? {
              ...conversationDoc,
              participants: populatedParticipants,
            }
          : null;

        if (populatedConversation) {
          const conversationData = {
            ...populatedConversation,
            isNew: true,
            unreadCount: 0,
            conversationId: conversation._id, // Ensure conversationId is included
          };

          // Send to customer
          for (const [sid, s] of io.sockets.sockets) {
            const uid = String((s.data as any)?.userId || "");
            if (uid === String(req.userId)) {
              console.log(
                `📨 Sending conversation ${conversation._id} to customer ${uid}`,
              );
              io.to(sid).emit("newConversation", {
                success: true,
                data: conversationData,
              });
            }
          }

          // Send to operator
          for (const [sid, s] of io.sockets.sockets) {
            const uid = String((s.data as any)?.userId || "");
            if (uid === String(operatorId)) {
              console.log(
                `📨 Sending conversation ${conversation._id} to operator ${uid}`,
              );
              io.to(sid).emit("newConversation", {
                success: true,
                data: conversationData,
              });
            }
          }
        }
      } else {
        console.log(
          `❌ Failed to create conversation between ${req.userId} and ${operatorId}`,
        );
      }

      // 🔔 Send push notification to customer when request is accepted
      try {
        const tokens = await getPushTokensFromBothDbs([String(req.userId)]);
        if (tokens.length > 0) {
          const operatorName =
            operator?.name || operator?.username || "An operator";
          await sendPushToExpo(tokens, {
            title: "Request Accepted! 🎉",
            body: `${operatorName} has accepted your assistance request`,
            sound: "default",
            categoryId: "ASSIST_ACCEPTED",
            data: {
              type: "assist_accepted",
              assistRequestId: id,
              operatorName,
              operatorId: operatorId,
              conversationId: conversation?._id?.toString() || null,
            },
          });
          console.log(
            `📱 Push notification sent to customer ${req.userId} for accepted request`,
          );
        }
      } catch (pushError) {
        console.error(
          "Error sending push notification for accepted request:",
          pushError,
        );
      }

      socket.emit("assist:accept", { success: true, data: { id } });
    } catch (e) {
      console.error("assist:accept error:", e);
      socket.emit("assist:accept", { success: false, msg: "Failed to accept" });
    }
  });

  // Status pushes
  socket.on("assist:status", async (data: { id: string; status: string }) => {
    try {
      const id = String(data?.id || "");
      const status = String(data?.status || "");
      if (!["completed"].includes(status)) return;

      const operatorId = String((socket.data as any)?.userId || "");

      // Update status and set completedAt/completedBy if operator is completing
      const updateData: any = { status: "completed" };
      if (operatorId) {
        updateData.completedAt = new Date();
        updateData.completedBy = operatorId;
      }

      const req = await AssistRequest.findByIdAndUpdate(id, updateData, {
        new: true,
      }).lean();

      if (!req) {
        console.log(`❌ Failed to update request ${id} - not found`);
        return socket.emit("assist:status", {
          success: false,
          msg: "Request not found",
        });
      }

      console.log(`✅ ASSISTANCE REQUEST COMPLETED`);
      console.log(`   Request ID: ${id}`);
      console.log(`   Customer: ${req.customerName} (${String(req.userId)})`);
      console.log(`   Status changed to: completed`);

      // Get operator details for notification
      let operatorName = "Operator";
      if (operatorId) {
        try {
          const operator = await User.findById(operatorId)
            .select("name username")
            .lean();
          if (operator) {
            operatorName = operator.name || operator.username || "Operator";
          } else {
            // Try appdb
            const appdbConnection = getAppdbConnection();
            const AppdbUserSchema = new Schema(
              { username: String, name: String },
              { collection: "users", strict: false },
            );
            const AppdbUser =
              appdbConnection.models.User ||
              appdbConnection.model("User", AppdbUserSchema);
            const appdbOperator = (await AppdbUser.findById(operatorId)
              .select("username name")
              .lean()) as any;
            if (appdbOperator) {
              operatorName =
                appdbOperator.username || appdbOperator.name || "Operator";
            }
          }
        } catch (err) {
          console.error("Error fetching operator name:", err);
        }
      }

      // 🔔 Send push notification to customer when request is completed
      try {
        const tokens = await getPushTokensFromBothDbs([String(req.userId)]);
        if (tokens.length > 0) {
          await sendPushToExpo(tokens, {
            title: "Request Completed! ✅",
            body: `Your assistance request has been completed by ${operatorName}`,
            sound: "default",
            categoryId: "ASSIST_COMPLETED",
            data: {
              type: "assist_completed",
              assistRequestId: id,
              operatorName,
              operatorId: operatorId || null,
            },
          });
          console.log(
            `📱 Push notification sent to customer ${req.userId} for completed request`,
          );
        }
      } catch (pushError) {
        console.error(
          "Error sending push notification for completed request:",
          pushError,
        );
      }

      // Emit to customer via socket
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (uid === String(req.userId)) {
          io.to(sid).emit("assist:status", {
            success: true,
            data: {
              id,
              status,
              completedAt: (req as any).completedAt || new Date(),
              completedBy: (req as any).completedBy || operatorId || null,
            },
          });
        }
      }

      socket.emit("assist:status", { success: true, data: { id, status } });
    } catch (e) {
      console.error("assist:status error:", e);
      socket.emit("assist:status", {
        success: false,
        msg: "Failed to update status",
      });
    }
  });

  // Operator status updates (en route, arrived, etc.)
  socket.on(
    "operator:statusUpdate",
    async (data: {
      assistRequestId: string;
      status: "en_route" | "arrived" | "working" | "completed";
      estimatedTime?: string;
      location?: { lat: number; lng: number };
    }) => {
      try {
        const { assistRequestId, status, estimatedTime, location } = data;
        const operatorId = String((socket.data as any)?.userId || "");

        // Find the assist request and customer
        const assistRequest = await AssistRequest.findById(assistRequestId)
          .select("userId assignedTo")
          .lean();

        if (!assistRequest || String(assistRequest.assignedTo) !== operatorId) {
          return socket.emit("operator:statusUpdate", {
            success: false,
            msg: "Request not found or not assigned to you",
          });
        }

        // Get operator details
        const operator = await User.findById(operatorId)
          .select("name avatar")
          .lean();

        // Notify customer about operator status
        for (const [sid, s] of io.sockets.sockets) {
          const uid = String((s.data as any)?.userId || "");
          if (uid === String(assistRequest.userId)) {
            io.to(sid).emit("operator:statusUpdate", {
              success: true,
              data: {
                status,
                operatorName: operator?.name || "Operator",
                operatorId,
                estimatedTime,
                location,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        socket.emit("operator:statusUpdate", { success: true });
      } catch (e) {
        console.error("operator:statusUpdate error:", e);
        socket.emit("operator:statusUpdate", {
          success: false,
          msg: "Failed to update status",
        });
      }
    },
  );

  // 📍 Operator sends real-time location update
  socket.on(
    "operator:locationUpdate",
    async (data: {
      assistRequestId: string;
      lat: number;
      lng: number;
      address?: string;
    }) => {
      try {
        const { assistRequestId, lat, lng, address } = data;
        const operatorId = String((socket.data as any)?.userId || "");

        if (!assistRequestId || !lat || !lng) {
          return socket.emit("operator:locationUpdate", {
            success: false,
            msg: "Missing required fields",
          });
        }

        // Update operator location in database
        const request = await AssistRequest.findOneAndUpdate(
          { _id: assistRequestId, assignedTo: operatorId },
          {
            operatorCurrentLocation: {
              lat,
              lng,
              address: address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              timestamp: new Date(),
            },
            lastLocationUpdate: new Date(),
          },
          { new: true },
        )
          .select("userId operatorCurrentLocation")
          .lean();

        if (!request) {
          return socket.emit("operator:locationUpdate", {
            success: false,
            msg: "Request not found or not assigned to you",
          });
        }

        console.log(
          `📍 Operator ${operatorId} location updated for request ${assistRequestId}`,
        );

        // Broadcast to customer
        for (const [sid, s] of io.sockets.sockets) {
          const uid = String((s.data as any)?.userId || "");
          if (uid === String(request.userId)) {
            io.to(sid).emit("operator:locationChanged", {
              success: true,
              data: {
                assistRequestId,
                operatorLocation: request.operatorCurrentLocation,
              },
            });
            console.log(`📡 Location broadcasted to customer ${uid}`);
          }
        }

        socket.emit("operator:locationUpdate", { success: true });
      } catch (e) {
        console.error("operator:locationUpdate error:", e);
        socket.emit("operator:locationUpdate", {
          success: false,
          msg: "Failed to update location",
        });
      }
    },
  );

  // 📍 Customer sends real-time location update
  socket.on(
    "customer:locationUpdate",
    async (data: {
      assistRequestId: string;
      lat: number;
      lng: number;
      address?: string;
    }) => {
      try {
        const { assistRequestId, lat, lng, address } = data;
        const customerId = String((socket.data as any)?.userId || "");

        if (!assistRequestId || !lat || !lng) {
          return socket.emit("customer:locationUpdate", {
            success: false,
            msg: "Missing required fields",
          });
        }

        // Update customer location in database
        const request = await AssistRequest.findOneAndUpdate(
          { _id: assistRequestId, userId: customerId },
          {
            customerCurrentLocation: {
              lat,
              lng,
              address: address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              timestamp: new Date(),
            },
            lastLocationUpdate: new Date(),
          },
          { new: true },
        )
          .select("assignedTo customerCurrentLocation")
          .lean();

        if (!request) {
          return socket.emit("customer:locationUpdate", {
            success: false,
            msg: "Request not found",
          });
        }

        console.log(
          `📍 Customer ${customerId} location updated for request ${assistRequestId}`,
        );

        // Broadcast to operator (if assigned)
        if (request.assignedTo) {
          for (const [sid, s] of io.sockets.sockets) {
            const uid = String((s.data as any)?.userId || "");
            if (uid === String(request.assignedTo)) {
              io.to(sid).emit("customer:locationChanged", {
                success: true,
                data: {
                  assistRequestId,
                  customerLocation: request.customerCurrentLocation,
                },
              });
              console.log(`📡 Location broadcasted to operator ${uid}`);
            }
          }
        }

        socket.emit("customer:locationUpdate", { success: true });
      } catch (e) {
        console.error("customer:locationUpdate error:", e);
        socket.emit("customer:locationUpdate", {
          success: false,
          msg: "Failed to update location",
        });
      }
    },
  );

  // ⭐ Handle rating submission
  socket.on(
    "rating:submit",
    async (data: {
      assistRequestId: string;
      rating: number;
      comment?: string;
    }) => {
      try {
        const { assistRequestId, rating, comment } = data;
        const customerId = String((socket.data as any)?.userId || "");

        if (!assistRequestId || !rating || rating < 1 || rating > 5) {
          return socket.emit("rating:submit", {
            success: false,
            msg: "Invalid rating data",
          });
        }

        // Find the assist request
        const request = await AssistRequest.findOne({
          _id: assistRequestId,
          userId: customerId,
        })
          .populate("assignedTo", "name avatar")
          .lean();

        if (!request) {
          return socket.emit("rating:submit", {
            success: false,
            msg: "Request not found",
          });
        }

        if (request.status !== "completed") {
          return socket.emit("rating:submit", {
            success: false,
            msg: "Request must be completed before rating",
          });
        }

        if (!request.assignedTo) {
          return socket.emit("rating:submit", {
            success: false,
            msg: "No operator assigned to this request",
          });
        }

        // Check if already rated
        const existingRating = await Rating.findOne({ assistRequestId });
        if (existingRating) {
          return socket.emit("rating:submit", {
            success: false,
            msg: "Request already rated",
          });
        }

        // Create rating
        const newRating = await Rating.create({
          assistRequestId,
          customerId,
          operatorId: request.assignedTo._id,
          rating,
          comment: comment || undefined,
        });

        console.log(
          `⭐ Rating submitted: ${rating} stars for operator ${request.assignedTo._id}`,
        );

        // Notify operator about the rating
        for (const [sid, s] of io.sockets.sockets) {
          const uid = String((s.data as any)?.userId || "");
          if (uid === String(request.assignedTo._id)) {
            io.to(sid).emit("rating:received", {
              success: true,
              data: {
                assistRequestId,
                rating: newRating.rating,
                comment: newRating.comment,
                customerId,
                customerName: request.customerName,
                createdAt: newRating.createdAt,
              },
            });
            console.log(`📡 Rating notification sent to operator ${uid}`);
          }
        }

        socket.emit("rating:submit", {
          success: true,
          data: {
            rating: newRating.rating,
            comment: newRating.comment,
            operatorName: (request.assignedTo as any).name,
          },
        });
      } catch (e) {
        console.error("rating:submit error:", e);
        socket.emit("rating:submit", {
          success: false,
          msg: "Failed to submit rating",
        });
      }
    },
  );
}

/**
 * Auto-send formatted request data to operator conversation
 */
async function sendRequestDataToConversation(
  io: SocketIOServer,
  conversationId: any,
  assistRequest: any,
  operatorId: string,
) {
  try {
    console.log(
      `📤 Auto-sending request data to conversation ${conversationId}`,
    );

    // Format the request data for display
    const requestData = {
      location: assistRequest.location?.address || "Location not specified",
      vehicleType: assistRequest.vehicle?.model || "Vehicle not specified",
      plateNumber: assistRequest.vehicle?.plate || "Plate not specified",
      otherInfos: assistRequest.vehicle?.notes || "No additional information",
      customerName: assistRequest.customerName || "Customer",
      requestDate: new Date(assistRequest.createdAt).toLocaleString(),
    };

    // Create formatted message content
    const messageContent = `Location: ${requestData.location}
Vehicle Type: ${requestData.vehicleType}
Plate Number: ${requestData.plateNumber}
Other infos: ${requestData.otherInfos}`;

    // Create the message in database - OPERATOR sends the first message
    const message = await Message.create({
      conversationId: conversationId,
      senderId: operatorId, // OPERATOR as sender (not customer)
      content: messageContent,
      type: "text",
      isSystemMessage: true, // Mark as system message
      metadata: {
        requestData: requestData,
        assistRequestId: assistRequest._id,
        isAutoGenerated: true,
      },
    });

    console.log(`✅ Auto-generated message created: ${message._id}`);

    // Broadcast the message to conversation participants
    const populatedMessage = await Message.findById(message._id)
      .populate("senderId", "name avatar email")
      .lean();

    if (populatedMessage) {
      // Send to all participants in the conversation
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (
          uid === String(assistRequest.userId) ||
          uid === String(operatorId)
        ) {
          console.log(`📨 Sending auto-generated message to user ${uid}`);
          io.to(sid).emit("newMessage", {
            success: true,
            data: {
              ...populatedMessage,
              conversationId: conversationId,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("❌ Error sending request data to conversation:", error);
  }
}

/**
 * 🔄 SERVER AUTO-REFRESH (0.5 seconds)
 * Periodically broadcasts database state to all connected clients
 * Ensures clients stay synchronized even if they miss socket events
 */
let autoRefreshInterval: NodeJS.Timeout | null = null;
let lastRequestsSnapshot: string = "";
let lastUserRequestsSnapshot: Map<string, string> = new Map();

export function startAutoRefresh(io: SocketIOServer) {
  // Prevent duplicate intervals
  if (autoRefreshInterval) {
    console.log("⚠️ Auto-refresh already running");
    return;
  }

  console.log("🔄 Starting server auto-refresh (0.5s interval)");

  autoRefreshInterval = setInterval(async () => {
    try {
      // 1️⃣ Broadcast pending requests to operators
      const pendingRequests = await AssistRequest.find({ status: "pending" })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate({ path: "userId", select: "name avatar email" })
        .lean();

      // Check if pending requests changed
      const currentSnapshot = JSON.stringify(
        pendingRequests.map((r) => ({
          id: String(r._id),
          status: r.status,
          updatedAt: r.updatedAt,
        })),
      );

      if (currentSnapshot !== lastRequestsSnapshot) {
        lastRequestsSnapshot = currentSnapshot;

        // Only broadcast to operators room if there are changes
        const formattedRequests = pendingRequests.map((req) => ({
          id: String(req._id),
          status: req.status,
          customerName:
            req.customerName || (req as any).userId?.name || "Customer",
          customerEmail: req.customerEmail || (req as any).userId?.email || "",
          customerPhone: req.customerPhone || "",
          vehicle: req.vehicle,
          location: req.location,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
        }));

        io.to("operators").emit("assist:refresh", {
          success: true,
          data: formattedRequests,
          timestamp: new Date().toISOString(),
        });
      }

      // 2️⃣ Broadcast status updates to individual customers
      // Removed the 5s filter to ensure we catch manual DB edits that don't update timestamps correctly
      const allRequests = await AssistRequest.find({
        status: { $in: ["accepted", "completed", "canceled"] },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Only last 24h
      })
        .populate({ path: "assignedTo", select: "name avatar email" })
        .lean();

      for (const req of allRequests) {
        const userId = String(req.userId);
        const requestSnapshot = JSON.stringify({
          id: String(req._id),
          status: req.status,
          assignedTo: req.assignedTo,
        });

        const lastSnapshot = lastUserRequestsSnapshot.get(
          `${userId}_${req._id}`,
        );

        if (requestSnapshot !== lastSnapshot) {
          lastUserRequestsSnapshot.set(`${userId}_${req._id}`, requestSnapshot);

          console.log(
            `📡 Auto-refresh: Status change detected for user ${userId} request ${req._id}: ${req.status}`,
          );

          const payload = {
            success: true,
            data: {
              id: String(req._id),
              status: req.status,
              operator: req.assignedTo
                ? {
                    id: String((req.assignedTo as any)._id || req.assignedTo),
                    name: (req.assignedTo as any)?.name || "Operator",
                    avatar: (req.assignedTo as any)?.avatar || null,
                  }
                : null,
              updatedAt: req.updatedAt,
              timestamp: new Date().toISOString(),
            },
          };

          // Emit clear events based on status
          if (req.status === "accepted") {
            io.to(userId).emit("assist:approved", payload);
          }

          io.to(userId).emit("assist:statusUpdate", payload);
          io.to(userId).emit("assist:status", payload);
        }
      }

      // Cleanup old snapshots (prevent memory leak)
      if (lastUserRequestsSnapshot.size > 1000) {
        const entries = Array.from(lastUserRequestsSnapshot.entries());
        lastUserRequestsSnapshot = new Map(entries.slice(-500)); // Keep last 500
      }
    } catch (error) {
      console.error("❌ Auto-refresh error:", error);
    }
  }, 500); // 0.5 seconds

  console.log("✅ Server auto-refresh started");
}

/**
 * Stop auto-refresh (cleanup on server shutdown)
 */
export function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    lastRequestsSnapshot = "";
    lastUserRequestsSnapshot.clear();
    console.log("🛑 Server auto-refresh stopped");
  }
}
