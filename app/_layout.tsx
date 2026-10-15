import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SignInScreen } from '@/components/auth/SignInScreen';
import { initAuth, useAuthStore } from '@/lib/auth';
import { colors, fontFamily, layout, themeMode } from '@/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Inter is FORM's typeface throughout the app. Any <Text> without an
// explicit fontFamily still falls back to the regular weight instead of
// the OS system font.
const TextAny = Text as unknown as { defaultProps?: { style?: unknown } };
TextAny.defaultProps = TextAny.defaultProps ?? {};
TextAny.defaultProps.style = [{ fontFamily: fontFamily.regular }, TextAny.defaultProps.style];

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= layout.desktopBreakpoint;

  const authStatus = useAuthStore((s) => s.status);
  const ready = fontsLoaded && authStatus !== 'loading';
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.backdrop, isDesktopWeb && styles.desktopBackdrop]}>
        <View style={[styles.appContainer, isDesktopWeb && styles.desktopContainer]}>
          {/* Signed out, no route is mounted at all, so no screen can show the previous account's data. */}
          {authStatus === 'signedOut' ? (
            <SignInScreen />
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: reducedMotion ? 'none' : 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="workout-player" options={{ gestureEnabled: false }} />
            </Stack>
          )}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  desktopBackdrop: {
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
  },
  appContainer: {
    flex: 1,
    width: '100%',
  },
  desktopContainer: {
    maxWidth: layout.containerMaxWidth,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: themeMode === 'dark' ? 0.6 : 0.12,
    shadowRadius: 48,
  },
});
