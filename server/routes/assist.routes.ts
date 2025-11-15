import { Router } from "express";
import AssistRequest from "../modals/AssistRequest";
import Rating from "../modals/Rating";
import { auth } from "../middleware/auth";
import Conversation from "../modals/Conversation";
import ConversationMeta from "../modals/ConversationMeta";

const router = Router();

/** List pending requests (for operator dashboard) */
router.get("/pending", auth, async (_req, res) => {
  const list = await AssistRequest.find({ status: "pending" })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({ path: "userId", select: "name avatar email" })
    .lean();
  res.json({ success: true, data: list });
});

/** Accept a request (HTTP alt to the socket) */
router.post("/:id/accept", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const operatorId = String(req.user?.id || "");
    const doc = await AssistRequest.findById(id);
    if (!doc) return res.status(404).json({ success: false, msg: "Not found" });
    if (doc.status !== "pending")
      return res.status(400).json({ success: false, msg: "Already processed" });

    doc.status = "accepted";
    doc.assignedTo = operatorId as any;
    await doc.save();

    // Ensure ConversationMeta rows exist
    const existing = await Conversation.findOne({
      type: "direct",
      participants: { $all: [doc.userId, operatorId], $size: 2 },
    }).lean();

    if (!existing) {
      const created = await Conversation.create({
        type: "direct",
        participants: [doc.userId, operatorId],
        createdBy: operatorId,
      });
      await Promise.all(
        [doc.userId, operatorId].map((uid) =>
          ConversationMeta.findOneAndUpdate(
            { conversationId: created._id, userId: uid },
            { $setOnInsert: { unreadCount: 0 } },
            { upsert: true, new: true }
          )
        )
      );
    }

    res.json({ success: true });
  } catch (e) {
    console.error("accept route error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Get user's assist requests */
router.get("/user-requests", auth, async (req, res) => {
  try {
    const userId = String(req.user?.id || "");
    const requests = await AssistRequest.find({ userId })
      .sort({ createdAt: -1 })
      .populate({ path: "assignedTo", select: "name avatar email" })
      .lean();
    
    res.json({ success: true, data: requests });
  } catch (e) {
    console.error("user-requests error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Get specific assist request */
router.get("/:id", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const userId = String(req.user?.id || "");
    
    const request = await AssistRequest.findOne({ _id: id, userId })
      .populate({ path: "assignedTo", select: "name avatar email" })
      .lean();
    
    if (!request) {
      return res.status(404).json({ success: false, msg: "Not found" });
    }
    
    // acceptedBy should be included by default, but ensure it's in the response
    res.json({ success: true, data: request });
  } catch (e) {
    console.error("get request error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Debug endpoint to check assist request status */
router.get("/:id/debug", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const userId = String(req.user?.id || "");
    
    const request = await AssistRequest.findOne({ _id: id, userId })
      .populate("assignedTo", "name avatar")
      .lean();
    
    if (!request) {
      return res.status(404).json({ success: false, msg: "Request not found" });
    }
    
    // Check if already rated
    const existingRating = await Rating.findOne({ assistRequestId: id });
    
    res.json({ 
      success: true, 
      data: {
        id: request._id,
        status: request.status,
        assignedTo: request.assignedTo,
        customerId: request.userId,
        alreadyRated: !!existingRating,
        canRate: request.status === "completed" && !!request.assignedTo && !existingRating,
        existingRating: existingRating ? {
          rating: existingRating.rating,
          comment: existingRating.comment,
          createdAt: existingRating.createdAt
        } : null
      }
    });
  } catch (e) {
    console.error("debug request error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Rate an assist request */
router.post("/:id/rate", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const userId = String(req.user?.id || "");
    const { rating, comment } = req.body;
    
    console.log(`⭐ Rating attempt - ID: ${id}, User: ${userId}, Rating: ${rating}, Comment: ${comment}`);
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      console.log(`❌ Invalid rating: ${rating}`);
      return res.status(400).json({ 
        success: false, 
        msg: "Rating must be between 1 and 5" 
      });
    }
    
    const request = await AssistRequest.findOne({ _id: id, userId }).lean();
    
    if (!request) {
      console.log(`❌ Request not found: ${id}`);
      return res.status(404).json({ success: false, msg: "Request not found" });
    }
    
    console.log(`📋 Request found - Status: ${request.status}`);
    console.log(`📋 acceptedBy: ${(request as any).acceptedBy}, completedBy: ${(request as any).completedBy}, assignedTo: ${(request as any).assignedTo}`);
    
    if (request.status !== "completed") {
      console.log(`❌ Request not completed - Status: ${request.status}`);
      return res.status(400).json({ 
        success: false, 
        msg: `Request must be completed before rating. Current status: ${request.status}` 
      });
    }
    
    // Get operatorId from acceptedBy, completedBy, or assignedTo (in that order of priority)
    const operatorId = (request as any).completedBy || (request as any).acceptedBy || (request as any).assignedTo;
    
    if (!operatorId) {
      console.log(`❌ No operator found - acceptedBy: ${(request as any).acceptedBy}, completedBy: ${(request as any).completedBy}, assignedTo: ${(request as any).assignedTo}`);
      return res.status(400).json({ 
        success: false, 
        msg: "No operator found for this request" 
      });
    }
    
    // Convert to string for consistency and ensure they're valid ObjectIds
    const operatorIdStr = typeof operatorId === "string" ? operatorId : String(operatorId._id || operatorId);
    const customerIdStr = userId; // userId is already a string from req.user?.id
    const assistRequestIdStr = id;
    
    // Validate ObjectIds format (24 hex characters)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(customerIdStr)) {
      console.error(`❌ Invalid customerId format: ${customerIdStr}`);
      return res.status(400).json({ success: false, msg: "Invalid customer ID format" });
    }
    if (!objectIdRegex.test(operatorIdStr)) {
      console.error(`❌ Invalid operatorId format: ${operatorIdStr}`);
      return res.status(400).json({ success: false, msg: "Invalid operator ID format" });
    }
    if (!objectIdRegex.test(assistRequestIdStr)) {
      console.error(`❌ Invalid assistRequestId format: ${assistRequestIdStr}`);
      return res.status(400).json({ success: false, msg: "Invalid request ID format" });
    }
    
    console.log(`✅ Validated IDs - Customer: ${customerIdStr}, Operator: ${operatorIdStr}, Request: ${assistRequestIdStr}`);
    
    // Check if already rated
    const existingRating = await Rating.findOne({ assistRequestId: assistRequestIdStr });
    if (existingRating) {
      console.log(`❌ Already rated - Rating ID: ${existingRating._id}, Rating: ${existingRating.rating}`);
      return res.status(400).json({ 
        success: false, 
        msg: "Request already rated" 
      });
    }
    
    console.log(`✅ Creating rating for operator: ${operatorIdStr}`);
    
    // Create rating with explicit ObjectIds (Mongoose will convert strings to ObjectIds)
    const newRating = await Rating.create({
      assistRequestId: assistRequestIdStr, // ObjectId from customer.assistrequests
      customerId: customerIdStr,           // ObjectId from customer.users
      operatorId: operatorIdStr,           // ObjectId from appdb.users
      rating: Number(rating),              // Ensure it's a number
      comment: comment ? String(comment).trim() : undefined
    });
    
    console.log(`✅ Rating created successfully:`);
    console.log(`   - Rating ID: ${newRating._id}`);
    console.log(`   - AssistRequest ID: ${newRating.assistRequestId}`);
    console.log(`   - Customer ID: ${newRating.customerId}`);
    console.log(`   - Operator ID: ${newRating.operatorId}`);
    console.log(`   - Rating: ${newRating.rating}`);
    console.log(`   - Comment: ${newRating.comment || "none"}`);
    
    res.json({ 
      success: true, 
      data: {
        _id: newRating._id,
        assistRequestId: newRating.assistRequestId,
        customerId: newRating.customerId,
        operatorId: newRating.operatorId,
        rating: newRating.rating,
        comment: newRating.comment,
        createdAt: newRating.createdAt,
        updatedAt: newRating.updatedAt
      }
    });
  } catch (e) {
    console.error("❌ Rate request error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Update assist request status to completed (for testing) */
router.post("/:id/mark-completed", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const userId = String(req.user?.id || "");
    
    const request = await AssistRequest.findOneAndUpdate(
      { _id: id, userId },
      { status: "completed" },
      { new: true }
    );
    
    if (!request) {
      return res.status(404).json({ success: false, msg: "Request not found" });
    }
    
    console.log(`✅ Request ${id} marked as completed`);
    res.json({ success: true, data: { status: request.status } });
  } catch (e) {
    console.error("mark-completed error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Test endpoint to check Rating collection */
router.get("/test-ratings", auth, async (req, res) => {
  try {
    const ratings = await Rating.find().limit(5).lean();
    res.json({ 
      success: true, 
      data: {
        totalRatings: await Rating.countDocuments(),
        recentRatings: ratings
      }
    });
  } catch (e) {
    console.error("test-ratings error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Get operator ratings */
router.get("/operator/:operatorId/ratings", auth, async (req, res) => {
  try {
    const operatorId = String(req.params.operatorId || "");
    
    const ratings = await Rating.find({ operatorId })
      .populate("customerId", "name avatar")
      .populate("assistRequestId", "vehicle location")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    // Calculate average rating
    const avgRating = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
      : 0;
    
    res.json({ 
      success: true, 
      data: {
        ratings,
        averageRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
        totalRatings: ratings.length
      }
    });
  } catch (e) {
    console.error("get operator ratings error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Cancel an assist request - deletes the request instead of changing status */
router.post("/:id/cancel", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const userId = String(req.user?.id || "");
    
    const request = await AssistRequest.findOne({ _id: id, userId });
    if (!request) {
      return res.status(404).json({ success: false, msg: "Not found" });
    }
    
    if (request.status !== "pending" && request.status !== "accepted") {
      return res.status(400).json({ success: false, msg: "Cannot cancel a completed request" });
    }
    
    // Delete the request instead of changing status
    await AssistRequest.findByIdAndDelete(id);
    
    res.json({ success: true });
  } catch (e) {
    console.error("cancel request error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

export default router;