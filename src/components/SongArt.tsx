/**
 * SongArt —— 通用歌曲封面组件。
 * 封面统一走 fetch 下载 + base64（resolveCover）：优先歌曲自带封面，缺失或加载失败时
 * 用腾讯接口兜底；全部失败显示中性浅灰占位（不显示彩色自制封面）。
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types';
import { resolveCover } from '../cover';

export default function SongArt({
  song,
  size,
  radius,
}: {
  song: Song;
  size: number;
  radius?: number;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const r = radius ?? Math.round(size / 5);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    resolveCover(song).then(dataUri => {
      if (!cancelled && dataUri) setUri(dataUri);
    });
    return () => {
      cancelled = true;
    };
  }, [song]);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: r }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: r }]}>
      <Text style={[styles.note, { fontSize: Math.round(size * 0.42) }]}>♪</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F2F5' },
  note: { color: '#B4B9C0' },
});
