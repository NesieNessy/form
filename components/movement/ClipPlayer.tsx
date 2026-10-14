import React, { forwardRef, useImperativeHandle } from 'react';
import { Text } from 'react-native';
import { strings } from '@/lib/strings';
import { colors, fontFamily } from '@/theme/colors';

export type ClipPlayerHandle = { seek: (seconds: number) => void; currentTime: () => number };

/** Native playback needs a video module that is not in the app yet (ClipPlayer.web.tsx plays on the web). */
export const ClipPlayer = forwardRef<ClipPlayerHandle, { uri: string | null }>(function ClipPlayer(_props, ref) {
  useImperativeHandle(ref, () => ({ seek: () => undefined, currentTime: () => 0 }));
  return <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular }}>{strings.playbackNative}</Text>;
});
