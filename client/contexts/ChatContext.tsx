import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getConversations, newConversation } from "@/socket/socketEvents";
import { getSocket } from "@/socket/socket";
import { ConversationProps, ResponseProps } from "@/types";
import { useAuth } from "./authContext";

type ChatContextType = {
  conversations: ConversationProps[];
  totalUnreadCount: number;
  refreshConversations: () => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationProps[]>([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  const calculateTotalUnread = useCallback((convs: ConversationProps[]) => {
    const total = convs.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
    setTotalUnreadCount(total);
  }, []);

  const processConversations = useCallback((res: ResponseProps) => {
    if (res.success && Array.isArray(res.data)) {
      setConversations(res.data);
      calculateTotalUnread(res.data);
    }
  }, [calculateTotalUnread]);

  const refreshConversations = useCallback(() => {
    if (user) {
      getConversations(processConversations);
      // Also emit to trigger fresh data
      getConversations(null);
    }
  }, [user, processConversations]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setTotalUnreadCount(0);
      return;
    }

    refreshConversations();

    const socket = getSocket();
    if (!socket) return;

    const onUpdated = (evt: any) => {
      if (!evt?.success || !evt?.data) return;
      const updatedConv = evt.data;
      setConversations((prev) => {
        const map = new Map(prev.map((c) => [c._id, c]));
        map.set(updatedConv._id, updatedConv);
        const arr = Array.from(map.values());
        calculateTotalUnread(arr);
        return arr;
      });
    };

    const onDeleted = (evt: any) => {
      if (evt?.success && evt?.conversationId) {
        setConversations((prev) => {
          const arr = prev.filter((c) => c._id !== evt.conversationId);
          calculateTotalUnread(arr);
          return arr;
        });
      }
    };

    const onNew = (res: ResponseProps) => {
        if (res.success && res.data) {
            setConversations((prev) => {
                const arr = [...prev, res.data];
                calculateTotalUnread(arr);
                return arr;
            })
        }
    }

    socket.on("conversationUpdated", onUpdated);
    socket.on("conversationDeleted", onDeleted);
    socket.on("newConversation", onNew);

    return () => {
      socket.off("conversationUpdated", onUpdated);
      socket.off("conversationDeleted", onDeleted);
      socket.off("newConversation", onNew);
    };
  }, [user, refreshConversations, calculateTotalUnread]);

  return (
    <ChatContext.Provider value={{ conversations, totalUnreadCount, refreshConversations }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
