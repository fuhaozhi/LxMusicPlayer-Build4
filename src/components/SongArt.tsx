/**
 * SongArt —— 通用歌曲封面组件。
 * 优先显示 song.pic；原图加载失败或无图时，异步用腾讯接口兜底补封面（fetchCover，带缓存）；
 * 仍无封面时显示按歌曲生成的彩色封面卡（hue 由歌名/ID 生成），保证任何情况下都不会空白。
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Song } from '../types';
import { fetchCover } from '../cover';

function hueOf(song: Song): number {
  const s = `${song.source}:${song.id}:${song.name}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

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
  const [failed, setFailed] = useState(false);
  const r = radius ?? Math.round(size / 5);
  const hue = hueOf(song);

  useEffect(() => {
    let cancelled = false;
    setUri(song.pic ?? null);
    setFailed(false);
    if (!song.pic) {
      fetchCover(song).then(url => {
        if (!cancelled && url) setUri(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [song]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: r }}
        resizeMode="cover"
        onError={() => {
          // 原图加载失败（防盗链/失效）→ 忽略原图换兜底封面；兜底也失败则显示彩色占位
          setFailed(true);
          fetchCover(song, { ignorePic: true }).then(url => {
            if (url && url !== uri) {
              setUri(url);
              setFailed(false);
            }
          });
        }}
      />
    );
  }
  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: `hsl(${hue}, 58%, 88%)`,
        },
      ]}
    >
      <Text style={[styles.note, { fontSize: Math.round(size * 0.42), color: `hsl(${hue}, 55%, 52%)` }]}>♪</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  note: { fontWeight: '700', opacity: 0.85 },
});
