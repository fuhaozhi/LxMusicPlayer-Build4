/** 正在播放页：封面/歌词/进度/控制；歌词由当前音源脚本 getLyric 提供 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatTime, parseLrc, currentLrcIndex } from '../player/lrc';
import { usePlayer } from '../player/PlayerContext';
import { lyricText, toMusicInfo } from '../sourceManager';
import { useSourceManager } from '../sourceManager';
import type { LyricInfo } from '../lx-api/types.js';

export default function NowPlayingScreen({ manager }: { manager: ReturnType<typeof useSourceManager> }) {
  const { state, toggle, next, prev } = usePlayer();
  const [lyric, setLyric] = useState<LyricInfo | null>(null);
  const [lyricLoading, setLyricLoading] = useState(false);

  const song = state.song;

  // 播放中的歌曲变化时，用当前音源脚本拉歌词
  useEffect(() => {
    setLyric(null);
    if (!song) return;
    const api = manager.getApi();
    if (!api) return;
    let cancelled = false;
    setLyricLoading(true);
    const cap = api.getSource(song.source);
    if (!cap || !cap.actions.includes('lyric')) {
      setLyricLoading(false);
      return;
    }
    api
      .getLyric(song.source, toMusicInfo(song))
      .then(info => {
        if (!cancelled) setLyric(info);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLyricLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [song?.source, song?.id, manager.currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lrc = useMemo(() => parseLrc(lyricText(lyric)), [lyric]);
  const currentIdx = currentLrcIndex(lrc, state.currentTime);

  if (!song) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>暂无播放\n在「搜索」页点击歌曲开始播放</Text>
      </View>
    );
  }

  const openExternal = () => {
    if (state.url) {
      Linking.openURL(state.url).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {song.pic ? (
          <Image source={{ uri: song.pic }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.coverText}>♪</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={1}>{song.name}</Text>
        <Text style={styles.singer} numberOfLines={1}>{song.singer}</Text>

        {/* 歌词 */}
        <View style={styles.lyricBox}>
          {lyricLoading ? (
            <ActivityIndicator style={{ marginTop: 16 }} color="#8e8e93" />
          ) : lrc.length ? (
            <View style={styles.lrcList}>
              {lrc.map((line, i) => (
                <Text
                  key={i}
                  style={[styles.lrcLine, i === currentIdx && styles.lrcActive]}
                  numberOfLines={1}
                >
                  {line.text || '…'}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.lrcEmpty}>当前音源脚本未提供歌词（或该源不支持 lyric）</Text>
          )}
        </View>

        {/* 进度 */}
        <View style={styles.progressRow}>
          <Text style={styles.time}>{formatTime(state.currentTime)}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${state.duration > 0 ? Math.min(100, (state.currentTime / state.duration) * 100) : 0}%` as any },
              ]}
            />
          </View>
          <Text style={styles.time}>{formatTime(state.duration)}</Text>
        </View>

        {/* 控制 */}
        <View style={styles.controls}>
          <Pressable onPress={prev} style={styles.ctrlBtn} hitSlop={8}>
            <Text style={styles.ctrlIcon}>⏮</Text>
          </Pressable>
          <Pressable onPress={toggle} style={[styles.ctrlBtn, styles.playBtn]} hitSlop={8}>
            {state.buffering ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.ctrlIcon, styles.playIcon]}>{state.paused ? '▶' : '❚❚'}</Text>
            )}
          </Pressable>
          <Pressable onPress={next} style={styles.ctrlBtn} hitSlop={8}>
            <Text style={styles.ctrlIcon}>⏭</Text>
          </Pressable>
        </View>

        {state.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} numberOfLines={2}>{state.error}</Text>
            {state.url ? (
              <Pressable onPress={openExternal}>
                <Text style={styles.external}>改用系统浏览器打开</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, alignItems: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  emptyText: { color: '#8e8e93', fontSize: 15, textAlign: 'center', lineHeight: 24 },
  cover: { width: 200, height: 200, borderRadius: 12, backgroundColor: '#f2f2f7' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  coverText: { fontSize: 64, color: '#c7c7cc' },
  title: { fontSize: 20, fontWeight: '700', color: '#000', marginTop: 14, maxWidth: '100%' },
  singer: { fontSize: 14, color: '#8e8e93', marginTop: 4 },
  lyricBox: { width: '100%', minHeight: 120, marginTop: 12 },
  lrcList: { alignItems: 'center' },
  lrcLine: { fontSize: 14, color: '#8e8e93', paddingVertical: 3, textAlign: 'center' },
  lrcActive: { color: '#007aff', fontWeight: '700' },
  lrcEmpty: { color: '#8e8e93', fontSize: 13, textAlign: 'center', marginTop: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 16, gap: 8 },
  time: { fontSize: 11, color: '#8e8e93', fontVariant: ['tabular-nums'] },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e5e5ea', overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#007aff' },
  controls: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 28 },
  ctrlBtn: { padding: 8 },
  ctrlIcon: { fontSize: 26, color: '#007aff' },
  playBtn: { backgroundColor: '#007aff', borderRadius: 32, width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  playIcon: { fontSize: 22, color: '#fff' },
  errorBox: { marginTop: 20, alignItems: 'center', padding: 12, backgroundColor: '#fff5f5', borderRadius: 8, width: '100%' },
  errorText: { color: '#d70015', fontSize: 13, textAlign: 'center' },
  external: { color: '#007aff', fontSize: 13, marginTop: 8, textDecorationLine: 'underline' },
});
