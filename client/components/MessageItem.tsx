// client/components/MessageItem.tsx

import {
  StyleSheet,
  View,
  Image,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import React from "react";
import { MessageProps } from "@/types";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";
import Avatar from "./Avatar";
import Typo from "./Typo";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Icons from "phosphor-react-native";
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MIN_W = SCREEN_WIDTH * 0.7;
const MAX_W = SCREEN_WIDTH * 0.7;




const formatTime = (val: string) => {
  if (!val) return "";
  if (/\d{1,2}:\d{2}\s?(AM|PM)/i.test(val)) return val;
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return val;
};

type Props = {
  item: MessageProps;
  isDirect: boolean;
};

const MessageItem = ({
  item,
  isDirect,
}: Props) => {
  const isMe = item.isMe;

  return (
    <Animated.View
      entering={FadeInDown.duration(160).delay(15)}
      style={[
        styles.messageContainer,
        isMe ? styles.myMessage : styles.theirMessage,
      ]}
    >
      {!isMe && (
        <Avatar
          size={30}
          uri={item.sender?.avatar || null}
          style={styles.messageAvatar}
        />
      )}

      <Animated.View entering={FadeIn.duration(140)}>
        <View
          style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.theirBubble,
          ]}
        >
          <Typo
            color="#FFFFFF"
            fontWeight={"800"}
            size={13}
            fontFamily="InterLight"
            style={styles.name}
          >
            {item.sender?.name || "Unknown"}
          </Typo>

          {item.attachment ? (
            <Image
              source={{ uri: item.attachment }}
              style={styles.attachment}
              resizeMode="cover"
            />
          ) : null}

          {item.content ? (
            <Typo size={15} fontFamily="InterLight" color="#FFFFFF">
              {item.content}
            </Typo>
          ) : null}

          <Typo
            style={styles.time}
            size={11}
            fontWeight={"500"}
            color="#D0D0D0"
            fontFamily="InterLight"
          >
            {formatTime(item.createdAt)}
          </Typo>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

export default MessageItem;

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacingX._7,
    maxWidth: "85%",
  },
  myMessage: { alignSelf: "flex-end" },
  theirMessage: { alignSelf: "flex-start" },

  messageAvatar: {
    alignSelf: "flex-start",
    marginTop: spacingY._6,
  },

  attachment: {
    height: verticalScale(180),
    width: verticalScale(180),
    borderRadius: radius._10,
    marginBottom: spacingY._4,
  },

  messageBubble: {
    paddingHorizontal: spacingX._10,
    paddingVertical: spacingY._8,
    borderRadius: radius._15,
    gap: spacingY._3,
    maxWidth: MAX_W,
    minWidth: MIN_W,
  },
  myBubble: { backgroundColor: 'rgba(196, 245, 215, 0.49)' }, // was "#C4F5D7",
  theirBubble: { backgroundColor: "#2F3136" },

  name: { marginTop: spacingY._1 },
  time: { alignSelf: "flex-end", marginTop: spacingY._1 },

});
