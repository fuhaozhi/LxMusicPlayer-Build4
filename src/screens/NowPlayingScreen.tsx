/**
 * 正在播放页：封面/歌词/进度/控制；歌词由当前音源脚本 getLyric 提供
 * 浅色清新风：大封面卡片 + 歌词自动滚动 + 圆角控制
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { formatTime, parseLrc, currentLrcIndex } from '../player/lrc';
import { usePlayer } from '../player/PlayerContext';
import { lyricText, toMusicInfo } from '../sourceManager';
import { useSourceManager } from '../sourceManager';
import { fetchLyricByName } from '../lyricFallback';
import SongArt from '../components/SongArt';
import type { LyricInfo } from '../lx-api/types.js';

const LINE_H = 30;

export default function NowPlayingScreen({
  manager,
  onBack,
}: {
  manager: ReturnType<typeof useSourceManager>;
  onBack: () => void;
}) {
  const { state, toggle, next, prev, seekTo } = usePlayer();
  const [lyric, setLyric] = useState<LyricInfo | null>(null);
  const [lyricLoading, setLyricLoading] = useState(false);
  const lrcRef = useRef<ScrollViewInstance>(null);

  // ---- 进度条拖动 seek ----
  // 拖动中只做本地预览（不触发播放器 seek），松手才真正跳转一次，
  // 避免高频 seek 导致播放器排队执行、进度来回乱跳
  const trackRef = useRef<any>(null);
  const trackLayoutRef = useRef({ x: 0, width: 0 });
  const durationRef = useRef(0);
  durationRef.current = state.duration;
  const seekToRef = useRef(seekTo);
  seekToRef.current = seekTo;
  const [dragPos, setDragPos] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const ratioFromX = (moveX: number): number => {
    const { x, width } = trackLayoutRef.current;
    if (!width) return 0;
    return Math.min(1, Math.max(0, (moveX - x) / width));
  };

  // 拖动中：更新本地预览位置
  const handleDragPreview = (moveX: number) => {
    const duration = durationRef.current;
    if (!duration) return;
    setDragPos(ratioFromX(moveX) * duration);
  };

  // 松手：真正 seek 一次
  const handleSeekCommit = (moveX: number) => {
    const duration = durationRef.current;
    if (!duration) return;
    seekToRef.current(ratioFromX(moveX) * duration);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_e, g) => {
        draggingRef.current = true;
        handleDragPreview(g.moveX);
      },
      onPanResponderMove: (_e, g) => {
        if (draggingRef.current) handleDragPreview(g.moveX);
      },
      onPanResponderRelease: (_e, g) => {
        draggingRef.current = false;
        setDragPos(null);
        handleSeekCommit(g.moveX);
      },
      onPanResponderTerminate: (_e, g) => {
        draggingRef.current = false;
        setDragPos(null);
        handleSeekCommit(g.moveX);
      },
    }),
  ).current;

  const song = state.song;

  // 播放中的歌曲变化时拉歌词：优先音源脚本（有 lyric 能力时），否则用网易云兜底
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLyric(null);
    if (!song) return;
    const api = manager.getApi();
    let cancelled = false;
    setLyricLoading(true);
    const run = async () => {
      const cap = api ? api.getSource(song.source) : null;
      if (api && cap && cap.actions.includes('lyric')) {
        try {
          const info = await api.getLyric(song.source, toMusicInfo(song));
          if (!cancelled && info) {
            setLyric(info);
            return;
          }
        } catch {
          /* 脚本歌词失败则走兜底 */
        }
      }
      const info = await fetchLyricByName(song);
      if (!cancelled) setLyric(info);
    };
    run().finally(() => {
      if (!cancelled) setLyricLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [song?.source, song?.id, manager.currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lrc = useMemo(() => parseLrc(lyricText(lyric)), [lyric]);
  const currentIdx = currentLrcIndex(lrc, state.currentTime);

  // 歌词自动滚动到当前行
  useEffect(() => {
    if (currentIdx >= 0) {
      lrcRef.current?.scrollTo({ y: Math.max(0, currentIdx * LINE_H - 80), animated: true });
    }
  }, [currentIdx]);

  if (!song) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyNote}>♪</Text>
        <Text style={styles.emptyTitle}>还没有播放</Text>
        <Text style={styles.emptyHint}>去「搜索」页点一首歌开始</Text>
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
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>正在播放</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.coverShadow}>
          <SongArt song={song} size={236} radius={22} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={styles.singer} numberOfLines={1}>
          {song.singer}
        </Text>

        {/* 歌词卡片 */}
        <View style={styles.lyricCard}>
          {lyricLoading ? (
            <ActivityIndicator style={styles.lyricLoading} color="#00B578" />
          ) : lrc.length ? (
            <ScrollView
              ref={lrcRef}
              style={styles.lrcScroll}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
            >
              {lrc.map((line, i) => (
                <Text
                  key={i}
                  style={[styles.lrcLine, i === currentIdx && styles.lrcActive]}
                  numberOfLines={1}
                >
                  {line.text || '…'}
                </Text>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.lrcEmpty}>当前音源未提供歌词</Text>
          )}
        </View>

        {/* 进度（可拖动/点击跳转）；拖动中显示预览位置，松手才 seek */}
        <View style={styles.progressRow}>
          <Text style={styles.time}>{formatTime(dragPos ?? state.currentTime)}</Text>
          <View
            ref={trackRef}
            style={styles.progressTrack}
            onLayout={() => {
              trackRef.current?.measureInWindow((mx: number, _my: number, w: number) => {
                trackLayoutRef.current = { x: mx, width: w };
              });
            }}
            {...pan.panHandlers}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    state.duration > 0
                      ? Math.min(100, ((dragPos ?? state.currentTime) / state.duration) * 100)
                      : 0
                  }%` as any,
                },
              ]}
            />
            <View
              style={[
                styles.progressThumb,
                {
                  left: `${
                    state.duration > 0
                      ? Math.min(100, ((dragPos ?? state.currentTime) / state.duration) * 100)
                      : 0
                  }%` as any,
                },
              ]}
            />
          </View>
          <Text style={styles.time}>{formatTime(state.duration)}</Text>
        </View>

        {/* 控制 */}
        <View style={styles.controls}>
          <Pressable onPress={prev} style={styles.ctrlBtn} hitSlop={8}>
            <Text style={styles.ctrlIcon}>◁◁</Text>
          </Pressable>
          <Pressable onPress={toggle} style={[styles.ctrlBtn, styles.playBtn]} hitSlop={8}>
            {state.buffering ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.ctrlIcon, styles.playIcon]}>{state.paused ? '▶' : '❚❚'}</Text>
            )}
          </Pressable>
          <Pressable onPress={next} style={styles.ctrlBtn} hitSlop={8}>
            <Text style={styles.ctrlIcon}>▷▷</Text>
          </Pressable>
        </View>

        {state.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} numberOfLines={3}>
              {state.error}
            </Text>
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
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  backText: { fontSize: 34, color: '#1F2329', lineHeight: 34, marginTop: -4 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1F2329' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, alignItems: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F6F8' },
  emptyNote: { fontSize: 56, color: '#DDE3E9' },
  emptyTitle: { fontSize: 17, color: '#5B6066', fontWeight: '600', marginTop: 10 },
  emptyHint: { fontSize: 13, color: '#B4B9C0', marginTop: 6 },
  coverShadow: {
    shadowColor: '#0A2540',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: { fontSize: 19, fontWeight: '700', color: '#1F2329', marginTop: 18, maxWidth: '100%' },
  singer: { fontSize: 13, color: '#8A9099', marginTop: 5 },
  lyricCard: {
    width: '100%',
    height: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginTop: 18,
    overflow: 'hidden',
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  lrcScroll: { flex: 1, paddingVertical: 6 },
  lyricLoading: { marginTop: 26 },
  lrcLine: {
    height: LINE_H,
    lineHeight: LINE_H,
    fontSize: 14,
    color: '#8A9099',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  lrcActive: { color: '#00B578', fontWeight: '700', fontSize: 15 },
  lrcEmpty: { color: '#B4B9C0', fontSize: 13, textAlign: 'center', marginTop: 24 },
  progressRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 18, gap: 8 },
  time: { fontSize: 11, color: '#B4B9C0', fontVariant: ['tabular-nums'] },
  progressTrack: {
    flex: 1,
    height: 18,
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: '#00B578' },
  progressThumb: {
    position: 'absolute',
    top: 5,
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: '#00B578',
  },
  controls: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 34 },
  ctrlBtn: { padding: 8 },
  ctrlIcon: { fontSize: 22, color: '#00B578' },
  playBtn: {
    backgroundColor: '#00B578',
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00B578',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  playIcon: { fontSize: 24, color: '#fff' },
  errorBox: {
    marginTop: 20,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF1F0',
    borderRadius: 14,
    width: '100%',
  },
  errorText: { color: '#F53F3F', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  external: { color: '#00B578', fontSize: 13, marginTop: 8, textDecorationLine: 'underline' },
});
