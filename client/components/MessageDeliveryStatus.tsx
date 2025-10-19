// client/components/MessageDeliveryStatus.tsx
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import Typo from "./Typo";
import { colors } from "@/constants/theme";
import { getSocket } from "@/socket/socket";
import * as Icons from "phosphor-react-native";

interface MessageDeliveryStatusProps {
  conversationId: string;
  showStatus?: boolean;
}

export default function MessageDeliveryStatus({ 
  conversationId, 
  showStatus = true 
}: MessageDeliveryStatusProps) {
  const [deliveryStatus, setDeliveryStatus] = useState<{
    delivered: boolean;
    deliveredTo: string[];
    timestamp: Date | null;
  }>({
    delivered: false,
    deliveredTo: [],
    timestamp: null,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessageDelivered = (evt: any) => {
      if (!evt?.success || evt.conversationId !== conversationId) return;
      
      const deliveredTo = Array.isArray(evt.deliveredTo) ? evt.deliveredTo : [];
      setDeliveryStatus({
        delivered: true,
        deliveredTo,
        timestamp: new Date(),
      });
    };

    socket.on("messageDelivered", onMessageDelivered);
    
    return () => {
      socket.off("messageDelivered", onMessageDelivered);
    };
  }, [conversationId]);

  if (!showStatus || !deliveryStatus.delivered) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Icons.CheckCircle size={12} color={colors.green} weight="fill" />
      <Typo size={10} color={colors.green} fontFamily="InterLight" style={styles.text}>
        Delivered
        {deliveryStatus.deliveredTo.length > 0 && 
          ` to ${deliveryStatus.deliveredTo.join(", ")}`
        }
      </Typo>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  text: {
    fontSize: 10,
  },
});



