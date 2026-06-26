import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

import { FeedScreen } from '../screens/FeedScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { NoteReaderScreen } from '../screens/NoteReaderScreen';
import { PillarEditScreen } from '../screens/PillarEditScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ShareScreen } from '../screens/ShareScreen';
import { colors } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg.primary,
    card: colors.bg.primary,
    primary: colors.accent.gold,
    text: colors.text.primary as string,
    border: colors.border as string,
  },
};

interface Props {
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
  onReady?: () => void;
}

export function RootNavigator({ navigationRef, onReady }: Props) {
  return (
    <NavigationContainer ref={navigationRef} theme={theme} onReady={onReady}>
      <Stack.Navigator
        initialRouteName="Feed"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.primary },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Share" component={ShareScreen} options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="PillarEdit" component={PillarEditScreen} />
        <Stack.Screen name="Notes" component={NotesScreen} />
        <Stack.Screen name="NoteReader" component={NoteReaderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
