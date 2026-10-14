import React, { forwardRef, useImperativeHandle, useRef } from 'react';

export type ClipPlayerHandle = { seek: (seconds: number) => void; currentTime: () => number };

/** A plain browser video player for a short-lived signed link. */
export const ClipPlayer = forwardRef<ClipPlayerHandle, { uri: string | null }>(function ClipPlayer({ uri }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({
    seek: (s) => {
      if (!video.current) return;
      video.current.currentTime = s;
      void video.current.play().catch(() => undefined);
    },
    currentTime: () => video.current?.currentTime ?? 0,
  }));
  if (!uri) return null;
  return <video ref={video} src={uri} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 420, borderRadius: 12, background: '#000' }} aria-label="Clip" />;
});
