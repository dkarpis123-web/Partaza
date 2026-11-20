import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { colors } from '@/theme';

/** Defect marks per photo: photo address → points, each [x, y] as a share (0–1) of the picture's width and height. */
export type Marks = Record<string, number[][]>;

/** Moves marks from the old photo addresses to the new ones (same order), e.g. after an upload. */
export function remapMarks(marks: Marks | undefined, from: string[], to: string[]): Marks {
  const out: Marks = {};
  from.forEach((uri, i) => {
    const points = marks?.[uri];
    if (points && points.length > 0 && to[i]) out[to[i]] = points;
  });
  return out;
}

/** The whole photo, uncropped, with red rings where the seller marked a defect. With onAdd, a tap adds a ring. */
export function MarkedPhoto({ uri, marks, height, onAdd }: { uri: string; marks?: number[][]; height: number; onAdd?: (x: number, y: number) => void }) {
  const [size, setSize] = useState<{ uri: string; w: number; h: number } | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let active = true;
    Image.getSize(uri, (w, h) => active && setSize({ uri, w, h }), () => {});
    return () => {
      active = false;
    };
  }, [uri]);

  // Where the picture really is inside the box (it is letterboxed, never cropped).
  const natural = size && size.uri === uri && size.w > 0 && size.h > 0 ? size : null;
  const scale = natural && width > 0 ? Math.min(width / natural.w, height / natural.h) : 0;
  const iw = natural ? natural.w * scale : width;
  const ih = natural ? natural.h * scale : height;
  const left = (width - iw) / 2;
  const top = (height - ih) / 2;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%', height, backgroundColor: colors.ink }}>
      <Image source={{ uri }} accessibilityLabel="Dalies nuotrauka" resizeMode="contain" style={{ width: '100%', height }} />
      {natural && onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pažymėti defekto vietą"
          onPress={(e) => {
            const native = e.nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
            const x = (native.locationX ?? native.offsetX ?? 0) / iw;
            const y = (native.locationY ?? native.offsetY ?? 0) / ih;
            if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onAdd(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000);
          }}
          style={{ position: 'absolute', left, top, width: iw, height: ih }}
        />
      ) : null}
      {natural
        ? (marks ?? []).map(([x, y], i) => (
            <View
              key={`${x}-${y}-${i}`}
              pointerEvents="none"
              style={{ position: 'absolute', left: left + x * iw - 18, top: top + y * ih - 18, width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff' }}>
              <View style={{ flex: 1, borderRadius: 16, borderWidth: 3, borderColor: '#e02424' }} />
            </View>
          ))
        : null}
    </View>
  );
}
