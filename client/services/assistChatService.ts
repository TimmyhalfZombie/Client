// client/services/assistChatService.ts
import { getSocket } from "@/socket/socket";
import { newConversation } from "@/socket/socketEvents";

export interface AssistChatInfo {
  assistRequestId: string;
  customerId: string;
  operatorId: string;
  customerName: string;
  operatorName: string;
  vehicleInfo?: string;
  locationInfo?: string;
}

/**
 * Creates a conversation between customer and operator for an assist request
 */
export async function createAssistConversation(info: AssistChatInfo): Promise<boolean> {
  try {
    const socket = getSocket();
    if (!socket) {
      console.error("Socket not connected");
      return false;
    }

    // Create conversation between customer and operator
    const conversationData = {
      type: "direct",
      participants: [info.customerId, info.operatorId],
      name: `Assistance Request - ${info.vehicleInfo || 'Vehicle Repair'}`,
    };

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 10000); // 10 second timeout

      newConversation((response: any) => {
        clearTimeout(timeout);
        if (response.success) {
          console.log("✅ Assist conversation created:", response.data);
          resolve(true);
        } else {
          console.error("❌ Failed to create assist conversation:", response.msg);
          resolve(false);
        }
      });

      // Emit the conversation creation
      socket.emit("newConversation", conversationData);
    });
  } catch (error) {
    console.error("Error creating assist conversation:", error);
    return false;
  }
}

/**
 * Gets conversations related to assist requests
 */
export function getAssistRelatedConversations(conversations: any[]): any[] {
  return conversations.filter(conv => {
    // Filter for direct conversations that might be assist-related
    return conv.type === "direct" && conv.participants.length === 2;
  });
}

/**
 * Checks if a conversation is related to an assist request
 */
export function isAssistConversation(conversation: any): boolean {
  // Check if conversation name contains assist-related keywords
  const assistKeywords = ['assistance', 'request', 'repair', 'vehicle', 'assist'];
  const name = (conversation.name || '').toLowerCase();
  
  return assistKeywords.some(keyword => name.includes(keyword));
}



