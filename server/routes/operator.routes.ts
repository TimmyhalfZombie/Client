import { Router } from "express";
import { auth } from "../middleware/auth";
import { getAppdbConnection } from "../config/db";
import { Schema } from "mongoose";

const router = Router();

/** Get appdb user by ID (for operators) */
router.get("/app/users/:id", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) {
      return res.status(400).json({ success: false, msg: "User ID is required" });
    }

    // Fetch from appdb
    const appdbConnection = getAppdbConnection();
    const AppdbUserSchema = new Schema(
      { 
        username: String, 
        name: String, 
        email: String, 
        avatar: String, 
        phone: String,
        initial_lat: Number,
        initial_lng: Number,
        initial_address: String,
      },
      { collection: "users", strict: false }
    );
    const AppdbUser =
      appdbConnection.models.User || appdbConnection.model("User", AppdbUserSchema);

    const appdbUser: any = await AppdbUser.findById(id)
      .select("username name avatar email phone initial_lat initial_lng initial_address _id")
      .lean();

    if (!appdbUser) {
      return res.status(404).json({ success: false, msg: "User not found in appdb" });
    }

    res.json({
      success: true,
      data: {
        _id: appdbUser._id,
        username: appdbUser.username || "",
        name: appdbUser.name || appdbUser.username || "",
        email: appdbUser.email || "",
        avatar: appdbUser.avatar || "",
        phone: appdbUser.phone || "",
        initial_lat: appdbUser.initial_lat || null,
        initial_lng: appdbUser.initial_lng || null,
        initial_address: appdbUser.initial_address || "",
      },
    });
  } catch (error) {
    console.error("Error fetching appdb user:", error);
    res.status(500).json({ success: false, msg: "Server Error" });
  }
});

export default router;
