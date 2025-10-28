
// client/services/assistChatService.ts
import { getSocket } from "@/socket/socket";
import { newConversation } from "@/socket/socketEvents";
import { AssistChatInfo } from "@/types";

/** Utility: make a stable, deduped, sorted participants array */
function normalizeParticipants(ids: (string | undefined | null)[]) {
  return Array.from(new Set(ids.filter(Boolean).map(String))).sort();
}

/**
 * Creates a conversation between customer and operator for an assist request
 * NOTE: We only normalized/sorted participants so both apps emit the same order.
 */
export async function createAssistConversation(info: AssistChatInfo): Promise<boolean> {
  try {
    const socket = getSocket();
    if (!socket) {
      console.error("Socket not connected");
      return false;
    }

    const participants = normalizeParticipants([info.customerId, info.operatorId]);

    // Keep your payload, just swap in normalized participants.
    const conversationData = {
      type: "direct",
      participants,
      name: `Assistance Request - ${info.vehicleInfo || "Vehicle Repair"}`,
      // Optional hint that both sides can send (ignored if server doesn't use it)
      // helps future-proof if you dedupe server-side:
      // pairKey: `${participants[0]}:${participants[1]}:${info.assistRequestId ?? ""}`,
      // requestId: info.assistRequestId, // include if your server uses it for per-request threads
    };

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 10000);

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

      socket.emit("newConversation", conversationData);
    });
  } catch (error) {
    console.error("Error creating assist conversation:", error);
    return false;
  }
}

export function getAssistRelatedConversations(conversations: any[]): any[] {
  return conversations.filter((conv) => conv.type === "direct" && conv.participants.length === 2);
}

export function isAssistConversation(conversation: any): boolean {
  const assistKeywords = ["assistance", "request", "repair", "vehicle", "assist"];
  const name = (conversation.name || "").toLowerCase();
  return assistKeywords.some((k) => name.includes(k));
}
