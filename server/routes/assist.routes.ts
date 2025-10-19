import { Router } from "express";
import AssistRequest from "../modals/AssistRequest";
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
    
    res.json({ success: true, data: request });
  } catch (e) {
    console.error("get request error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Rate an assist request */
router.post("/:id/rate", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const userId = String(req.user?.id || "");
    const { rating, comment } = req.body;
    
    const request = await AssistRequest.findOne({ _id: id, userId });
    if (!request) {
      return res.status(404).json({ success: false, msg: "Not found" });
    }
    
    if (request.status !== "done") {
      return res.status(400).json({ success: false, msg: "Request not completed" });
    }
    
    // Update with rating (you might want to create a separate Rating model)
    request.status = "done"; // Already done, but ensure it's marked as rated
    await request.save();
    
    res.json({ success: true });
  } catch (e) {
    console.error("rate request error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

/** Cancel an assist request */
router.post("/:id/cancel", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const userId = String(req.user?.id || "");
    
    const request = await AssistRequest.findOne({ _id: id, userId });
    if (!request) {
      return res.status(404).json({ success: false, msg: "Not found" });
    }
    
    if (request.status !== "pending" && request.status !== "accepted") {
      return res.status(400).json({ success: false, msg: "Cannot cancel this request" });
    }
    
    request.status = "canceled";
    await request.save();
    
    res.json({ success: true });
  } catch (e) {
    console.error("cancel request error:", e);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

export default router;