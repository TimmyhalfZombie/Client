import React, { useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY, radius } from "@/constants/theme";
import * as Icons from "phosphor-react-native";

type Props = {
  visible: boolean;
  conversationName?: string;
  onClose: () => void;
  onDelete: (done: () => void) => void; // caller passes a done() callback
};

export default function ConversationActionsSheet({
  visible,
  conversationName,
  onClose,
  onDelete,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleClose = () => {
    setConfirming(false);
    setDeleting(false);
    onClose();
  };

  const handleDeletePress = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    // second tap = confirmed
    setDeleting(true);
    onDelete(() => {
      setDeleting(false);
      setConfirming(false);
      // parent closes the sheet after success
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      onDismiss={() => {
        setConfirming(false);
        setDeleting(false);
      }}
    >
      <View style={styles.backdrop}>
        {/* Tap outside to close */}
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.sheet}>
          {/* Handle pill */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Typo size={13} fontFamily="InterLight" color={colors.neutral400}>
              {conversationName ?? "Conversation"}
            </Typo>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Delete row */}
          <TouchableOpacity
            style={styles.row}
            onPress={handleDeletePress}
            activeOpacity={0.75}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size={20} color="#ff4d4f" />
            ) : (
              <Icons.Trash
                size={22}
                color="#ff4d4f"
                weight={confirming ? "fill" : "regular"}
              />
            )}

            <View style={{ flex: 1, marginLeft: spacingX._12 }}>
              <Typo
                size={16}
                color="#ff4d4f"
                fontWeight={confirming ? "700" : "400"}
              >
                {deleting
                  ? "Deleting…"
                  : confirming
                    ? "Tap again to confirm"
                    : "Delete conversation"}
              </Typo>
              {confirming && !deleting && (
                <Typo
                  size={12}
                  color={colors.neutral500}
                  fontFamily="InterLight"
                >
                  This removes all messages for everyone.
                </Typo>
              )}
            </View>

            {confirming && !deleting && (
              <Icons.Warning size={18} color="#ff4d4f" weight="fill" />
            )}
          </TouchableOpacity>

          {/* Cancel */}
          {!deleting && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.cancelRow}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Typo size={16} color={colors.neutral300} fontWeight="600">
                  Cancel
                </Typo>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#18191C",
    paddingHorizontal: spacingX._20,
    paddingBottom: spacingY._20 + 18, // safe area bump
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3A3B40",
    alignSelf: "center",
    marginTop: spacingY._10,
    marginBottom: spacingY._12,
  },
  header: {
    paddingBottom: spacingY._10,
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#2B2D31",
    marginVertical: spacingY._4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacingY._15,
    minHeight: 56,
  },
  cancelRow: {
    alignItems: "center",
    paddingVertical: spacingY._15,
  },
});
