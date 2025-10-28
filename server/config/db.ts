import mongoose from "mongoose";

// Use Mongoose default connection so models can register before connect resolves
const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI ||
      "mongodb+srv://CJBLACK:CJBLACK112425@cluster0.eme875o.mongodb.net/customer";
    console.log("Connecting to:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("✅ Database connected successfully!");
  } catch (error) {
    console.log("mongoDB connection error", error);
    throw error;
  }
};

// Return the default connection without throwing; it exists pre-connect
export const getAppdbConnection = () => mongoose.connection;
export const getCustomerConnection = () => mongoose.connection;

export default connectDB;
