import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

type Props = {
  /** Inner red dot diameter (px). */
  dotSize?: number;
  /** White ring thickness (px). */
  ring?: number;
  /** Override the red color if needed. */
  color?: string;
};

/** Red dot with a white ring for the operator marker. */
export default function OperatorPin({ dotSize = 16, ring = 2, color = '#ff3b30' }: Props) {
  const OUTER = dotSize + ring * 2;
  return (
    <View style={[styles.outer, { width: OUTER, height: OUTER, borderRadius: OUTER / 2 }]}>
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 2 },
    }),
  },
});
