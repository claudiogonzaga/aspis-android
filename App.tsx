import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreenAPI from 'expo-splash-screen';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useShareIntent } from 'expo-share-intent';
import {
  useFonts,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

import { RootNavigator } from './src/navigation/RootNavigator';
import { VaseBackground } from './src/components/VaseBackground';
import type { RootStackParamList } from './src/navigation/types';
import { useAppStore } from './src/store/useAppStore';
import { colors } from './src/theme';

SplashScreenAPI.preventAutoHideAsync().catch(() => {});

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const { ready, init } = useAppStore();
  const [navReady, setNavReady] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  const [fontsLoaded] = useFonts({
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    init().catch((e) => console.error('init failed', e));
  }, [init]);

  useEffect(() => {
    if (ready && fontsLoaded) {
      SplashScreenAPI.hideAsync().catch(() => {});
    }
  }, [ready, fontsLoaded]);

  // Compartilhar → Aspis: o link chega aqui e abre a tela de análise.
  useEffect(() => {
    if (!hasShareIntent || !ready || !fontsLoaded || !navReady) return;
    const text = shareIntent?.webUrl || shareIntent?.text || '';
    resetShareIntent();
    if (text && navigationRef.isReady()) {
      navigationRef.navigate('Share', { sharedText: text });
    }
  }, [hasShareIntent, shareIntent, ready, fontsLoaded, navReady, resetShareIntent]);

  if (!ready || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={styles.splash}>
          <VaseBackground />
          <Image source={require('./assets/logo-mark.png')} style={styles.shield} />
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <RootNavigator navigationRef={navigationRef} onReady={() => setNavReady(true)} />
        <StatusBar style="dark" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
  splash: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shield: { width: 140, height: 140, borderRadius: 70 },
});
