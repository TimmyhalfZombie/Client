import { StyleSheet, View } from "react-native";
import React from "react";
import { AvatarProps } from "@/types";
import { verticalScale } from "@/utils/styling";
import { Image } from "expo-image";
import { getAvatarPath } from "@/services/imageService";

const Avatar = ({ uri, size = 40, style }: AvatarProps) => {
  const src = getAvatarPath(uri);

  // Determine if it's a remote URL or a local requirement
  const imageSource = typeof src === "string" ? { uri: src } : src;

  const scaledSize = verticalScale(size);

  return (
    <View
      style={[
        styles.avatar,
        {
          height: scaledSize,
          width: scaledSize,
          borderRadius: scaledSize / 2,
        },
        style,
      ]}
    >
      <Image
        style={[styles.image, { backgroundColor: "transparent" }]}
        source={imageSource}
        // Fallback placeholder while loading or if source fails
        placeholder={require("../assets/images/defaultAvatar.png")}
        contentFit="cover"
        transition={150}
      />
    </View>
  );
};

export default Avatar;

const styles = StyleSheet.create({
  avatar: {
    alignSelf: "center",
    backgroundColor: "transparent",
    overflow: "hidden",
    // Subtle border to help define the circle on bright backgrounds
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  image: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
