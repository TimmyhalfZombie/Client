import { Server as SocketIOServer, Socket } from "socket.io";
import AssistRequest from "../modals/AssistRequest";
import Conversation from "../modals/Conversation";
import ConversationMeta from "../modals/ConversationMeta";
import User from "../modals/User";
import Message from "../modals/Message";

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

      // Notify requester (customer)
      for (const [sid, s] of io.sockets.sockets) {
        const uid = String((s.data as any)?.userId || "");
        if (uid === String(req.userId)) {
          console.log(`📢 Notifying customer ${req.userId} about approved request`);
          io.to(sid).emit("assist:approved", {
            success: true,
            data: { id },
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

    // Create the message in database
    const message = await Message.create({
      conversationId: conversationId,
      senderId: assistRequest.userId, // Customer as sender
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
