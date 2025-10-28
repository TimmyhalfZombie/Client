import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Text,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import Typo from "@/components/Typo";
import { colors, spacingY } from "@/constants/theme";
import * as Icons from "phosphor-react-native";
import * as activityStore from "@/utils/activityStore";

type Props = {
  visible: boolean;
  kind: "requesting" | "accepted";
  caption?: string;
  onClose?: () => void;
  onCancel?: () => void; // parent may call load()
  onCommitRequest?: () => void;
  logDelayMs?: number;
  autoCloseMsAccepted?: number;
  showAcceptedCountdown?: boolean;
  dismissOnBackdrop?: boolean;
  blockTouches?: boolean;
  activityItemId?: string; // local id
  assistId?: string; // server id
};

export default function RequestStatusOverlay({
  visible,
  kind,
  caption,
  onClose,
  onCancel,
  onCommitRequest,
  logDelayMs = 8000,
  autoCloseMsAccepted = 3000,
  showAcceptedCountdown = true,
  dismissOnBackdrop = false,
  blockTouches = true,
  activityItemId,
  assistId,
}: Props) {
  const isAccepted = kind === "accepted";
  const [internalVisible, setInternalVisible] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const requestProgress = useRef(new Animated.Value(0)).current;

  const requestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptedTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [acceptedCountdown, setAcceptedCountdown] = useState(
    Math.ceil(autoCloseMsAccepted / 1000)
  );

  const animateIn = () => {
    opacity.setValue(0);
    scale.setValue(0.96);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
      }),
    ]).start();
  };
  const animateOut = (cb?: () => void) => {
    requestProgress.stopAnimation();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.98,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInternalVisible(false);
      cb?.();
    });
  };

  const clearRequestTimer = () => {
    if (requestTimerRef.current) {
      clearTimeout(requestTimerRef.current);
      requestTimerRef.current = null;
    }
  };
  const clearAcceptedTimers = () => {
    if (acceptedTimerRef.current) {
      clearTimeout(acceptedTimerRef.current);
      acceptedTimerRef.current = null;
    }
    if (acceptedTickRef.current) {
      clearInterval(acceptedTickRef.current);
      acceptedTickRef.current = null;
    }
  };

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      animateIn();
    } else if (internalVisible) {
      animateOut();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!internalVisible || !visible || isAccepted) return;
    requestProgress.stopAnimation();
    requestProgress.setValue(0);
    const progressAnim = Animated.timing(requestProgress, {
      toValue: 1,
      duration: logDelayMs,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnim.start();
    requestTimerRef.current = setTimeout(() => {
      requestTimerRef.current = null;
      onCommitRequest?.();
      animateOut(onClose);
    }, logDelayMs);
    return () => {
      progressAnim.stop();
      clearRequestTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internalVisible, visible, isAccepted, logDelayMs]);

  useEffect(() => {
    if (!internalVisible || !visible || !isAccepted) return;
    setAcceptedCountdown(Math.ceil(autoCloseMsAccepted / 1000));
    if (showAcceptedCountdown && autoCloseMsAccepted > 0) {
      acceptedTickRef.current = setInterval(
        () => setAcceptedCountdown((s) => Math.max(0, s - 1)),
        1000
      );
    }
    if (autoCloseMsAccepted > 0) {
      acceptedTimerRef.current = setTimeout(() => {
        acceptedTimerRef.current = null;
        animateOut(onClose);
      }, autoCloseMsAccepted);
    }
    return () => {
      clearAcceptedTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    internalVisible,
    visible,
    isAccepted,
    autoCloseMsAccepted,
    showAcceptedCountdown,
  ]);

  const handleBackdropPress = () => {
    if (!dismissOnBackdrop) return;
    clearRequestTimer();
    clearAcceptedTimers();
    animateOut(onClose);
  };

  // 🔴 Cancel from overlay: flip status to "canceled" (robust even if ids are missing)
  const handleCancel = async () => {
    try {
      clearRequestTimer();

      const markCanceled =
        (activityStore as any).markActivityCanceled ??
        ((where: any) =>
          (activityStore as any).setActivityStatus?.(where, "canceled"));

      // Try with provided ids first
      let ok = false;
      if (activityItemId || assistId) {
        ok = (await markCanceled?.({ id: activityItemId, assistId })) === true;
      }
      // Fallback: cancel most recent pending if ids weren’t provided/matched
      if (!ok && (activityStore as any).cancelMostRecentPending) {
        await (activityStore as any).cancelMostRecentPending();
      }
      // Store emits change → Activity reloads via onActivityChange()
    } finally {
      animateOut(() => {
        onCancel?.(); // parent can also call load()
        onClose?.();
      });
    }
  };

  if (!internalVisible) return null;

  const progressWidth = requestProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[
          styles.backdrop,
          { pointerEvents: blockTouches ? "auto" : "none" },
        ]}
        onPress={handleBackdropPress}
      >
        <Animated.View
          style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}
          pointerEvents="box-none"
        >
          <View style={styles.card} pointerEvents="auto">
            {isAccepted ? (
              <>
                <View style={styles.badgeAccepted}>
                  <Icons.Check size={36} color={colors.black} weight="bold" />
                </View>
                <Typo
                  size={18}
                  color={colors.white}
                  fontWeight="800"
                  style={{ marginTop: spacingY._8 }}
                >
                  Assistance accepted
                </Typo>
              </>
            ) : (
              <>
                <Typo size={20} color={colors.white} fontWeight="800">
                  <Typo size={20} color={colors.green} fontWeight="800">
                    Requesting
                  </Typo>{" "}
                  assistance…
                </Typo>

                {!!caption && (
                  <Typo
                    size={12}
                    color={colors.white}
                    fontFamily="InterLight"
                    style={{
                      marginTop: spacingY._4,
                      opacity: 0.9,
                      textAlign: "center",
                    }}
                  >
                    {caption}
                  </Typo>
                )}

                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[styles.progressFill, { width: progressWidth }]}
                  />
                </View>

              </>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  cardWrap: { width: "100%", alignItems: "center", justifyContent: "center" },
  card: {
    minWidth: 260,
    maxWidth: 420,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  badgeAccepted: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    width: 240,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginTop: spacingY._8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.green,
    borderRadius: 999,
  },
  cancelBtn: {
    marginTop: spacingY._10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.69)",
    borderColor: "#6EFF87",
    borderWidth: 1,
  },
  cancelText: { color: colors.white, fontWeight: "600" },
});
