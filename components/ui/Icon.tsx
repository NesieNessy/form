import React from 'react';
import type { IconKey } from '@/lib/types';
import { iconStrokeWidth } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const map: Record<IconKey, (typeof Icons)[keyof typeof Icons]> = {
  'trending-up': Icons.trendingUp,
  medal: Icons.medal,
  heart: Icons.heart,
  dumbbell: Icons.dumbbell,
  flame: Icons.flame,
  trophy: Icons.trophy,
  'check-circle': Icons.checkCircle,
};

export function Icon({ name, size = 20, color = '#fff' }: { name: IconKey; size?: number; color?: string }) {
  const Cmp = map[name];
  return <Cmp size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
