import { Tabs } from 'expo-router';
import React from 'react';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth } from '@/theme/colors';
import { Icons } from '@/theme/icons';

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
          tabBarIcon: ({ color, size }) => <Icons.house color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: strings.workouts,
          tabBarIcon: ({ color, size }) => <Icons.dumbbell color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: strings.trends,
          tabBarIcon: ({ color, size }) => <Icons.lineChart color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: strings.more,
          tabBarIcon: ({ color, size }) => <Icons.menu color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
    </Tabs>
  );
}
