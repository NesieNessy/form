import { Tabs } from 'expo-router';
import React from 'react';
import { strings } from '@/lib/strings';
import { useLayout } from '@/lib/useLayout';
import { colors, fontFamily, iconStrokeWidth } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/** Today · Train · Progress · Health · More (docs/concepts/11-frontend-ux-ui-architecture.md, decided 2026-10-14). */
export default function TabsLayout() {
  const { size } = useLayout();
  // Phones get the bottom tab bar; tablets a rail with icons and labels below; desktops a sidebar with labels beside the icons.
  const side = size !== 'mobile';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.action,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarPosition: side ? 'left' : 'bottom',
        tabBarVariant: side ? 'material' : 'uikit',
        tabBarLabelPosition: size === 'desktop' ? 'beside-icon' : 'below-icon',
        tabBarStyle: side
          ? { backgroundColor: colors.bgElevated, borderRightColor: colors.border, minWidth: size === 'desktop' ? 200 : 88, paddingTop: 16 }
          : { backgroundColor: colors.bgElevated, borderTopColor: colors.border, height: 84, paddingTop: 8 },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: fontFamily.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: strings.tabToday,
          tabBarIcon: ({ color, size }) => <Icons.house color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: strings.tabTrain,
          tabBarIcon: ({ color, size }) => <Icons.dumbbell color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: strings.tabProgress,
          tabBarIcon: ({ color, size }) => <Icons.lineChart color={color} size={size} strokeWidth={iconStrokeWidth} />,
        }}
      />
      <Tabs.Screen
        name="health-hub"
        options={{
          title: strings.tabHealth,
          tabBarIcon: ({ color, size }) => <Icons.heartPulse color={color} size={size} strokeWidth={iconStrokeWidth} />,
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
