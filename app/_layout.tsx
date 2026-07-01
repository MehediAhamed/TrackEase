import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useScanStore } from '../store/scanStore';

export default function RootLayout() {
  const loadScans = useScanStore((s) => s.loadScans);

  useEffect(() => {
    loadScans();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0A0E1A' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="result"
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="history" />
      </Stack>
    </GestureHandlerRootView>
  );
}
