  import React from 'react';
import { Animated, Easing, PixelRatio, Platform, StyleSheet, View } from 'react-native';

  const BLUE = '#0A84FF';

  type Props = {
    dotSize?: number;      // inner blue circle diameter
    ring?: number;         // white ring thickness
    pulseScale?: number;   // how big the pulse grows
  };

  export default function UserPin({ dotSize = 16, ring = 2, pulseScale = 1.8 }: Props) {
    const OUTER = dotSize + ring * 2;                           // visible dot incl. white ring
    const BOX   = Math.ceil(PixelRatio.roundToNearestPixel(OUTER * pulseScale)) + 2; // wrapper size (no clipping)

    const pulse = React.useRef(new Animated.Value(0)).current;
    React.useEffect(() => {
      Animated.loop(
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ).start();
    }, [pulse]);

    const scale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, pulseScale] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] });

    return (
      <View
        pointerEvents="none"
        style={[styles.wrap, { width: BOX, height: BOX }]}
        collapsable={false}
        renderToHardwareTextureAndroid
        needsOffscreenAlphaCompositing
      >
        {/* pulse as a filled disc (no border = no shaving) */}
        <Animated.View
          style={[
            styles.pulse,
            { width: OUTER, height: OUTER, borderRadius: OUTER / 2, transform: [{ scale }], opacity }
          ]}
        />

        {/* white ring via nesting (no borders) */}
        <View style={[styles.outer, { width: OUTER, height: OUTER, borderRadius: OUTER / 2 }]}>
          <View style={[styles.inner, { width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]} />
        </View>
      </View>
    );
  }

  const styles = StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },
    pulse: {
      position: 'absolute',
      backgroundColor: BLUE,
    },
    outer: {
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
        android: { elevation: 3 },
      }),
    },
    inner: {
      backgroundColor: BLUE,
    },
  });
