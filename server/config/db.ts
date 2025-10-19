import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    // Temporary hardcoded connection for testing
    const mongoUri = process.env.MONGO_URI || "mongodb+srv://CJBLACK:CJBLACK112425@cluster0.eme875o.mongodb.net/customer";
    console.log("MONGO_URI:", mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log("✅ Database connected successfully!");
  } catch (error) {
    console.log("mongoDB connection error", error);
    throw error;
  }
};

export default connectDB;
