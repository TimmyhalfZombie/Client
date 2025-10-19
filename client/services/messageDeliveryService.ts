// client/services/messageDeliveryService.ts
import { getSocket } from "@/socket/socket";

export interface MessageDeliveryInfo {
  conversationId: string;
  delivered: boolean;
  deliveredTo: string[];
  timestamp: Date;
}

class MessageDeliveryService {
  private deliveryStatuses = new Map<string, MessageDeliveryInfo>();
  private listeners = new Set<(status: MessageDeliveryInfo) => void>();

  constructor() {
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    socket.on("messageDelivered", (evt: any) => {
      if (!evt?.success) return;

      const deliveryInfo: MessageDeliveryInfo = {
        conversationId: evt.conversationId,
        delivered: true,
        deliveredTo: Array.isArray(evt.deliveredTo) ? evt.deliveredTo : [],
        timestamp: new Date(),
      };

      this.deliveryStatuses.set(evt.conversationId, deliveryInfo);
      
      // Notify all listeners
      this.listeners.forEach(listener => listener(deliveryInfo));
    });
  }

  /**
   * Subscribe to delivery status updates
   */
  subscribe(listener: (status: MessageDeliveryInfo) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get delivery status for a conversation
   */
  getDeliveryStatus(conversationId: string): MessageDeliveryInfo | null {
    return this.deliveryStatuses.get(conversationId) || null;
  }

  /**
   * Check if messages are delivered for a conversation
   */
  isDelivered(conversationId: string): boolean {
    const status = this.deliveryStatuses.get(conversationId);
    return status?.delivered || false;
  }

  /**
   * Get who received the message
   */
  getDeliveredTo(conversationId: string): string[] {
    const status = this.deliveryStatuses.get(conversationId);
    return status?.deliveredTo || [];
  }

  /**
   * Clear delivery status for a conversation
   */
  clearStatus(conversationId: string) {
    this.deliveryStatuses.delete(conversationId);
  }
}

export default new MessageDeliveryService();



