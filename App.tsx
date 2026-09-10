/**
 * LxMusicPlayer —— 洛雪音乐自定义音源 · 自签 iOS 播放器
 * 结构：主页（每日推荐）/ 音乐馆 / 我的 + 全屏页面（搜索/设置/歌单/播放/报告）
 * 音源管理在「设置」中，播放条常驻底部。
 */
import React from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LibraryProvider, useLibrary } from './src/library';
import { PlayerProvider, usePlayer } from './src/player/PlayerContext';
import { useSourceManager } from './src/sourceManager';
import PlayerBar from './src/player/PlayerBar';
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import MineScreen from './src/screens/MineScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SearchScreen from './src/screens/SearchScreen';
import PlaylistScreen from './src/screens/PlaylistScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import ReportScreen from './src/screens/ReportScreen';
import type { Collection, LocalPlaylist } from './src/types';

type Tab = 'home' | 'explore' | 'mine';

type Overlay =
  | { kind: 'search' }
  | { kind: 'settings' }
  | { kind: 'player' }
  | { kind: 'report' }
  | { kind: 'collection'; collection: Collection }
  | { kind: 'local'; playlist: LocalPlaylist };

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: '主页' },
  { id: 'explore', label: '音乐馆' },
  { id: 'mine', label: '我的' },
];

function Main() {
  const insets = useSafeAreaInsets();
  const manager = useSourceManager();
  const { deletePlaylist } = useLibrary();
  const { state, restoreLast } = usePlayer();
  const [tab, setTab] = React.useState<Tab>('home');
  const [overlay, setOverlay] = React.useState<Overlay | null>(null);
  const restoredRef = React.useRef(false);

  // 启动：自动加载上次使用的音源（无需每次手动点）
  React.useEffect(() => {
    const lastId = manager.getLastSourceId();
    if (lastId) {
      void manager.loadSource(lastId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 音源加载成功后：自动恢复上次播放的歌曲（含进度续播）
  React.useEffect(() => {
    if (restoredRef.current) return;
    const api = manager.getApi();
    if (api) {
      restoredRef.current = true;
      void restoreLast(api);
    }
  }, [manager.loading, manager.currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => setOverlay(null);

  const openCollection = (c: Collection) => setOverlay({ kind: 'collection', collection: c });
  const openLocal = (pl: LocalPlaylist) => setOverlay({ kind: 'local', playlist: pl });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {overlay === null ? (
        <>
          <View style={styles.content}>
            {tab === 'home' ? (
              <HomeScreen onSearch={() => setOverlay({ kind: 'search' })} onOpenCollection={openCollection} />
            ) : null}
            {tab === 'explore' ? <ExploreScreen onOpenCollection={openCollection} /> : null}
            {tab === 'mine' ? (
              <MineScreen
                getApi={manager.getApi}
                onOpenSettings={() => setOverlay({ kind: 'settings' })}
                onOpenCollection={openCollection}
                onOpenLocalPlaylist={openLocal}
                onOpenReport={() => setOverlay({ kind: 'report' })}
              />
            ) : null}
          </View>
          {state.song ? <PlayerBar onOpen={() => setOverlay({ kind: 'player' })} /> : null}
          <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <Pressable key={t.id} style={styles.tabItem} onPress={() => setTab(t.id)}>
                  <View style={[styles.capsule, active && styles.capsuleActive]}>
                    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.overlay}>
          {overlay.kind === 'search' ? <SearchScreen getApi={manager.getApi} onBack={close} /> : null}
          {overlay.kind === 'settings' ? <SettingsScreen manager={manager} onBack={close} /> : null}
          {overlay.kind === 'player' ? <NowPlayingScreen manager={manager} onBack={close} /> : null}
          {overlay.kind === 'report' ? <ReportScreen onBack={close} /> : null}
          {overlay.kind === 'collection' ? (
            <PlaylistScreen
              title={overlay.collection.name}
              desc={overlay.collection.desc}
              mode="collection"
              collection={overlay.collection}
              getApi={manager.getApi}
              onBack={close}
            />
          ) : null}
          {overlay.kind === 'local' ? (
            <PlaylistScreen
              title={overlay.playlist.name}
              mode="local"
              local={overlay.playlist}
              getApi={manager.getApi}
              onBack={close}
              onDeleteLocal={() => {
                deletePlaylist(overlay.playlist.id);
                close();
              }}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <LibraryProvider>
        <PlayerProvider>
          <Main />
        </PlayerProvider>
      </LibraryProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { flex: 1 },
  overlay: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EDEFF2',
    paddingTop: 6,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  capsule: { paddingHorizontal: 26, paddingVertical: 7, borderRadius: 20 },
  capsuleActive: { backgroundColor: '#E6F7F0' },
  tabLabel: { fontSize: 13, color: '#8A9099' },
  tabLabelActive: { color: '#00B578', fontWeight: '600' },
});

export default App;
