import {
  CheckCircle2,
  Dumbbell,
  Flame,
  Heart,
  Medal,
  Trophy,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import type { IconKey } from '@/lib/types';
import { iconStrokeWidth } from '@/theme/colors';

const map: Record<IconKey, LucideIcon> = {
  'trending-up': TrendingUp,
  medal: Medal,
  heart: Heart,
  dumbbell: Dumbbell,
  flame: Flame,
  trophy: Trophy,
  'check-circle': CheckCircle2,
};

export function Icon({ name, size = 20, color = '#fff' }: { name: IconKey; size?: number; color?: string }) {
  const Cmp = map[name];
  return <Cmp size={size} color={color} strokeWidth={iconStrokeWidth} />;
}
