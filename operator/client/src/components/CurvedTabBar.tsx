// client/src/components/CurvedTabBar.tsx
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Icons from "phosphor-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Dimensions,
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    Easing,
    useAnimatedProps,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Colors
const BG = "#121212";
const BAR_BG = "rgba(30, 30, 30, 0.8)";
const BAR_BORDER = "#0A0A0A";
const ACTIVE_GREEN = "#6EFF87";
const INACTIVE_TEXT = "#B9B9B9";

// Sizes
const BAR_HEIGHT = 85;
const ICON_BG = 50;
const SAFE_TABS = new Set(["home", "activity", "messages", "profile"]);

// Animation constants
const HALO_LIFT_Y = -40;
const NOTCH_DEPTH = 5;
const HALO_PRESS_LIFT_Y = -40;
const NOTCH_PRESS_DEPTH = 25;
const HALO_OFFSET_X = -23;

// Notch geometry
const RADIUS = 16;
const NOTCH_WIDTH = ICON_BG + 20;

function toTitle(s: string) {
  return s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

// 🔹 Extend props to accept optional badges (e.g., { activity: true })
type CurvedProps = BottomTabBarProps & {
  badges?: Record<string, boolean | number>;
};

export default function CurvedTabBar({ state, descriptors, navigation, badges }: CurvedProps) {
  const routes = useMemo(() => state.routes.filter((r) => SAFE_TABS.has(r.name)), [state.routes]);

  const [width, setWidth] = useState<number>(SCREEN_WIDTH);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  const widthSV = useSharedValue(SCREEN_WIDTH);
  const tabWsv = useSharedValue(width / Math.max(routes.length, 1));

  useEffect(() => {
    widthSV.value = width;
    tabWsv.value = width / Math.max(routes.length, 1);
  }, [width, routes.length, widthSV, tabWsv]);

  const activeIndex = Math.max(0, routes.findIndex((r) => r.key === state.routes[state.index].key));
  const activeIndexSV = useSharedValue(activeIndex);
  useEffect(() => {
    activeIndexSV.value = activeIndex;
  }, [activeIndex, activeIndexSV]);

  const notchCenterX = useSharedValue(activeIndex * tabWsv.value + tabWsv.value / 2);
  const haloX = useSharedValue(activeIndex * tabWsv.value);
  const haloLiftY = useSharedValue(0);
  const notchDepthSV = useSharedValue(NOTCH_DEPTH);

  useEffect(() => {
    const tabW = width / Math.max(routes.length, 1);
    const rawCenter = activeIndex * tabW + tabW / 2;
    let offset = 0;

    // ✅ Apply same offset to notch & halo when on "home"
    const activeName = routes[activeIndex]?.name;
    if (activeName === "home") {
      offset = -2; // adjusted to move 13px to the right (-15 + 13 = -2)
    }

    notchCenterX.value = withTiming(rawCenter + offset, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
    });
    haloX.value = withTiming(activeIndex * tabW + offset, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
    });

    widthSV.value = width;
    tabWsv.value = tabW;
  }, [activeIndex, routes, width, notchCenterX, haloX, widthSV, tabWsv]);

  useDerivedValue(() => {
    "worklet";
    const _ = activeIndexSV.value;
    haloLiftY.value = withTiming(HALO_LIFT_Y, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
    });
    notchDepthSV.value = withTiming(NOTCH_DEPTH, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
    });
  });

  const animatedPath = useAnimatedProps(() => {
    "worklet";
    function buildPath(W: number, H: number, cx: number, notchW: number, notchD: number, radius: number): string {
      "worklet";
      const left = 0,
        right = W,
        top = 0,
        bottom = H;
      const nHalf = notchW / 2;
      const nStart = cx - nHalf;
      const nEnd = cx + nHalf;
      const k = 0.551915024494;

      const brx = right - radius;
      const bry = bottom;
      const try_ = top + radius;

      return (
        `M ${left} ${bottom - radius}` +
        ` C ${left} ${bottom - radius * (1 - k)} ${left + radius * (1 - k)} ${bottom} ${left + radius} ${bottom}` +
        ` L ${brx} ${bry}` +
        ` C ${right - radius * (1 - k)} ${bottom} ${right} ${bottom - radius * (1 - k)} ${right} ${bottom - radius}` +
        ` L ${right} ${try_}` +
        ` C ${right} ${top + radius * (1 - k)} ${right - radius * (1 - k)} ${top} ${right - radius} ${top}` +
        ` L ${nEnd - 15} ${top}` +
        ` C ${nEnd - 10} ${top - 3} ${nEnd - 5} ${top - 2} ${nEnd - 2} ${top - 1}` +
        ` C ${nEnd - 1} ${top} ${nEnd} ${top + 1} ${nEnd} ${top + 2}` +
        ` A ${nHalf} ${nHalf} 0 0 1 ${cx + nHalf} ${top + notchD}` +
        ` A ${nHalf} ${nHalf} 0 0 1 ${nStart} ${top + 2}` +
        ` C ${nStart} ${top + 1} ${nStart + 1} ${top} ${nStart + 2} ${top - 1}` +
        ` C ${nStart + 5} ${top - 2} ${nStart + 10} ${top - 3} ${nStart + 15} ${top}` +
        ` L ${left + radius} ${top}` +
        ` C ${left + radius * (1 - k)} ${top} ${left} ${top + radius * (1 - k)} ${left} ${top + radius}` +
        ` L ${left} ${bottom - radius} Z`
      );
    }

    const W = widthSV.value;
    const notchW = NOTCH_WIDTH;
    const notchD = notchDepthSV.value;
    const r = RADIUS;
    const cx = notchCenterX.value;

    return { d: buildPath(W, BAR_HEIGHT, cx, notchW, notchD, r) };
  });

  const haloStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [
        { translateX: haloX.value + (tabWsv.value - ICON_BG) / 2 + HALO_OFFSET_X },
        { translateY: haloLiftY.value },
      ],
    };
  });

  const handlePress = useCallback(
    (routeName: string, routeKey: string, isFocused: boolean, index: number) => {
      if (activeIndex === index) {
        haloLiftY.value = withTiming(
          HALO_PRESS_LIFT_Y,
          { duration: 110, easing: Easing.out(Easing.cubic) },
          () => {
            haloLiftY.value = withTiming(HALO_LIFT_Y, {
              duration: 160,
              easing: Easing.out(Easing.cubic),
            });
          }
        );
        notchDepthSV.value = withTiming(
          NOTCH_PRESS_DEPTH,
          { duration: 110 },
          () => {
            notchDepthSV.value = withTiming(NOTCH_DEPTH, { duration: 160 });
          }
        );
      }

      const event = navigation.emit({
        type: "tabPress",
        target: routeKey,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName as never);
      }
    },
    [navigation, activeIndex, haloLiftY, notchDepthSV]
  );

  const activeRoute = routes[activeIndex] ?? routes[0];
  const ActiveIconComp = (() => {
    switch (activeRoute?.name) {
      case "home":
        return Icons.House;
      case "activity":
        return Icons.ListBullets;
      case "messages":
        return Icons.ChatCircleDots;
      case "profile":
        return Icons.UserCircle;
      default:
        return Icons.Circle;
    }
  })();

  const tabWidth = width / Math.max(routes.length, 1);

  // Hide the custom tab bar on screens outside SAFE_TABS (e.g., chat)
  const isSafeActive = SAFE_TABS.has(state.routes[state.index]?.name as string);
  if (!isSafeActive) {
    return null;
  }

  return (
    <Animated.View pointerEvents="box-none" style={{ backgroundColor: BG }}>
      <View style={[styles.bar, { height: BAR_HEIGHT }]} onLayout={onLayout}>
        {/* Notched background */}
        <Svg
          width="100%"
          height={BAR_HEIGHT}
          viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <AnimatedPath
            animatedProps={animatedPath}
            fill={BAR_BG}
            stroke={BAR_BORDER}
            strokeWidth={StyleSheet.hairlineWidth}
          />
        </Svg>

        {/* Lifted halo */}
        <Animated.View
          style={[styles.haloContainer, { width: tabWidth, height: BAR_HEIGHT }, haloStyle]}
          pointerEvents="none"
        >
          <View style={styles.halo}>
            <ActiveIconComp size={24} color={"#0C0C0C"} weight="fill" />
          </View>
        </Animated.View>

        {/* Tabs */}
        <View style={styles.row}>
          {routes.map((route, index) => {
            const isFocused = activeIndex === index;
            const options = descriptors[route.key]?.options ?? {};
            const raw =
              options.tabBarLabel ??
              options.title ??
              (route.name === "messages" ? "Messages" : toTitle(route.name));
            const label = typeof raw === "string" ? raw : toTitle(route.name);

            let IconComp: any;
            switch (route.name) {
              case "home":
                IconComp = Icons.HouseSimple;
                break;
              case "activity":
                IconComp = Icons.List;
                break;
              case "messages":
                IconComp = Icons.ChatCircle;
                break;
              case "profile":
                IconComp = Icons.User;
                break;
              default:
                IconComp = Icons.Circle;
            }

            // 🔹 Simple boolean/number badge check
            const showBadge =
              route.name === "activity" &&
              !isFocused &&
              !!(badges && (badges["activity"] === true || Number(badges["activity"]) > 0));

            return (
              <TouchableOpacity
                key={route.key}
                style={[styles.tab, { width: tabWidth }]}
                activeOpacity={0.9}
                onPress={() => handlePress(route.name, route.key, isFocused, index)}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
              >
                <View style={styles.tabInner}>
                  {/* Icon + optional green dot */}
                  <View style={{ opacity: isFocused ? 0 : 1 }}>
                    <View style={styles.iconWrap}>
                      <IconComp size={24} color={INACTIVE_TEXT} />
                      {showBadge ? <View style={styles.badgeDot} /> : null}
                    </View>
                  </View>

                  <Text style={[styles.label, isFocused && styles.labelActive]}>
                    {label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { width: "100%", overflow: "visible", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  tab: { height: BAR_HEIGHT, alignItems: "center", justifyContent: "center" },
  tabInner: {
    height: 52,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    transform: [{ translateY: -6 }],
  },
  label: { fontSize: 12, color: INACTIVE_TEXT },
  labelActive: { color: ACTIVE_GREEN, fontWeight: "600" },
  haloContainer: { position: "absolute", left: 0, top: 0, alignItems: "center", justifyContent: "center" },
  halo: {
    width: ICON_BG,
    height: ICON_BG,
    borderRadius: ICON_BG / 2,
    backgroundColor: ACTIVE_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },

  // 🔹 Badge helpers
  iconWrap: {
    position: "relative",
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 6,
    backgroundColor: ACTIVE_GREEN,
    borderWidth: 1,
    borderColor: BG,
  },
});
