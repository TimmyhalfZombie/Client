import mongoose from "mongoose";

// Create separate connection for appdb
let appdbConnection: mongoose.Connection | null = null;

// Use Mongoose default connection so models can register before connect resolves
const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI ||
      "mongodb+srv://CJBLACK:CJBLACK112425@cluster0.eme875o.mongodb.net/customer";
    console.log("Connecting to:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("✅ Database connected successfully!");

    // Also connect to appdb for operator users
    const appdbUri = process.env.APPDB_URI ||
      "mongodb+srv://CJBLACK:CJBLACK112425@cluster0.eme875o.mongodb.net/appdb";
    appdbConnection = mongoose.createConnection(appdbUri);
    console.log("✅ Appdb connection established!");
  } catch (error) {
    console.log("mongoDB connection error", error);
    throw error;
  }
};

// Return the default connection without throwing; it exists pre-connect
export const getAppdbConnection = () => {
  if (!appdbConnection) {
    // Fallback: create connection if not already created
    const appdbUri = process.env.APPDB_URI ||
      "mongodb+srv://CJBLACK:CJBLACK112425@cluster0.eme875o.mongodb.net/appdb";
    appdbConnection = mongoose.createConnection(appdbUri);
  }
  return appdbConnection;
};
export const getCustomerConnection = () => mongoose.connection;

export default connectDB;
