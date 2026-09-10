/**
 * SongArt —— 通用歌曲封面组件。
 * 优先显示 song.pic；原图加载失败或无图时，异步用腾讯接口兜底补封面（fetchCover，带缓存），
 * 仍无则显示浅色占位块。列表页 / 播放页 / 迷你条共用。
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
  const [uri, setUri] = useState<string | null>(song.pic ?? null);
  const r = radius ?? Math.round(size / 5);

  useEffect(() => {
    let cancelled = false;
    setUri(song.pic ?? null);
    if (!song.pic) {
      fetchCover(song).then(url => {
        if (!cancelled && url) setUri(url);
      });
    }
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
        onError={() => {
          // 原图加载失败（防盗链/失效）→ 忽略原图，换兜底封面
          fetchCover(song, { ignorePic: true }).then(url => {
            if (url && url !== uri) setUri(url);
          });
        }}
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
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F7F0' },
  note: { color: '#00B578', opacity: 0.45 },
});
