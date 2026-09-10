/**
 * SongArt —— 通用歌曲封面组件。
 * song.pic 存在直接显示；为空时异步用网易云兜底补封面（fetchCover，带缓存），
 * 仍无则显示浅色占位块。列表页 / 播放页 / 迷你条共用，避免到处重复兜底逻辑。
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types';
import { fetchCover } from '../cover';

export default function SongArt({
  song,
  size,
  radius,
}: {
  song: Song;
  size: number;
  radius?: number;
}) {
  const [pic, setPic] = useState<string | null>(song.pic ?? null);
  const r = radius ?? Math.round(size / 5);

  useEffect(() => {
    let cancelled = false;
    setPic(song.pic ?? null);
    if (!song.pic) {
      fetchCover(song).then(url => {
        if (!cancelled && url) setPic(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [song]);

  if (pic) {
    return <Image source={{ uri: pic }} style={{ width: size, height: size, borderRadius: r }} resizeMode="cover" />;
  }
  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: r }]}>
      <Text style={[styles.note, { fontSize: Math.round(size * 0.42) }]}>♪</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F7F0' },
  note: { color: '#00B578', opacity: 0.45, lineHeight: undefined },
});
