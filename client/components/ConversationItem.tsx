import React, { useEffect, useRef } from "react";
import { StyleSheet, TouchableOpacity, View, Animated } from "react-native";
import { colors, spacingX, spacingY } from "@/constants/theme";
import Avatar from "./Avatar";
import Typo from "./Typo";
import moment from "moment";
import { ConversationListItemProps } from "@/types";
import { useAuth } from "@/contexts/authContext";
import * as Icons from "phosphor-react-native";

type Props = ConversationListItemProps & {
  onMorePress?: (item: ConversationListItemProps["item"]) => void;
  onLongPress?: (item: ConversationListItemProps["item"]) => void;
};

/** Animated ping beacon shown when there are unread messages */
const PulseDot = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.6,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.7,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[styles.dotRing, { transform: [{ scale }], opacity }]}
      />
      <View style={styles.dotCore} />
    </View>
  );
};

const UnreadBadge = ({ count }: { count: number }) => {
  if (count <= 1) return <PulseDot />;
  return (
    <View style={styles.badge}>
      <Typo size={10} fontWeight="700" color={colors.black}>
        {count > 99 ? "99+" : String(count)}
      </Typo>
    </View>
  );
};

const ConversationItem = ({
  item,
  showDivider,
  router,
  onMorePress,
  onLongPress,
}: Props) => {
  const { user: currentUser } = useAuth();
  const lastMessage: any = item.lastMessage;

  const isDirect =
    item?.type === "direct" ||
    (Array.isArray(item?.participants) && item.participants.length === 2);
  const participants = Array.isArray(item?.participants)
    ? item.participants
    : [];

  const otherParticipant =
    isDirect && participants.length
      ? participants.find(
          (p: any) => String(p?._id) !== String(currentUser?.id),
        )
      : null;

  const lastSender = lastMessage?.senderId as any;
  const lastSenderIsMe =
    lastSender && String(lastSender._id) === String(currentUser?.id);
  const fallbackFromLastSender =
    !lastSenderIsMe && (lastSender?.name || lastSender?.username);

  const conversationName =
    (isDirect && (otherParticipant?.name || otherParticipant?.username)) ||
    fallbackFromLastSender ||
    item.name ||
    "Conversation";

  const avatar = isDirect
    ? otherParticipant?.avatar || item.avatar
    : item.avatar;

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
        name: conversationName,
        avatar: item.avatar,
        type: item.type,
        participants: JSON.stringify(item.participants),
      },
    });
  };

  const getPreviewText = () => {
    if (!lastMessage) return "Say hi 👋";
    if (lastMessage.attachment) return "📷 Image";
    return lastMessage.content || "Message";
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.row, hasUnread && styles.rowUnread]}
        onPress={openConversation}
        delayLongPress={250}
        onLongPress={() => onLongPress?.(item)}
        activeOpacity={0.72}
      >
        {/* Avatar with online dot */}
        <View style={styles.avatarWrap}>
          <Avatar uri={avatar} size={50} />
          {hasUnread && <View style={styles.onlineDot} />}
        </View>

        {/* Text block */}
        <View style={styles.textBlock}>
          <View style={styles.nameLine}>
            <Typo
              size={15}
              fontFamily="InterLight"
              fontWeight={hasUnread ? "800" : "600"}
              color={hasUnread ? colors.white : colors.neutral300}
              style={{ flex: 1 }}
              textProps={{ numberOfLines: 1 }}
            >
              {conversationName}
            </Typo>

            {timeLabel ? (
              <Typo
                size={12}
                fontFamily="InterLight"
                color={hasUnread ? colors.green : colors.neutral500}
                style={{ marginLeft: spacingX._8 }}
              >
                {timeLabel}
              </Typo>
            ) : null}
          </View>

          <View style={styles.previewLine}>
            {hasUnread ? (
              <Typo
                size={14}
                fontFamily="InterLight"
                fontWeight="700"
                color={colors.green}
                style={{ flex: 1 }}
                textProps={{ numberOfLines: 1 }}
              >
                {unreadCount === 1
                  ? "1 new message"
                  : `${unreadCount} new messages`}
              </Typo>
            ) : (
              <Typo
                size={14}
                fontFamily="InterLight"
                color={colors.neutral500}
                style={{ flex: 1 }}
                textProps={{ numberOfLines: 1 }}
              >
                {getPreviewText()}
              </Typo>
            )}

            {hasUnread && <UnreadBadge count={unreadCount} />}
          </View>
        </View>

        {/* 3-dots more button */}
        <TouchableOpacity
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => onMorePress?.(item)}
          style={styles.moreBtn}
          activeOpacity={0.6}
        >
          <Icons.DotsThreeVertical
            size={20}
            color={colors.neutral500}
            weight="bold"
          />
        </TouchableOpacity>
      </TouchableOpacity>

      {showDivider && <View style={styles.divider} />}
    </View>
  );
};

export default ConversationItem;

const DOT_SIZE = 10;
const BADGE_SIZE = 18;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacingX._4,
    paddingVertical: spacingY._10,
    borderRadius: 14,
    gap: spacingX._12,
  },
  rowUnread: {
    backgroundColor: "rgba(110,255,135,0.05)",
  },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: "#0D0D0D",
  },
  textBlock: { flex: 1 },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  previewLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  moreBtn: {
    padding: 4,
  },
  dotWrap: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacingX._8,
  },
  dotRing: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.green,
  },
  dotCore: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.green,
  },
  badge: {
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    marginLeft: spacingX._8,
  },
  divider: {
    height: 1,
    backgroundColor: "#1E2025",
    marginHorizontal: spacingX._4,
  },
});
