import { Socket, Server as SocketIOServer } from "socket.io";
import User from "../modals/User";
import { generateToken } from "../utils/token";
import { getAppdbConnection } from "../config/db";
import { Schema } from "mongoose";

export function registerUserEvents(io: SocketIOServer, socket: Socket) {
  socket.on("testSocket", () => {
    socket.emit("testSocket", { msg: "realtime updates!" });
  });

  socket.on(
    "updateProfile",
    async (data: { name?: string; avatar?: string; phone?: string }) => {
      console.log("update profile event: ", data);

      const userId = socket.data.userId;
      if (!userId) {
        return socket.emit("updateProfile", {
          success: false,
          msg: "Unauthorized",
        });
      }

      try {
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { name: data.name, avatar: data.avatar, phone: data.phone },
          { new: true }
        );

        if (!updatedUser) {
          return socket.emit("updateProfile", {
            success: false,
            msg: "User not found",
          });
        }

        const newToken = generateToken(updatedUser);

        socket.emit("updateProfile", {
          success: true,
          data: { token: newToken },
          msg: "Profile updated successfully",
        });
      } catch (error) {
        console.log("Error updating profile", error);
        socket.emit("updateProfile", {
          success: false,
          msg: "Error updating profile",
        });
      }
    }
  );

  socket.on("getContacts", async () => {
    try {
      const currentUserId = socket.data.userId;
      if (!currentUserId) {
        socket.emit("getContacts", {
          success: false,
          msg: "Unauthorized",
        });
        return;
      }

      const users = await User.find(
        { _id: { $ne: currentUserId } },
        { password: 0 }
      ).lean();

      const contacts = users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar || "",
      }));

      socket.emit("getContacts", { success: true, data: contacts });
    } catch (error: any) {
      console.log("getContacts error: ", error);
      socket.emit("getContacts", {
        success: false,
        msg: "Failed to fetch contacts",
      });
    }
  });

  // 🔔 Save the Expo push token for this user (checks both databases)
  socket.on("registerPushToken", async (data: { token?: string }) => {
    try {
      const userId = socket.data.userId;
      if (!userId || !data?.token) {
        socket.emit("registerPushToken", {
          success: false,
          msg: "Invalid payload",
        });
        return;
      }

      // Try customer database first
      const updated = await User.findByIdAndUpdate(userId, { expoPushToken: data.token });
      
      if (updated) {
        socket.emit("registerPushToken", { success: true });
        return;
      }

      // If not found in customer DB, try appdb
      try {
        const appdbConnection = getAppdbConnection();
        const AppdbUserSchema = new Schema(
          { username: String, name: String, email: String, avatar: String, phone: String, expoPushToken: String },
          { collection: "users", strict: false }
        );
        const AppdbUser =
          appdbConnection.models.User || appdbConnection.model("User", AppdbUserSchema);

        const appdbUpdated = await AppdbUser.findByIdAndUpdate(userId, { expoPushToken: data.token });
        
        if (appdbUpdated) {
          socket.emit("registerPushToken", { success: true });
          return;
        }
      } catch (appdbError) {
        console.error("Error updating push token in appdb:", appdbError);
      }

      // If user not found in either database
      socket.emit("registerPushToken", {
        success: false,
        msg: "User not found",
      });
    } catch (e) {
      console.error("registerPushToken error:", e);
      socket.emit("registerPushToken", {
        success: false,
        msg: "Failed to save token",
      });
    }
  });
}
