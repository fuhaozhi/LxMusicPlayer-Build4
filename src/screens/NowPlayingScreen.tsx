/**
 * 正在播放页 —— 网易云手机端风格重制
 * 左：播放模式（顺序/单曲循环/随机，图标切换）；右：播放列表（底部弹层，点击切歌）
 * 红白主题：#EC4141 主红；封面居中大卡 + 歌词自动滚动 + 可拖动进度条 + 定时关闭
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { formatTime, parseLrc, currentLrcIndex } from '../player/lrc';
import { usePlayer, type PlayMode } from '../player/PlayerContext';
import { lyricText, toMusicInfo } from '../sourceManager';
import { useSourceManager } from '../sourceManager';
import { fetchLyricByName } from '../lyricFallback';
import SongArt from '../components/SongArt';
import type { LyricInfo } from '../lx-api/types.js';

const LINE_H = 30;
const RED = '#EC4141';

/** 简洁线条播放模式图标（顺序=三线列表 / 单曲=圆环+1 / 随机=交叉箭头） */
function ModeIcon({ mode, color }: { mode: PlayMode; color: string }) {
  if (mode === 'order') {
    return (
      <View style={{ width: 20, height: 14, justifyContent: 'space-between' }}>
        <View style={{ height: 2, borderRadius: 1, backgroundColor: color }} />
        <View style={{ height: 2, borderRadius: 1, backgroundColor: color }} />
        <View style={{ height: 2, borderRadius: 1, backgroundColor: color }} />
      </View>
    );
  }
  if (mode === 'single') {
    return (
      <View
        style={{
          width: 20,
          height: 20,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '700', color }}>1</Text>
      </View>
    );
  }
  return (
    <View style={{ width: 20, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color }}>⇄</Text>
    </View>
  );
}

/** 播放模式名称 */
const MODE_META: Record<PlayMode, { name: string }> = {
  order: { name: '顺序播放' },
  single: { name: '单曲循环' },
  random: { name: '随机播放' },
};

export default function NowPlayingScreen({
  manager,
  onBack,
}: {
  manager: ReturnType<typeof useSourceManager>;
  onBack: () => void;
}) {
  const {
    state,
    toggle,
    next,
    prev,
    seekTo,
    sleepRemaining,
    startSleepTimer,
    cancelSleepTimer,
    mode,
    cycleMode,
    queue,
    play,
  } = usePlayer();
  const [lyric, setLyric] = useState<LyricInfo | null>(null);
  const [lyricLoading, setLyricLoading] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const lrcRef = useRef<ScrollViewInstance>(null);

  // ---- 进度条拖动 seek（拖动只预览，松手才提交一次） ----
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

  const handleDragPreview = (moveX: number) => {
    const duration = durationRef.current;
    if (!duration) return;
    setDragPos(ratioFromX(moveX) * duration);
  };

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

  // 播放中的歌曲变化时拉歌词
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
    if (state.url) Linking.openURL(state.url).catch(() => {});
  };

  const modeMeta = MODE_META[mode];

  return (
    <View style={styles.container}>
      {/* 顶栏：返回 | 歌名 | 定时关闭 */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerBtn} hitSlop={8}>
          <Text style={styles.headerIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {song.name}
          </Text>
        </View>
        <Pressable style={styles.headerBtn} onPress={() => setTimerOpen(true)} hitSlop={8}>
          <Text style={[styles.headerIconSmall, sleepRemaining > 0 && styles.timerActive]}>⏱</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 封面 */}
        <View style={styles.coverWrap}>
          <View style={styles.coverShadow}>
            <SongArt song={song} size={250} radius={18} />
          </View>
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={styles.singer} numberOfLines={1}>
          {song.singer}
        </Text>
        {song.album && !/封面|设计：/.test(song.album) ? (
          <Text style={styles.album} numberOfLines={1}>
            {song.album}
          </Text>
        ) : null}

        {/* 歌词卡片 */}
        <View style={styles.lyricCard}>
          {lyricLoading ? (
            <ActivityIndicator style={styles.lyricLoading} color={RED} />
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

        {/* 进度 */}
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

        {/* 控制区：左模式 / 中播放控制 / 右播放列表 */}
        <View style={styles.controlsRow}>
          {/* 播放模式（左） */}
          <Pressable style={styles.sideBtn} onPress={cycleMode} hitSlop={8}>
            <ModeIcon mode={mode} color={mode === 'order' ? '#8A9099' : RED} />
            <Text style={styles.sideBtnText}>{modeMeta.name}</Text>
          </Pressable>

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

          {/* 播放列表（右） */}
          <Pressable style={styles.sideBtn} onPress={() => setListOpen(true)} hitSlop={8}>
            <Text style={styles.sideBtnIcon}>☰</Text>
            <Text style={styles.sideBtnText}>列表</Text>
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

      {/* 定时关闭选择面板 */}
      <Modal visible={timerOpen} transparent animationType="fade" onRequestClose={() => setTimerOpen(false)}>
        <Pressable style={styles.mask} onPress={() => setTimerOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>定时关闭</Text>
            <Text style={styles.sheetHint}>到点后自动暂停播放</Text>
            {[15, 30, 45, 60, 90].map(min => (
              <Pressable
                key={min}
                style={styles.sheetRow}
                onPress={() => {
                  startSleepTimer(min);
                  setTimerOpen(false);
                }}
              >
                <Text style={styles.sheetRowText}>{min} 分钟</Text>
                <Text style={styles.sheetRowGo}>›</Text>
              </Pressable>
            ))}
            {sleepRemaining > 0 ? (
              <Pressable
                style={[styles.sheetRow, styles.sheetCancelRow]}
                onPress={() => {
                  cancelSleepTimer();
                  setTimerOpen(false);
                }}
              >
                <Text style={styles.sheetCancelText}>取消定时（剩余 {formatTime(sleepRemaining)}）</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.sheetCancelRow} onPress={() => setTimerOpen(false)}>
              <Text style={styles.sheetClose}>关闭</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 播放列表弹层 */}
      <Modal visible={listOpen} transparent animationType="slide" onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.mask} onPress={() => setListOpen(false)}>
          <View style={styles.listSheet}>
            <View style={styles.listHandle} />
            <Text style={styles.listTitle}>播放列表（{queue.length} 首）</Text>
            <FlatList
              data={queue}
              keyExtractor={(s, i) => `${s.source}-${s.id}-${i}`}
              style={styles.listBody}
              renderItem={({ item: s, index }) => {
                const isCurrent =
                  state.song && s.source === state.song.source && s.id === state.song.id;
                return (
                  <Pressable
                    style={styles.listRow}
                    onPress={() => {
                      setListOpen(false);
                      void play(s, manager.getApi(), queue);
                    }}
                  >
                    <Text style={[styles.listIndex, isCurrent && styles.listCurrent]}>
                      {isCurrent ? '♪' : index + 1}
                    </Text>
                    <View style={styles.listMain}>
                      <Text
                        style={[styles.listName, isCurrent && styles.listCurrent]}
                        numberOfLines={1}
                      >
                        {s.name}
                      </Text>
                      <Text style={styles.listSinger} numberOfLines={1}>
                        {s.singer}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 36, color: '#1F2329', lineHeight: 36, marginTop: -4 },
  headerIconSmall: { fontSize: 19, color: '#1F2329' },
  timerActive: { color: RED },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#1F2329' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 34, alignItems: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F7' },
  emptyNote: { fontSize: 56, color: '#DDE3E9' },
  emptyTitle: { fontSize: 17, color: '#5B6066', fontWeight: '600', marginTop: 10 },
  emptyHint: { fontSize: 13, color: '#B4B9C0', marginTop: 6 },
  coverWrap: { marginTop: 6 },
  coverShadow: {
    shadowColor: '#0A2540',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2329', marginTop: 18, maxWidth: '100%' },
  singer: { fontSize: 13, color: '#8A9099', marginTop: 5 },
  album: { fontSize: 11, color: '#C0C6CC', marginTop: 4 },
  lyricCard: {
    width: '100%',
    height: 230,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 16,
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
  lrcActive: { color: RED, fontWeight: '700', fontSize: 15 },
  lrcEmpty: { color: '#B4B9C0', fontSize: 13, textAlign: 'center', marginTop: 24 },
  progressRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 16, gap: 8 },
  time: { fontSize: 11, color: '#B4B9C0', fontVariant: ['tabular-nums'] },
  progressTrack: { flex: 1, height: 18, justifyContent: 'center', marginHorizontal: 2 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: RED },
  progressThumb: {
    position: 'absolute',
    top: 5,
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: RED,
  },
  controlsRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 14 },
  sideBtn: { width: 62, alignItems: 'center', paddingVertical: 4 },
  sideBtnIcon: { fontSize: 17 },
  sideBtnText: { fontSize: 10, color: '#8A9099', marginTop: 2 },
  controls: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 },
  ctrlBtn: { padding: 6 },
  ctrlIcon: { fontSize: 22, color: '#1F2329' },
  playBtn: {
    backgroundColor: RED,
    borderRadius: 30,
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: RED,
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  playIcon: { fontSize: 23, color: '#fff' },
  mask: { flex: 1, backgroundColor: 'rgba(20,24,28,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 30,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#1F2329', textAlign: 'center' },
  sheetHint: { fontSize: 12, color: '#B4B9C0', textAlign: 'center', marginTop: 4, marginBottom: 6 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F2F5',
  },
  sheetRowText: { fontSize: 15, color: '#1F2329' },
  sheetRowGo: { fontSize: 18, color: '#C0C6CC' },
  sheetCancelRow: { justifyContent: 'center', marginTop: 4 },
  sheetCancelText: { fontSize: 14, color: '#F53F3F', textAlign: 'center' },
  sheetClose: { fontSize: 14, color: '#8A9099', textAlign: 'center' },
  listSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '72%',
    paddingBottom: 24,
  },
  listHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 8,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2329',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  listBody: { paddingHorizontal: 16 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F2F5',
  },
  listIndex: { width: 30, fontSize: 14, color: '#C0C6CC', textAlign: 'center' },
  listCurrent: { color: RED, fontWeight: '700' },
  listMain: { flex: 1, paddingLeft: 8 },
  listName: { fontSize: 15, color: '#1F2329' },
  listSinger: { fontSize: 12, color: '#8A9099', marginTop: 2 },
  errorBox: {
    marginTop: 18,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF1F0',
    borderRadius: 14,
    width: '100%',
  },
  errorText: { color: '#F53F3F', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  external: { color: RED, fontSize: 13, marginTop: 8, textDecorationLine: 'underline' },
});
