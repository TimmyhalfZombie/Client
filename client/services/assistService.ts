// client/services/assistService.ts
import { API_URL } from "@/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AssistRequest {
  _id: string;
  userId: string;
  title?: string;
  placeName?: string;
  status: "pending" | "accepted" | "done" | "canceled";
  assignedTo?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  vehicle?: any;
  location?: {
    type: string;
    coordinates: number[];
    address?: string;
    accuracy?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  name: string;
  avatar?: string;
  email: string;
}

export interface AssistRequestWithUser extends Omit<AssistRequest, 'userId'> {
  userId: User;
}

class AssistService {
  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async fetchUserAssistRequests(): Promise<AssistRequest[]> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${API_URL}/api/assist/user-requests`;
      
      console.log("🔍 Fetching from:", url);
      console.log("🔍 Headers:", headers);
      
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      console.log("🔍 Response status:", response.status);
      console.log("🔍 Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Response error:", errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Response data:", data);
      return data.success ? data.data : [];
    } catch (error) {
      console.error("❌ Error fetching user assist requests:", error);
      return [];
    }
  }

  async fetchAssistRequestById(id: string): Promise<AssistRequest | null> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_URL}/api/assist/${id}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error("Error fetching assist request:", error);
      return null;
    }
  }

  async rateAssistRequest(id: string, rating: number, comment?: string): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_URL}/api/assist/${id}/rate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rating, comment }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error("Error rating assist request:", error);
      return false;
    }
  }

  async cancelAssistRequest(id: string): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_URL}/api/assist/${id}/cancel`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error("Error canceling assist request:", error);
      return false;
    }
  }
}

export default new AssistService();
