import React, { useState } from 'react';
import { Pressable, StyleProp, Text, TextStyle } from 'react-native';
import { usePrivacy } from '@/lib/privacy';
import { strings } from '@/lib/strings';

/** A sensitive value: shown as dots while privacy blur is on, until tapped. */
export function Sensitive({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const hide = usePrivacy((s) => s.hideSensitive);
  const [shown, setShown] = useState(false);
  if (!hide || shown) return <Text style={style}>{children}</Text>;
  return (
    <Pressable onPress={() => setShown(true)} accessibilityRole="button" accessibilityLabel={strings.sensitiveHidden} hitSlop={6}>
      <Text style={style}>••••</Text>
    </Pressable>
  );
}
