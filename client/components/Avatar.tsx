import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { AvatarProps } from "@/types";
import { verticalScale } from "@/utils/styling";
import { colors, radius } from "@/constants/theme";
import { Image } from "react-native";
import { getAvatarPath } from "@/services/imageService";
const Avatar = ({ uri, size = 40, style, isGroup = false }: AvatarProps) => {
  const src = getAvatarPath(uri, isGroup);

  // Normalize different shapes: string URL, local require (number), or an object
  // from image picker which may have { uri } or { url }.
  let imageSource: any = null;

  if (typeof src === "string" && src.trim() !== "") {
    imageSource = { uri: src };
  } else if (src && typeof src === "object") {
    const possibleUri = (src as any).uri || (src as any).url;
    if (
      possibleUri &&
      typeof possibleUri === "string" &&
      possibleUri.trim() !== ""
    ) {
      imageSource = { uri: possibleUri };
    } else {
      // src might be a local require() which is a number (handled below)
      imageSource = src;
    }
  } else {
    // src could be a local module (number) or null — fall back to src
    imageSource = src;
  }

  if (__DEV__) {
    // Helpful debug info when running the app in development
    // eslint-disable-next-line no-console
    console.log("[Avatar] resolved imageSource:", { uri, src, imageSource });
  }

  return (
    <View
      style={[
        styles.avatar,
        { height: verticalScale(size), width: verticalScale(size) },
      ]}
    >
      <Image
        style={{ flex: 1 }}
        source={imageSource as any}
        resizeMode="cover"
      />
    </View>
  );
};

export default Avatar;

const styles = StyleSheet.create({
  avatar: {
    alignSelf: "center",
    backgroundColor: colors.neutral200,
    height: verticalScale(47),
    width: verticalScale(47),
    borderRadius: radius.full,
    borderWidth: 1,
    borderEndColor: colors.neutral100,
    overflow: "hidden",
  },
});
