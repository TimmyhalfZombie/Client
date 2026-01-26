import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

type Props = {
  size?: number;       // overall diameter
  value?: number;      // numeric temperature reading
  minValue?: number;
  maxValue?: number;
  targetValue?: number; // show desired temperature tick (optional)
  valueText?: string;  // center text; e.g. "27°C"
  isHeating?: boolean;
  isCooling?: boolean;
  isRetracting?: boolean;
  timerText?: string;  // optional mm:ss below value
};

function clamp(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function toRadians(deg: number) {
  return (Math.PI / 180) * deg;
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = toRadians(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function TemperatureDial({
  size = 240,
  value,
  minValue = 0,
  maxValue = 120,
  targetValue,
  valueText,
  isHeating = false,
  isCooling = false,
  isRetracting = false,
  timerText
}: Props) {
  const cx = size / 2;
  const cy = size / 2;

  const outerStroke = 24;
  const tickStroke = 2;
  const tickLength = 6;
  const tickCount = 60;

  const baseMin = Number.isFinite(minValue) ? minValue : 0;
  const baseMax = Number.isFinite(maxValue) && maxValue !== minValue ? maxValue : baseMin + 1;
  const rawValue = value != null ? value : baseMin;
  const clampedValue = clamp(rawValue, baseMin, baseMax);
  const progress = clamp((clampedValue - baseMin) / (baseMax - baseMin), 0, 1);
  const startAngle = 90; // bottom
  const sweepDeg = progress * 360;
  const endAngle = startAngle + sweepDeg;

  const displayText = valueText ?? `${Math.round(clampedValue)}°C`;

  const progressColor = isRetracting
    ? '#FF4D4D'
    : isCooling
      ? '#4EA7FF'
      : isHeating
        ? '#FF7A00'
        : '#44FF75';

  const trackRadius = cx - outerStroke / 2;
  const ticksRadius = trackRadius - outerStroke * 0.35;

  const knobRadius = 12;
  const knobPos = polarToCartesian(cx, cy, trackRadius, endAngle);

  const targetMarker = (() => {
    if (targetValue == null) return null;
    const tv = clamp(targetValue, baseMin, baseMax);
    const tProgress = (tv - baseMin) / (baseMax - baseMin);
    const tAngle = startAngle + tProgress * 360;
    const outer = polarToCartesian(cx, cy, trackRadius + outerStroke * 0.05, tAngle);
    const inner = polarToCartesian(cx, cy, trackRadius - outerStroke * 0.55, tAngle);
    return (
      <Line
        x1={inner.x}
        y1={inner.y}
        x2={outer.x}
        y2={outer.y}
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.6}
      />
    );
  })();

  const pt = (r: number, deg: number) => polarToCartesian(cx, cy, r, deg);

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Track */}
          <Circle
            cx={cx}
            cy={cy}
            r={trackRadius}
            stroke="#1F1F1F"
            strokeWidth={outerStroke}
            fill="none"
          />

          {/* Progress */}
          {progress > 0 ? (() => {
            if (progress >= 0.999) {
              return (
                <Circle
                  cx={cx}
                  cy={cy}
                  r={trackRadius}
                  stroke={progressColor}
                  strokeWidth={outerStroke}
                  strokeLinecap="round"
                  fill="none"
                />
              );
            }
            const largeArc = sweepDeg > 180 ? 1 : 0;
            const arcStart = polarToCartesian(cx, cy, trackRadius, startAngle);
            const arcEnd = polarToCartesian(cx, cy, trackRadius, endAngle);
            const adjRadius = trackRadius;
            const d = `M ${arcStart.x} ${arcStart.y} A ${adjRadius} ${adjRadius} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`;
            return (
              <Path
                d={d}
                stroke={progressColor}
                strokeWidth={outerStroke}
                strokeLinecap="round"
                fill="none"
              />
            );
          })() : null}

          {/* Degree ticks */}
          <G>
            {Array.from({ length: tickCount }).map((_, i) => {
              const deg = (360 / tickCount) * i - 90;
              const p1 = pt(ticksRadius, deg);
              const p2 = pt(ticksRadius - tickLength, deg);
              return (
                <Line
                  key={i}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#c7c7c7"
                  strokeOpacity={0.45}
                  strokeWidth={tickStroke}
                  strokeLinecap="round"
                />
              );
            })}
          </G>

          {targetMarker}

          {/* Knob */}
          <Circle
            cx={knobPos.x}
            cy={knobPos.y}
            r={knobRadius}
            fill="#FFFFFF"
            stroke={progressColor}
            strokeWidth={4}
          />
        </Svg>

        {/* Center value text — ALWAYS show real reading */}
        <View style={styles.centerWrap} pointerEvents="none">
          <Text style={styles.valueText}>{displayText}</Text>
          {timerText ? <Text style={styles.timerText}>{timerText}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    color: '#ffffff',
    fontSize: 44,
    fontWeight: 'bold',
    fontFamily: 'Candal',
  },
  timerText: {
    color: '#c7c7c7',
    fontSize: 18,
    marginTop: 6,
    fontFamily: 'Inter-Regular',
  },
});
