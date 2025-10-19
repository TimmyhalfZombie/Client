// client/utils/testApiConnection.ts
import { API_URL } from "@/constants";

export async function testApiConnection() {
  try {
    console.log("🔍 Testing API connection to:", `${API_URL}/api/health`);
    
    const response = await fetch(`${API_URL}/api/health`, {
      method: "GET",
    });
    
    console.log("🔍 Health check response status:", response.status);
    console.log("🔍 Health check response ok:", response.ok);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("✅ Health check response:", data);
    return true;
  } catch (error) {
    console.error("❌ API connection test failed:", error);
    return false;
  }
}
