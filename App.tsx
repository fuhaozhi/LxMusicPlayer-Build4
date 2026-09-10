/**
 * LxMusicPlayer —— 洛雪音乐自定义音源 · 自签 iOS 播放器
 * 搜索（内置公开源）→ 音源脚本取链（awaw.cc 8 源）→ 播放
 */
import React from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerProvider } from './src/player/PlayerContext';
import { useSourceManager } from './src/sourceManager';
import SearchScreen from './src/screens/SearchScreen';
import SourceScreen from './src/screens/SourceScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';

type Tab = 'search' | 'source' | 'playing';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'search', label: '搜索', icon: '🔍' },
  { id: 'source', label: '音源', icon: '📡' },
  { id: 'playing', label: '播放', icon: '▶' },
];

function Main() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const [tab, setTab] = React.useState<Tab>('search');
  const manager = useSourceManager();

  const bg = isDark ? '#000' : '#fff';
  const fg = isDark ? '#fff' : '#000';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.content}>
        {tab === 'search' ? <SearchScreen getApi={manager.getApi} /> : null}
        {tab === 'source' ? <SourceScreen manager={manager} /> : null}
        {tab === 'playing' ? <NowPlayingScreen manager={manager} /> : null}
      </View>
      <View style={[styles.tabBar, { backgroundColor: bg, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map(t => (
          <Pressable key={t.id} style={styles.tabItem} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabIcon, tab === t.id && styles.tabIconActive]}>{t.icon}</Text>
            <Text style={[styles.tabLabel, { color: fg }, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
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
  container: { flex: 1 },
  content: { flex: 1 },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e5ea' },
  tabItem: { flex: 1, alignItems: 'center', paddingTop: 8, gap: 2 },
  tabIcon: { fontSize: 18, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11 },
  tabLabelActive: { color: '#007aff', fontWeight: '600' },
});

export default App;
