/**
 * LxMusicPlayer —— 洛雪音乐自定义音源 · 自签 iOS 播放器
 * 浅色清新主题：搜索 → 音源取链 → 播放
 */
import React from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerProvider } from './src/player/PlayerContext';
import { useSourceManager } from './src/sourceManager';
import SearchScreen from './src/screens/SearchScreen';
import SourceScreen from './src/screens/SourceScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';

type Tab = 'search' | 'source' | 'playing';

const TABS: { id: Tab; label: string }[] = [
  { id: 'search', label: '搜索' },
  { id: 'source', label: '音源' },
  { id: 'playing', label: '播放' },
];

function Main() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = React.useState<Tab>('search');
  const manager = useSourceManager();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        {tab === 'search' ? <SearchScreen getApi={manager.getApi} /> : null}
        {tab === 'source' ? <SourceScreen manager={manager} /> : null}
        {tab === 'playing' ? <NowPlayingScreen manager={manager} /> : null}
      </View>
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
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <Main />
      </PlayerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { flex: 1 },
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
