import { StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import { colors, spacingX, spacingY } from "@/constants/theme";
import Avatar from "./Avatar";
import Typo from "./Typo";
import moment from "moment";
import { ConversationListItemProps } from "@/types";
import { useAuth } from "@/contexts/authContext";

type Props = ConversationListItemProps & {
  onLongPress?: (item: ConversationListItemProps["item"]) => void;
};

const ConversationItem = ({ item, showDivider, router, onLongPress }: Props) => {
  const { user: currentUser } = useAuth();

  const lastMessage: any = item.lastMessage;

  // robust direct detection
  const isDirect =
    item?.type === "direct" ||
    (Array.isArray(item?.participants) && item.participants.length === 2);

  const participants = Array.isArray(item?.participants) ? item.participants : [];

  // find other participant
  const otherParticipant =
    isDirect && participants.length
      ? participants.find((p: any) => String(p?._id) !== String(currentUser?.id))
      : null;

  // fallback: last sender if not me
  const lastSender = lastMessage?.senderId as any;
  const lastSenderIsMe = lastSender && String(lastSender._id) === String(currentUser?.id);
  const fallbackFromLastSender = !lastSenderIsMe && (lastSender?.name || lastSender?.username);

  // final name (shows "Tim")
  const conversationName =
    (isDirect && (otherParticipant?.name || otherParticipant?.username)) ||
    fallbackFromLastSender ||
    item.name ||
    "Conversation";

  // avatar
  const avatar = isDirect ? otherParticipant?.avatar || item.avatar : item.avatar;

  const unreadCount = Number((item as any).unreadCount ?? 0);
  const hasUnread = unreadCount > 0;

  const getLastMessageDate = () => {
    if (!lastMessage?.createdAt) return null;
    const d = moment(lastMessage.createdAt);
    const now = moment();
    if (now.diff(d, "minutes") < 1) return "now";
    if (d.isSame(now, "day")) return d.format("h:mm A");
    if (d.isSame(now, "year")) return d.format("MMM D");
    return d.format("MMM D, YYYY");
  };
  const timeLabel = getLastMessageDate();

  const openConversation = () => {
    router.push({
      pathname: "/(main)/conversation",
      params: {
        id: item._id,
        name: conversationName, // keep header consistent
        avatar: item.avatar,
        type: item.type,
        participants: JSON.stringify(item.participants),
      },
    });
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={openConversation}
        delayLongPress={250}
        onLongPress={() => onLongPress?.(item)}
      >
        <Avatar uri={avatar} size={47} />

        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <View style={styles.nameContainer}>
              <Typo
                size={17}
                fontFamily="InterLight"
                fontWeight={hasUnread ? "800" : undefined}
                color={colors.neutral100}
                style={styles.nameText}
              >
                {conversationName}
              </Typo>
            </View>

            <View style={styles.rightMeta}>
              {timeLabel ? (
                <Typo
                  size={13}
                  color={colors.neutral200}
                  fontFamily="InterLight"
                  style={styles.timeText}
                >
                  {timeLabel}
                </Typo>
              ) : null}
              {hasUnread && <View style={styles.dot} />}
            </View>
          </View>

          {hasUnread ? (
            <Typo
              size={15}
              color={colors.green}
              fontFamily="InterLight"
              style={{ marginTop: -10 }}
            >
              {unreadCount === 1 ? "1 new message" : `${unreadCount} new messages`}
            </Typo>
          ) : lastMessage ? (
            <Typo
              size={15}
              color={colors.neutral400}
              textProps={{ numberOfLines: 1 }}
              fontFamily="InterLight"
            >
              {lastMessage.attachment ? "Image" : lastMessage.content || "Message"}
            </Typo>
          ) : (
            <Typo size={15} color={colors.neutral400} fontFamily="InterLight">
              Say hi
            </Typo>
          )}
        </View>
      </TouchableOpacity>

      {showDivider && <View style={styles.divider} />}
    </View>
  );
};

export default ConversationItem;

const styles = StyleSheet.create({
  conversationItem: {
    gap: spacingX._12,
    marginVertical: spacingY._12,
    flexDirection: "row",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  nameContainer: {
    flex: 1,
    flexDirection: "column",
  },
  rightMeta: { flexDirection: "column", alignItems: "flex-end" },
  nameText: { includeFontPadding: false, lineHeight: 20 },
  timeText: { includeFontPadding: false, lineHeight: 16 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
    marginTop: 6,
    alignSelf: "center",
  },
  divider: {
    height: 1,
    width: "95%",
    alignSelf: "center",
    backgroundColor: "rgba(47, 43, 43, 1)",
  },
});
