// client/components/Toast.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  Pressable,
  View,
  Platform,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Icons from "phosphor-react-native";
import * as Haptics from "expo-haptics";

export type ToastType = "success" | "info" | "warning" | "error";

export type ToastConfig = {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  onPress?: () => void;
  icon?: React.ReactNode;
};

// Global toast manager
let toastListener: ((config: ToastConfig) => void) | null = null;

export const showToast = (config: Omit<ToastConfig, "id">) => {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  toastListener?.({ ...config, id });
};

// Preset toast functions
export const toast = {
  success: (message: string, options?: Partial<ToastConfig>) =>
    showToast({ message, type: "success", ...options }),
  info: (message: string, options?: Partial<ToastConfig>) =>
    showToast({ message, type: "info", ...options }),
  warning: (message: string, options?: Partial<ToastConfig>) =>
    showToast({ message, type: "warning", ...options }),
  error: (message: string, options?: Partial<ToastConfig>) =>
    showToast({ message, type: "error", ...options }),
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> =
  {
    success: {
      bg: "rgba(110, 255, 135, 0.15)",
      border: "#6EFF87",
      icon: "#6EFF87",
    },
    info: {
      bg: "rgba(55, 119, 255, 0.15)",
      border: "#3777FF",
      icon: "#3777FF",
    },
    warning: {
      bg: "rgba(255, 193, 7, 0.15)",
      border: "#FFC107",
      icon: "#FFC107",
    },
    error: {
      bg: "rgba(255, 84, 84, 0.15)",
      border: "#FF5454",
      icon: "#FF5454",
    },
  };

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <Icons.CheckCircle size={22} color={COLORS.success.icon} weight="fill" />
  ),
  info: <Icons.Info size={22} color={COLORS.info.icon} weight="fill" />,
  warning: (
    <Icons.Warning size={22} color={COLORS.warning.icon} weight="fill" />
  ),
  error: <Icons.XCircle size={22} color={COLORS.error.icon} weight="fill" />,
};

type ToastItemProps = {
  config: ToastConfig;
  onDismiss: (id: string) => void;
};

function ToastItem({ config, onDismiss }: ToastItemProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const type = config.type || "info";
  const colors = COLORS[type];

  useEffect(() => {
    // Haptic feedback on show
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(
        type === "success"
          ? Haptics.NotificationFeedbackType.Success
          : type === "error"
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Warning,
      );
    }

    // Animate in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const duration = config.duration ?? 4000;
    const timer = setTimeout(() => {
      dismissToast();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(config.id);
    });
  };

  const handlePress = () => {
    config.onPress?.();
    dismissToast();
  };

  return (
    <Animated.View
      style={[
        styles.toastItem,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable style={styles.toastContent} onPress={handlePress}>
        <View style={styles.iconContainer}>{config.icon || ICONS[type]}</View>
        <Text style={styles.message} numberOfLines={2}>
          {config.message}
        </Text>
        <Pressable onPress={dismissToast} hitSlop={8}>
          <Icons.X size={18} color="#999" weight="bold" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  useEffect(() => {
    toastListener = (config: ToastConfig) => {
      setToasts((prev) => [...prev, config]);
    };

    return () => {
      toastListener = null;
    };
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      {children}
      {toasts.length > 0 && (
        <Modal
          transparent
          visible={true}
          animationType="none"
          pointerEvents="box-none"
        >
          <View
            style={[styles.container, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            {toasts.map((toast) => (
              <ToastItem
                key={toast.id}
                config={toast}
                onDismiss={handleDismiss}
              />
            ))}
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toastItem: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(18, 20, 23, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  iconContainer: {
    width: 28,
    alignItems: "center",
  },
  message: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
});
