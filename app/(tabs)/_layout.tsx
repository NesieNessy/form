import { Tabs } from 'expo-router';
import { Dumbbell, House, LineChart, Menu } from 'lucide-react-native';
import React from 'react';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth } from '@/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          height: 84,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: fontFamily.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: strings.home,
          tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: strings.workouts,
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: strings.trends,
          tabBarIcon: ({ color, size }) => <LineChart color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: strings.more,
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
    </Tabs>
  );
}
