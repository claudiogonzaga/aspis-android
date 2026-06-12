import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme';

interface Props {
  children: ReactNode;
  contentStyle?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function ScreenContainer({ children, contentStyle, edges = ['top', 'bottom'] }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.bg.primary, colors.bg.gradientEnd]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={edges}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
  safe: { flex: 1 },
  content: { flex: 1 },
});
