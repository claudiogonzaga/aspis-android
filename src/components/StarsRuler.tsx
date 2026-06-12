import { useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ALIGN_COLORS, alignColor, colors, typography } from '../theme';

interface Props {
  value: number; // estrelas mínimas, 0–5
  onChange: (n: number) => void;
}

// Régua de gradiente do filtro de estrelas mínimas — port do .align-track do
// desktop: arraste/toque para escolher; tocar no valor atual volta para 0.
export function StarsRuler({ value, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const moved = useRef(false);

  const current = drag ?? value;
  const pct = current > 0 ? ((current - 0.5) / 5) * 100 : 0;
  const thumbColor = current > 0 ? alignColor(current) : colors.text.tertiary;

  const valueAt = (e: GestureResponderEvent) => {
    if (!width) return current;
    const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / width));
    return Math.round(ratio * 5);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.lbl}>não alinhado</Text>
      <View
        style={styles.trackWrap}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          moved.current = false;
          setDrag(valueAt(e));
        }}
        onResponderMove={(e) => {
          moved.current = true;
          const n = valueAt(e);
          if (n !== drag) setDrag(n);
        }}
        onResponderRelease={(e) => {
          const n = valueAt(e);
          setDrag(null);
          Haptics.selectionAsync();
          // toque (sem arrastar) no valor atual desliga o filtro — como no desktop
          if (!moved.current && n === value) onChange(0);
          else onChange(n);
        }}
      >
        <LinearGradient
          colors={[...ALIGN_COLORS]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.track}
        />
        <View style={[styles.mask, { width: `${pct}%` as `${number}%` }]} />
        <View
          style={[
            styles.thumb,
            { left: `${pct}%` as `${number}%`, backgroundColor: thumbColor },
          ]}
        />
      </View>
      <Text style={styles.lbl}>muito alinhado</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lbl: {
    ...typography.label,
    fontSize: 10,
    color: colors.text.tertiary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  trackWrap: {
    flex: 1,
    height: 28, // área de toque generosa; o trilho é fino
    justifyContent: 'center',
  },
  track: {
    height: 7,
    borderRadius: 3.5,
  },
  mask: {
    position: 'absolute',
    left: 0,
    top: 10.5,
    height: 7,
    borderTopLeftRadius: 3.5,
    borderBottomLeftRadius: 3.5,
    backgroundColor: colors.bg.primary,
    opacity: 0.72,
  },
  thumb: {
    position: 'absolute',
    top: 7,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    borderWidth: 2,
    borderColor: colors.bg.primary,
  },
});
