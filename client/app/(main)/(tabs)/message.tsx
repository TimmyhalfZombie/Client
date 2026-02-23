/* eslint-disable @typescript-eslint/no-unused-vars */
// client/(main)/message.tsx
import { ScrollView, StyleSheet, View, Alert } from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { useRouter, useFocusEffect } from "expo-router";
import Loading from "@/components/Loading";
import ConversationItem from "@/components/ConversationItem";
import {
  getConversations,
  newConversation,
  deleteConversation,
  conversationDeleted as onConversationDeleted,
} from "@/socket/socketEvents";
import { ConversationProps, ResponseProps } from "@/types";
import { getSocket } from "@/socket/socket";

import ConversationActionsSheet from "@/components/ConversationActionsSheet";
import { useChat } from "@/contexts/ChatContext";
import Animated, {
  FadeInDown,
  FadeInUp,
  LinearTransition,
} from "react-native-reanimated";

const sortByRecent = (a: ConversationProps, b: ConversationProps) => {
  const aDate = a?.lastMessage?.createdAt || a.createdAt;
  const bDate = b?.lastMessage?.createdAt || b.createdAt;
  return new Date(bDate).getTime() - new Date(aDate).getTime();
};

const Message = () => {
  const { signOut } = useAuth();
  const { conversations, refreshConversations } = useChat();
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  // sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<ConversationProps | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshConversations();
      return () => {};
    }, [refreshConversations]),
  );

  const sortedConversations = [...conversations].sort(sortByRecent);

  const openSheet = (item: ConversationProps) => {
    setSelected(item);
    setSheetOpen(true);
  };

  const handleDelete = (done: () => void) => {
    if (!selected) {
      done();
      return;
    }
    deleteConversation({
      conversationId: selected._id,
      cb: (res) => {
        if (!res.success) {
          Alert.alert("Error", res.msg || "Failed to delete");
        } else {
          setSheetOpen(false);
          setSelected(null);
        }
        done();
      },
    });
  };

  return (
    <ScreenWrapper style={{ paddingTop: 0, backgroundColor: "#121217" }}>
      <View style={styles.container}>
        <Animated.View
          entering={FadeInDown.duration(180)}
          style={styles.topBar}
        >
          <View style={{ flexDirection: "column", alignItems: "flex-start" }}>
            <Typo size={32} fontFamily="Candal" style={{ lineHeight: 34 }}>
              <Typo size={32} fontFamily="Candal" color={colors.primary}>
                patch
              </Typo>{" "}
              <Typo size={32} fontFamily="Candal" color={colors.white}>
                up
              </Typo>
            </Typo>

            <Typo
              size={20}
              fontWeight="800"
              color={colors.white}
              style={{ marginTop: 15 }}
            >
              Chats
            </Typo>
          </View>
        </Animated.View>

        <View style={styles.content}>
          <ScrollView
            showsHorizontalScrollIndicator={false}
            overScrollMode="never"
            contentContainerStyle={{ paddingVertical: spacingY._10 }}
          >
            <Animated.View
              layout={LinearTransition.springify().damping(18).stiffness(220)}
              style={styles.conversationList}
            >
              {sortedConversations.map((item: ConversationProps, index) => (
                <Animated.View
                  key={(item as any)._id || `${item.type}-${index}`}
                  entering={FadeInUp.duration(180).delay(index * 30)}
                >
                  <ConversationItem
                    item={item}
                    router={router}
                    showDivider={false}
                    onMorePress={openSheet}
                    onLongPress={openSheet}
                  />
                  {index !== conversations.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </Animated.View>
              ))}
            </Animated.View>

            {!loading && sortedConversations.length === 0 && (
              <Typo
                color={colors.white}
                fontFamily="InterLight"
                style={{ textAlign: "center", marginTop: spacingY._20 }}
              >
                No chats yet
              </Typo>
            )}

            {loading && <Loading />}
          </ScrollView>
        </View>
      </View>

      <ConversationActionsSheet
        visible={sheetOpen}
        conversationName={selected?.name || undefined}
        onClose={() => {
          setSheetOpen(false);
          setSelected(null);
        }}
        onDelete={handleDelete}
      />
    </ScreenWrapper>
  );
};

export default Message;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  topBar: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._15,
    paddingBottom: spacingY._10,
  },
  content: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    paddingHorizontal: spacingX._15,
  },
  conversationList: { paddingVertical: spacingY._10 },
  divider: { height: 1, backgroundColor: "#2B2D31", marginVertical: 8 },
});
