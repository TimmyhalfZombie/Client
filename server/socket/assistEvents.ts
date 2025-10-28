import { Server as SocketIOServer, Socket } from "socket.io";
import AssistRequest from "../modals/AssistRequest";
import Conversation from "../modals/Conversation";
import ConversationMeta from "../modals/ConversationMeta";
import User from "../modals/User";
import Message from "../modals/Message";
import Rating from "../modals/Rating";

/** Helpers */
async function ensureDirectConversation(io: SocketIOServer, a: string, b: string) {
  let convo = await Conversation.findOne({
    type: "direct",
    participants: { $all: [a, b], $size: 2 },
  })
    .populate({ path: "participants", select: "name avatar email" })
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
          { upsert: true, new: true }
        )
      )
    );

    // join sockets to room
    for (const [sid, s] of io.sockets.sockets) {
      const uid = String((s.data as any)?.userId || "");
      if (uid === String(a) || uid === String(b)) s.join(created._id.toString());
    }

    convo = await Conversation.findById(created._id)
      .populate({ path: "participants", select: "name avatar email" })
      .populate({
        path: "lastMessage",
        select: "content senderId attachment createdAt conversationId",
      })
      .lean();

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
  socket.on("assistRequest", async (data: any) => {
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
        phone: user?.phone
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
        status: doc.status
      });

      // Acknowledge back to the requester
      socket.emit("assistRequest", {
        success: true,
        data: { id: String(doc._id) },
      });

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
      socket.emit("assistRequest", {
        success: false,
        msg: "Failed to dispatch request",
      });
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
          status: "pending" // Only update if still pending
        },
        { 
          status: "accepted",
          assignedTo: operatorId,
          acceptedAt: new Date()
        },
        { new: true } // Return updated document
      );

      if (!req) {
        return socket.emit("assist:accept", {
          success: false,
          msg: "Request already taken by another operator or not found",
        });
      }

      console.log(`✅ Request ${id} accepted by operator ${operatorId}`);

      // Get operator details for customer notification
      const operator = await User.findById(operatorId)
        .select("name avatar email")
        .lean();

      // Notify requester (customer) with operator details
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (uid === String(req.userId)) {
          console.log(`📢 Notifying customer ${req.userId} about approved request`);
          io.to(sid).emit("assist:approved", {
            success: true,
            data: { 
              id,
              operatorName: operator?.name || "Operator",
              operatorId: operatorId,
              operatorAvatar: operator?.avatar || null,
              operator: {
                id: operatorId,
                name: operator?.name || "Operator",
                avatar: operator?.avatar || null,
                phone: operator?.phone || null
              },
              estimatedTimeWindow: "10:15 - 10:25 AM" // Default ETA
            },
          });
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
          location: req.location
        },
      });

      // Notify the accepting operator specifically
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (uid === String(operatorId)) {
          console.log(`📢 Notifying operator ${operatorId} about accepted request`);
          io.to(sid).emit("assist:accepted", {
            success: true,
            data: { id, customerId: req.userId },
          });
        }
      }

      // Ensure DM with assist request context
      console.log(`🔗 Creating conversation between customer ${req.userId} and operator ${operatorId}`);
      const conversation = await ensureDirectConversation(io, String(req.userId), operatorId);
      
      // Update conversation name to include assist request details
      if (conversation) {
        console.log(`✅ Conversation created: ${conversation._id}`);
        await Conversation.findByIdAndUpdate(conversation._id, {
          name: `Assistance Request - ${req.vehicle?.model || 'Vehicle Repair'}`,
        });
        console.log(`📝 Conversation name updated for ${conversation._id}`);
        
        // Auto-send formatted request data to operator conversation
        await sendRequestDataToConversation(io, conversation._id, req, operatorId);
        
        // Ensure both users are in the socket room for this conversation
        const conversationId = conversation._id.toString();
        for (const [sid, s] of io.sockets.sockets) {
          const uid = String((s.data as any)?.userId || "");
          if (uid === String(req.userId) || uid === String(operatorId)) {
            s.join(conversationId);
            console.log(`🔗 User ${uid} joined conversation room ${conversationId}`);
          }
        }
        
        // Notify both users about the new conversation with the same conversation ID
        const populatedConversation = await Conversation.findById(conversation._id)
          .populate({ path: "participants", select: "name avatar email" })
          .lean();
          
        if (populatedConversation) {
          const conversationData = { 
            ...populatedConversation, 
            isNew: true, 
            unreadCount: 0,
            conversationId: conversation._id // Ensure conversationId is included
          };
          
          // Send to customer
          for (const [sid, s] of io.sockets.sockets) {
            const uid = String((s.data as any)?.userId || "");
            if (uid === String(req.userId)) {
              console.log(`📨 Sending conversation ${conversation._id} to customer ${uid}`);
              io.to(sid).emit("newConversation", { 
                success: true, 
                data: conversationData
              });
            }
          }
          
          // Send to operator
          for (const [sid, s] of io.sockets.sockets) {
            const uid = String((s.data as any)?.userId || "");
            if (uid === String(operatorId)) {
              console.log(`📨 Sending conversation ${conversation._id} to operator ${uid}`);
              io.to(sid).emit("newConversation", { 
                success: true, 
                data: conversationData
              });
            }
          }
        }
      } else {
        console.log(`❌ Failed to create conversation between ${req.userId} and ${operatorId}`);
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
      if (!["completed", "cancelled", "rejected", "done"].includes(status)) return;

      const req = await AssistRequest.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      ).lean();
      if (!req) return;

      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (uid === String(req.userId)) {
          io.to(sid).emit("assist:status", { success: true, data: { id, status } });
        }
      }
    } catch (e) {
      console.error("assist:status error:", e);
    }
  });

  // Operator status updates (en route, arrived, etc.)
  socket.on("operator:statusUpdate", async (data: {
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
          msg: "Request not found or not assigned to you"
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
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      socket.emit("operator:statusUpdate", { success: true });
    } catch (e) {
      console.error("operator:statusUpdate error:", e);
      socket.emit("operator:statusUpdate", { success: false, msg: "Failed to update status" });
    }
  });

  // 📍 Operator sends real-time location update
  socket.on("operator:locationUpdate", async (data: {
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
          msg: "Missing required fields"
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
            timestamp: new Date()
          },
          lastLocationUpdate: new Date()
        },
        { new: true }
      ).select("userId operatorCurrentLocation").lean();

      if (!request) {
        return socket.emit("operator:locationUpdate", {
          success: false,
          msg: "Request not found or not assigned to you"
        });
      }

      console.log(`📍 Operator ${operatorId} location updated for request ${assistRequestId}`);

      // Broadcast to customer
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (uid === String(request.userId)) {
          io.to(sid).emit("operator:locationChanged", {
            success: true,
            data: {
              assistRequestId,
              operatorLocation: request.operatorCurrentLocation,
            }
          });
          console.log(`📡 Location broadcasted to customer ${uid}`);
        }
      }

      socket.emit("operator:locationUpdate", { success: true });
    } catch (e) {
      console.error("operator:locationUpdate error:", e);
      socket.emit("operator:locationUpdate", { success: false, msg: "Failed to update location" });
    }
  });

  // 📍 Customer sends real-time location update
  socket.on("customer:locationUpdate", async (data: {
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
          msg: "Missing required fields"
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
            timestamp: new Date()
          },
          lastLocationUpdate: new Date()
        },
        { new: true }
      ).select("assignedTo customerCurrentLocation").lean();

      if (!request) {
        return socket.emit("customer:locationUpdate", {
          success: false,
          msg: "Request not found"
        });
      }

      console.log(`📍 Customer ${customerId} location updated for request ${assistRequestId}`);

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
              }
            });
            console.log(`📡 Location broadcasted to operator ${uid}`);
          }
        }
      }

      socket.emit("customer:locationUpdate", { success: true });
    } catch (e) {
      console.error("customer:locationUpdate error:", e);
      socket.emit("customer:locationUpdate", { success: false, msg: "Failed to update location" });
    }
  });

  // ⭐ Handle rating submission
  socket.on("rating:submit", async (data: {
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
          msg: "Invalid rating data"
        });
      }

      // Find the assist request
      const request = await AssistRequest.findOne({ 
        _id: assistRequestId, 
        userId: customerId 
      }).populate("assignedTo", "name avatar").lean();

      if (!request) {
        return socket.emit("rating:submit", {
          success: false,
          msg: "Request not found"
        });
      }

      if (request.status !== "done" && request.status !== "completed") {
        return socket.emit("rating:submit", {
          success: false,
          msg: "Request must be completed before rating"
        });
      }

      if (!request.assignedTo) {
        return socket.emit("rating:submit", {
          success: false,
          msg: "No operator assigned to this request"
        });
      }

      // Check if already rated
      const existingRating = await Rating.findOne({ assistRequestId });
      if (existingRating) {
        return socket.emit("rating:submit", {
          success: false,
          msg: "Request already rated"
        });
      }

      // Create rating
      const newRating = await Rating.create({
        assistRequestId,
        customerId,
        operatorId: request.assignedTo._id,
        rating,
        comment: comment || undefined
      });

      console.log(`⭐ Rating submitted: ${rating} stars for operator ${request.assignedTo._id}`);

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
              createdAt: newRating.createdAt
            }
          });
          console.log(`📡 Rating notification sent to operator ${uid}`);
        }
      }

      socket.emit("rating:submit", { 
        success: true, 
        data: {
          rating: newRating.rating,
          comment: newRating.comment,
          operatorName: (request.assignedTo as any).name
        }
      });
    } catch (e) {
      console.error("rating:submit error:", e);
      socket.emit("rating:submit", { success: false, msg: "Failed to submit rating" });
    }
  });
}

/**
 * Auto-send formatted request data to operator conversation
 */
async function sendRequestDataToConversation(
  io: SocketIOServer, 
  conversationId: any, 
  assistRequest: any, 
  operatorId: string
) {
  try {
    console.log(`📤 Auto-sending request data to conversation ${conversationId}`);
    
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
        isAutoGenerated: true
      }
    });

    console.log(`✅ Auto-generated message created: ${message._id}`);

    // Broadcast the message to conversation participants
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name avatar email')
      .lean();

    if (populatedMessage) {
      // Send to all participants in the conversation
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (uid === String(assistRequest.userId) || uid === String(operatorId)) {
          console.log(`📨 Sending auto-generated message to user ${uid}`);
          io.to(sid).emit("newMessage", {
            success: true,
            data: {
              ...populatedMessage,
              conversationId: conversationId
            }
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
      const currentSnapshot = JSON.stringify(pendingRequests.map(r => ({
        id: String(r._id),
        status: r.status,
        updatedAt: r.updatedAt
      })));

      if (currentSnapshot !== lastRequestsSnapshot) {
        lastRequestsSnapshot = currentSnapshot;
        
        // Only broadcast to operators room if there are changes
        const formattedRequests = pendingRequests.map((req) => ({
          id: String(req._id),
          status: req.status,
          customerName: req.customerName || (req as any).userId?.name || "Customer",
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
      const allRequests = await AssistRequest.find({
        status: { $in: ["pending", "accepted", "completed", "canceled"] },
        updatedAt: { $gte: new Date(Date.now() - 5000) }, // Only recent updates (last 5 seconds)
      })
        .populate({ path: "assignedTo", select: "name avatar email" })
        .lean();

      for (const req of allRequests) {
        const userId = String(req.userId);
        const requestSnapshot = JSON.stringify({
          id: String(req._id),
          status: req.status,
          assignedTo: req.assignedTo,
          updatedAt: req.updatedAt,
        });

        const lastSnapshot = lastUserRequestsSnapshot.get(`${userId}_${req._id}`);

        if (requestSnapshot !== lastSnapshot) {
          lastUserRequestsSnapshot.set(`${userId}_${req._id}`, requestSnapshot);

          // Find customer's socket and send update
          for (const [sid, s] of io.sockets.sockets) {
            const uid = String((s.data as any)?.userId || "");
            if (uid === userId) {
              io.to(sid).emit("assist:statusUpdate", {
                success: true,
                data: {
                  id: String(req._id),
                  status: req.status,
                  assignedTo: req.assignedTo ? {
                    id: String((req.assignedTo as any)._id || req.assignedTo),
                    name: (req.assignedTo as any)?.name || "Operator",
                    avatar: (req.assignedTo as any)?.avatar || null,
                  } : null,
                  updatedAt: req.updatedAt,
                  timestamp: new Date().toISOString(),
                },
              });
            }
          }
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